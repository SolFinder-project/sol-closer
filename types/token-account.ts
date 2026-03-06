import { PublicKey } from '@solana/web3.js';

export interface TokenAccount {
  pubkey: PublicKey;
  mint: PublicKey;
  balance: number;
  rentExemptReserve: number;
  programId: PublicKey; // ⭐ Nouveau champ
}

/** Token account with small balance (dust) – for burn + close flow. */
export interface DustAccount {
  pubkey: PublicKey;
  mint: PublicKey;
  balanceUi: number;
  balanceRaw: bigint;
  decimals: number;
  rentExemptReserve: number;
  programId: PublicKey;
}

/** NFT (balance 1, decimals 0) – for burn + close to reclaim token account rent. */
export interface NftBurnAccount {
  pubkey: PublicKey;
  mint: PublicKey;
  rentExemptReserve: number;
  programId: PublicKey;
}

export interface CloseAccountResult {
  signature: string;
  accountsClosed: number;
  solReclaimed: number;
  success: boolean;
  error?: string;
  warningMessage?: string;
}
