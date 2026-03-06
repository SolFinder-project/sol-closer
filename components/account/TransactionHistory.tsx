'use client';

import { useState, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { getUserTransactions } from '@/lib/supabase/transactions';
import type { ReclaimType } from '@/lib/supabase/transactions';

interface Transaction {
  id: string;
  signature: string;
  accounts_closed: number;
  sol_reclaimed: number;
  fee: number;
  net_received: number;
  referrer_code?: string;
  referral_earned?: number;
  /** Unix ms or ISO string (Supabase timestamptz returns string). */
  timestamp: number | string;
  created_at: string;
  reclaim_type?: ReclaimType | null;
}

function getReclaimTypeLabel(type?: ReclaimType | null): string {
  switch (type) {
    case 'empty': return 'Empty accounts';
    case 'dust': return 'Dust';
    case 'pump': return 'Pump PDA';
    case 'pumpswap': return 'PumpSwap PDA';
    case 'drift': return 'Drift account';
    case 'nft_burn': return 'NFT burn';
    case 'openorders': return 'OpenOrders'; // legacy
    case 'full_reclaim': return 'Full reclaim';
    case 'cnft_close': return 'cNFT close';
    default: return 'Reclaim';
  }
}

export default function TransactionHistory() {
  const { publicKey } = useWallet();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadTransactions() {
      if (!publicKey) {
        setTransactions([]);
        setLoading(false);
        return;
      }
      setTransactions([]);
      setLoading(true);
      const data = await getUserTransactions(publicKey.toString());
      setTransactions(data || []);
      setLoading(false);
    }

    loadTransactions();
  }, [publicKey]);

  const formatDate = (timestamp: number | string) => {
    return new Date(timestamp).toLocaleString();
  };

  const formatSignature = (sig: string) => {
    return sig.slice(0, 8) + '...' + sig.slice(-8);
  };

  if (!publicKey) {
    return (
      <div className="animate-slide-up max-w-xl mx-auto">
        <div className="card-cyber text-center py-10 md:py-12 border-dark-border">
          <div className="text-5xl md:text-6xl mb-4">👛</div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Transaction History</p>
          <h2 className="text-2xl md:text-3xl font-bold font-[family-name:var(--font-orbitron)] text-white mb-3">Connect your wallet</h2>
          <p className="text-sm text-gray-400">Connect your wallet to view your past reclaim transactions.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="card-cyber text-center py-10 md:py-12 border-dark-border">
        <div className="text-4xl mb-3 animate-spin">⏳</div>
        <p className="text-sm text-gray-400">Loading transactions...</p>
      </div>
    );
  }

  if (transactions.length === 0) {
    return (
      <div className="animate-slide-up max-w-xl mx-auto">
        <div className="card-cyber text-center py-10 md:py-12 border-dark-border">
          <div className="text-5xl md:text-6xl mb-4">📜</div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Transaction History</p>
          <h2 className="text-2xl md:text-3xl font-bold font-[family-name:var(--font-orbitron)] text-white mb-3">No transactions yet</h2>
          <p className="text-sm text-gray-400">Start closing accounts to see your history here.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-slide-up space-y-8 md:space-y-10">
      <div className="text-center mb-8 md:mb-10">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Transaction History</p>
        <h1 className="text-2xl md:text-4xl lg:text-5xl font-bold font-[family-name:var(--font-orbitron)] text-white mb-2">Your reclaims</h1>
        <p className="text-sm text-gray-400">All reclaims: empty accounts, dust, Pump PDA, PumpSwap PDA, Drift, NFT burn, cNFT close.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <div className="card-cyber border-dark-border bg-dark-card/80 text-center py-5 px-4">
          <p className="text-xs text-gray-400 mb-1">Transactions</p>
          <p className="text-xl md:text-2xl font-bold font-[family-name:var(--font-orbitron)] text-neon-purple">{transactions.length}</p>
        </div>
        <div className="card-cyber border-dark-border bg-dark-card/80 text-center py-5 px-4">
          <p className="text-xs text-gray-400 mb-1">Items closed</p>
          <p className="text-xl md:text-2xl font-bold font-[family-name:var(--font-orbitron)] text-neon-pink">
            {transactions.reduce((sum, tx) => sum + tx.accounts_closed, 0)}
          </p>
        </div>
        <div className="card-cyber border-dark-border bg-dark-card/80 text-center py-5 px-4">
          <p className="text-xs text-gray-400 mb-1">SOL Reclaimed</p>
          <p className="text-xl md:text-2xl font-bold font-[family-name:var(--font-orbitron)] text-neon-cyan">
            {transactions.reduce((sum, tx) => sum + tx.sol_reclaimed, 0).toFixed(4)}
          </p>
        </div>
        <div className="card-cyber border-dark-border bg-dark-card/80 text-center py-5 px-4">
          <p className="text-xs text-gray-400 mb-1">Fees Paid</p>
          <p className="text-xl md:text-2xl font-bold font-[family-name:var(--font-orbitron)] text-neon-green">
            {transactions.reduce((sum, tx) => sum + tx.fee, 0).toFixed(4)}
          </p>
        </div>
      </div>

      <div>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Transactions</h2>
        <div className="space-y-3 md:space-y-4">
          {transactions.map((tx) => (
            <div key={tx.id} className="card-cyber border-dark-border p-4 md:p-5">
              <div className="flex flex-col gap-3 sm:gap-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-bold text-base md:text-lg text-white">Closed {tx.accounts_closed} item{tx.accounts_closed !== 1 ? 's' : ''}</p>
                    <span className="text-xs px-2 py-0.5 rounded bg-white/10 text-gray-300">{getReclaimTypeLabel(tx.reclaim_type)}</span>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">{formatDate(tx.timestamp)}</p>
                  <p className="text-xs text-gray-500 font-mono mt-0.5">Sig: {formatSignature(tx.signature)}</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-4">
                  <div className="flex justify-between sm:block p-2 rounded-lg bg-dark-bg">
                    <span className="text-xs text-gray-400">Reclaimed</span>
                    <span className="font-semibold text-neon-cyan text-sm">{tx.sol_reclaimed.toFixed(4)} SOL</span>
                  </div>
                  <div className="flex justify-between sm:block p-2 rounded-lg bg-dark-bg">
                    <span className="text-xs text-gray-400">Fee</span>
                    <span className="font-semibold text-neon-pink text-sm">{tx.fee.toFixed(4)} SOL</span>
                  </div>
                  <div className="flex justify-between sm:block p-2 rounded-lg bg-dark-bg">
                    <span className="text-xs text-gray-400">Received</span>
                    <span className="font-semibold text-neon-green text-sm">{tx.net_received.toFixed(4)} SOL</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="text-center">
        <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-green-500/10 border border-green-500/30 text-green-400 text-xs md:text-sm">
          <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></span>
          Live Data from Supabase
        </span>
      </div>
    </div>
  );
}
