'use client';

import { useWallet } from '@solana/wallet-adapter-react';
import { useEffect, useState } from 'react';
import { getUserStats } from '@/lib/supabase/transactions';

interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  requirement: number;
  progress: number;
  unlocked: boolean;
  category: 'accounts' | 'sol' | 'transactions' | 'referral';
}

const ACHIEVEMENT_DEFINITIONS = [
  { id: 'first_close', name: 'First Steps', description: 'Close your first token account', icon: '🎯', requirement: 1, category: 'accounts' as const },
  { id: 'close_10', name: 'Getting Started', description: 'Close 10 token accounts', icon: '🔟', requirement: 10, category: 'accounts' as const },
  { id: 'close_50', name: 'Cleanup Crew', description: 'Close 50 token accounts', icon: '🧹', requirement: 50, category: 'accounts' as const },
  { id: 'close_100', name: 'Account Slayer', description: 'Close 100 token accounts', icon: '⚔️', requirement: 100, category: 'accounts' as const },
  { id: 'sol_0.1', name: 'Pocket Change', description: 'Reclaim 0.1 SOL', icon: '🪙', requirement: 0.1, category: 'sol' as const },
  { id: 'sol_1', name: 'One SOL Club', description: 'Reclaim 1 SOL', icon: '💰', requirement: 1, category: 'sol' as const },
  { id: 'sol_5', name: 'SOL Collector', description: 'Reclaim 5 SOL', icon: '💎', requirement: 5, category: 'sol' as const },
  { id: 'tx_5', name: 'Regular User', description: 'Complete 5 transactions', icon: '📝', requirement: 5, category: 'transactions' as const },
  { id: 'tx_20', name: 'Power User', description: 'Complete 20 transactions', icon: '⚡', requirement: 20, category: 'transactions' as const },
  { id: 'referral_1', name: 'Spread the Word', description: 'Refer your first user', icon: '🎁', requirement: 1, category: 'referral' as const },
  { id: 'referral_5', name: 'Influencer', description: 'Refer 5 users', icon: '📢', requirement: 5, category: 'referral' as const },
  { id: 'referral_10', name: 'Ambassador', description: 'Refer 10 users', icon: '🌟', requirement: 10, category: 'referral' as const },
];

export default function Achievements() {
  const { publicKey } = useWallet();
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [filter, setFilter] = useState<'all' | 'unlocked' | 'locked'>('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAchievements();
  }, [publicKey]);

  const loadAchievements = async () => {
    if (!publicKey) {
      setAchievements([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    
    try {
      const stats = await getUserStats(publicKey.toString());
      
      const computed: Achievement[] = ACHIEVEMENT_DEFINITIONS.map(def => {
        let progress = 0;
        
        if (stats) {
          switch (def.category) {
            case 'accounts': progress = stats.total_accounts_closed || 0; break;
            case 'sol': progress = stats.total_sol_reclaimed || 0; break;
            case 'transactions': progress = stats.transaction_count || 0; break;
            case 'referral': progress = stats.referral_count || 0; break;
          }
        }
        
        return { ...def, progress, unlocked: progress >= def.requirement };
      });
      
      setAchievements(computed);
    } catch (error) {
      console.error('Error loading achievements:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredAchievements = achievements.filter(a => {
    if (filter === 'unlocked') return a.unlocked;
    if (filter === 'locked') return !a.unlocked;
    return true;
  });

  const unlockedCount = achievements.filter(a => a.unlocked).length;
  const totalCount = achievements.length;

  if (!publicKey) {
    return (
      <div className="card-cyber text-center py-12">
        <div className="text-6xl mb-4">🏆</div>
        <p className="text-xl text-gray-400">Connect your wallet to view achievements</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="card-cyber text-center py-12">
        <div className="text-4xl mb-4 animate-spin">⏳</div>
        <p className="text-gray-400">Loading achievements...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="card-cyber">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h2 className="text-3xl font-bold font-[family-name:var(--font-orbitron)] mb-2">
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-neon-purple to-neon-pink">
                Achievements
              </span>
            </h2>
            <p className="text-gray-400 text-sm">{unlockedCount} / {totalCount} unlocked</p>
          </div>
          <div className="w-full md:w-64">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-gray-400">Progress</span>
              <span className="text-neon-purple font-mono">
                {totalCount > 0 ? Math.round((unlockedCount / totalCount) * 100) : 0}%
              </span>
            </div>
            <div className="w-full bg-dark-bg rounded-full h-3 overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-neon-purple to-neon-pink rounded-full transition-all duration-500"
                style={{ width: `${totalCount > 0 ? (unlockedCount / totalCount) * 100 : 0}%` }}
              ></div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        {(['all', 'unlocked', 'locked'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              filter === f
                ? 'bg-gradient-to-r from-neon-purple to-neon-pink text-white'
                : 'bg-dark-card text-gray-400 hover:text-white border border-dark-border'
            }`}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredAchievements.map((achievement) => (
          <div
            key={achievement.id}
            className={`card-cyber transition-all ${
              achievement.unlocked
                ? 'border-neon-purple/50 bg-gradient-to-br from-neon-purple/10 to-transparent'
                : 'opacity-60 hover:opacity-80'
            }`}
          >
            <div className="text-center">
              <div className={`text-5xl mb-4 ${achievement.unlocked ? 'animate-float' : 'grayscale'}`}>
                {achievement.icon}
              </div>
              <h3 className={`text-lg font-bold mb-2 font-[family-name:var(--font-orbitron)] ${
                achievement.unlocked ? 'text-neon-purple' : 'text-gray-400'
              }`}>
                {achievement.name}
              </h3>
              <p className="text-xs text-gray-400 mb-4">{achievement.description}</p>
              {achievement.unlocked ? (
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-neon-green/20 border border-neon-green/30 text-neon-green text-xs">
                  <span>✓</span><span>Unlocked!</span>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>Progress</span>
                    <span className="font-mono">
                      {achievement.category === 'sol' 
                        ? `${achievement.progress.toFixed(2)} / ${achievement.requirement}`
                        : `${achievement.progress} / ${achievement.requirement}`}
                    </span>
                  </div>
                  <div className="w-full bg-dark-bg rounded-full h-2 overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-neon-purple/50 to-neon-pink/50 rounded-full"
                      style={{ width: `${Math.min((achievement.progress / achievement.requirement) * 100, 100)}%` }}
                    ></div>
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="text-center">
        <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-green-500/10 border border-green-500/30 text-green-400 text-sm">
          <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></span>
          Live Data from Supabase
        </span>
      </div>
    </div>
  );
}
