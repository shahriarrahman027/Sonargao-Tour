-- Optional additive column on existing tour_settings table for admin-managed
-- "Places We'll Explore" media (uses existing settings RLS policies; no new table).
ALTER TABLE public.tour_settings
ADD COLUMN IF NOT EXISTS explore_destinations JSONB;
