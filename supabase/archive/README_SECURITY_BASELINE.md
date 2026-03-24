# Supabase RLS hardening (SolPit) — baseline & rollback

## What changed (2026-03-24)

- **Anon key** (`NEXT_PUBLIC_SUPABASE_ANON_KEY`) no longer performs **INSERT/UPDATE** on tables that were abusable from the browser or from any holder of the anon JWT.
- **Server writes** use **`SUPABASE_SERVICE_ROLE_KEY`** only (PostgREST bypasses RLS for the service role). See `lib/supabase/server.ts` and the routes updated in the same commit as migration `20260324120000_harden_rls_service_role_writes.sql`.

## Official references (procedure)

1. **Supabase — Row Level Security**  
   https://supabase.com/docs/guides/database/postgres/row-level-security  
   RLS must be enabled on exposed tables; policies gate `anon` / `authenticated` access; **service role bypasses RLS** — use it only on trusted servers.

2. **PostgreSQL — Row Security Policies**  
   https://www.postgresql.org/docs/current/ddl-rowsecurity.html  
   Defines how `USING` / `WITH CHECK` apply to `SELECT` / `INSERT` / `UPDATE` / `DELETE`.

3. **Supabase — API keys**  
   https://supabase.com/docs/guides/api/api-keys  
   Never expose `service_role` to the client; `anon` is safe to embed in the browser but must be restricted by RLS.

## Rollback

1. Run `supabase/archive/RLS_ROLLBACK_pre_20260324_hardening.sql` in the SQL Editor (restores old permissive write policies).
2. If the **app** still expects service-role-only writes, either redeploy an older build or re-apply the forward migration after fixing issues.

## Preconditions in production

- `SUPABASE_SERVICE_ROLE_KEY` must be set on the host (e.g. Vercel) or **reclaims, F1 registration, weekly event bootstrap, and NFT submission reads** will return 500 from the updated API paths.

## Deploy order (avoid downtime)

1. **Ship the application** (this repo’s commit that calls service role on the server and `POST /api/transactions/reclaim` from the browser).
2. **Then** apply `supabase/migrations/20260324120000_harden_rls_service_role_writes.sql` (or `supabase db push`).

If you apply the migration **before** the new app is live, **reclaims will fail** until deploy completes (anon `INSERT` into `transactions` is removed while the old client still talked to Supabase directly).
