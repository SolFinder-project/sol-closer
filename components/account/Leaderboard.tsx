'use client';

import { useState, useEffect, useCallback } from 'react';
import { getLeaderboard } from '@/lib/supabase/transactions';

interface LeaderboardUser {
  wallet_address: string;
  total_sol_reclaimed: number;
  total_accounts_closed: number;
  referral_earnings: number;
}

type LeaderboardType = 'sol' | 'accounts' | 'referrals';

export default function Leaderboard() {
  const [activeTab, setActiveTab] = useState<LeaderboardType>('sol');
  const [leaderboard, setLeaderboard] = useState<LeaderboardUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);

  const copyWalletAddress = useCallback((address: string) => {
    void navigator.clipboard.writeText(address).then(() => {
      setCopiedAddress(address);
      window.setTimeout(() => setCopiedAddress((a) => (a === address ? null : a)), 2000);
    });
  }, []);

  useEffect(() => {
    async function loadLeaderboard() {
      setLoading(true);
      const data = await getLeaderboard(10);
      setLeaderboard(data || []);
      setLoading(false);
    }
    loadLeaderboard();

    const interval = setInterval(loadLeaderboard, 30000);
    return () => clearInterval(interval);
  }, []);

  const getSortedLeaderboard = () => {
    const sorted = [...leaderboard];
    switch (activeTab) {
      case 'sol':
        return sorted.sort((a, b) => b.total_sol_reclaimed - a.total_sol_reclaimed);
      case 'accounts':
        return sorted.sort((a, b) => b.total_accounts_closed - a.total_accounts_closed);
      case 'referrals':
        return sorted.sort((a, b) => (b.referral_earnings || 0) - (a.referral_earnings || 0));
      default:
        return sorted;
    }
  };

  const formatWallet = (address: string) => {
    return `${address.slice(0, 4)}...${address.slice(-4)}`;
  };

  const getEmojiForRank = (rank: number) => {
    switch (rank) {
      case 1: return '🥇';
      case 2: return '🥈';
      case 3: return '🥉';
      default: return '🏅';
    }
  };

  const sortedData = getSortedLeaderboard();

  if (loading) {
    return (
      <div className="card-cyber text-center py-10 md:py-12 border-dark-border">
        <div className="text-4xl mb-3 animate-spin">⏳</div>
        <p className="text-sm text-gray-400">Loading leaderboard...</p>
      </div>
    );
  }

  if (leaderboard.length === 0) {
    return (
      <div className="animate-slide-up max-w-xl mx-auto">
        <div className="card-cyber text-center py-10 md:py-12 border-dark-border">
          <div className="text-5xl md:text-6xl mb-4">🏆</div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Leaderboard</p>
          <h2 className="text-2xl md:text-3xl font-bold font-[family-name:var(--font-orbitron)] text-white mb-3">No data yet</h2>
          <p className="text-sm text-gray-400">Be the first to appear on the leaderboard.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-slide-up space-y-8 md:space-y-10">
      <div className="text-center mb-8 md:mb-10">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Leaderboard</p>
        <h1 className="text-2xl md:text-4xl lg:text-5xl font-bold font-[family-name:var(--font-orbitron)] text-white mb-2">
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-neon-purple to-neon-pink">Top reclaimers</span>
        </h1>
        <p className="text-sm text-gray-400">Top performers globally. Refreshes every 30s.</p>
      </div>

      <div className="flex flex-wrap justify-center gap-2 md:gap-3">
        <button
          onClick={() => setActiveTab('sol')}
          className={`px-4 md:px-5 py-2.5 rounded-xl font-semibold text-sm transition-all ${
            activeTab === 'sol'
              ? 'bg-neon-purple text-white'
              : 'border border-dark-border text-gray-400 hover:bg-white/5 hover:border-neon-purple/40'
          }`}
        >
          💎 <span className="hidden sm:inline">Most </span>SOL
        </button>
        <button
          onClick={() => setActiveTab('accounts')}
          className={`px-4 md:px-5 py-2.5 rounded-xl font-semibold text-sm transition-all ${
            activeTab === 'accounts'
              ? 'bg-neon-purple text-white'
              : 'border border-dark-border text-gray-400 hover:bg-white/5 hover:border-neon-purple/40'
          }`}
        >
          🔒 <span className="hidden sm:inline">Most </span>Accounts
        </button>
        <button
          onClick={() => setActiveTab('referrals')}
          className={`px-4 md:px-5 py-2.5 rounded-xl font-semibold text-sm transition-all ${
            activeTab === 'referrals'
              ? 'bg-neon-purple text-white'
              : 'border border-dark-border text-gray-400 hover:bg-white/5 hover:border-neon-purple/40'
          }`}
        >
          ⭐ <span className="hidden sm:inline">Most </span>Referrals
        </button>
      </div>

      <div className="space-y-3 md:space-y-4">
        {sortedData.map((user, index) => {
          const rank = index + 1;
          const value =
            activeTab === 'sol'
              ? user.total_sol_reclaimed.toFixed(4)
              : activeTab === 'accounts'
              ? user.total_accounts_closed.toString()
              : (user.referral_earnings || 0).toFixed(4);
          const label = activeTab === 'sol' ? 'SOL' : activeTab === 'accounts' ? 'Accounts' : 'SOL Earned';
          return (
            <div
              key={user.wallet_address}
              className={`card-cyber flex items-center justify-between p-4 md:p-5 border-dark-border ${
                rank <= 3 ? 'border-neon-purple/50' : ''
              }`}
            >
              <div className="flex items-center gap-3 md:gap-4 min-w-0">
                <span className="text-2xl md:text-3xl shrink-0">{getEmojiForRank(rank)}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-base md:text-lg font-bold text-white">#{rank}</p>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    <p className="text-xs md:text-sm text-gray-400 font-mono truncate max-w-[min(100%,14rem)] sm:max-w-xs" title={user.wallet_address}>
                      {formatWallet(user.wallet_address)}
                    </p>
                    <button
                      type="button"
                      onClick={() => copyWalletAddress(user.wallet_address)}
                      className="shrink-0 px-2 py-0.5 rounded-md text-xs font-medium border border-dark-border text-gray-400 hover:text-white hover:border-neon-purple/50 transition-colors"
                    >
                      {copiedAddress === user.wallet_address ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className={`text-lg md:text-xl font-bold font-[family-name:var(--font-orbitron)] ${
                  activeTab === 'sol' ? 'text-neon-purple' : activeTab === 'accounts' ? 'text-neon-pink' : 'text-neon-cyan'
                }`}>
                  {value}
                </p>
                <p className="text-xs text-gray-400">{label}</p>
              </div>
            </div>
          );
        })}
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
