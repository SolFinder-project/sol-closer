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
import LiveFeed from '@/components/ui/LiveFeed';
import { getGlobalStats } from '@/lib/supabase/transactions';

type Section = 'home' | 'scanner' | 'dashboard' | 'history' | 'referral' | 'achievements' | 'leaderboard';

export default function Home() {
  const [currentSection, setCurrentSection] = useState<Section>('home');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [globalStats, setGlobalStats] = useState({
    totalClosed: '0',
    totalReclaimed: '0',
    activeUsers: '0',
    avgReclaim: '0',
  });

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
    
    const interval = setInterval(loadStats, 10000);
    return () => clearInterval(interval);
  }, []);

  const navigateTo = (section: Section) => {
    setCurrentSection(section);
    setMobileMenuOpen(false);
  };

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
        return <HomeContent setSection={navigateTo} globalStats={globalStats} />;
    }
  };

  return (
    <main className="min-h-screen">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-neon-purple/10 rounded-full blur-3xl animate-pulse-slow"></div>
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-neon-pink/10 rounded-full blur-3xl animate-pulse-slow" style={{ animationDelay: '1s' }}></div>
      </div>

      <header className="sticky top-0 z-50 backdrop-blur-xl bg-dark-bg/80 border-b border-dark-border">
        <div className="container mx-auto px-3 md:px-4 py-3 md:py-4">
          <div className="flex justify-between items-center gap-2">
            {/* Logo - toujours avec texte */}
            <div onClick={() => navigateTo('home')} className="cursor-pointer flex-shrink min-w-0">
              <Logo size="sm" showText={true} />
            </div>
            
            {/* Navigation desktop */}
            <nav className="hidden xl:flex items-center space-x-6 text-sm">
              <button onClick={() => navigateTo('scanner')} className="text-gray-400 hover:text-neon-purple transition-colors">
                Scanner
              </button>
              <button onClick={() => navigateTo('dashboard')} className="text-gray-400 hover:text-neon-purple transition-colors">
                Dashboard
              </button>
              <button onClick={() => navigateTo('history')} className="text-gray-400 hover:text-neon-purple transition-colors">
                History
              </button>
              <button onClick={() => navigateTo('referral')} className="text-gray-400 hover:text-neon-purple transition-colors">
                Referral
              </button>
              <button onClick={() => navigateTo('achievements')} className="text-gray-400 hover:text-neon-purple transition-colors">
                Achievements
              </button>
              <button onClick={() => navigateTo('leaderboard')} className="text-gray-400 hover:text-neon-purple transition-colors">
                Leaderboard
              </button>
            </nav>

            {/* Actions */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <WalletButton />
              
              {/* Menu burger mobile */}
              <button 
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="xl:hidden p-2 text-gray-400 hover:text-white"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  {mobileMenuOpen ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  )}
                </svg>
              </button>
            </div>
          </div>

          {/* Menu mobile */}
          {mobileMenuOpen && (
            <nav className="xl:hidden mt-4 pb-4 border-t border-dark-border pt-4 space-y-3">
              <button onClick={() => navigateTo('scanner')} className="block w-full text-left text-gray-400 hover:text-neon-purple transition-colors py-2">
                🔍 Scanner
              </button>
              <button onClick={() => navigateTo('dashboard')} className="block w-full text-left text-gray-400 hover:text-neon-purple transition-colors py-2">
                📊 Dashboard
              </button>
              <button onClick={() => navigateTo('history')} className="block w-full text-left text-gray-400 hover:text-neon-purple transition-colors py-2">
                📜 History
              </button>
              <button onClick={() => navigateTo('referral')} className="block w-full text-left text-gray-400 hover:text-neon-purple transition-colors py-2">
                🎁 Referral
              </button>
              <button onClick={() => navigateTo('achievements')} className="block w-full text-left text-gray-400 hover:text-neon-purple transition-colors py-2">
                🏅 Achievements
              </button>
              <button onClick={() => navigateTo('leaderboard')} className="block w-full text-left text-gray-400 hover:text-neon-purple transition-colors py-2">
                🏆 Leaderboard
              </button>
            </nav>
          )}
        </div>
      </header>

      <div className="relative z-10">
        <section className="container mx-auto px-4 py-8 md:py-12">
          {renderSection()}
        </section>
      </div>
    </main>
  );
}

