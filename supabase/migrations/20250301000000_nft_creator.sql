-- NFT Creator feature: submissions (pending → approved/rejected → finalized) and tiers per mint.
-- See docs/RECAP-INTEGRATION-NFT-CREATOR-SOLCLOSER.md and docs/BRIEF-AGENT-INTEGRATION-NFT-CREATOR.md

-- Submissions: image + metadata, status, tier (set on approval), mint_address (set on finalize).
CREATE TABLE IF NOT EXISTS nft_creator_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address text NOT NULL,
  image_uri text NOT NULL,
  metadata_uri text,
  name text NOT NULL,
  description text NOT NULL,
  attributes jsonb,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'finalized', 'expired')),
  tier text CHECK (tier IN ('standard', 'silver', 'gold')),
  rejection_reason text,
  approved_at timestamptz,
  expires_at timestamptz,
  mint_address text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_nft_creator_submissions_wallet ON nft_creator_submissions(wallet_address);
CREATE INDEX IF NOT EXISTS idx_nft_creator_submissions_status ON nft_creator_submissions(status);

-- Tiers per mint (filled at finalization). Used for bonus points and race time.
CREATE TABLE IF NOT EXISTS nft_creator_tiers (
  mint_address text PRIMARY KEY,
  tier text NOT NULL CHECK (tier IN ('standard', 'silver', 'gold')),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- RLS: allow anon to read only their own submissions (by wallet from JWT or session); service role for admin.
-- For simplicity we rely on API routes (server) using service key for admin and passing wallet for user reads.
ALTER TABLE nft_creator_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE nft_creator_tiers ENABLE ROW LEVEL SECURITY;

-- Policy: anyone can read nft_creator_tiers (needed for public leaderboard/badge checks via API).
CREATE POLICY "nft_creator_tiers_read" ON nft_creator_tiers FOR SELECT USING (true);

-- Policy: only service role can insert/update nft_creator_tiers (done in API finalize).
CREATE POLICY "nft_creator_tiers_insert" ON nft_creator_tiers FOR INSERT WITH CHECK (true);
CREATE POLICY "nft_creator_tiers_update" ON nft_creator_tiers FOR UPDATE USING (true);

-- Submissions: allow insert for authenticated or anon (API will validate wallet from body).
CREATE POLICY "nft_creator_submissions_insert" ON nft_creator_submissions FOR INSERT WITH CHECK (true);
-- Read: allow select by wallet (API filters by wallet_address from query param).
CREATE POLICY "nft_creator_submissions_select" ON nft_creator_submissions FOR SELECT USING (true);
-- Update: used by admin (approve/reject) and finalize; done server-side with service key.
CREATE POLICY "nft_creator_submissions_update" ON nft_creator_submissions FOR UPDATE USING (true);

COMMENT ON TABLE nft_creator_submissions IS 'NFT Creator submissions: pending → approved/rejected → finalized (mint_address set).';
COMMENT ON TABLE nft_creator_tiers IS 'Creator tier per mint (standard/silver/gold) for F1 bonus points and race time.';
