import { Connection, Commitment } from '@solana/web3.js';
import { COMMITMENT } from './constants';

let connectionInstance: Connection | null = null;

export function getConnection(): Connection {
  if (!connectionInstance) {
    const rpcUrl = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 
                   'https://api.devnet.solana.com';
    
    connectionInstance = new Connection(rpcUrl, {
      commitment: COMMITMENT as Commitment,
      confirmTransactionInitialTimeout: 60000,
    });
  }
  
  return connectionInstance;
}

export function resetConnection(): void {
  connectionInstance = null;
}
