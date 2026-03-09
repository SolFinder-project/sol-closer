import { PublicKey } from '@solana/web3.js';

export const TOKEN_PROGRAM_ID = new PublicKey(
  'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'
);

export const TOKEN_2022_PROGRAM_ID = new PublicKey(
  'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb'
);

/** Metaplex Core (Mpl Core) – single-account NFTs, e.g. Honeyland Generations. */
export const MPL_CORE_PROGRAM_ID = new PublicKey(
  'CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d'
);

/** Lamports kept in the account on Core burn (~0.00089784 SOL); only the rest is returned to payer. */
export const CORE_BURN_RETAINED_LAMPORTS = 897_840;

export const TOKEN_ACCOUNT_RENT = 2039280;

export const NETWORKS = {
  'mainnet-beta': 'https://api.mainnet-beta.solana.com',
  devnet: 'https://api.devnet.solana.com',
  testnet: 'https://api.testnet.solana.com',
} as const;

export const COMMITMENT = 'confirmed';

/** Minimum SOL (network fees) required in wallet to send reclaim transactions. */
export const MIN_SOL_NETWORK = 0.001;

/**
 * Solana transaction limits (official runtime constants).
 * @see https://solana.com/docs/core/constants-reference
 * Legacy transactions: max serialized size 1232 bytes → ~35 accounts in practice; batch sizes below respect this.
 * @see docs/ANALYSE-SINGLE-TX-RECLAIM-IMPACT-ET-RISQUES.md
 */
export const SOLANA_MAX_INSTRUCTIONS_PER_TX = 64;
export const SOLANA_MAX_TX_SIZE_BYTES = 1232;

/** Reserve for setComputeUnitLimit + fee transfer + referral transfer. */
export const RECLAIM_IX_BUDGET_PER_TX = SOLANA_MAX_INSTRUCTIONS_PER_TX - 4;
/** Max unique accounts per legacy tx (wallet + fee + referrer + reclaim accounts). Stay under ~35 total. */
export const RECLAIM_ACCOUNT_BUDGET_PER_TX = 22;

/** Max close-empty per tx (1 account each + wallet/fee/referral). Size-safe for 1232 bytes. */
export const MAX_EMPTY_CLOSE_PER_TX = 12;
/** Max burn+close (dust or SPL NFT) per tx: 2 ix + 2 accounts each. Size-safe. */
export const MAX_BURN_CLOSE_PER_TX = 5;
/** Max single-ix reclaim (Pump PDA, PumpSwap PDA) per tx. Size-safe. */
export const MAX_SINGLE_IX_RECLAIM_PER_TX = 12;
/**
 * Max cNFT burns per tx. Bubblegum merkle proof can be ~640 bytes per burn (canopy depth 0);
 * even with truncateCanopy, 2+ burns often exceed Solana's 1232-byte tx limit → "encoding overruns Uint8Array".
 * Use 1 per tx so serialization never overflows; multiple cNFTs are handled by multiple txs in closeCnftAssets.
 */
export const MAX_CNFT_BURNS_PER_TX = 1;
/** Max Metaplex Core burns per tx (1 account each). */
export const MAX_CORE_BURN_PER_TX = 12;