function HomeContent({ setSection, globalStats }: { setSection: (section: Section) => void; globalStats: any }) {
  return (
    <>
      {/* Hero Section */}
      <div className="text-center mb-12 md:mb-16 animate-slide-up">
        <div className="inline-block mb-4">
          <span className="px-3 py-1.5 md:px-4 md:py-2 rounded-full bg-neon-purple/10 border border-neon-purple/30 text-neon-purple text-xs md:text-sm font-mono">
            🤝 By the Community, For the Community
          </span>
        </div>
        
        <h1 className="text-4xl md:text-5xl lg:text-7xl font-bold font-[family-name:var(--font-orbitron)] mb-4 md:mb-6">
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-neon-purple via-neon-pink to-neon-cyan animate-glow">
            Recover Your
          </span>
          <br />
          <span className="text-white">Locked SOL</span>
        </h1>
        
        <p className="text-base md:text-xl text-gray-400 max-w-3xl mx-auto mb-6 md:mb-8 leading-relaxed px-4">
          Close unused SPL token accounts and reclaim your rent deposits.
          <br />
          <span className="text-neon-green">Each account = ~0.00204 SOL</span> waiting to be recovered.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 md:gap-4 justify-center items-center px-4">
          <button onClick={() => setSection('scanner')} className="btn-cyber w-full sm:w-auto">
            Start Scanning →
          </button>
          <button onClick={() => setSection('dashboard')} className="w-full sm:w-auto px-6 py-3 rounded-lg font-bold border-2 border-neon-purple/30 text-neon-purple hover:bg-neon-purple/10 transition-all duration-300">
            View Dashboard
          </button>
        </div>
      </div>

      {/* Global Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-12 md:mb-16">
        <StatsCard
          title="Accounts Closed"
          value={globalStats.totalClosed}
          icon="🔒"
          trend="Live data"
          color="purple"
        />
        <StatsCard
          title="SOL Reclaimed"
          value={globalStats.totalReclaimed}
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

      {/* Live Activity Feed */}
      <div className="mb-12 md:mb-16">
        <LiveFeed />
      </div>

      {/* Quick Access Cards */}
      <div className="grid md:grid-cols-3 gap-4 md:gap-6 mb-12 md:mb-16">
        <button onClick={() => setSection('scanner')} className="card-cyber text-left group hover:scale-105 transition-transform">
          <div className="text-4xl md:text-5xl mb-3 md:mb-4 group-hover:animate-float">🔍</div>
          <h3 className="text-xl md:text-2xl font-bold mb-2 font-[family-name:var(--font-orbitron)] text-neon-purple">
            Scan Wallet
          </h3>
          <p className="text-sm md:text-base text-gray-400">
            Find and close unused token accounts to reclaim your SOL
          </p>
        </button>

        <button onClick={() => setSection('referral')} className="card-cyber text-left group hover:scale-105 transition-transform">
          <div className="text-4xl md:text-5xl mb-3 md:mb-4 group-hover:animate-float" style={{ animationDelay: '0.1s' }}>🎁</div>
          <h3 className="text-xl md:text-2xl font-bold mb-2 font-[family-name:var(--font-orbitron)] text-neon-pink">
            Refer & Earn
          </h3>
          <p className="text-sm md:text-base text-gray-400">
            Get 10% of SOL reclaimed by users you refer to SOLcloser
          </p>
        </button>

        <button onClick={() => setSection('leaderboard')} className="card-cyber text-left group hover:scale-105 transition-transform">
          <div className="text-4xl md:text-5xl mb-3 md:mb-4 group-hover:animate-float" style={{ animationDelay: '0.2s' }}>🏆</div>
          <h3 className="text-xl md:text-2xl font-bold mb-2 font-[family-name:var(--font-orbitron)] text-neon-cyan">
            Leaderboard
          </h3>
          <p className="text-sm md:text-base text-gray-400">
            Compete with others and see top performers globally
          </p>
        </button>
      </div>

      {/* How It Works */}
      <div className="mb-12 md:mb-16">
        <h2 className="text-3xl md:text-4xl font-bold text-center mb-8 md:mb-12 font-[family-name:var(--font-orbitron)]">
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-neon-purple to-neon-pink">
            How It Works
          </span>
        </h2>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6">
          <div className="card-cyber text-center">
            <div className="text-3xl md:text-5xl mb-2 md:mb-4">🔌</div>
            <h3 className="text-lg md:text-xl font-bold mb-1 md:mb-2 text-neon-purple">1. Connect</h3>
            <p className="text-xs md:text-sm text-gray-400">Connect your Solana wallet securely</p>
          </div>

          <div className="card-cyber text-center">
            <div className="text-3xl md:text-5xl mb-2 md:mb-4">🔍</div>
            <h3 className="text-lg md:text-xl font-bold mb-1 md:mb-2 text-neon-pink">2. Scan</h3>
            <p className="text-xs md:text-sm text-gray-400">We scan for empty SPL token accounts</p>
          </div>

          <div className="card-cyber text-center">
            <div className="text-3xl md:text-5xl mb-2 md:mb-4">✅</div>
            <h3 className="text-lg md:text-xl font-bold mb-1 md:mb-2 text-neon-cyan">3. Select</h3>
            <p className="text-xs md:text-sm text-gray-400">Choose accounts to close</p>
          </div>

          <div className="card-cyber text-center">
            <div className="text-3xl md:text-5xl mb-2 md:mb-4">💰</div>
            <h3 className="text-lg md:text-xl font-bold mb-1 md:mb-2 text-neon-green">4. Claim</h3>
            <p className="text-xs md:text-sm text-gray-400">Receive your SOL instantly</p>
          </div>
        </div>
      </div>

      {/* Why Choose SOLcloser */}
      <div className="mb-12 md:mb-16">
        <h2 className="text-3xl md:text-4xl font-bold text-center mb-8 md:mb-12 font-[family-name:var(--font-orbitron)]">
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-neon-cyan to-neon-green">
            Why Choose SOLcloser
          </span>
        </h2>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6">
          <div className="card-cyber border-neon-purple/30">
            <div className="text-3xl md:text-4xl mb-2 md:mb-4">🔒</div>
            <h3 className="text-lg md:text-xl font-bold mb-1 md:mb-2 text-neon-purple">Secure by Design</h3>
            <p className="text-xs md:text-sm text-gray-400">
              Your keys never leave your wallet. All transactions are signed by you.
            </p>
          </div>

          <div className="card-cyber border-neon-pink/30">
            <div className="text-3xl md:text-4xl mb-2 md:mb-4">⚡</div>
            <h3 className="text-lg md:text-xl font-bold mb-1 md:mb-2 text-neon-pink">Lightning Fast</h3>
            <p className="text-xs md:text-sm text-gray-400">
              Powered by Solana's blazing-fast blockchain.
            </p>
          </div>

          <div className="card-cyber border-neon-cyan/30">
            <div className="text-3xl md:text-4xl mb-2 md:mb-4">💎</div>
            <h3 className="text-lg md:text-xl font-bold mb-1 md:mb-2 text-neon-cyan">Transparent Fees</h3>
            <p className="text-xs md:text-sm text-gray-400">
              Simple 15% service fee. No hidden costs.
            </p>
          </div>

          <div className="card-cyber border-neon-green/30">
            <div className="text-3xl md:text-4xl mb-2 md:mb-4">🎁</div>
            <h3 className="text-lg md:text-xl font-bold mb-1 md:mb-2 text-neon-green">Earn Rewards</h3>
            <p className="text-xs md:text-sm text-gray-400">
              Refer friends and earn 10% of their reclaimed SOL.
            </p>
          </div>
        </div>
      </div>

      {/* Important Notes */}
      <div className="card-cyber border-blue-500/30 bg-gradient-to-br from-blue-500/5 to-transparent mb-12 md:mb-16">
        <h3 className="text-xl md:text-2xl font-bold mb-4 md:mb-6 flex items-center font-[family-name:var(--font-orbitron)]">
          <span className="text-2xl md:text-3xl mr-2 md:mr-3">📋</span>
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400">
            Important Notes
          </span>
        </h3>

        <div className="space-y-3 md:space-y-4">
          <div className="flex items-start gap-2 md:gap-3">
            <div className="text-xl md:text-2xl mt-0.5 md:mt-1 flex-shrink-0">⚠️</div>
            <div>
              <h4 className="font-bold text-blue-300 mb-0.5 md:mb-1 text-sm md:text-base">Only Empty Accounts</h4>
              <p className="text-xs md:text-sm text-gray-400">
                We only close token accounts with zero balance. Your tokens are always safe.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-2 md:gap-3">
            <div className="text-xl md:text-2xl mt-0.5 md:mt-1 flex-shrink-0">🔐</div>
            <div>
              <h4 className="font-bold text-blue-300 mb-0.5 md:mb-1 text-sm md:text-base">Your Keys, Your Control</h4>
              <p className="text-xs md:text-sm text-gray-400">
                We never have access to your private keys.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-2 md:gap-3">
            <div className="text-xl md:text-2xl mt-0.5 md:mt-1 flex-shrink-0">💡</div>
            <div>
              <h4 className="font-bold text-blue-300 mb-0.5 md:mb-1 text-sm md:text-base">Standard Rent Amount</h4>
              <p className="text-xs md:text-sm text-gray-400">
                Each SPL token account locks ~0.00204 SOL as rent.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-2 md:gap-3">
            <div className="text-xl md:text-2xl mt-0.5 md:mt-1 flex-shrink-0">🎯</div>
            <div>
              <h4 className="font-bold text-blue-300 mb-0.5 md:mb-1 text-sm md:text-base">Instant Processing</h4>
              <p className="text-xs md:text-sm text-gray-400">
                Transactions are processed instantly on the Solana blockchain.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="py-8 md:py-12 border-t border-dark-border mt-12 md:mt-16">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8">
            <div className="col-span-2 md:col-span-1">
              <h3 className="text-base md:text-lg font-bold mb-3 md:mb-4 text-neon-purple">About SOLcloser</h3>
              <p className="text-xs md:text-sm text-gray-400">
                Reclaim your SOL from unused token accounts on Solana. Fast, secure, and efficient.
              </p>
            </div>

            <div>
              <h3 className="text-base md:text-lg font-bold mb-3 md:mb-4 text-neon-purple">Légal 🇫🇷</h3>
              <ul className="space-y-1.5 md:space-y-2 text-xs md:text-sm">
                <li>
                  <a href="/legal/fr/terms" className="text-gray-400 hover:text-neon-pink transition-colors">
                    Conditions Générales
                  </a>
                </li>
                <li>
                  <a href="/legal/fr/privacy" className="text-gray-400 hover:text-neon-pink transition-colors">
                    Confidentialité
                  </a>
                </li>
                <li>
                  <a href="/legal/fr/mentions" className="text-gray-400 hover:text-neon-pink transition-colors">
                    Mentions Légales
                  </a>
                </li>
                <li>
                  <a href="/legal/fr/risks" className="text-gray-400 hover:text-neon-pink transition-colors">
                    Avertissements
                  </a>
                </li>
              </ul>
            </div>

            <div>
              <h3 className="text-base md:text-lg font-bold mb-3 md:mb-4 text-neon-purple">Legal 🇬🇧</h3>
              <ul className="space-y-1.5 md:space-y-2 text-xs md:text-sm">
                <li>
                  <a href="/legal/en/terms" className="text-gray-400 hover:text-neon-pink transition-colors">
                    Terms of Service
                  </a>
                </li>
                <li>
                  <a href="/legal/en/privacy" className="text-gray-400 hover:text-neon-pink transition-colors">
                    Privacy Policy
                  </a>
                </li>
                <li>
                  <a href="/legal/en/risks" className="text-gray-400 hover:text-neon-pink transition-colors">
                    Risk Disclaimer
                  </a>
                </li>
              </ul>
            </div>

            <div>
              <h3 className="text-base md:text-lg font-bold mb-3 md:mb-4 text-neon-purple">Community</h3>
              <ul className="space-y-1.5 md:space-y-2 text-xs md:text-sm">
                <li>
                  <a 
                    href="https://github.com/SolFinder-project/sol-closer" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-gray-400 hover:text-neon-pink transition-colors flex items-center gap-2"
                  >
                    <svg className="w-4 h-4 md:w-5 md:h-5" fill="currentColor" viewBox="0 0 24 24">
                      <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
                    </svg>
                    GitHub
                  </a>
                </li>
                <li>
                  <a 
                    href="https://twitter.com/SOLcloserApp" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-gray-400 hover:text-neon-pink transition-colors flex items-center gap-2"
                  >
                    <svg className="w-4 h-4 md:w-5 md:h-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                    </svg>
                    Twitter
                  </a>
                </li>
              </ul>
            </div>
          </div>

          <div className="mt-8 md:mt-12 pt-6 md:pt-8 border-t border-dark-border text-center text-xs md:text-sm text-gray-500">
            <p>© {new Date().getFullYear()} SOLcloser. All rights reserved.</p>
            <p className="mt-2">Built with 💜 on Solana</p>
          </div>
        </div>
      </footer>
    </>
  );
}
