-- F1 game: enable RLS and add policies for anon (API routes use anon client for reads and for ensureOpenEventsForCurrentWeek / register / update upgrades).
-- Admin operations (close event, rotate week, write results) use service_role and bypass RLS.
-- See docs/RAPPORT-PRE-DEPLOIEMENT-PROD.md and docs/GUIDE-DEPLOIEMENT-PROD-COTE-UTILISATEUR.md

-- ========== leagues ==========
ALTER TABLE leagues ENABLE ROW LEVEL SECURITY;

-- Lecture publique : listage des ligues (Bronze, Silver, Gold)
CREATE POLICY "leagues_select"
  ON leagues FOR SELECT
  USING (true);

-- Écriture : réservée au service_role (pas de politique anon pour INSERT/UPDATE/DELETE)


-- ========== weekly_events ==========
ALTER TABLE weekly_events ENABLE ROW LEVEL SECURITY;

-- Lecture : events ouverts/fermés, semaine en cours, etc.
CREATE POLICY "weekly_events_select"
  ON weekly_events FOR SELECT
  USING (true);

-- Insert / Update : GET /api/game/events appelle ensureOpenEventsForCurrentWeek() qui fait un upsert (anon)
CREATE POLICY "weekly_events_insert"
  ON weekly_events FOR INSERT
  WITH CHECK (true);

CREATE POLICY "weekly_events_update"
  ON weekly_events FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- Delete : non utilisé par anon (rotation utilise service_role)


-- ========== registrations ==========
ALTER TABLE registrations ENABLE ROW LEVEL SECURITY;

-- Lecture : vérifier inscription, liste des inscrits par event, etc.
CREATE POLICY "registrations_select"
  ON registrations FOR SELECT
  USING (true);

-- Insert : inscription à une course (POST /api/game/register)
CREATE POLICY "registrations_insert"
  ON registrations FOR INSERT
  WITH CHECK (true);

-- Update : mise à jour des upgrades (upgrade_config) par un utilisateur pour son inscription
CREATE POLICY "registrations_update"
  ON registrations FOR UPDATE
  USING (true)
  WITH CHECK (true);


-- ========== results ==========
ALTER TABLE results ENABLE ROW LEVEL SECURITY;

-- Lecture seule : classement après clôture (leaderboard)
CREATE POLICY "results_select"
  ON results FOR SELECT
  USING (true);

-- Insert / Update / Delete : uniquement via service_role (closeOneEventAndWriteResults dans cron / admin)
