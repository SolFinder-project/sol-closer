-- F1 game: store Creator bonus points at transaction time so points are stable when NFT moves.
-- Bonus is only applied for reclaims made while the wallet held a Creator NFT (no bonus for new holder on old reclaims).
-- Existing rows get default 0 (no backfill).

ALTER TABLE public.transactions
ADD COLUMN IF NOT EXISTS f1_creator_bonus_pts integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.transactions.f1_creator_bonus_pts IS 'F1 points bonus per reclaim when wallet held a Creator NFT at tx time; 0 otherwise.';
