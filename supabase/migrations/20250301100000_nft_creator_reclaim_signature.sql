-- One eligible reclaim = one NFT. Track which reclaim was "consumed" when finalizing.
-- See docs/RECAP-INTEGRATION-NFT-CREATOR-SOLCLOSER.md

ALTER TABLE nft_creator_submissions
  ADD COLUMN IF NOT EXISTS reclaim_signature text;

COMMENT ON COLUMN nft_creator_submissions.reclaim_signature IS 'Transaction signature of the reclaim that was used for this NFT (set on finalize). One reclaim per finalized NFT per wallet.';

CREATE INDEX IF NOT EXISTS idx_nft_creator_submissions_reclaim_sig
  ON nft_creator_submissions(wallet_address, reclaim_signature)
  WHERE reclaim_signature IS NOT NULL AND status = 'finalized';
