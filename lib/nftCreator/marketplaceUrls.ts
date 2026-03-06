/**
 * Marketplace deep links for SolPit Creator NFTs.
 * Sources: Magic Eden item-details URL, Tensor item page URL (documented formats).
 *
 * Note: Magic Eden and Tensor do not offer public devnet marketplace UIs. These URLs
 * point to mainnet only. Magic Eden has api-devnet.magiceden.dev for API use, but the
 * web marketplace (magiceden.io) is mainnet. On devnet, NFTs minted by users exist only
 * on devnet, so listing/selling on these marketplaces is not available until mainnet.
 */

/** Solana mint addresses are base58, 32–44 chars. Allow only safe path segment. */
function safeMintForPath(mint: string | null | undefined): string | null {
  if (typeof mint !== 'string' || !mint.trim()) return null;
  const s = mint.trim();
  if (s.length < 32 || s.length > 48) return null;
  if (!/^[1-9A-HJ-NP-Za-km-z]+$/.test(s)) return null;
  return s;
}

/**
 * Magic Eden item-details page for a given mint.
 * User can view the NFT and list/sell from there.
 * @see https://help.magiceden.io/en/articles/6531562-how-to-view-nft-details-and-metadata-on-magic-eden
 */
export function getMagicEdenItemUrl(mint: string | null | undefined): string | null {
  const m = safeMintForPath(mint);
  if (!m) return null;
  return `https://magiceden.io/item-details/${m}`;
}

/**
 * Tensor item page for a given mint.
 * User can list or sell from the item page (SELL / LIST tabs).
 * @see https://docs.tensor.trade/trade/get-started-with-tensors-amm/sell-or-list
 */
export function getTensorItemUrl(mint: string | null | undefined): string | null {
  const m = safeMintForPath(mint);
  if (!m) return null;
  return `https://www.tensor.trade/item/${m}`;
}
