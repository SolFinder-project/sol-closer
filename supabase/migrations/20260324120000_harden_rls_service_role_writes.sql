-- Harden RLS: remove anon (public) INSERT/UPDATE on high-risk tables.
-- App must write via service_role (see lib/supabase/server.ts + API routes updated in the same release).
-- References: https://supabase.com/docs/guides/database/postgres/row-level-security
--             https://www.postgresql.org/docs/current/ddl-rowsecurity.html
--
-- Rollback SQL: supabase/archive/RLS_ROLLBACK_pre_20260324_hardening.sql

-- Ensure global_stats row exists so anon SELECT + getGlobalStats() never depend on client INSERT.
INSERT INTO public.global_stats (id, total_accounts_closed, total_sol_reclaimed, total_transactions, total_users)
SELECT 1, 0, 0, 0, 0
WHERE NOT EXISTS (SELECT 1 FROM public.global_stats WHERE id = 1);

-- ========== transactions: keep SELECT, drop INSERT ==========
DROP POLICY IF EXISTS "transactions_insert" ON transactions;

-- ========== user_stats ==========
DROP POLICY IF EXISTS "user_stats_insert" ON user_stats;
DROP POLICY IF EXISTS "user_stats_update" ON user_stats;

-- ========== global_stats ==========
DROP POLICY IF EXISTS "global_stats_insert" ON global_stats;
DROP POLICY IF EXISTS "global_stats_update" ON global_stats;

-- ========== weekly_events ==========
DROP POLICY IF EXISTS "weekly_events_insert" ON weekly_events;
DROP POLICY IF EXISTS "weekly_events_update" ON weekly_events;

-- ========== registrations ==========
DROP POLICY IF EXISTS "registrations_insert" ON registrations;
DROP POLICY IF EXISTS "registrations_update" ON registrations;

-- ========== nft_creator_tiers: public read only ==========
DROP POLICY IF EXISTS "nft_creator_tiers_insert" ON nft_creator_tiers;
DROP POLICY IF EXISTS "nft_creator_tiers_update" ON nft_creator_tiers;

-- ========== nft_creator_submissions: server admin only for writes ==========
DROP POLICY IF EXISTS "nft_creator_submissions_insert" ON nft_creator_submissions;
DROP POLICY IF EXISTS "nft_creator_submissions_update" ON nft_creator_submissions;

-- SELECT policies remain: transactions_select, user_stats_select, global_stats_select,
-- leagues_select, weekly_events_select, registrations_select, results_select,
-- nft_creator_tiers_read, nft_creator_submissions_select.
