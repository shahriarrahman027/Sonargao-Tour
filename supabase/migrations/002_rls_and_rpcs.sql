-- ============================================================================
-- ১ দিনের সস্তায় ট্যুর — Row Level Security, Session Validation & Safe RPCs
-- ============================================================================

-- Revoke direct access on sensitive credential/session tables from client roles
REVOKE ALL ON public.member_credentials FROM anon, authenticated;
REVOKE ALL ON public.admin_credentials FROM anon, authenticated;
REVOKE ALL ON public.auth_sessions FROM anon, authenticated;
REVOKE ALL ON public.auth_rate_limits FROM anon, authenticated;

-- Enable RLS on every table
ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.member_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auth_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auth_rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tour_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_edit_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.itinerary_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checklist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.polls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.poll_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shared_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tour_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fun_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- Session Inspection Helpers (reads x-tour-session HTTP header)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_request_session_token()
RETURNS TEXT
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NULLIF(
    trim(COALESCE((current_setting('request.headers', true)::jsonb ->> 'x-tour-session'), '')),
    ''
  );
$$;

CREATE OR REPLACE FUNCTION public.current_session_row()
RETURNS TABLE (session_id UUID, member_id UUID, is_admin BOOLEAN)
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.id, s.member_id, s.is_admin
  FROM public.auth_sessions s
  JOIN public.members m ON m.id = s.member_id
  WHERE s.session_token_hash = encode(digest(COALESCE(public.get_request_session_token(), ''), 'sha256'), 'hex')
    AND s.revoked_at IS NULL
    AND s.expires_at > NOW()
    AND m.is_active = TRUE
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.current_member_id()
RETURNS UUID
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT member_id FROM public.current_session_row() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.is_tour_member()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.current_session_row());
$$;

CREATE OR REPLACE FUNCTION public.is_tour_admin()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.current_session_row() WHERE is_admin = TRUE
  );
$$;

-- ----------------------------------------------------------------------------
-- Rate Limiting Helper
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.check_and_bump_rate_limit(
  p_key TEXT,
  p_max_attempts INTEGER DEFAULT 8,
  p_window_minutes INTEGER DEFAULT 10
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.auth_rate_limits%ROWTYPE;
BEGIN
  SELECT * INTO v_row FROM public.auth_rate_limits WHERE rate_key = p_key FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO public.auth_rate_limits (rate_key, attempts, window_started_at, locked_until)
    VALUES (p_key, 1, NOW(), NULL);
    RETURN TRUE;
  END IF;

  IF v_row.locked_until IS NOT NULL AND v_row.locked_until > NOW() THEN
    RETURN FALSE;
  END IF;

  IF v_row.window_started_at + (p_window_minutes || ' minutes')::INTERVAL < NOW() THEN
    UPDATE public.auth_rate_limits
    SET attempts = 1, window_started_at = NOW(), locked_until = NULL
    WHERE rate_key = p_key;
    RETURN TRUE;
  END IF;

  IF v_row.attempts + 1 > p_max_attempts THEN
    UPDATE public.auth_rate_limits
    SET attempts = v_row.attempts + 1,
        locked_until = NOW() + (p_window_minutes || ' minutes')::INTERVAL
    WHERE rate_key = p_key;
    RETURN FALSE;
  END IF;

  UPDATE public.auth_rate_limits
  SET attempts = v_row.attempts + 1
  WHERE rate_key = p_key;
  RETURN TRUE;
END;
$$;

-- ----------------------------------------------------------------------------
-- Public Pre-Login Gate Info (Only non-sensitive settings; no group data!)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_gate_status()
RETURNS JSONB
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'website_name_bn', ts.website_name_bn,
    'website_name_en', ts.website_name_en,
    'tagline_bn', ts.tagline_bn,
    'tagline_en', ts.tagline_en,
    'require_group_passcode', ts.require_group_passcode
  )
  FROM public.tour_settings ts
  WHERE ts.id = 1;
$$;

