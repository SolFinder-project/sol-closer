'use client';

import { useWallet } from '@solana/wallet-adapter-react';
import { useEffect, useState } from 'react';
import { getUserStats } from '@/lib/supabase/transactions';
import StatsCard from '@/components/ui/StatsCard';

interface UserStatsData {
  wallet_address: string;
  total_accounts_closed: number;
  total_sol_reclaimed: number;
  total_fees_paid: number;
  total_net_received: number;
  transaction_count: number;
  first_transaction_at: number;
  last_transaction_at: number;
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

      setLoading(true);
      const data = await getUserStats(publicKey.toString());
      setStats(data);
      setLoading(false);
    }

    loadStats();
  }, [publicKey]);

  if (!publicKey) {
    return (
      <div className="card-cyber text-center py-12">
        <div className="text-6xl mb-4">🔐</div>
        <p className="text-xl text-gray-400">Connect your wallet to view your dashboard</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="card-cyber text-center py-12">
        <div className="text-4xl mb-4 animate-spin">⏳</div>
        <p className="text-gray-400">Loading your stats...</p>
      </div>
    );
  }

  if (!stats || stats.transaction_count === 0) {
    return (
      <div className="card-cyber text-center py-12">
        <div className="text-6xl mb-4">🚀</div>
        <h3 className="text-2xl font-bold mb-2 font-[family-name:var(--font-orbitron)]">
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-neon-purple to-neon-pink">
            Start Your Journey
          </span>
        </h3>
        <p className="text-gray-400 mb-6">Close your first token account to see your stats here</p>
      </div>
    );
  }

  const daysSinceFirst = Math.floor((Date.now() - stats.first_transaction_at) / (1000 * 60 * 60 * 24));
  const avgPerTransaction = stats.transaction_count > 0 
    ? stats.total_sol_reclaimed / stats.transaction_count 
    : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="card-cyber">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold font-[family-name:var(--font-orbitron)] mb-2">
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-neon-purple to-neon-pink">
                My Dashboard
              </span>
            </h2>
            <p className="text-gray-400 font-mono text-sm">
              Member since {new Date(stats.first_transaction_at).toLocaleDateString()}
              {daysSinceFirst > 0 && ` (${daysSinceFirst} days ago)`}
            </p>
          </div>
          <div className="text-6xl animate-float">💎</div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          title="Accounts Closed"
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
        <div className="card-cyber border-neon-green/30 bg-gradient-to-br from-neon-green/10 to-transparent">
          <h3 className="text-xl font-bold mb-4 flex items-center">
            <span className="text-2xl mr-2">🎁</span>
            <span className="font-[family-name:var(--font-orbitron)]">Referral Earnings</span>
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-dark-bg/50 rounded-lg p-4">
              <p className="text-sm text-gray-400 mb-1">Total Earned</p>
              <p className="text-2xl font-bold text-neon-green font-mono">
                {stats.referral_earnings.toFixed(6)} SOL
              </p>
            </div>
            <div className="bg-dark-bg/50 rounded-lg p-4">
              <p className="text-sm text-gray-400 mb-1">Users Referred</p>
              <p className="text-2xl font-bold text-neon-purple font-mono">
                {stats.referral_count || 0}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Detailed Stats */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Financial Overview */}
        <div className="card-cyber">
          <h3 className="text-xl font-bold mb-4 flex items-center">
            <span className="text-2xl mr-2">💸</span>
            <span className="font-[family-name:var(--font-orbitron)]">Financial Overview</span>
          </h3>
          <div className="space-y-3">
            <div className="flex justify-between p-3 rounded-lg bg-dark-bg/50">
              <span className="text-gray-400">Total Reclaimed</span>
              <span className="font-bold text-neon-green font-mono">
                {stats.total_sol_reclaimed.toFixed(6)} SOL
              </span>
            </div>
            <div className="flex justify-between p-3 rounded-lg bg-dark-bg/50">
              <span className="text-gray-400">Service Fees Paid</span>
              <span className="font-bold text-orange-500 font-mono">
                {stats.total_fees_paid.toFixed(6)} SOL
              </span>
            </div>
            <div className="flex justify-between p-3 rounded-lg bg-dark-bg/50">
              <span className="text-gray-400">Net Received</span>
              <span className="font-bold text-neon-cyan font-mono">
                {stats.total_net_received.toFixed(6)} SOL
              </span>
            </div>
            <div className="flex justify-between p-3 rounded-lg bg-gradient-to-r from-neon-purple/20 to-neon-pink/20 border border-neon-purple/30">
              <span className="text-gray-200 font-semibold">Avg per Transaction</span>
              <span className="font-bold text-white font-mono">
                {avgPerTransaction.toFixed(6)} SOL
              </span>
            </div>
          </div>
        </div>

        {/* Activity Summary */}
        <div className="card-cyber">
          <h3 className="text-xl font-bold mb-4 flex items-center">
            <span className="text-2xl mr-2">📈</span>
            <span className="font-[family-name:var(--font-orbitron)]">Activity Summary</span>
          </h3>
          <div className="space-y-3">
            <div className="flex justify-between p-3 rounded-lg bg-dark-bg/50">
              <span className="text-gray-400">Total Transactions</span>
              <span className="font-bold text-neon-purple font-mono">
                {stats.transaction_count}
              </span>
            </div>
            <div className="flex justify-between p-3 rounded-lg bg-dark-bg/50">
              <span className="text-gray-400">Accounts Closed</span>
              <span className="font-bold text-neon-pink font-mono">
                {stats.total_accounts_closed}
              </span>
            </div>
            <div className="flex justify-between p-3 rounded-lg bg-dark-bg/50">
              <span className="text-gray-400">First Transaction</span>
              <span className="font-bold text-gray-300 text-sm">
                {new Date(stats.first_transaction_at).toLocaleDateString()}
              </span>
            </div>
            <div className="flex justify-between p-3 rounded-lg bg-dark-bg/50">
              <span className="text-gray-400">Last Transaction</span>
              <span className="font-bold text-gray-300 text-sm">
                {new Date(stats.last_transaction_at).toLocaleDateString()}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Progress */}
      <div className="card-cyber border-neon-purple/30">
        <h3 className="text-xl font-bold mb-4 flex items-center">
          <span className="text-2xl mr-2">🎯</span>
          <span className="font-[family-name:var(--font-orbitron)]">Your Progress</span>
        </h3>
        <div className="space-y-4">
          <div>
            <div className="flex justify-between text-sm mb-2">
              <span className="text-gray-400">SOL Reclaimed</span>
              <span className="text-neon-green font-mono">{stats.total_sol_reclaimed.toFixed(2)} / 10.00 SOL</span>
            </div>
            <div className="w-full bg-dark-bg rounded-full h-3 overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-neon-purple to-neon-pink rounded-full transition-all duration-500"
                style={{ width: `${Math.min((stats.total_sol_reclaimed / 10) * 100, 100)}%` }}
              ></div>
            </div>
          </div>

          <div>
            <div className="flex justify-between text-sm mb-2">
              <span className="text-gray-400">Accounts Closed</span>
              <span className="text-neon-cyan font-mono">{stats.total_accounts_closed} / 50</span>
            </div>
            <div className="w-full bg-dark-bg rounded-full h-3 overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-neon-cyan to-neon-green rounded-full transition-all duration-500"
                style={{ width: `${Math.min((stats.total_accounts_closed / 50) * 100, 100)}%` }}
              ></div>
            </div>
          </div>
        </div>
      </div>

      {/* Data source indicator */}
      <div className="text-center">
        <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-green-500/10 border border-green-500/30 text-green-400 text-sm">
          <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></span>
          Live Data from Supabase
        </span>
      </div>
    </div>
  );
}
