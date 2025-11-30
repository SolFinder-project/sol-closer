'use client';

import { useState, useEffect } from 'react';
import { getRecentTransactions } from '@/lib/supabase/transactions';

interface Transaction {
  wallet_address: string;
  accounts_closed: number;
  net_received: number;
  timestamp: number;
}

export default function LiveFeed() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  useEffect(() => {
    loadTransactions();
    
    // Refresh toutes les 30 secondes
    const interval = setInterval(() => {
      loadTransactions();
    }, 30000);
    
    return () => clearInterval(interval);
  }, []);

  const loadTransactions = async () => {
    const data = await getRecentTransactions(5);
    setTransactions(data || []);
    setLastUpdate(new Date());
    setLoading(false);
  };

  const formatWallet = (address: string) => {
    return `${address.slice(0, 4)}...${address.slice(-4)}`;
  };

  const formatTimeAgo = (timestamp: number) => {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    
    if (seconds < 60) return 'now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
    return `${Math.floor(seconds / 86400)}d`;
  };

  if (loading) {
    return (
      <div className="card-cyber">
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin text-2xl">⏳</div>
        </div>
      </div>
    );
  }

  if (transactions.length === 0) {
    return null;
  }

  return (
    <div className="card-cyber border-neon-green/30 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between mb-3 md:mb-4">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5 md:h-3 md:w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 md:h-3 md:w-3 bg-red-500"></span>
          </span>
          <h3 className="text-sm md:text-lg font-bold font-[family-name:var(--font-orbitron)] text-white">
            LIVE ACTIVITY
          </h3>
        </div>
        <span className="text-[10px] md:text-xs text-gray-500 hidden sm:block">
          Updated {formatTimeAgo(lastUpdate.getTime())} ago
        </span>
      </div>

      {/* Transactions list */}
      <div className="space-y-2">
        {transactions.map((tx, index) => (
          <div
            key={`${tx.wallet_address}-${tx.timestamp}`}
            className="flex items-center justify-between p-2 md:p-3 rounded-lg bg-dark-bg/50 hover:bg-dark-bg transition-colors gap-2"
            style={{ animationDelay: `${index * 100}ms` }}
          >
            {/* Left side - wallet & accounts */}
            <div className="flex items-center gap-2 md:gap-3 min-w-0 flex-1">
              <span className="text-base md:text-xl flex-shrink-0">💰</span>
              <div className="min-w-0 flex flex-col sm:flex-row sm:items-center sm:gap-2">
                <span className="font-mono text-xs md:text-sm text-gray-300 truncate">
                  {formatWallet(tx.wallet_address)}
                </span>
                <span className="text-gray-500 text-[10px] md:text-sm">
                  {tx.accounts_closed} acc.
                </span>
              </div>
            </div>
            
            {/* Right side - SOL amount & time */}
            <div className="flex items-center gap-2 md:gap-4 flex-shrink-0">
              <span className="text-neon-green font-bold font-mono text-xs md:text-base">
                +{tx.net_received.toFixed(4)}
              </span>
              <span className="text-[10px] md:text-xs text-gray-500 w-8 md:w-12 text-right">
                {formatTimeAgo(tx.timestamp)}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="mt-3 md:mt-4 pt-2 md:pt-3 border-t border-dark-border flex items-center justify-center">
        <span className="text-[10px] md:text-xs text-gray-500">
          🔄 Auto-refreshes every 30s
        </span>
      </div>
    </div>
  );
}
