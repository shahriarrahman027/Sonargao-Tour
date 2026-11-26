-- ============================================================================
-- ১ দিনের সস্তায় ট্যুর — Complete Normalized PostgreSQL Schema (Supabase Free)
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. Members (Publicly safe profile table; NEVER stores student IDs)
CREATE TABLE IF NOT EXISTS public.members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name_en TEXT NOT NULL,
  name_bn TEXT NOT NULL,
  nickname_en TEXT NOT NULL,
  nickname_bn TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  avatar_url TEXT,
  bio_en TEXT DEFAULT '',
  bio_bn TEXT DEFAULT '',
  badge_title_en TEXT DEFAULT '',
  badge_title_bn TEXT DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Private Member Credentials (SHA-256 hashed DIU student IDs; NO client SELECT)
CREATE TABLE IF NOT EXISTS public.member_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL UNIQUE REFERENCES public.members(id) ON DELETE CASCADE,
  student_id_hash TEXT NOT NULL UNIQUE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Private Admin Credentials (bcrypt hashed password via pgcrypto; NO client SELECT)
CREATE TABLE IF NOT EXISTS public.admin_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL UNIQUE REFERENCES public.members(id) ON DELETE CASCADE,
  password_hash TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Authorized Access Sessions (Token hash stored; raw token only given once on login)
CREATE TABLE IF NOT EXISTS public.auth_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  session_token_hash TEXT NOT NULL UNIQUE,
  is_admin BOOLEAN NOT NULL DEFAULT FALSE,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  client_hint TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_auth_sessions_token_hash ON public.auth_sessions(session_token_hash);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_member_id ON public.auth_sessions(member_id);

-- 5. Rate Limiting Buckets for Login & Admin Elevation
CREATE TABLE IF NOT EXISTS public.auth_rate_limits (
  rate_key TEXT PRIMARY KEY,
  attempts INTEGER NOT NULL DEFAULT 0,
  window_started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  locked_until TIMESTAMPTZ
);

