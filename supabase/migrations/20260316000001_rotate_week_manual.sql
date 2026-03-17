-- =============================================================================
-- ROTATION COMPLÈTE : ferme TOUS les events ouverts et crée 3 nouveaux (nouvelle
-- semaine fin = prochain dimanche 17:00 UTC). C'est CE script qui "relance" une
-- nouvelle semaine. Prérequis : contrainte UNIQUE(league_id, week_start) — voir
-- 20260315200000_weekly_events_unique_league_week.sql si erreur ON CONFLICT.
-- =============================================================================

-- 1) Fermer tous les events encore ouverts
UPDATE public.weekly_events
SET
  status = 'closed',
  closed_at_ms = floor(extract(epoch from now()) * 1000)::bigint
WHERE status = 'open';

-- 2) Calculer la nouvelle semaine : fin = prochain dimanche 17:00 UTC, début = fin - 7 jours
--    (date_trunc('week') = lundi 00:00 UTC ; +6 j = dimanche 00:00 ; +17h = dimanche 17:00)
WITH week_bounds AS (
  SELECT
    (date_trunc('week', (now() at time zone 'UTC'))::date + 6 + interval '17 hours') at time zone 'UTC' AS this_sunday_17,
    now() AS n
  ),
  next_end AS (
    SELECT
      CASE
        WHEN n >= this_sunday_17 THEN this_sunday_17 + interval '7 days'
        ELSE this_sunday_17
      END AS week_end_ts
    FROM week_bounds
  ),
  bounds AS (
    SELECT
      (week_end_ts - interval '7 days')::timestamptz AS week_start_ts,
      week_end_ts::timestamptz AS week_end_ts
    FROM next_end
  )
-- 3) Créer un event ouvert par ligue (upsert si contrainte UNIQUE(league_id, week_start) existe)
INSERT INTO public.weekly_events (league_id, week_start, week_end, status, closed_at_ms)
SELECT
  l.id,
  b.week_start_ts,
  b.week_end_ts,
  'open',
  NULL
FROM public.leagues l
CROSS JOIN bounds b
ON CONFLICT (league_id, week_start)
DO UPDATE SET
  week_end = EXCLUDED.week_end,
  status = 'open',
  closed_at_ms = NULL;

-- Résultat : tous les anciens events sont closed ; exactement 3 lignes open (Bronze, Silver, Gold)
-- pour la semaine qui se termine au prochain dimanche 17:00 UTC.
