-- Stats & reclaim: enable RLS and add policies for anon (saveTransaction, getGlobalStats, getUserStats, etc. use client anon).
-- See lib/supabase/transactions.ts and docs/RAPPORT-PRE-DEPLOIEMENT-PROD.md § 3.2.
-- Tables transactions, user_stats, global_stats must already exist (created by you or scripts).

-- ========== transactions ==========
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "transactions_select"
  ON transactions FOR SELECT
  USING (true);

CREATE POLICY "transactions_insert"
  ON transactions FOR INSERT
  WITH CHECK (true);


-- ========== user_stats ==========
ALTER TABLE user_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_stats_select"
  ON user_stats FOR SELECT
  USING (true);

CREATE POLICY "user_stats_insert"
  ON user_stats FOR INSERT
  WITH CHECK (true);

CREATE POLICY "user_stats_update"
  ON user_stats FOR UPDATE
  USING (true)
  WITH CHECK (true);


-- ========== global_stats ==========
ALTER TABLE global_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "global_stats_select"
  ON global_stats FOR SELECT
  USING (true);

CREATE POLICY "global_stats_insert"
  ON global_stats FOR INSERT
  WITH CHECK (true);

CREATE POLICY "global_stats_update"
  ON global_stats FOR UPDATE
  USING (true)
  WITH CHECK (true);