-- 6. Tour Settings (Single-row configuration editable by admin)
CREATE TABLE IF NOT EXISTS public.tour_settings (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  website_name_bn TEXT NOT NULL DEFAULT '১ দিনের সস্তায় ট্যুর',
  website_name_en TEXT NOT NULL DEFAULT 'Ek Diner Sostay Tour',
  tagline_bn TEXT NOT NULL DEFAULT 'প্ল্যান ক্যানসেল না হইলেই হয়।',
  tagline_en TEXT NOT NULL DEFAULT 'As long as the plan doesn''t get cancelled.',
  tour_date TIMESTAMPTZ NOT NULL DEFAULT '2026-11-28T06:30:00+06:00',
  start_location_bn TEXT NOT NULL DEFAULT 'সিঅ্যান্ডবি, সাভার',
  start_location_en TEXT NOT NULL DEFAULT 'C&B, Savar',
  destinations_bn TEXT NOT NULL DEFAULT 'পানাম নগর, সোনারগাঁও এবং সন্ধ্যায় পুরান ঢাকা',
  destinations_en TEXT NOT NULL DEFAULT 'Panam Nagar, Sonargaon & Puran Dhaka in the evening',
  estimated_budget_per_person NUMERIC(12,2) NOT NULL DEFAULT 1000.00 CHECK (estimated_budget_per_person >= 0),
  target_contribution_per_person NUMERIC(12,2) NOT NULL DEFAULT 1000.00 CHECK (target_contribution_per_person >= 0),
  budget_warning_threshold_pct INTEGER NOT NULL DEFAULT 85 CHECK (budget_warning_threshold_pct BETWEEN 10 AND 100),
  announcement_bn TEXT DEFAULT '',
  announcement_en TEXT DEFAULT '',
  require_group_passcode BOOLEAN NOT NULL DEFAULT FALSE,
  group_passcode_hash TEXT,
  ambient_sound_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  hero_video_url TEXT DEFAULT '',
  hero_fallback_image_url TEXT DEFAULT '/images/panam-hero.svg',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. Contributions (Cash collected from members; admin-only writes)
CREATE TABLE IF NOT EXISTS public.contributions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE RESTRICT,
  amount NUMERIC(12,2) NOT NULL CHECK (amount <> 0),
  payment_method TEXT NOT NULL DEFAULT 'Cash' CHECK (payment_method IN ('Cash', 'Adjustment')),
  contributed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notes TEXT DEFAULT '',
  reference_code TEXT DEFAULT '',
  is_correction BOOLEAN NOT NULL DEFAULT FALSE,
  corrects_id UUID REFERENCES public.contributions(id),
  created_by UUID NOT NULL REFERENCES public.members(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contributions_member ON public.contributions(member_id);
CREATE INDEX IF NOT EXISTS idx_contributions_date ON public.contributions(contributed_at DESC);

-- 8. Expenses (Group cash or personal payer; allocations must sum to total_amount)
CREATE TABLE IF NOT EXISTS public.expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN (
    'Transport', 'Food', 'Tickets', 'Shopping', 'Accommodation', 'Miscellaneous', 'Other'
  )),
  expense_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  total_amount NUMERIC(12,2) NOT NULL CHECK (total_amount <> 0),
  description TEXT DEFAULT '',
  payer_member_id UUID REFERENCES public.members(id),
  funding_source TEXT NOT NULL DEFAULT 'group_cash' CHECK (funding_source IN ('group_cash', 'personal_payer')),
  allocation_mode TEXT NOT NULL DEFAULT 'equal' CHECK (allocation_mode IN ('equal', 'custom')),
  receipt_url TEXT,
  is_reimbursed BOOLEAN NOT NULL DEFAULT FALSE,
  is_correction BOOLEAN NOT NULL DEFAULT FALSE,
  corrects_expense_id UUID REFERENCES public.expenses(id),
  voided_by_correction BOOLEAN NOT NULL DEFAULT FALSE,
  created_by UUID NOT NULL REFERENCES public.members(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_expenses_date ON public.expenses(expense_at DESC);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON public.expenses(category);

-- 9. Expense Items (Line items under a single bill, e.g., individual restaurant orders)
CREATE TABLE IF NOT EXISTS public.expense_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_id UUID NOT NULL REFERENCES public.expenses(id) ON DELETE CASCADE,
  member_id UUID REFERENCES public.members(id),
  item_name TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_price NUMERIC(12,2) NOT NULL,
  line_total NUMERIC(12,2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_expense_items_expense ON public.expense_items(expense_id);

-- 10. Expense Allocations (Exact share per participating member)
CREATE TABLE IF NOT EXISTS public.expense_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_id UUID NOT NULL REFERENCES public.expenses(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE RESTRICT,
  allocated_amount NUMERIC(12,2) NOT NULL,
  note TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (expense_id, member_id)
);

CREATE INDEX IF NOT EXISTS idx_allocations_expense ON public.expense_allocations(expense_id);
CREATE INDEX IF NOT EXISTS idx_allocations_member ON public.expense_allocations(member_id);

-- 11. Expense Edit History (Immutable audit log for any modification)
CREATE TABLE IF NOT EXISTS public.expense_edit_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_id UUID NOT NULL REFERENCES public.expenses(id) ON DELETE CASCADE,
  edited_by UUID NOT NULL REFERENCES public.members(id),
  reason TEXT NOT NULL,
  previous_snapshot JSONB NOT NULL,
  new_snapshot JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 12. Itinerary Items
CREATE TABLE IF NOT EXISTS public.itinerary_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sort_order INTEGER NOT NULL DEFAULT 0,
  time_label TEXT NOT NULL,
  duration_label TEXT DEFAULT '',
  title_bn TEXT NOT NULL,
  title_en TEXT NOT NULL,
  location_bn TEXT NOT NULL,
  location_en TEXT NOT NULL,
  activity_bn TEXT NOT NULL,
  activity_en TEXT NOT NULL,
  transport_bn TEXT DEFAULT '',
  transport_en TEXT DEFAULT '',
  estimated_cost NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (estimated_cost >= 0),
  notes_bn TEXT DEFAULT '',
  notes_en TEXT DEFAULT '',
  image_url TEXT DEFAULT '',
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  segment_type TEXT NOT NULL DEFAULT 'destination' CHECK (segment_type IN ('departure', 'transit', 'destination', 'food', 'return')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 13. Checklist Items (Shared Group + Personal Packing)
CREATE TABLE IF NOT EXISTS public.checklist_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scope TEXT NOT NULL DEFAULT 'group' CHECK (scope IN ('group', 'personal')),
  title_bn TEXT NOT NULL,
  title_en TEXT NOT NULL,
  responsible_member_id UUID REFERENCES public.members(id) ON DELETE SET NULL,
  owner_member_id UUID REFERENCES public.members(id) ON DELETE CASCADE,
  is_completed BOOLEAN NOT NULL DEFAULT FALSE,
  due_label TEXT DEFAULT '',
  completed_at TIMESTAMPTZ,
  created_by UUID REFERENCES public.members(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 14. Polls, Options, Votes
CREATE TABLE IF NOT EXISTS public.polls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_bn TEXT NOT NULL,
  question_en TEXT NOT NULL,
  description_bn TEXT DEFAULT '',
  description_en TEXT DEFAULT '',
  deadline TIMESTAMPTZ,
  is_closed BOOLEAN NOT NULL DEFAULT FALSE,
  allow_multiple BOOLEAN NOT NULL DEFAULT FALSE,
  created_by UUID NOT NULL REFERENCES public.members(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.poll_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id UUID NOT NULL REFERENCES public.polls(id) ON DELETE CASCADE,
  label_bn TEXT NOT NULL,
  label_en TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id UUID NOT NULL REFERENCES public.polls(id) ON DELETE CASCADE,
  option_id UUID NOT NULL REFERENCES public.poll_options(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (poll_id, member_id, option_id)
);

-- 15. Shared Notes
CREATE TABLE IF NOT EXISTS public.shared_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  title TEXT DEFAULT '',
  content TEXT NOT NULL,
  is_pinned BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 16. Photos & Memories
CREATE TABLE IF NOT EXISTS public.photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  uploaded_by UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  public_url TEXT NOT NULL,
  caption TEXT DEFAULT '',
  tags TEXT[] NOT NULL DEFAULT '{}',
  taken_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 17. Live Tour Progress
CREATE TABLE IF NOT EXISTS public.tour_progress (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  current_stage_index INTEGER NOT NULL DEFAULT 0,
  current_stage_bn TEXT NOT NULL DEFAULT 'প্রস্তুতি পর্ব',
  current_stage_en TEXT NOT NULL DEFAULT 'Preparation Stage',
  current_location_bn TEXT NOT NULL DEFAULT 'সাভার (যাত্রার অপেক্ষা)',
  current_location_en TEXT NOT NULL DEFAULT 'Savar (Awaiting Departure)',
  current_activity_bn TEXT NOT NULL DEFAULT 'বাজেট সংগ্রহ ও চেকলিস্ট চূড়ান্ত করা',
  current_activity_en TEXT NOT NULL DEFAULT 'Collecting cash fund & finalizing checklist',
  next_destination_bn TEXT NOT NULL DEFAULT 'সিঅ্যান্ডবি বাস স্ট্যান্ড, সাভার',
  next_destination_en TEXT NOT NULL DEFAULT 'C&B Bus Stand, Savar',
  updated_by UUID REFERENCES public.members(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 18. Member Badges & Fun Milestones
CREATE TABLE IF NOT EXISTS public.badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  title_bn TEXT NOT NULL,
  title_en TEXT NOT NULL,
  description_bn TEXT DEFAULT '',
  description_en TEXT DEFAULT '',
  icon TEXT NOT NULL DEFAULT 'award',
  awarded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (member_id, code)
);

-- 19. Fun Zone Fair-Picker History (Prevents picking same person repeatedly)
CREATE TABLE IF NOT EXISTS public.fun_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL CHECK (event_type IN ('snack_picker', 'challenge')),
  selected_member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  prompt_bn TEXT NOT NULL,
  prompt_en TEXT NOT NULL,
  completed BOOLEAN NOT NULL DEFAULT FALSE,
  created_by UUID NOT NULL REFERENCES public.members(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 20. Activity Log (Global immutable audit trail)
CREATE TABLE IF NOT EXISTS public.activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_member_id UUID REFERENCES public.members(id) ON DELETE SET NULL,
  action_type TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  summary_bn TEXT NOT NULL,
  summary_en TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activity_log_created ON public.activity_log(created_at DESC);
