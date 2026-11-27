-- ============================================================================
-- Web Push Subscriptions, Member Push Preferences & Backend Delivery Log
-- ============================================================================
-- Supports multiple subscribed devices per member, strict own-row isolation,
-- automatic expired subscription pruning by backend Edge Functions, and
-- idempotent single-delivery tracking via push_delivery_log.
-- ============================================================================

ALTER TABLE public.members
  ADD COLUMN IF NOT EXISTS push_enabled BOOLEAN NOT NULL DEFAULT TRUE;

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  user_agent TEXT NOT NULL DEFAULT '',
  device_label TEXT NOT NULL DEFAULT '',
  notifications_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  failure_count INTEGER NOT NULL DEFAULT 0,
  last_success_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_member
  ON public.push_subscriptions(member_id);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_active
  ON public.push_subscriptions(member_id)
  WHERE notifications_enabled = TRUE;

CREATE TABLE IF NOT EXISTS public.push_delivery_log (
  event_key TEXT PRIMARY KEY,
  triggered_by UUID REFERENCES public.members(id) ON DELETE SET NULL,
  event_kind TEXT NOT NULL,
  sent_count INTEGER NOT NULL DEFAULT 0,
  pruned_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Delivery log is strictly backend (service_role Edge Function) only
REVOKE ALL ON public.push_delivery_log FROM anon, authenticated;

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_delivery_log ENABLE ROW LEVEL SECURITY;

-- Members may inspect/manage ONLY their own device subscriptions
DROP POLICY IF EXISTS push_subs_select_own ON public.push_subscriptions;
CREATE POLICY push_subs_select_own
  ON public.push_subscriptions
  FOR SELECT
  USING (public.is_tour_member() AND member_id = public.current_member_id());

DROP POLICY IF EXISTS push_subs_insert_own ON public.push_subscriptions;
CREATE POLICY push_subs_insert_own
  ON public.push_subscriptions
  FOR INSERT
  WITH CHECK (public.is_tour_member() AND member_id = public.current_member_id());

DROP POLICY IF EXISTS push_subs_update_own ON public.push_subscriptions;
CREATE POLICY push_subs_update_own
  ON public.push_subscriptions
  FOR UPDATE
  USING (public.is_tour_member() AND member_id = public.current_member_id())
  WITH CHECK (public.is_tour_member() AND member_id = public.current_member_id());

DROP POLICY IF EXISTS push_subs_delete_own ON public.push_subscriptions;
CREATE POLICY push_subs_delete_own
  ON public.push_subscriptions
  FOR DELETE
  USING (public.is_tour_member() AND member_id = public.current_member_id());

-- ----------------------------------------------------------------------------
-- RPC: Save / Update Current Device Push Subscription (Multi-Device Safe)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.upsert_push_subscription(
  p_endpoint TEXT,
  p_p256dh TEXT,
  p_auth TEXT,
  p_user_agent TEXT DEFAULT '',
  p_device_label TEXT DEFAULT ''
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_member_id UUID;
  v_sub_id UUID;
  v_count INTEGER;
BEGIN
  IF NOT public.is_tour_member() THEN
    RAISE EXCEPTION 'Unauthorized: Active member session required.';
  END IF;
  v_member_id := public.current_member_id();

  IF COALESCE(trim(p_endpoint), '') !~* '^https://' THEN
    RAISE EXCEPTION 'Invalid push subscription endpoint.';
  END IF;
  IF length(trim(COALESCE(p_p256dh, ''))) < 16 OR length(trim(COALESCE(p_auth, ''))) < 8 THEN
    RAISE EXCEPTION 'Invalid push encryption keys.';
  END IF;

  INSERT INTO public.push_subscriptions (
    member_id, endpoint, p256dh, auth, user_agent, device_label,
    notifications_enabled, failure_count, updated_at
  )
  VALUES (
    v_member_id,
    trim(p_endpoint),
    trim(p_p256dh),
    trim(p_auth),
    left(COALESCE(p_user_agent, ''), 200),
    left(COALESCE(p_device_label, ''), 80),
    TRUE,
    0,
    NOW()
  )
  ON CONFLICT (endpoint) DO UPDATE SET
    member_id = v_member_id,
    p256dh = EXCLUDED.p256dh,
    auth = EXCLUDED.auth,
    user_agent = EXCLUDED.user_agent,
    device_label = EXCLUDED.device_label,
    notifications_enabled = TRUE,
    failure_count = 0,
    updated_at = NOW()
  RETURNING id INTO v_sub_id;

  UPDATE public.members
  SET push_enabled = TRUE, updated_at = NOW()
  WHERE id = v_member_id;

  SELECT count(*)::INTEGER INTO v_count
  FROM public.push_subscriptions
  WHERE member_id = v_member_id AND notifications_enabled = TRUE;

  RETURN jsonb_build_object(
    'id', v_sub_id,
    'push_enabled', TRUE,
    'device_count', v_count
  );
END;
$$;

-- ----------------------------------------------------------------------------
-- RPC: Remove Device Push Subscription (Unsubscribe Device or All Devices)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.remove_push_subscription(
  p_endpoint TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_member_id UUID;
  v_deleted INTEGER := 0;
  v_remaining INTEGER := 0;
BEGIN
  IF NOT public.is_tour_member() THEN
    RAISE EXCEPTION 'Unauthorized: Active member session required.';
  END IF;
  v_member_id := public.current_member_id();

  IF p_endpoint IS NOT NULL AND length(trim(p_endpoint)) > 0 THEN
    DELETE FROM public.push_subscriptions
    WHERE member_id = v_member_id AND endpoint = trim(p_endpoint);
  ELSE
    DELETE FROM public.push_subscriptions
    WHERE member_id = v_member_id;
  END IF;

  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  SELECT count(*)::INTEGER INTO v_remaining
  FROM public.push_subscriptions
  WHERE member_id = v_member_id AND notifications_enabled = TRUE;

  RETURN jsonb_build_object(
    'removed', v_deleted,
    'device_count', v_remaining
  );
END;
$$;

-- ----------------------------------------------------------------------------
-- RPC: Update Member Push Preference (Respects User Opt-Out Across Devices)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_member_push_preference(
  p_enabled BOOLEAN
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_member_id UUID;
  v_count INTEGER := 0;
BEGIN
  IF NOT public.is_tour_member() THEN
    RAISE EXCEPTION 'Unauthorized: Active member session required.';
  END IF;
  v_member_id := public.current_member_id();

  UPDATE public.members
  SET push_enabled = COALESCE(p_enabled, TRUE), updated_at = NOW()
  WHERE id = v_member_id;

  UPDATE public.push_subscriptions
  SET notifications_enabled = COALESCE(p_enabled, TRUE), updated_at = NOW()
  WHERE member_id = v_member_id;

  SELECT count(*)::INTEGER INTO v_count
  FROM public.push_subscriptions
  WHERE member_id = v_member_id AND notifications_enabled = TRUE;

  RETURN jsonb_build_object(
    'push_enabled', COALESCE(p_enabled, TRUE),
    'device_count', v_count
  );
END;
$$;

-- ----------------------------------------------------------------------------
-- RPC: Inspect Safe Push Status for Current Member (No Secret Keys Returned)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_my_push_status()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_member_id UUID;
  v_push_enabled BOOLEAN := TRUE;
  v_devices JSONB := '[]'::jsonb;
  v_count INTEGER := 0;
BEGIN
  IF NOT public.is_tour_member() THEN
    RAISE EXCEPTION 'Unauthorized: Active member session required.';
  END IF;
  v_member_id := public.current_member_id();

  SELECT COALESCE(push_enabled, TRUE) INTO v_push_enabled
  FROM public.members
  WHERE id = v_member_id;

  SELECT
    count(*) FILTER (WHERE notifications_enabled = TRUE)::INTEGER,
    COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'id', id,
          'device_label', device_label,
          'enabled', notifications_enabled,
          'endpoint_hint', right(endpoint, 18),
          'updated_at', updated_at
        )
        ORDER BY updated_at DESC
      ),
      '[]'::jsonb
    )
  INTO v_count, v_devices
  FROM public.push_subscriptions
  WHERE member_id = v_member_id;

  RETURN jsonb_build_object(
    'push_enabled', v_push_enabled,
    'device_count', v_count,
    'devices', v_devices
  );
END;
$$;
