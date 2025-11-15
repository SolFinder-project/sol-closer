'use client';

import { useState, useEffect } from 'react';
import WalletButton from '@/components/wallet/WalletButton';
import AccountScanner from '@/components/account/AccountScanner';
import ReferralDashboard from '@/components/account/ReferralDashboard';
import UserDashboard from '@/components/account/UserDashboard';
import TransactionHistory from '@/components/account/TransactionHistory';
import Achievements from '@/components/account/Achievements';
import Leaderboard from '@/components/account/Leaderboard';
import Logo from '@/components/ui/Logo';
import StatsCard from '@/components/ui/StatsCard';
import { getGlobalStats } from '@/lib/supabase/transactions';

type Section = 'home' | 'scanner' | 'dashboard' | 'history' | 'referral' | 'achievements' | 'leaderboard';

export default function Home() {
  const [currentSection, setCurrentSection] = useState<Section>('home');
  const [globalStats, setGlobalStats] = useState({
    totalClosed: '0',
    totalReclaimed: '0',
    activeUsers: '0',
    avgReclaim: '0',
  });

  // 🔥 NOUVEAU : Charger les vraies stats depuis Supabase
  useEffect(() => {
    async function loadStats() {
      const stats = await getGlobalStats();
      if (stats) {
        setGlobalStats({
          totalClosed: stats.total_accounts_closed.toString(),
          totalReclaimed: stats.total_sol_reclaimed.toFixed(2),
          activeUsers: stats.total_users.toString(),
          avgReclaim: stats.total_users > 0 
            ? (stats.total_sol_reclaimed / stats.total_users).toFixed(4)
            : '0',
        });
      }
    }
    loadStats();
    
    // Refresh toutes les 10 secondes
    const interval = setInterval(loadStats, 10000);
    return () => clearInterval(interval);
  }, []);

  const renderSection = () => {
    switch (currentSection) {
      case 'scanner':
        return <AccountScanner />;
      case 'dashboard':
        return <UserDashboard />;
      case 'history':
        return <TransactionHistory />;
      case 'referral':
        return <ReferralDashboard />;
      case 'achievements':
        return <Achievements />;
      case 'leaderboard':
        return <Leaderboard />;
      default:
        return <HomeContent setSection={setCurrentSection} globalStats={globalStats} />;
    }
  };

  return (
    <main className="min-h-screen">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-neon-purple/10 rounded-full blur-3xl animate-pulse-slow"></div>
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-neon-pink/10 rounded-full blur-3xl animate-pulse-slow" style={{ animationDelay: '1s' }}></div>
      </div>

      <header className="sticky top-0 z-50 backdrop-blur-xl bg-dark-bg/80 border-b border-dark-border">
        <div className="container mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <div onClick={() => setCurrentSection('home')} className="cursor-pointer">
              <Logo />
            </div>
            
            <nav className="hidden md:flex items-center space-x-6 text-sm">
              <button onClick={() => setCurrentSection('scanner')} className="text-gray-400 hover:text-neon-purple transition-colors">
                Scanner
              </button>
              <button onClick={() => setCurrentSection('dashboard')} className="text-gray-400 hover:text-neon-purple transition-colors">
                Dashboard
              </button>
              <button onClick={() => setCurrentSection('history')} className="text-gray-400 hover:text-neon-purple transition-colors">
                History
              </button>
              <button onClick={() => setCurrentSection('referral')} className="text-gray-400 hover:text-neon-purple transition-colors">
                Referral
              </button>
              <button onClick={() => setCurrentSection('achievements')} className="text-gray-400 hover:text-neon-purple transition-colors">
                Achievements
              </button>
              <button onClick={() => setCurrentSection('leaderboard')} className="text-gray-400 hover:text-neon-purple transition-colors">
                Leaderboard
              </button>
            </nav>

            <WalletButton />
          </div>
        </div>
      </header>

      <div className="relative z-10">
        <section className="container mx-auto px-4 py-12">
          {renderSection()}
        </section>

        <footer className="border-t border-dark-border bg-dark-card/50 backdrop-blur-xl mt-20">
          <div className="container mx-auto px-4 py-12">
            <div className="grid md:grid-cols-4 gap-8">
              <div className="col-span-2">
                <Logo />
                <p className="text-gray-400 text-sm mt-4 leading-relaxed">
                  The most efficient way to reclaim locked SOL from unused token accounts on Solana.
                </p>
              </div>

              <div>
                <h4 className="font-bold mb-4 text-neon-purple">Quick Links</h4>
                <ul className="space-y-2 text-sm text-gray-400">
                  <li><button onClick={() => setCurrentSection('scanner')} className="hover:text-neon-purple transition-colors">Scanner</button></li>
                  <li><button onClick={() => setCurrentSection('dashboard')} className="hover:text-neon-purple transition-colors">Dashboard</button></li>
                  <li><button onClick={() => setCurrentSection('referral')} className="hover:text-neon-purple transition-colors">Referral</button></li>
                  <li><button onClick={() => setCurrentSection('leaderboard')} className="hover:text-neon-purple transition-colors">Leaderboard</button></li>
                </ul>
              </div>

              <div>
                <h4 className="font-bold mb-4 text-neon-pink">Community</h4>
                <ul className="space-y-2 text-sm text-gray-400">
                  <li><a href="https://github.com/SolFinder-project/sol-finder" target="_blank" rel="noopener noreferrer" className="hover:text-neon-pink transition-colors">GitHub</a></li>
                  <li><a href="https://twitter.com/MisterMppCryp" target="_blank" rel="noopener noreferrer" className="hover:text-neon-pink transition-colors">Twitter</a></li>
                </ul>
              </div>
            </div>

            <div className="border-t border-dark-border mt-12 pt-8 text-center">
              <p className="text-gray-500 text-sm font-mono">
                © 2025 SolFinder - Built with 💜 on Solana
              </p>
              <div className="flex justify-center space-x-4 mt-4 text-xs text-gray-600">
                <span>Open Source</span>
                <span>•</span>
                <span>Secure</span>
                <span>•</span>
                <span>Transparent</span>
              </div>
            </div>
          </div>
        </footer>
      </div>
    </main>
  );
}

