import { PublicKey } from '@solana/web3.js';

export interface TokenAccount {
  pubkey: PublicKey;
  mint: PublicKey;
  balance: number;
  rentExemptReserve: number;
  programId: PublicKey; // ⭐ Nouveau champ
}

export interface CloseAccountResult {
  signature: string;
  accountsClosed: number;
  solReclaimed: number;
  success: boolean;
  error?: string;
}
