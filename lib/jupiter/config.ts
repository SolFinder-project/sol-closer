/**
 * Jupiter integration config (official: https://dev.jup.ag/docs/swap-api).
 * Metis Swap API: GET /quote, POST /swap → base https://api.jup.ag/swap/v1
 */

/** Client-side: call Jupiter directly to avoid 404 from Next API route. Official base from dev.jup.ag */
export const JUPITER_SWAP_V1_BASE = 'https://api.jup.ag/swap/v1';

/** Server-side proxy (optional); mainnet only for liquidity */
export const JUPITER_API_BASE =
  process.env.NEXT_PUBLIC_SOLANA_NETWORK === 'mainnet-beta'
    ? 'https://api.jup.ag'
    : 'https://preprod-quote-api.jup.ag';

/** Wrapped SOL mint (same on mainnet and devnet) */
export const MINT_SOL = 'So11111111111111111111111111111111111111112';

/** Output tokens for "Swap your reclaimed SOL" (mainnet only – api.jup.ag has no devnet liquidity). */
export const OUTPUT_TOKENS_MAINNET = [
  { symbol: 'USDC', mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', decimals: 6 },
  { symbol: 'USDT', mint: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', decimals: 6 },
  { symbol: 'JUP', mint: 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN', decimals: 6 },
] as const;

/**
 * Jupiter api.jup.ag is mainnet-only: it only has mainnet liquidity and token lists.
 * Devnet mints (e.g. 4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU) return 400 "not tradable".
 * So we only enable swap on mainnet and only use mainnet output tokens.
 */
export function getOutputTokens(network: string): readonly { symbol: string; mint: string; decimals: number }[] {
  return network === 'mainnet-beta' ? OUTPUT_TOKENS_MAINNET : [];
}

/** Swap UI only on mainnet – api.jup.ag does not support devnet tokens. */
export function isSwapEnabled(network: string): boolean {
  return network === 'mainnet-beta';
}
