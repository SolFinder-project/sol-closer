/**
 * Minimal types for Jupiter Swap API (v1) integration.
 * Used for post-reclaim swap: SOL → USDC / USDT / JUP.
 */

/** Quote response from GET /swap/v1/quote – pass-through to swap endpoint */
export type JupiterQuoteResponse = Record<string, unknown>;

/** Swap request body for POST /swap/v1/swap */
export interface JupiterSwapRequest {
  quoteResponse: JupiterQuoteResponse;
  userPublicKey: string;
  wrapAndUnwrapSol?: boolean;
  dynamicComputeUnitLimit?: boolean;
  prioritizationFeeLamports?: 'auto' | number;
}

/** Swap response: serialized transaction to sign and send */
export interface JupiterSwapResponse {
  swapTransaction: string; // base64
  lastValidBlockHeight?: number;
}

export interface JupiterQuoteParams {
  inputMint: string;
  outputMint: string;
  amount: string; // lamports or atomic units (string for big numbers)
  slippageBps?: number;
}
