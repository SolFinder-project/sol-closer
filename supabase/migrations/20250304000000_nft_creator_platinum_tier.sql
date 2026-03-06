-- Add 'platinum' to NFT Creator tier CHECK constraints.
-- See docs/NFT-TIERS-SPEC-CONCRETE.md and docs/BRIEF-AGENT-NFT-TIERS-ROYALTIES-INTEGRATION.md

ALTER TABLE nft_creator_submissions
  DROP CONSTRAINT IF EXISTS nft_creator_submissions_tier_check;

ALTER TABLE nft_creator_submissions
  ADD CONSTRAINT nft_creator_submissions_tier_check
  CHECK (tier IS NULL OR tier IN ('standard', 'silver', 'gold', 'platinum'));

ALTER TABLE nft_creator_tiers
  DROP CONSTRAINT IF EXISTS nft_creator_tiers_tier_check;

ALTER TABLE nft_creator_tiers
  ADD CONSTRAINT nft_creator_tiers_tier_check
  CHECK (tier IN ('standard', 'silver', 'gold', 'platinum'));

COMMENT ON CONSTRAINT nft_creator_submissions_tier_check ON nft_creator_submissions IS 'Creator tier set on approval: standard, silver, gold, platinum.';
COMMENT ON CONSTRAINT nft_creator_tiers_tier_check ON nft_creator_tiers IS 'Creator tier per mint: standard, silver, gold, platinum.';
