-- =============================================================================
-- NETTOYAGE UNIQUEMENT (ne crée pas de nouvelle semaine).
-- Ferme : events open dont week_end < now() + déduplique par ligue. Ne touche
-- PAS aux events dont week_end est dans le futur. Pour "réinitialiser" et
-- repartir sur une nouvelle semaine (fin = dimanche 17h UTC), utiliser
-- 20260316000001_rotate_week_manual.sql à la place.
-- =============================================================================

-- 1) Fermer toutes les semaines dont week_end est déjà passée (encore ouvertes)
UPDATE public.weekly_events
SET
  status = 'closed',
  closed_at_ms = floor(extract(epoch from now()) * 1000)::bigint
WHERE status = 'open'
  AND week_end < now();

-- 2) Parmi les events encore ouverts qui contiennent "now" (week_start <= now <= week_end),
--    garder un seul event par ligue (celui avec le plus ancien week_start), fermer les autres
WITH current_open AS (
  SELECT id, league_id, week_start,
         row_number() OVER (PARTITION BY league_id ORDER BY week_start ASC) AS rn
  FROM public.weekly_events
  WHERE status = 'open'
    AND week_start <= now()
    AND week_end >= now()
)
UPDATE public.weekly_events we
SET
  status = 'closed',
  closed_at_ms = floor(extract(epoch from now()) * 1000)::bigint
FROM current_open co
WHERE we.id = co.id
  AND co.rn > 1;

-- 3) (Optionnel) Renseigner closed_at_ms pour les events déjà closed mais sans closed_at_ms
UPDATE public.weekly_events
SET closed_at_ms = floor(extract(epoch from week_end) * 1000)::bigint
WHERE status = 'closed'
  AND closed_at_ms IS NULL
  AND week_end IS NOT NULL;

-- Résultat attendu après exécution :
-- - Au plus 3 lignes avec status = 'open' (une par league_id), même week_start/week_end.
-- - Toutes les autres lignes status = 'closed' avec closed_at_ms renseigné.
