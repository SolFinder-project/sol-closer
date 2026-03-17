-- =============================================================================
-- ROTATION F1 – TOUT-EN-UN (à exécuter en UNE SEULE FOIS dans le SQL Editor)
-- 1. Index unique si besoin
-- 2. Ferme TOUS les events ouverts
-- 3. Pour la nouvelle semaine (fin = prochain dim. 17h UTC) : supprime les
--    inscriptions concernées, supprime les lignes weekly_events, insère 3 nouveaux
-- Effet : plus aucune inscription sur la nouvelle semaine, 3 events open.
-- =============================================================================

-- 1) Index unique (idempotent)
CREATE UNIQUE INDEX IF NOT EXISTS weekly_events_league_id_week_start_key
  ON public.weekly_events (league_id, week_start);

-- 2) Fermer TOUS les events ouverts
UPDATE public.weekly_events
SET
  status = 'closed',
  closed_at_ms = floor(extract(epoch from now()) * 1000)::bigint
WHERE status = 'open';

-- 3) Nouvelle semaine (fin = prochain dimanche 17:00 UTC)
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
  ),
  target_week AS (
    SELECT l.id AS league_id, b.week_start_ts, b.week_end_ts
    FROM public.leagues l
    CROSS JOIN bounds b
  ),
  event_ids_to_replace AS (
    SELECT we.id
    FROM public.weekly_events we
    JOIN target_week tw ON we.league_id = tw.league_id AND we.week_start = tw.week_start_ts
  )
-- 3a) Désinscrire tout le monde pour ces events (évite erreur FK à l’étape 3b)
DELETE FROM public.registrations
WHERE event_id IN (SELECT id FROM event_ids_to_replace);

-- 3b) Supprimer les lignes weekly_events de cette semaine (même calcul de semaine)
WITH week_bounds AS (
  SELECT
    (date_trunc('week', (now() at time zone 'UTC'))::date + 6 + interval '17 hours') at time zone 'UTC' AS this_sunday_17,
    now() AS n
  ),
  next_end AS (
    SELECT CASE WHEN n >= this_sunday_17 THEN this_sunday_17 + interval '7 days' ELSE this_sunday_17 END AS week_end_ts
    FROM week_bounds
  ),
  target_week AS (
    SELECT l.id AS league_id, (week_end_ts - interval '7 days')::timestamptz AS week_start_ts
    FROM public.leagues l
    CROSS JOIN next_end
  )
DELETE FROM public.weekly_events we
USING target_week tw
WHERE we.league_id = tw.league_id AND we.week_start = tw.week_start_ts;

-- 3c) Insérer les 3 nouveaux events (même calcul de semaine)
WITH week_bounds AS (
  SELECT
    (date_trunc('week', (now() at time zone 'UTC'))::date + 6 + interval '17 hours') at time zone 'UTC' AS this_sunday_17,
    now() AS n
  ),
  next_end AS (
    SELECT CASE WHEN n >= this_sunday_17 THEN this_sunday_17 + interval '7 days' ELSE this_sunday_17 END AS week_end_ts
    FROM week_bounds
  ),
  bounds AS (
    SELECT
      (week_end_ts - interval '7 days')::timestamptz AS week_start_ts,
      week_end_ts::timestamptz AS week_end_ts
    FROM next_end
  )
INSERT INTO public.weekly_events (league_id, week_start, week_end, status, closed_at_ms)
SELECT l.id, b.week_start_ts, b.week_end_ts, 'open', NULL
FROM public.leagues l
CROSS JOIN bounds b;
