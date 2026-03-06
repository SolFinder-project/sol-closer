/**
 * Creator charter – F1 theme requirement, prohibitions, and how the feature works.
 * Source: docs/RECAP-INTEGRATION-NFT-CREATOR-SOLCLOSER.md
 */

export const CHARTE_CREATORS_TITLE = 'SolPit Creator charter';

/** English regulation text: rules + how it works (tiers, selling). */
export const CHARTE_CREATORS_BODY = `
Use SOL from your last reclaim to mint a verified NFT in the SolPit Creator collection. While you hold it, you get a Creator badge and F1 perks (extra points per reclaim and, for Silver/Gold tiers, a faster race time). You can later sell your NFT on secondary markets (e.g. Magic Eden, Tensor); the new owner will then receive the badge and perks instead.

How it works

(1) Eligibility — You need at least 0.02 SOL net from a previous reclaim to unlock "Create NFT". That amount is a ceiling (you must have reclaimed at least that much); you do not pay 0.02 SOL for the NFT. At finalization you pay only the actual mint cost: on-chain rent (mint + token + metadata accounts) plus a SolPit fee (~0.005 SOL), typically ~0.01–0.02 SOL in total.

(2) Submission — You submit an image and metadata (name, description, attributes). No payment is taken at this stage. Your creation is reviewed by a human moderator (usually within 24 hours).

(3) Review and tier — The moderator either approves or rejects your submission. If approved, they assign a tier: Standard, Silver, or Gold. The tier is fixed for that NFT and determines your in-app benefits:
  • Standard: Creator badge + 1 extra point per reclaim.
  • Silver: Creator badge + 3 extra points per reclaim + 1 second subtracted from your F1 race time.
  • Gold: Creator badge + 5 extra points per reclaim + 3 seconds subtracted from your F1 race time.
If you hold several Creator NFTs, only your best tier is applied.

(4) Finalization — Once approved, you have a limited time (e.g. 7 days) to finalize. Finalizing builds a transaction (mint + SolPit fee); you sign with your wallet and the NFT is minted. Payment happens only at this step.

(5) If you sell your NFT — Benefits (badge and F1 perks) are tied to who holds the NFT on-chain. If you sell or transfer it, you lose the badge and perks; the new holder gets them. There is no penalty for selling. Resale price on Magic Eden or Tensor is not tied to mint cost: you set your listing price (in SOL) when you list; value is what buyers are willing to pay (offers, collection floor, etc.).

Rules

(1) F1 theme required — NFTs created via SolPit must be on the theme of Formula 1: motorsport, circuits, drivers, cars, F1 universe. Content clearly off-theme may be refused during review.

(2) Prohibited content — The following are not allowed: pornographic, violent, gore, discriminatory, illegal content, or anything that infringes third-party rights. We check each creation before publication.

By submitting, you accept this charter and confirm that your NFT complies with the F1 theme and these rules.
`.trim();