function HomeContent({ setSection, globalStats }: { setSection: (section: Section) => void; globalStats: any }) {
  return (
    <>
      {/* Hero Section */}
      <div className="text-center mb-16 animate-slide-up">
        <div className="inline-block mb-4">
          <span className="px-4 py-2 rounded-full bg-neon-purple/10 border border-neon-purple/30 text-neon-purple text-sm font-mono">
            🤝 By the Community, For the Community
          </span>
        </div>
        
        <h1 className="text-5xl md:text-7xl font-bold font-[family-name:var(--font-orbitron)] mb-6">
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-neon-purple via-neon-pink to-neon-cyan animate-glow">
            Recover Your
          </span>
          <br />
          <span className="text-white">Locked SOL</span>
        </h1>
        
        <p className="text-xl text-gray-400 max-w-3xl mx-auto mb-8 leading-relaxed">
          Close unused SPL token accounts and reclaim your rent deposits.
          <br />
          <span className="text-neon-green">Each account = ~0.00204 SOL</span> waiting to be recovered.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
          <button onClick={() => setSection('scanner')} className="btn-cyber">
            Start Scanning →
          </button>
          <button onClick={() => setSection('dashboard')} className="px-6 py-3 rounded-lg font-bold border-2 border-neon-purple/30 text-neon-purple hover:bg-neon-purple/10 transition-all duration-300">
            View Dashboard
          </button>
        </div>
      </div>

      {/* Global Stats - VRAIES DONNÉES */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-16">
        <StatsCard
          title="Accounts Closed"
          value={globalStats.totalClosed}
          icon="🔒"
          trend="Live data"
          color="purple"
        />
        <StatsCard
          title="SOL Reclaimed"
          value={`${globalStats.totalReclaimed}`}
          icon="💎"
          trend="Real-time"
          color="pink"
        />
        <StatsCard
          title="Active Users"
          value={globalStats.activeUsers}
          icon="👥"
          trend="Growing"
          color="cyan"
        />
        <StatsCard
          title="Avg. Recovery"
          value={`${globalStats.avgReclaim} SOL`}
          icon="⚡"
          color="green"
        />
      </div>

      {/* Quick Access Cards */}
      <div className="grid md:grid-cols-3 gap-6 mb-16">
        <button onClick={() => setSection('scanner')} className="card-cyber text-left group hover:scale-105 transition-transform">
          <div className="text-5xl mb-4 group-hover:animate-float">🔍</div>
          <h3 className="text-2xl font-bold mb-2 font-[family-name:var(--font-orbitron)] text-neon-purple">
            Scan Wallet
          </h3>
          <p className="text-gray-400">
            Find and close unused token accounts to reclaim your SOL
          </p>
        </button>

        <button onClick={() => setSection('referral')} className="card-cyber text-left group hover:scale-105 transition-transform">
          <div className="text-5xl mb-4 group-hover:animate-float" style={{ animationDelay: '0.1s' }}>🎁</div>
          <h3 className="text-2xl font-bold mb-2 font-[family-name:var(--font-orbitron)] text-neon-pink">
            Refer & Earn
          </h3>
          <p className="text-gray-400">
            Get 10% of SOL reclaimed by users you refer to SolFinder
          </p>
        </button>

        <button onClick={() => setSection('leaderboard')} className="card-cyber text-left group hover:scale-105 transition-transform">
          <div className="text-5xl mb-4 group-hover:animate-float" style={{ animationDelay: '0.2s' }}>🏆</div>
          <h3 className="text-2xl font-bold mb-2 font-[family-name:var(--font-orbitron)] text-neon-cyan">
            Leaderboard
          </h3>
          <p className="text-gray-400">
            Compete with others and see top performers globally
          </p>
        </button>
      </div>

      {/* How It Works Section */}
      <div className="mb-16">
        <h2 className="text-4xl font-bold text-center mb-12 font-[family-name:var(--font-orbitron)]">
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-neon-purple to-neon-pink">
            How It Works
          </span>
        </h2>

        <div className="grid md:grid-cols-4 gap-6">
          <div className="card-cyber text-center">
            <div className="text-5xl mb-4">🔌</div>
            <h3 className="text-xl font-bold mb-2 text-neon-purple">1. Connect</h3>
            <p className="text-sm text-gray-400">Connect your Solana wallet securely via Phantom or Solflare</p>
          </div>

          <div className="card-cyber text-center">
            <div className="text-5xl mb-4">🔍</div>
            <h3 className="text-xl font-bold mb-2 text-neon-pink">2. Scan</h3>
            <p className="text-sm text-gray-400">We scan your wallet for empty SPL token accounts</p>
          </div>

          <div className="card-cyber text-center">
            <div className="text-5xl mb-4">✅</div>
            <h3 className="text-xl font-bold mb-2 text-neon-cyan">3. Select</h3>
            <p className="text-sm text-gray-400">Choose which accounts you want to close and reclaim</p>
          </div>

          <div className="card-cyber text-center">
            <div className="text-5xl mb-4">💰</div>
            <h3 className="text-xl font-bold mb-2 text-neon-green">4. Claim</h3>
            <p className="text-sm text-gray-400">Approve the transaction and receive your SOL instantly</p>
          </div>
        </div>
      </div>

      {/* Why Choose SolFinder */}
      <div className="mb-16">
        <h2 className="text-4xl font-bold text-center mb-12 font-[family-name:var(--font-orbitron)]">
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-neon-cyan to-neon-green">
            Why Choose SolFinder
          </span>
        </h2>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="card-cyber border-neon-purple/30">
            <div className="text-4xl mb-4">🔒</div>
            <h3 className="text-xl font-bold mb-2 text-neon-purple">Secure by Design</h3>
            <p className="text-sm text-gray-400">
              Your keys never leave your wallet. All transactions are signed by you, ensuring maximum security.
            </p>
          </div>

          <div className="card-cyber border-neon-pink/30">
            <div className="text-4xl mb-4">⚡</div>
            <h3 className="text-xl font-bold mb-2 text-neon-pink">Lightning Fast</h3>
            <p className="text-sm text-gray-400">
              Powered by Solana's blazing-fast blockchain. Close accounts and receive SOL in seconds.
            </p>
          </div>

          <div className="card-cyber border-neon-cyan/30">
            <div className="text-4xl mb-4">💎</div>
            <h3 className="text-xl font-bold mb-2 text-neon-cyan">Transparent Fees</h3>
            <p className="text-sm text-gray-400">
              Simple 15% service fee. No hidden costs. You always know exactly what you'll receive.
            </p>
          </div>

          <div className="card-cyber border-neon-green/30">
            <div className="text-4xl mb-4">🎁</div>
            <h3 className="text-xl font-bold mb-2 text-neon-green">Earn Rewards</h3>
            <p className="text-sm text-gray-400">
              Refer friends and earn 10% of their reclaimed SOL. Build passive income effortlessly.
            </p>
          </div>
        </div>
      </div>

      {/* Important Notes */}
      <div className="card-cyber border-blue-500/30 bg-gradient-to-br from-blue-500/5 to-transparent mb-16">
        <h3 className="text-2xl font-bold mb-6 flex items-center font-[family-name:var(--font-orbitron)]">
          <span className="text-3xl mr-3">📋</span>
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400">
            Important Notes
          </span>
        </h3>

        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <div className="text-2xl mt-1">⚠️</div>
            <div>
              <h4 className="font-bold text-blue-300 mb-1">Only Empty Accounts</h4>
              <p className="text-sm text-gray-400">
                We only close token accounts with zero balance. Your tokens are always safe.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="text-2xl mt-1">🔐</div>
            <div>
              <h4 className="font-bold text-blue-300 mb-1">Your Keys, Your Control</h4>
              <p className="text-sm text-gray-400">
                We never have access to your private keys. All transactions require your explicit approval.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="text-2xl mt-1">💡</div>
            <div>
              <h4 className="font-bold text-blue-300 mb-1">Standard Rent Amount</h4>
              <p className="text-sm text-gray-400">
                Each SPL token account locks ~0.00204 SOL as rent. This is a Solana standard, not our fee.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="text-2xl mt-1">🎯</div>
            <div>
              <h4 className="font-bold text-blue-300 mb-1">Instant Processing</h4>
              <p className="text-sm text-gray-400">
                Transactions are processed instantly on the Solana blockchain. Your SOL is available immediately.
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
