-- =============================================================================
-- Contrainte unique weekly_events (league_id, week_start) pour les upserts F1.
-- Requise pour : ensureOpenEventsForCurrentWeek(), closeCurrentWeekAndStartNext(),
-- et le script manuel 20260316000001_rotate_week_manual.sql (ON CONFLICT).
-- Idempotent : IF NOT EXISTS évite erreur si la contrainte existe déjà.
-- =============================================================================

CREATE UNIQUE INDEX IF NOT EXISTS weekly_events_league_id_week_start_key
  ON public.weekly_events (league_id, week_start);
