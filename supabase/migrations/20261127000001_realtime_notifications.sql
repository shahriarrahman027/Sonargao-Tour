-- ============================================================================
-- Real-time Financial Notifications: Supabase Realtime Publication & Replicas
-- ============================================================================
-- Configures PostgreSQL publication and replica identity cleanly so all
-- online crew members receive financial and activity updates without duplicates.
-- Safe and idempotent across repeated runs.
-- ============================================================================

-- Set REPLICA IDENTITY FULL on financial tables so UPDATE/void payloads retain
-- previous and current snapshots for accurate client state synchronization.
ALTER TABLE public.contributions REPLICA IDENTITY FULL;
ALTER TABLE public.expenses REPLICA IDENTITY FULL;
ALTER TABLE public.expense_edit_history REPLICA IDENTITY FULL;
ALTER TABLE public.activity_log REPLICA IDENTITY FULL;

-- Ensure core root tables are published to supabase_realtime cleanly.
-- Child fan-out tables (expense_allocations, expense_items) are intentionally
-- excluded so one multi-member expense never fires N duplicate notifications.
DO $$
DECLARE
  v_table TEXT;
  v_tables TEXT[] := ARRAY[
    'contributions',
    'expenses',
    'activity_log',
    'tour_progress',
    'photos',
    'votes',
    'shared_notes',
    'checklist_items',
    'polls',
    'tour_settings',
    'members',
    'badges',
    'fun_events'
  ];
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    FOREACH v_table IN ARRAY v_tables
    LOOP
      BEGIN
        EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', v_table);
      EXCEPTION
        WHEN duplicate_object THEN
          NULL;
      END;
    END LOOP;
  END IF;
END
$$;