-- ----------------------------------------------------------------------------
-- Member Login via DIU Student ID (+ optional group passcode)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.verify_member_access(
  p_student_id TEXT,
  p_group_passcode TEXT DEFAULT NULL,
  p_client_hint TEXT DEFAULT 'web'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_clean_id TEXT;
  v_id_hash TEXT;
  v_member public.members%ROWTYPE;
  v_settings public.tour_settings%ROWTYPE;
  v_raw_token TEXT;
  v_token_hash TEXT;
  v_expires TIMESTAMPTZ;
BEGIN
  IF NOT public.check_and_bump_rate_limit('login:' || COALESCE(p_client_hint, 'web'), 10, 10) THEN
    RAISE EXCEPTION 'Too many login attempts. Please wait 10 minutes.';
  END IF;

  v_clean_id := upper(regexp_replace(COALESCE(p_student_id, ''), '\s+', '', 'g'));
  IF length(v_clean_id) < 5 THEN
    RAISE EXCEPTION 'Invalid DIU student ID.';
  END IF;

  SELECT * INTO v_settings FROM public.tour_settings WHERE id = 1;

  IF v_settings.require_group_passcode THEN
    IF COALESCE(p_group_passcode, '') = '' OR v_settings.group_passcode_hash IS NULL OR
       crypt(p_group_passcode, v_settings.group_passcode_hash) <> v_settings.group_passcode_hash THEN
      RAISE EXCEPTION 'Incorrect group passcode.';
    END IF;
  END IF;

  v_id_hash := encode(digest(v_clean_id, 'sha256'), 'hex');

  SELECT m.* INTO v_member
  FROM public.member_credentials mc
  JOIN public.members m ON m.id = mc.member_id
  WHERE mc.student_id_hash = v_id_hash
    AND m.is_active = TRUE
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Unauthorized student ID.';
  END IF;

  -- Reset login rate limit on success
  DELETE FROM public.auth_rate_limits WHERE rate_key = 'login:' || COALESCE(p_client_hint, 'web');

  v_raw_token := encode(gen_random_bytes(32), 'hex');
  v_token_hash := encode(digest(v_raw_token, 'sha256'), 'hex');
  v_expires := NOW() + INTERVAL '14 days';

  INSERT INTO public.auth_sessions (member_id, session_token_hash, is_admin, expires_at, client_hint)
  VALUES (v_member.id, v_token_hash, FALSE, v_expires, p_client_hint);

  RETURN jsonb_build_object(
    'token', v_raw_token,
    'is_admin', FALSE,
    'expires_at', v_expires,
    'member', to_jsonb(v_member)
  );
END;
$$;

-- ----------------------------------------------------------------------------
-- Admin Elevation (Shahriar only, password checked via pgcrypto bcrypt)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.elevate_admin_session(p_password TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session_id UUID;
  v_member_id UUID;
  v_role TEXT;
  v_hash TEXT;
BEGIN
  SELECT s.session_id, s.member_id INTO v_session_id, v_member_id
  FROM public.current_session_row() s LIMIT 1;

  IF v_session_id IS NULL THEN
    RAISE EXCEPTION 'Active member session required.';
  END IF;

  IF NOT public.check_and_bump_rate_limit('admin:' || v_member_id::TEXT, 5, 15) THEN
    RAISE EXCEPTION 'Too many admin attempts. Locked for 15 minutes.';
  END IF;

  SELECT role INTO v_role FROM public.members WHERE id = v_member_id;
  IF v_role <> 'admin' THEN
    RAISE EXCEPTION 'Only the designated treasurer/admin can unlock admin mode.';
  END IF;

  SELECT password_hash INTO v_hash FROM public.admin_credentials WHERE member_id = v_member_id;
  IF v_hash IS NULL OR crypt(COALESCE(p_password, ''), v_hash) <> v_hash THEN
    RAISE EXCEPTION 'Incorrect admin password.';
  END IF;

  DELETE FROM public.auth_rate_limits WHERE rate_key = 'admin:' || v_member_id::TEXT;

  UPDATE public.auth_sessions SET is_admin = TRUE, last_seen_at = NOW() WHERE id = v_session_id;

  INSERT INTO public.activity_log (actor_member_id, action_type, entity_type, entity_id, summary_bn, summary_en)
  VALUES (v_member_id, 'admin_elevated', 'session', v_session_id::TEXT,
          'শাহরিয়ার অ্যাডমিন ড্যাশবোর্ড আনলক করেছেন', 'Shahriar unlocked Admin Dashboard');

  RETURN jsonb_build_object('is_admin', TRUE);
END;
$$;

-- Revoke current session (logout)
CREATE OR REPLACE FUNCTION public.logout_tour_session()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session_id UUID;
BEGIN
  SELECT session_id INTO v_session_id FROM public.current_session_row() LIMIT 1;
  IF v_session_id IS NOT NULL THEN
    UPDATE public.auth_sessions SET revoked_at = NOW() WHERE id = v_session_id;
  END IF;
END;
$$;

-- Validate current session on reload
CREATE OR REPLACE FUNCTION public.get_current_session_info()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_s RECORD;
  v_m public.members%ROWTYPE;
BEGIN
  SELECT * INTO v_s FROM public.current_session_row() LIMIT 1;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;
  SELECT * INTO v_m FROM public.members WHERE id = v_s.member_id;
  RETURN jsonb_build_object(
    'is_admin', v_s.is_admin,
    'member', to_jsonb(v_m)
  );
END;
$$;

-- ----------------------------------------------------------------------------
-- Transaction-Safe Financial RPCs (Enforces Admin + Exact Allocation Sum)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.record_contribution(
  p_member_id UUID,
  p_amount NUMERIC,
  p_payment_method TEXT DEFAULT 'Cash',
  p_notes TEXT DEFAULT '',
  p_reference_code TEXT DEFAULT '',
  p_contributed_at TIMESTAMPTZ DEFAULT NOW(),
  p_is_correction BOOLEAN DEFAULT FALSE,
  p_corrects_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_id UUID;
  v_new_id UUID;
  v_member_name TEXT;
BEGIN
  IF NOT public.is_tour_admin() THEN
    RAISE EXCEPTION 'Forbidden: Admin privileges required.';
  END IF;
  v_admin_id := public.current_member_id();

  IF p_amount IS NULL OR p_amount = 0 THEN
    RAISE EXCEPTION 'Contribution amount cannot be zero.';
  END IF;

  SELECT name_en INTO v_member_name FROM public.members WHERE id = p_member_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Member not found.';
  END IF;

  INSERT INTO public.contributions (
    member_id, amount, payment_method, contributed_at, notes, reference_code,
    is_correction, corrects_id, created_by
  )
  VALUES (
    p_member_id, round(p_amount, 2), p_payment_method, p_contributed_at,
    COALESCE(p_notes, ''), COALESCE(p_reference_code, ''),
    p_is_correction, p_corrects_id, v_admin_id
  )
  RETURNING id INTO v_new_id;

  INSERT INTO public.activity_log (
    actor_member_id, action_type, entity_type, entity_id, summary_bn, summary_en, metadata
  )
  VALUES (
    v_admin_id,
    CASE WHEN p_is_correction THEN 'contribution_correction' ELSE 'contribution_recorded' END,
    'contribution',
    v_new_id::TEXT,
    format('%s-এর ৳%s জমা রেকর্ড করা হয়েছে', v_member_name, round(p_amount, 2)),
    format('Recorded ৳%s contribution for %s', round(p_amount, 2), v_member_name),
    jsonb_build_object('member_id', p_member_id, 'amount', round(p_amount, 2))
  );

  RETURN v_new_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_expense_with_allocations(
  p_title TEXT,
  p_category TEXT,
  p_total_amount NUMERIC,
  p_funding_source TEXT,
  p_allocation_mode TEXT,
  p_allocations JSONB, -- [{ "member_id": uuid, "allocated_amount": number, "note": text }]
  p_items JSONB DEFAULT '[]'::jsonb, -- [{ "member_id": uuid|null, "item_name": text, "quantity": int, "unit_price": number, "line_total": number }]
  p_payer_member_id UUID DEFAULT NULL,
  p_description TEXT DEFAULT '',
  p_receipt_url TEXT DEFAULT NULL,
  p_expense_at TIMESTAMPTZ DEFAULT NOW()
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_id UUID;
  v_expense_id UUID;
  v_alloc_sum NUMERIC(12,2) := 0;
  v_elem JSONB;
BEGIN
  IF NOT public.is_tour_admin() THEN
    RAISE EXCEPTION 'Forbidden: Admin privileges required.';
  END IF;
  v_admin_id := public.current_member_id();

  IF p_total_amount IS NULL OR p_total_amount <= 0 THEN
    RAISE EXCEPTION 'Total expense amount must be positive.';
  END IF;

  IF p_allocations IS NULL OR jsonb_array_length(p_allocations) = 0 THEN
    RAISE EXCEPTION 'At least one participant allocation is required.';
  END IF;

  SELECT COALESCE(SUM((x->>'allocated_amount')::NUMERIC), 0)
  INTO v_alloc_sum
  FROM jsonb_array_elements(p_allocations) x;

  IF round(v_alloc_sum, 2) <> round(p_total_amount, 2) THEN
    RAISE EXCEPTION 'Allocation sum (৳%) does not match expense total (৳%).', round(v_alloc_sum, 2), round(p_total_amount, 2);
  END IF;

  INSERT INTO public.expenses (
    title, category, expense_at, total_amount, description, payer_member_id,
    funding_source, allocation_mode, receipt_url, created_by
  )
  VALUES (
    p_title, p_category, p_expense_at, round(p_total_amount, 2), COALESCE(p_description, ''),
    p_payer_member_id, p_funding_source, p_allocation_mode, p_receipt_url, v_admin_id
  )
  RETURNING id INTO v_expense_id;

  FOR v_elem IN SELECT * FROM jsonb_array_elements(p_allocations)
  LOOP
    INSERT INTO public.expense_allocations (expense_id, member_id, allocated_amount, note)
    VALUES (
      v_expense_id,
      (v_elem->>'member_id')::UUID,
      round((v_elem->>'allocated_amount')::NUMERIC, 2),
      COALESCE(v_elem->>'note', '')
    );
  END LOOP;

  IF p_items IS NOT NULL AND jsonb_array_length(p_items) > 0 THEN
    FOR v_elem IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
      INSERT INTO public.expense_items (expense_id, member_id, item_name, quantity, unit_price, line_total)
      VALUES (
        v_expense_id,
        NULLIF(v_elem->>'member_id', '')::UUID,
        v_elem->>'item_name',
        COALESCE((v_elem->>'quantity')::INTEGER, 1),
        round((v_elem->>'unit_price')::NUMERIC, 2),
        round((v_elem->>'line_total')::NUMERIC, 2)
      );
    END LOOP;
  END IF;

  INSERT INTO public.activity_log (
    actor_member_id, action_type, entity_type, entity_id, summary_bn, summary_en, metadata
  )
  VALUES (
    v_admin_id, 'expense_created', 'expense', v_expense_id::TEXT,
    format('নতুন খরচ যোগ হয়েছে: %s (৳%s)', p_title, round(p_total_amount, 2)),
    format('Added expense: %s (৳%s)', p_title, round(p_total_amount, 2)),
    jsonb_build_object('category', p_category, 'total_amount', round(p_total_amount, 2), 'funding_source', p_funding_source)
  );

  RETURN v_expense_id;
END;
$$;

-- Update Expense with Mandatory Audit History Snapshot
CREATE OR REPLACE FUNCTION public.update_expense_with_audit(
  p_expense_id UUID,
  p_reason TEXT,
  p_title TEXT,
  p_category TEXT,
  p_total_amount NUMERIC,
  p_funding_source TEXT,
  p_allocation_mode TEXT,
  p_allocations JSONB,
  p_items JSONB DEFAULT '[]'::jsonb,
  p_payer_member_id UUID DEFAULT NULL,
  p_description TEXT DEFAULT '',
  p_is_reimbursed BOOLEAN DEFAULT FALSE
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_id UUID;
  v_prev_exp public.expenses%ROWTYPE;
  v_prev_allocs JSONB;
  v_alloc_sum NUMERIC(12,2);
  v_elem JSONB;
BEGIN
  IF NOT public.is_tour_admin() THEN
    RAISE EXCEPTION 'Forbidden: Admin privileges required.';
  END IF;
  v_admin_id := public.current_member_id();

  IF trim(COALESCE(p_reason, '')) = '' THEN
    RAISE EXCEPTION 'Edit reason is required for audit trail.';
  END IF;

  SELECT * INTO v_prev_exp FROM public.expenses WHERE id = p_expense_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Expense not found.';
  END IF;

  SELECT COALESCE(SUM((x->>'allocated_amount')::NUMERIC), 0)
  INTO v_alloc_sum
  FROM jsonb_array_elements(p_allocations) x;

  IF round(v_alloc_sum, 2) <> round(p_total_amount, 2) THEN
    RAISE EXCEPTION 'Allocation sum (৳%) does not match expense total (৳%).', round(v_alloc_sum, 2), round(p_total_amount, 2);
  END IF;

  SELECT COALESCE(jsonb_agg(to_jsonb(a)), '[]'::jsonb)
  INTO v_prev_allocs
  FROM public.expense_allocations a WHERE a.expense_id = p_expense_id;

  INSERT INTO public.expense_edit_history (expense_id, edited_by, reason, previous_snapshot, new_snapshot)
  VALUES (
    p_expense_id,
    v_admin_id,
    p_reason,
    jsonb_build_object('expense', to_jsonb(v_prev_exp), 'allocations', v_prev_allocs),
    jsonb_build_object('title', p_title, 'category', p_category, 'total_amount', round(p_total_amount, 2), 'allocations', p_allocations)
  );

  UPDATE public.expenses
  SET title = p_title,
      category = p_category,
      total_amount = round(p_total_amount, 2),
      funding_source = p_funding_source,
      allocation_mode = p_allocation_mode,
      payer_member_id = p_payer_member_id,
      description = COALESCE(p_description, ''),
      is_reimbursed = p_is_reimbursed,
      updated_at = NOW()
  WHERE id = p_expense_id;

  DELETE FROM public.expense_allocations WHERE expense_id = p_expense_id;
  FOR v_elem IN SELECT * FROM jsonb_array_elements(p_allocations)
  LOOP
    INSERT INTO public.expense_allocations (expense_id, member_id, allocated_amount, note)
    VALUES (
      p_expense_id,
      (v_elem->>'member_id')::UUID,
      round((v_elem->>'allocated_amount')::NUMERIC, 2),
      COALESCE(v_elem->>'note', '')
    );
  END LOOP;

  DELETE FROM public.expense_items WHERE expense_id = p_expense_id;
  IF p_items IS NOT NULL AND jsonb_array_length(p_items) > 0 THEN
    FOR v_elem IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
      INSERT INTO public.expense_items (expense_id, member_id, item_name, quantity, unit_price, line_total)
      VALUES (
        p_expense_id,
        NULLIF(v_elem->>'member_id', '')::UUID,
        v_elem->>'item_name',
        COALESCE((v_elem->>'quantity')::INTEGER, 1),
        round((v_elem->>'unit_price')::NUMERIC, 2),
        round((v_elem->>'line_total')::NUMERIC, 2)
      );
    END LOOP;
  END IF;

  INSERT INTO public.activity_log (
    actor_member_id, action_type, entity_type, entity_id, summary_bn, summary_en, metadata
  )
  VALUES (
    v_admin_id, 'expense_edited', 'expense', p_expense_id::TEXT,
    format('খরচ সংশোধন: %s (%s)', p_title, p_reason),
    format('Edited expense %s: %s', p_title, p_reason),
    jsonb_build_object('reason', p_reason, 'new_total', round(p_total_amount, 2))
  );
END;
$$;

-- Admin Passcode / Group Passcode Update Helper
CREATE OR REPLACE FUNCTION public.update_group_passcode(
  p_require BOOLEAN,
  p_new_passcode TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_tour_admin() THEN
    RAISE EXCEPTION 'Forbidden: Admin privileges required.';
  END IF;

  UPDATE public.tour_settings
  SET require_group_passcode = p_require,
      group_passcode_hash = CASE
        WHEN p_require AND COALESCE(p_new_passcode, '') <> '' THEN crypt(p_new_passcode, gen_salt('bf'))
        WHEN NOT p_require THEN NULL
        ELSE group_passcode_hash
      END,
      updated_at = NOW()
  WHERE id = 1;
END;
$$;

-- Void / Reverse Expense with Mandatory Audit Trail (Never silently delete)
CREATE OR REPLACE FUNCTION public.void_expense_with_audit(
  p_expense_id UUID,
  p_reason TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_id UUID;
  v_prev_exp public.expenses%ROWTYPE;
BEGIN
  IF NOT public.is_tour_admin() THEN
    RAISE EXCEPTION 'Forbidden: Admin privileges required.';
  END IF;
  v_admin_id := public.current_member_id();

  IF trim(COALESCE(p_reason, '')) = '' THEN
    RAISE EXCEPTION 'Void reason is required for audit trail.';
  END IF;

  SELECT * INTO v_prev_exp FROM public.expenses WHERE id = p_expense_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Expense not found.';
  END IF;
  IF v_prev_exp.voided_by_correction THEN
    RAISE EXCEPTION 'Expense is already voided.';
  END IF;

  INSERT INTO public.expense_edit_history (expense_id, edited_by, reason, previous_snapshot, new_snapshot)
  VALUES (
    p_expense_id,
    v_admin_id,
    'VOIDED: ' || p_reason,
    to_jsonb(v_prev_exp),
    jsonb_build_object('voided_by_correction', TRUE, 'reason', p_reason)
  );

  UPDATE public.expenses
  SET voided_by_correction = TRUE,
      updated_at = NOW()
  WHERE id = p_expense_id;

  INSERT INTO public.activity_log (
    actor_member_id, action_type, entity_type, entity_id, summary_bn, summary_en, metadata
  )
  VALUES (
    v_admin_id, 'expense_voided', 'expense', p_expense_id::TEXT,
    format('খরচ বাতিল/সংশোধন: %s (%s)', v_prev_exp.title, p_reason),
    format('Voided expense %s: %s', v_prev_exp.title, p_reason),
    jsonb_build_object('reason', p_reason, 'amount', v_prev_exp.total_amount)
  );
END;
$$;

-- ----------------------------------------------------------------------------
-- Row Level Security Policies
-- ----------------------------------------------------------------------------

-- Members: all active tour members can view; admin can edit any, members can update own nickname/bio/avatar
CREATE POLICY members_select ON public.members FOR SELECT USING (public.is_tour_member());
CREATE POLICY members_admin_all ON public.members FOR ALL USING (public.is_tour_admin()) WITH CHECK (public.is_tour_admin());
CREATE POLICY members_self_update ON public.members FOR UPDATE
  USING (id = public.current_member_id())
  WITH CHECK (id = public.current_member_id() AND role = (SELECT m.role FROM public.members m WHERE m.id = public.current_member_id()));

-- Tour settings: members read; admin write
CREATE POLICY settings_select ON public.tour_settings FOR SELECT USING (public.is_tour_member());
CREATE POLICY settings_admin_write ON public.tour_settings FOR ALL USING (public.is_tour_admin()) WITH CHECK (public.is_tour_admin());

-- Financial tables: members READ ONLY; ONLY admin can write (and ideally via RPCs)
CREATE POLICY contrib_select ON public.contributions FOR SELECT USING (public.is_tour_member());
CREATE POLICY contrib_admin_write ON public.contributions FOR ALL USING (public.is_tour_admin()) WITH CHECK (public.is_tour_admin());

CREATE POLICY expenses_select ON public.expenses FOR SELECT USING (public.is_tour_member());
CREATE POLICY expenses_admin_write ON public.expenses FOR ALL USING (public.is_tour_admin()) WITH CHECK (public.is_tour_admin());

CREATE POLICY expense_items_select ON public.expense_items FOR SELECT USING (public.is_tour_member());
CREATE POLICY expense_items_admin_write ON public.expense_items FOR ALL USING (public.is_tour_admin()) WITH CHECK (public.is_tour_admin());

CREATE POLICY allocations_select ON public.expense_allocations FOR SELECT USING (public.is_tour_member());
CREATE POLICY allocations_admin_write ON public.expense_allocations FOR ALL USING (public.is_tour_admin()) WITH CHECK (public.is_tour_admin());

CREATE POLICY edit_hist_select ON public.expense_edit_history FOR SELECT USING (public.is_tour_member());
CREATE POLICY edit_hist_admin_insert ON public.expense_edit_history FOR INSERT WITH CHECK (public.is_tour_admin());

-- Itinerary & Tour Progress: members read, admin write
CREATE POLICY itinerary_select ON public.itinerary_items FOR SELECT USING (public.is_tour_member());
CREATE POLICY itinerary_admin_write ON public.itinerary_items FOR ALL USING (public.is_tour_admin()) WITH CHECK (public.is_tour_admin());

CREATE POLICY progress_select ON public.tour_progress FOR SELECT USING (public.is_tour_member());
CREATE POLICY progress_admin_write ON public.tour_progress FOR ALL USING (public.is_tour_admin()) WITH CHECK (public.is_tour_admin());

-- Checklist: members read, insert, toggle own/group; admin full control
CREATE POLICY checklist_select ON public.checklist_items FOR SELECT USING (public.is_tour_member());
CREATE POLICY checklist_member_insert ON public.checklist_items FOR INSERT WITH CHECK (public.is_tour_member());
CREATE POLICY checklist_member_update ON public.checklist_items FOR UPDATE
  USING (public.is_tour_admin() OR owner_member_id IS NULL OR owner_member_id = public.current_member_id());
CREATE POLICY checklist_admin_delete ON public.checklist_items FOR DELETE
  USING (public.is_tour_admin() OR owner_member_id = public.current_member_id());

-- Polls, options, votes
CREATE POLICY polls_select ON public.polls FOR SELECT USING (public.is_tour_member());
CREATE POLICY polls_member_insert ON public.polls FOR INSERT WITH CHECK (public.is_tour_member() AND created_by = public.current_member_id());
CREATE POLICY polls_admin_write ON public.polls FOR ALL USING (public.is_tour_admin()) WITH CHECK (public.is_tour_admin());

CREATE POLICY poll_options_select ON public.poll_options FOR SELECT USING (public.is_tour_member());
CREATE POLICY poll_options_insert ON public.poll_options FOR INSERT WITH CHECK (public.is_tour_member());
CREATE POLICY poll_options_admin ON public.poll_options FOR ALL USING (public.is_tour_admin()) WITH CHECK (public.is_tour_admin());

CREATE POLICY votes_select ON public.votes FOR SELECT USING (public.is_tour_member());
CREATE POLICY votes_member_insert ON public.votes FOR INSERT
  WITH CHECK (
    public.is_tour_member()
    AND member_id = public.current_member_id()
    AND EXISTS (SELECT 1 FROM public.polls p WHERE p.id = poll_id AND p.is_closed = FALSE)
  );
CREATE POLICY votes_member_delete ON public.votes FOR DELETE
  USING (
    public.is_tour_admin()
    OR (
      member_id = public.current_member_id()
      AND EXISTS (SELECT 1 FROM public.polls p WHERE p.id = poll_id AND p.is_closed = FALSE)
    )
  );

-- Shared Notes
CREATE POLICY notes_select ON public.shared_notes FOR SELECT USING (public.is_tour_member());
CREATE POLICY notes_member_insert ON public.shared_notes FOR INSERT
  WITH CHECK (
    public.is_tour_member()
    AND author_id = public.current_member_id()
    AND (is_pinned = FALSE OR public.is_tour_admin())
  );
CREATE POLICY notes_member_update ON public.shared_notes FOR UPDATE
  USING (public.is_tour_admin() OR author_id = public.current_member_id())
  WITH CHECK (public.is_tour_admin() OR (author_id = public.current_member_id() AND is_pinned = FALSE));
CREATE POLICY notes_member_delete ON public.shared_notes FOR DELETE
  USING (public.is_tour_admin() OR author_id = public.current_member_id());

-- Photos
CREATE POLICY photos_select ON public.photos FOR SELECT USING (public.is_tour_member());
CREATE POLICY photos_member_insert ON public.photos FOR INSERT WITH CHECK (public.is_tour_member() AND uploaded_by = public.current_member_id());
CREATE POLICY photos_admin_delete ON public.photos FOR DELETE USING (public.is_tour_admin() OR uploaded_by = public.current_member_id());

-- Badges & Fun Events & Activity Log
CREATE POLICY badges_select ON public.badges FOR SELECT USING (public.is_tour_member());
CREATE POLICY badges_admin_write ON public.badges FOR ALL USING (public.is_tour_admin()) WITH CHECK (public.is_tour_admin());

CREATE POLICY fun_events_select ON public.fun_events FOR SELECT USING (public.is_tour_member());
CREATE POLICY fun_events_insert ON public.fun_events FOR INSERT WITH CHECK (public.is_tour_member());
CREATE POLICY fun_events_update ON public.fun_events FOR UPDATE USING (public.is_tour_member());

CREATE POLICY activity_log_select ON public.activity_log FOR SELECT USING (public.is_tour_member());
CREATE POLICY activity_log_insert ON public.activity_log FOR INSERT WITH CHECK (public.is_tour_member());
