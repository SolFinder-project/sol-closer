'use client';

import { useWallet } from '@solana/wallet-adapter-react';
import { useEffect, useState } from 'react';
import { getUserStats, statsTimestampToMs } from '@/lib/supabase/transactions';
import StatsCard from '@/components/ui/StatsCard';
import CreatorBadge from '@/components/nft-creator/CreatorBadge';

interface UserStatsData {
  wallet_address: string;
  total_accounts_closed: number;
  total_sol_reclaimed: number;
  total_fees_paid: number;
  total_net_received: number;
  transaction_count: number;
  /** Epoch seconds, epoch ms, or ISO string (Supabase int/timestamptz). */
  first_transaction_at: number | string;
  last_transaction_at: number | string;
  referral_earnings?: number;
  referral_count?: number;
}

export default function UserDashboard() {
  const { publicKey } = useWallet();
  const [stats, setStats] = useState<UserStatsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadStats() {
      if (!publicKey) {
        setStats(null);
        setLoading(false);
        return;
      }
      setStats(null);
      setLoading(true);
      const data = await getUserStats(publicKey.toString());
      setStats(data);
      setLoading(false);
    }

    loadStats();
  }, [publicKey]);

  if (!publicKey) {
    return (
      <div className="animate-slide-up max-w-xl mx-auto">
        <div className="card-cyber text-center py-10 md:py-12 border-dark-border">
          <div className="text-5xl md:text-6xl mb-4">🔐</div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Dashboard</p>
          <h2 className="text-2xl md:text-3xl font-bold font-[family-name:var(--font-orbitron)] text-white mb-3">Connect your wallet</h2>
          <p className="text-sm text-gray-400">Connect your wallet to view your reclaim stats and progress.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="card-cyber text-center py-10 md:py-12 border-dark-border">
        <div className="text-4xl mb-3 animate-spin">⏳</div>
        <p className="text-sm text-gray-400">Loading your stats...</p>
      </div>
    );
  }

  if (!stats || stats.transaction_count === 0) {
    return (
      <div className="animate-slide-up max-w-xl mx-auto">
        <div className="card-cyber text-center py-10 md:py-12 border-dark-border">
          <div className="text-5xl md:text-6xl mb-4">🚀</div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Dashboard</p>
          <h2 className="text-2xl md:text-3xl font-bold font-[family-name:var(--font-orbitron)] text-white mb-3">
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-neon-purple to-neon-pink">Start your journey</span>
          </h2>
          <p className="text-sm text-gray-400">Do your first reclaim (empty, dust, Pump PDA or PumpSwap PDA) to see your stats here.</p>
        </div>
      </div>
    );
  }

  const firstMs = statsTimestampToMs(stats.first_transaction_at);
  const daysSinceFirst = Math.floor((Date.now() - firstMs) / (1000 * 60 * 60 * 24));
  const avgPerTransaction = stats.transaction_count > 0 
    ? stats.total_sol_reclaimed / stats.transaction_count 
    : 0;

  return (
    <div className="animate-slide-up space-y-8 md:space-y-10">
      <div className="text-center md:text-left mb-8 md:mb-10">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Dashboard</p>
        <h1 className="text-2xl md:text-4xl lg:text-5xl font-bold font-[family-name:var(--font-orbitron)] text-white mb-2">
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-neon-purple to-neon-pink">My stats</span>
        </h1>
        <p className="text-sm text-gray-400 font-mono flex items-center justify-center md:justify-start gap-2 flex-wrap">
          Member since {new Date(statsTimestampToMs(stats.first_transaction_at)).toLocaleDateString()}
          {daysSinceFirst > 0 && ` · ${daysSinceFirst} days ago`}
          <CreatorBadge wallet={publicKey?.toString() ?? null} />
        </p>
      </div>

      {/* Stats Grid — same as landing */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <StatsCard
          title="Items closed"
          value={stats.total_accounts_closed.toString()}
          icon="🔒"
          color="purple"
        />
        <StatsCard
          title="SOL Reclaimed"
          value={stats.total_sol_reclaimed.toFixed(4)}
          icon="💰"
          color="pink"
        />
        <StatsCard
          title="Net Received"
          value={stats.total_net_received.toFixed(4)}
          icon="✨"
          color="cyan"
        />
        <StatsCard
          title="Transactions"
          value={stats.transaction_count.toString()}
          icon="⚡"
          color="green"
        />
      </div>

      {/* Referral Stats (if any) */}
      {(stats.referral_earnings && stats.referral_earnings > 0) && (
        <div>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Referral earnings</h2>
          <div className="grid grid-cols-2 gap-3 md:gap-4">
            <div className="card-cyber border-neon-green/30 bg-dark-card/80 py-5 px-4">
              <p className="text-xs text-gray-400 mb-1">Total Earned</p>
              <p className="text-xl font-bold text-neon-green font-mono">{stats.referral_earnings.toFixed(6)} SOL</p>
            </div>
            <div className="card-cyber border-neon-purple/30 bg-dark-card/80 py-5 px-4">
              <p className="text-xs text-gray-400 mb-1">Users Referred</p>
              <p className="text-xl font-bold text-neon-purple font-mono">{stats.referral_count || 0}</p>
            </div>
          </div>
        </div>
      )}

      {/* Detailed Stats */}
      <div>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider text-center mb-6">Overview</h2>
        <div className="grid md:grid-cols-2 gap-4">
          <div className="card-cyber border-dark-border p-4 md:p-5">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Financial</p>
            <div className="space-y-2">
              <div className="flex justify-between p-3 rounded-lg bg-dark-bg text-sm">
                <span className="text-gray-400">Total Reclaimed</span>
                <span className="font-mono font-semibold text-neon-green">{stats.total_sol_reclaimed.toFixed(6)} SOL</span>
              </div>
              <div className="flex justify-between p-3 rounded-lg bg-dark-bg text-sm">
                <span className="text-gray-400">Service Fees Paid</span>
                <span className="font-mono font-semibold text-orange-500">{stats.total_fees_paid.toFixed(6)} SOL</span>
              </div>
              <div className="flex justify-between p-3 rounded-lg bg-dark-bg text-sm">
                <span className="text-gray-400">Net Received</span>
                <span className="font-mono font-semibold text-neon-cyan">{stats.total_net_received.toFixed(6)} SOL</span>
              </div>
              <div className="flex justify-between p-3 rounded-lg bg-neon-purple/10 border border-neon-purple/30 text-sm">
                <span className="text-gray-200 font-medium">Avg per tx</span>
                <span className="font-mono font-bold text-white">{avgPerTransaction.toFixed(6)} SOL</span>
              </div>
            </div>
          </div>
          <div className="card-cyber border-dark-border p-4 md:p-5">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Activity</p>
            <div className="space-y-2">
              <div className="flex justify-between p-3 rounded-lg bg-dark-bg text-sm">
                <span className="text-gray-400">Total Transactions</span>
                <span className="font-mono font-semibold text-neon-purple">{stats.transaction_count}</span>
              </div>
              <div className="flex justify-between p-3 rounded-lg bg-dark-bg text-sm">
                <span className="text-gray-400">Items closed</span>
                <span className="font-mono font-semibold text-neon-pink">{stats.total_accounts_closed}</span>
              </div>
              <div className="flex justify-between p-3 rounded-lg bg-dark-bg text-sm">
                <span className="text-gray-400">First tx</span>
                <span className="font-mono text-gray-300 text-xs">{new Date(statsTimestampToMs(stats.first_transaction_at)).toLocaleDateString()}</span>
              </div>
              <div className="flex justify-between p-3 rounded-lg bg-dark-bg text-sm">
                <span className="text-gray-400">Last tx</span>
                <span className="font-mono text-gray-300 text-xs">{new Date(statsTimestampToMs(stats.last_transaction_at)).toLocaleDateString()}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Progress */}
      <div>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Your progress</h2>
        <div className="card-cyber border-neon-purple/30 p-4 md:p-5">
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-xs md:text-sm mb-2">
                <span className="text-gray-400">SOL Reclaimed</span>
                <span className="font-mono text-neon-green">{stats.total_sol_reclaimed.toFixed(2)} / 10 SOL</span>
              </div>
              <div className="w-full bg-dark-bg rounded-full h-2.5 overflow-hidden">
                <div className="h-full bg-gradient-to-r from-neon-purple to-neon-pink rounded-full transition-all duration-500" style={{ width: `${Math.min((stats.total_sol_reclaimed / 10) * 100, 100)}%` }} />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-xs md:text-sm mb-2">
                <span className="text-gray-400">Items closed</span>
                <span className="font-mono text-neon-cyan">{stats.total_accounts_closed} / 50</span>
              </div>
              <div className="w-full bg-dark-bg rounded-full h-2.5 overflow-hidden">
                <div className="h-full bg-gradient-to-r from-neon-cyan to-neon-green rounded-full transition-all duration-500" style={{ width: `${Math.min((stats.total_accounts_closed / 50) * 100, 100)}%` }} />
              </div>
            </div>
          </div>
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
