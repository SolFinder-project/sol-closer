-- SOLcloser: ensure timestamp columns use timestamptz and accept ISO 8601
-- See https://www.postgresql.org/docs/16/datatype-datetime.html
-- PostgREST/Supabase expect ISO 8601 for timestamp columns; raw integers cause "date/time field value out of range".
-- Run this in Supabase SQL Editor if you get that error. Adjust if your columns are named differently.

-- bigint -> timestamptz: use to_timestamp() only. Skip if column is already timestamptz (e.g. after partial run).
-- Value < 10000000000 = epoch seconds; else = epoch milliseconds.
-- user_stats: first_transaction_at, last_transaction_at, updated_at
DO $$
DECLARE
  col_type text;
BEGIN
  SELECT data_type INTO col_type FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'user_stats' AND column_name = 'first_transaction_at';
  IF col_type IS NOT NULL AND col_type <> 'timestamp with time zone' THEN
    ALTER TABLE public.user_stats ALTER COLUMN first_transaction_at TYPE timestamptz
      USING CASE WHEN first_transaction_at IS NULL THEN NULL WHEN (first_transaction_at::numeric) < 10000000000 THEN to_timestamp(first_transaction_at::numeric) AT TIME ZONE 'UTC' ELSE to_timestamp((first_transaction_at::numeric / 1000.0)) AT TIME ZONE 'UTC' END;
  END IF;

  SELECT data_type INTO col_type FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'user_stats' AND column_name = 'last_transaction_at';
  IF col_type IS NOT NULL AND col_type <> 'timestamp with time zone' THEN
    ALTER TABLE public.user_stats ALTER COLUMN last_transaction_at TYPE timestamptz
      USING CASE WHEN last_transaction_at IS NULL THEN NULL WHEN (last_transaction_at::numeric) < 10000000000 THEN to_timestamp(last_transaction_at::numeric) AT TIME ZONE 'UTC' ELSE to_timestamp((last_transaction_at::numeric / 1000.0)) AT TIME ZONE 'UTC' END;
  END IF;

  SELECT data_type INTO col_type FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'user_stats' AND column_name = 'updated_at';
  IF col_type IS NOT NULL AND col_type <> 'timestamp with time zone' THEN
    ALTER TABLE public.user_stats ALTER COLUMN updated_at TYPE timestamptz
      USING CASE WHEN updated_at IS NULL THEN NULL WHEN (updated_at::numeric) < 10000000000 THEN to_timestamp(updated_at::numeric) AT TIME ZONE 'UTC' ELSE to_timestamp((updated_at::numeric / 1000.0)) AT TIME ZONE 'UTC' END;
  END IF;
END $$;

-- global_stats: updated_at
DO $$
DECLARE
  col_type text;
BEGIN
  SELECT data_type INTO col_type FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'global_stats' AND column_name = 'updated_at';
  IF col_type IS NOT NULL AND col_type <> 'timestamp with time zone' THEN
    ALTER TABLE public.global_stats ALTER COLUMN updated_at TYPE timestamptz
      USING CASE WHEN updated_at IS NULL THEN NULL WHEN (updated_at::numeric) < 10000000000 THEN to_timestamp(updated_at::numeric) AT TIME ZONE 'UTC' ELSE to_timestamp((updated_at::numeric / 1000.0)) AT TIME ZONE 'UTC' END;
  END IF;
END $$;
