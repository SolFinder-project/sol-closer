-- Rollback: restore permissive anon write policies removed by 20260324120000_harden_rls_service_role_writes.sql
-- Run in Supabase SQL Editor only if you must revert the hardening (e.g. emergency).
-- Official context: https://supabase.com/docs/guides/database/postgres/row-level-security
-- After rollback, revert app code to a commit that still used anon writes, or writes will fail from the server.

-- ========== transactions ==========
CREATE POLICY "transactions_insert"
  ON transactions FOR INSERT
  WITH CHECK (true);

-- ========== user_stats ==========
CREATE POLICY "user_stats_insert"
  ON user_stats FOR INSERT
  WITH CHECK (true);

CREATE POLICY "user_stats_update"
  ON user_stats FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- ========== global_stats ==========
CREATE POLICY "global_stats_insert"
  ON global_stats FOR INSERT
  WITH CHECK (true);

CREATE POLICY "global_stats_update"
  ON global_stats FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- ========== weekly_events ==========
CREATE POLICY "weekly_events_insert"
  ON weekly_events FOR INSERT
  WITH CHECK (true);

CREATE POLICY "weekly_events_update"
  ON weekly_events FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- ========== registrations ==========
CREATE POLICY "registrations_insert"
  ON registrations FOR INSERT
  WITH CHECK (true);

CREATE POLICY "registrations_update"
  ON registrations FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- ========== nft_creator (original nft_creator.sql names) ==========
CREATE POLICY "nft_creator_tiers_insert" ON nft_creator_tiers FOR INSERT WITH CHECK (true);
CREATE POLICY "nft_creator_tiers_update" ON nft_creator_tiers FOR UPDATE USING (true);

CREATE POLICY "nft_creator_submissions_insert" ON nft_creator_submissions FOR INSERT WITH CHECK (true);
CREATE POLICY "nft_creator_submissions_update" ON nft_creator_submissions FOR UPDATE USING (true);
