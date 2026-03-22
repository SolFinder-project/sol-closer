'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import WalletButton from '@/components/wallet/WalletButton';
import AccountScanner from '@/components/account/AccountScanner';
import ReferralDashboard from '@/components/account/ReferralDashboard';
import UserDashboard from '@/components/account/UserDashboard';
import TransactionHistory from '@/components/account/TransactionHistory';
import Achievements from '@/components/account/Achievements';
import Leaderboard from '@/components/account/Leaderboard';
import F1GamePage from '@/components/game/F1GamePage';
import NftCreatorPage from '@/components/nft-creator/NftCreatorPage';
import Logo from '@/components/ui/Logo';
import StatsCard from '@/components/ui/StatsCard';
import LiveFeed from '@/components/ui/LiveFeed';
import { getGlobalStats } from '@/lib/supabase/transactions';
import { isValidSolanaAddress } from '@/lib/solana/validators';
import { CNFT_BURN_COMING_SOON } from '@/lib/solana/constants';

type Section = 'home' | 'scanner' | 'dashboard' | 'history' | 'referral' | 'achievements' | 'leaderboard' | 'game' | 'nftCreator';

const ACCOUNT_SECTIONS: Section[] = ['dashboard', 'history', 'referral', 'achievements', 'leaderboard', 'game', 'nftCreator'];

const REFERRER_STORAGE_KEY = 'solcloser_referrer_wallet';

export default function Home() {
  const [currentSection, setCurrentSection] = useState<Section>('home');
  const currentSectionRef = useRef<Section>(currentSection);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [globalStats, setGlobalStats] = useState({
    totalClosed: '0',
    totalReclaimed: '0',
    activeUsers: '0',
    avgReclaim: '0',
  });
  const [liveFeedRefreshTrigger, setLiveFeedRefreshTrigger] = useState(0);
  const loadStatsRef = useRef<() => void>(() => {});

  // Capture referral ref from URL as soon as the app loads (before any navigation strips it).
  // useReferral() only runs when Scanner/Referral etc. mount; without this, ref would be lost
  // when user clicks "Scan & reclaim" because navigateTo uses pathname-only pushState.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const refWallet = params.get('ref');
    if (refWallet) {
      const cleaned = refWallet.trim();
      if (isValidSolanaAddress(cleaned)) {
        sessionStorage.setItem(REFERRER_STORAGE_KEY, cleaned);
      }
      const url = new URL(window.location.href);
      url.searchParams.delete('ref');
      window.history.replaceState({}, '', url.toString());
    }
  }, []);

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
    loadStatsRef.current = loadStats;
    loadStats();
    const interval = setInterval(() => loadStatsRef.current(), 5000);
    return () => clearInterval(interval);
  }, []);

  const onReclaimSuccess = useCallback(() => {
    loadStatsRef.current?.();
    setLiveFeedRefreshTrigger((t) => t + 1);
  }, []);

  currentSectionRef.current = currentSection;

  const navigateTo = (section: Section) => {
    if (section !== currentSection) {
      history.pushState({ section: currentSection }, '', window.location.pathname);
    }
    setCurrentSection(section);
    setMobileMenuOpen(false);
  };

  useEffect(() => {
    const handlePopState = (e: PopStateEvent) => {
      const fromSection = currentSectionRef.current;
      if (ACCOUNT_SECTIONS.includes(fromSection)) {
        setCurrentSection('home');
        history.replaceState({ section: 'home' }, '', window.location.pathname);
      } else {
        const section = (e.state?.section as Section) ?? 'home';
        setCurrentSection(section);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const renderSection = () => {
    switch (currentSection) {
      case 'scanner':
        return <AccountScanner onNavigateToGame={() => navigateTo('game')} onReclaimSuccess={onReclaimSuccess} />;
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
      case 'game':
        return <F1GamePage />;
      case 'nftCreator':
        return <NftCreatorPage />;
      default:
        return <HomeContent setSection={navigateTo} globalStats={globalStats} liveFeedRefreshTrigger={liveFeedRefreshTrigger} />;
    }
  };

  return (
    <main className="min-h-screen">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-neon-purple/10 rounded-full blur-3xl animate-pulse-slow"></div>
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-neon-pink/10 rounded-full blur-3xl animate-pulse-slow" style={{ animationDelay: '1s' }}></div>
      </div>

      <header className="sticky top-0 z-50 bg-black">
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
              <button onClick={() => navigateTo('game')} className="text-gray-400 hover:text-red-400 transition-colors">
                F1 Race
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
              <button onClick={() => navigateTo('nftCreator')} className="text-gray-400 hover:text-amber-400 transition-colors">
                NFT Creator
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
            <nav className="xl:hidden mt-4 pb-4 border-t border-neutral-800 pt-4 space-y-3">
              <button onClick={() => navigateTo('scanner')} className="block w-full text-left text-gray-400 hover:text-neon-purple transition-colors py-2">
                🔍 Scanner
              </button>
              <button onClick={() => navigateTo('game')} className="block w-full text-left text-gray-400 hover:text-red-400 transition-colors py-2">
                🏁 F1 Race
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
              <button onClick={() => navigateTo('nftCreator')} className="block w-full text-left text-gray-400 hover:text-amber-400 transition-colors py-2">
                🎨 NFT Creator
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

function HomeContent({ setSection, globalStats, liveFeedRefreshTrigger = 0 }: { setSection: (section: Section) => void; globalStats: any; liveFeedRefreshTrigger?: number }) {
  return (
    <>
      {/* Hero — explicit, accurate, differentiated (4 sources, keep/stake/swap) */}
      <div className="text-center mb-8 md:mb-10 animate-slide-up max-w-4xl mx-auto">
        <p className="text-xs font-medium text-neon-purple/90 uppercase tracking-wider mb-2 md:mb-3">
          Reclaim · Refuel · Race
        </p>
        <h1 className="text-xl md:text-3xl lg:text-4xl font-bold font-[family-name:var(--font-orbitron)] text-white mb-3 md:mb-4 leading-tight">
          Reclaim SOL from more sources. Then keep, stake, swap, play or create.
        </h1>
        <p className="text-sm md:text-base text-gray-400 max-w-2xl mx-auto mb-6 leading-relaxed">
          Empty token accounts, dust, <strong className="text-rose-400/90">Burn NFT</strong>, Pump.fun PDAs, PumpSwap PDAs, Drift accounts, and <strong className="text-amber-400/90">cNFT close</strong>{CNFT_BURN_COMING_SOON && <span className="text-xs font-normal ml-1 px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 align-middle">Coming soon</span>} — reclaim in one app. Full reclaim in one transaction. Keep your SOL, or stake with <strong className="text-amber-400/90">PSOL</strong> (Phantom) or <strong className="text-neon-green/90">Marinade</strong>, or swap with <strong className="text-neon-cyan/90">Jupiter</strong> in one click. Compete in the <strong className="text-red-400/90">weekly F1 race</strong>; create <strong className="text-amber-400/90">F1-themed NFTs</strong> from eligible reclaims.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3 max-w-3xl mx-auto">
          <button
            onClick={() => setSection('scanner')}
            className="w-full px-8 py-3.5 rounded-xl font-semibold bg-neon-purple text-white hover:bg-neon-purple/90 transition-all shadow-lg shadow-neon-purple/20"
          >
            Optimize my wallet
          </button>
          <button
            onClick={() => setSection('game')}
            className="w-full px-8 py-3.5 rounded-xl font-semibold border border-red-500/50 text-red-400 hover:bg-red-500/10 hover:border-red-500/70 transition-all"
          >
            Weekly F1 Race
          </button>
          <button
            onClick={() => setSection('nftCreator')}
            className="w-full px-8 py-3.5 rounded-xl font-semibold border border-amber-500/50 text-amber-400 hover:bg-amber-500/10 hover:border-amber-500/70 transition-all"
          >
            Create NFT
          </button>
        </div>
      </div>

      {/* What you can reclaim — scrollable carousel with arrows */}
      <div className="mb-12 md:mb-14">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider text-center mb-6">
          What you can reclaim
        </h2>
        <div className="relative flex items-center gap-2 max-w-5xl mx-auto">
          <button
            type="button"
            onClick={() => document.getElementById('reclaim-cards')?.scrollBy({ left: -280, behavior: 'smooth' })}
            className="shrink-0 w-10 h-10 rounded-full border border-dark-border bg-dark-card/80 text-gray-400 hover:text-white hover:border-neon-purple/50 flex items-center justify-center transition-colors"
            aria-label="Previous features"
          >
            <span className="text-xl leading-none">‹</span>
          </button>
          <div
            id="reclaim-cards"
            className="flex overflow-x-auto gap-3 md:gap-4 py-2 scroll-smooth snap-x snap-mandatory scrollbar-thin flex-1 min-w-0 [scrollbar-width:thin]"
            style={{ scrollbarGutter: 'stable' }}
          >
            <div className="card-cyber border-dark-border bg-dark-card/80 text-center py-5 px-4 min-w-[240px] md:min-w-[260px] shrink-0 snap-start overflow-visible">
              <p className="text-lg md:text-xl font-bold font-[family-name:var(--font-orbitron)] text-neon-purple mb-1 break-words">Empty <span className="whitespace-nowrap">accounts</span></p>
              <p className="text-xs text-gray-400 break-words">SPL / Token-2022 · ~0.002 SOL each</p>
            </div>
            <div className="card-cyber border-dark-border bg-dark-card/80 text-center py-5 px-4 min-w-[240px] md:min-w-[260px] shrink-0 snap-start overflow-visible">
              <p className="text-lg md:text-xl font-bold font-[family-name:var(--font-orbitron)] text-neon-pink mb-1 break-words">Dust</p>
              <p className="text-xs text-gray-400 break-words">Burn + close · small balances</p>
            </div>
            <div className="card-cyber border-rose-500/30 bg-dark-card/80 text-center py-5 px-4 min-w-[240px] md:min-w-[260px] shrink-0 snap-start overflow-visible">
              <p className="text-lg md:text-xl font-bold font-[family-name:var(--font-orbitron)] text-rose-400 mb-1 break-words">Burn NFT</p>
              <p className="text-xs text-gray-400 break-words">~0.002 SOL per NFT</p>
            </div>
            <div className="card-cyber border-dark-border bg-dark-card/80 text-center py-5 px-4 min-w-[240px] md:min-w-[260px] shrink-0 snap-start overflow-visible">
              <p className="text-lg md:text-xl font-bold font-[family-name:var(--font-orbitron)] text-neon-cyan mb-1 break-words">Pump.fun PDA</p>
              <p className="text-xs text-gray-400 break-words">~0.0018 SOL per PDA</p>
            </div>
            <div className="card-cyber border-dark-border bg-dark-card/80 text-center py-5 px-4 min-w-[240px] md:min-w-[260px] shrink-0 snap-start overflow-visible">
              <p className="text-lg md:text-xl font-bold font-[family-name:var(--font-orbitron)] text-neon-green mb-1 break-words">PumpSwap PDA</p>
              <p className="text-xs text-gray-400 break-words">~0.0018 SOL per PDA</p>
            </div>
            <div className="card-cyber border-emerald-500/30 bg-dark-card/80 text-center py-5 px-4 min-w-[240px] md:min-w-[260px] shrink-0 snap-start overflow-visible">
              <p className="text-lg md:text-xl font-bold font-[family-name:var(--font-orbitron)] text-emerald-400 mb-1 break-words">Drift <span className="whitespace-nowrap">account</span></p>
              <p className="text-xs text-gray-400 break-words">~0.035 SOL · withdraw first</p>
            </div>
            <div className="card-cyber border-amber-500/30 bg-dark-card/80 text-center py-5 px-4 min-w-[240px] md:min-w-[260px] shrink-0 snap-start overflow-visible">
              <p className="text-lg md:text-xl font-bold font-[family-name:var(--font-orbitron)] text-amber-400 mb-1 break-words flex flex-col items-center gap-1">
                <span>cNFT <span className="whitespace-nowrap">close</span></span>
                {CNFT_BURN_COMING_SOON && <span className="text-xs font-normal px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40">Coming soon</span>}
              </p>
              <p className="text-xs text-gray-400 break-words">Burn compressed NFTs · reclaim rent</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => document.getElementById('reclaim-cards')?.scrollBy({ left: 280, behavior: 'smooth' })}
            className="shrink-0 w-10 h-10 rounded-full border border-dark-border bg-dark-card/80 text-gray-400 hover:text-white hover:border-neon-purple/50 flex items-center justify-center transition-colors"
            aria-label="Next features"
          >
            <span className="text-xl leading-none">›</span>
          </button>
        </div>
      </div>

      {/* F1 Race + NFT Creator — swipeable sections (one visible at a time), like "What you can reclaim" */}
      <div className="mb-10 md:mb-12">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider text-center mb-6">
          Featured
        </h2>
        <div className="relative flex items-stretch gap-2 max-w-4xl mx-auto">
          <button
            type="button"
            onClick={() => document.getElementById('featured-sections')?.scrollBy({ left: -document.getElementById('featured-sections')!.clientWidth, behavior: 'smooth' })}
            className="shrink-0 w-10 h-10 rounded-full border border-dark-border bg-dark-card/80 text-gray-400 hover:text-white hover:border-neon-purple/50 flex items-center justify-center transition-colors self-center"
            aria-label="Previous section"
          >
            <span className="text-xl leading-none">‹</span>
          </button>
          <div
            id="featured-sections"
            className="flex overflow-x-auto gap-4 py-2 scroll-smooth snap-x snap-mandatory flex-1 min-w-0 [scrollbar-width:thin] scrollbar-thin"
            style={{ scrollbarGutter: 'stable' }}
          >
            <button
              onClick={() => setSection('game')}
              className="flex-shrink-0 w-full min-w-full max-w-full snap-start card-cyber border-red-500/40 bg-gradient-to-br from-red-500/10 to-amber-500/10 hover:border-red-500/60 hover:from-red-500/15 hover:to-amber-500/15 transition-all p-6 md:p-8 text-left group"
            >
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold text-red-400 uppercase tracking-wider mb-1">Weekly competition</p>
                  <h2 className="text-2xl md:text-3xl font-bold font-[family-name:var(--font-orbitron)] text-white mb-2 group-hover:text-red-200 transition-colors">
                    🏁 SolPit F1 Race
                  </h2>
                  <p className="text-sm text-gray-400 max-w-xl">
                    Reclaim SOL → earn points → upgrade your car → best lap time wins. One race per week. Prize pool in SOL for the top 3. Skill-based, no luck.
                  </p>
                </div>
                <span className="shrink-0 px-5 py-2.5 rounded-xl bg-red-500/20 text-red-300 font-semibold text-sm border border-red-500/40 group-hover:bg-red-500/30 transition-colors">
                  Enter the race →
                </span>
              </div>
            </button>
            <button
              onClick={() => setSection('nftCreator')}
              className="flex-shrink-0 w-full min-w-full max-w-full snap-start card-cyber border-amber-500/40 bg-gradient-to-br from-amber-500/10 to-orange-500/10 hover:border-amber-500/60 hover:from-amber-500/15 hover:to-orange-500/15 transition-all p-6 md:p-8 text-left group"
            >
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold text-amber-400 uppercase tracking-wider mb-1">Creator badge</p>
                  <h2 className="text-2xl md:text-3xl font-bold font-[family-name:var(--font-orbitron)] text-white mb-2 group-hover:text-amber-200 transition-colors">
                    🎨 SolPit NFT Creator
                  </h2>
                  <p className="text-sm text-gray-400 max-w-xl">
                    Reclaim at least 0.02 SOL → create a unique F1-themed NFT in the official collection. Badge + in-game perks when you hold it. One eligible reclaim = one NFT.
                  </p>
                </div>
                <span className="shrink-0 px-5 py-2.5 rounded-xl bg-amber-500/20 text-amber-300 font-semibold text-sm border border-amber-500/40 group-hover:bg-amber-500/30 transition-colors">
                  Create NFT →
                </span>
              </div>
            </button>
          </div>
          <button
            type="button"
            onClick={() => document.getElementById('featured-sections')?.scrollBy({ left: document.getElementById('featured-sections')!.clientWidth, behavior: 'smooth' })}
            className="shrink-0 w-10 h-10 rounded-full border border-dark-border bg-dark-card/80 text-gray-400 hover:text-white hover:border-neon-purple/50 flex items-center justify-center transition-colors self-center"
            aria-label="Next section"
          >
            <span className="text-xl leading-none">›</span>
          </button>
        </div>
      </div>

      {/* Put your SOL to work — PSOL + Marinade + Jupiter */}
      <div className="mb-10 md:mb-12">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider text-center mb-6">
          Put your SOL to work
        </h2>
        <div className="grid md:grid-cols-2 gap-4 max-w-3xl mx-auto">
          <div className="card-cyber border-amber-500/30 bg-dark-card/80 hover:border-amber-500/50 transition-colors p-5 text-left">
            <p className="text-lg font-bold font-[family-name:var(--font-orbitron)] text-amber-400 mb-1">Stake with PSOL</p>
            <p className="text-sm text-gray-400 mb-4">Turn reclaimed SOL into PSOL (Phantom) or mSOL (Marinade). Earn staking rewards in-app.</p>
            <button onClick={() => setSection('scanner')} className="text-sm font-medium text-amber-400 hover:underline">
              Reclaim first, then stake →
            </button>
          </div>
          <div className="card-cyber border-neon-cyan/30 bg-dark-card/80 hover:border-neon-cyan/50 transition-colors p-5 text-left">
            <p className="text-lg font-bold font-[family-name:var(--font-orbitron)] text-neon-cyan mb-1">Swap with Jupiter</p>
            <p className="text-sm text-gray-400 mb-4">Swap to USDC, JUP, or any token. Best routes on Solana.</p>
            <button onClick={() => setSection('scanner')} className="text-sm font-medium text-neon-cyan hover:underline">
              Reclaim first, then swap →
            </button>
          </div>
        </div>
      </div>

      {/* Global Stats — compact */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-10 md:mb-12">
        <StatsCard title="Items closed" value={globalStats.totalClosed} icon="🔒" trend="Live" color="purple" />
        <StatsCard title="SOL reclaimed" value={globalStats.totalReclaimed} icon="💎" trend="Real-time" color="pink" />
        <StatsCard title="Active users" value={globalStats.activeUsers} icon="👥" trend="Growing" color="cyan" />
        <StatsCard title="Avg. recovery" value={`${globalStats.avgReclaim} SOL`} icon="⚡" color="green" />
      </div>

      {/* Live feed — subtle */}
      <div className="mb-10 md:mb-12">
        <LiveFeed refreshTrigger={liveFeedRefreshTrigger} />
      </div>

      {/* Quick access — 4 cards, 2×2 on small / 1×4 on large, no empty space */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-10 md:mb-12">
        <button onClick={() => setSection('scanner')} className="card-cyber text-left group hover:border-neon-purple/40 transition-colors p-4 md:p-5">
          <span className="text-lg md:text-xl font-bold font-[family-name:var(--font-orbitron)] text-neon-purple block mb-1.5">Scan & reclaim</span>
          <p className="text-xs md:text-sm text-gray-400 line-clamp-2">Find empty accounts, dust, Burn NFT, Pump PDA, PumpSwap PDA, Drift, cNFT close{CNFT_BURN_COMING_SOON ? ' (coming soon)' : ''}. One flow.</p>
        </button>
        <button onClick={() => setSection('referral')} className="card-cyber text-left group hover:border-neon-pink/40 transition-colors p-4 md:p-5">
          <span className="text-lg md:text-xl font-bold font-[family-name:var(--font-orbitron)] text-neon-pink block mb-1.5">Refer & earn</span>
          <p className="text-xs md:text-sm text-gray-400 line-clamp-2">Earn 10% of SOL reclaimed by users you refer.</p>
        </button>
        <button onClick={() => setSection('game')} className="card-cyber text-left group hover:border-red-500/40 transition-colors p-4 md:p-5">
          <span className="text-lg md:text-xl font-bold font-[family-name:var(--font-orbitron)] text-red-400 block mb-1.5">Weekly F1 Race</span>
          <p className="text-xs md:text-sm text-gray-400 line-clamp-2">Earn points, upgrade your car, best lap time wins. Prize pool for top 3.</p>
        </button>
        <button onClick={() => setSection('nftCreator')} className="card-cyber text-left group hover:border-amber-500/40 transition-colors p-4 md:p-5">
          <span className="text-lg md:text-xl font-bold font-[family-name:var(--font-orbitron)] text-amber-400 block mb-1.5">NFT Creator</span>
          <p className="text-xs md:text-sm text-gray-400 line-clamp-2">Create an F1-themed NFT from your reclaimed SOL. Badge + perks.</p>
        </button>
      </div>

      {/* Why SolPit — trust */}
      <div className="mb-12 md:mb-14">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider text-center mb-6">
          Why SolPit
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
          <div className="card-cyber border-dark-border py-5 px-4">
            <p className="text-base font-bold text-neon-purple mb-1">Secure</p>
            <p className="text-xs text-gray-400">Keys stay in your wallet. You sign every tx.</p>
          </div>
          <div className="card-cyber border-dark-border py-5 px-4">
            <p className="text-base font-bold text-neon-pink mb-1">Fast</p>
            <p className="text-xs text-gray-400">Solana speed. Reclaim in seconds.</p>
          </div>
          <div className="card-cyber border-dark-border py-5 px-4">
            <p className="text-base font-bold text-neon-cyan mb-1">Transparent</p>
            <p className="text-xs text-gray-400">20% fee. No hidden costs.</p>
          </div>
          <div className="card-cyber border-dark-border py-5 px-4">
            <p className="text-base font-bold text-neon-green mb-1">Earn</p>
            <p className="text-xs text-gray-400">10% referral on reclaimed SOL.</p>
          </div>
        </div>
      </div>

      {/* Important notes — same content, cleaner layout */}
      <div className="card-cyber border-blue-500/20 bg-blue-500/5 mb-12 md:mb-14">
        <h3 className="text-base font-bold text-blue-300 mb-4 uppercase tracking-wider">
          Important
        </h3>
        <ul className="space-y-3 text-sm text-gray-400">
          <li className="flex gap-3">
            <span className="text-blue-400 shrink-0">·</span>
            <span>We only close <strong className="text-gray-300">empty</strong> token accounts. Your tokens are safe.</span>
          </li>
          <li className="flex gap-3">
            <span className="text-blue-400 shrink-0">·</span>
            <span>We never have access to your private keys.</span>
          </li>
          <li className="flex gap-3">
            <span className="text-blue-400 shrink-0">·</span>
            <span>Rent per SPL account ~0.00204 SOL. Burn NFT ~0.002 SOL each. Pump/PumpSwap PDA ~0.0018 SOL each. cNFT close: burn compressed NFTs to reclaim rent{CNFT_BURN_COMING_SOON ? ' (coming soon)' : ''}.</span>
          </li>
          <li className="flex gap-3">
            <span className="text-blue-400 shrink-0">·</span>
            <span>Transactions confirm on Solana in seconds.</span>
          </li>
        </ul>
      </div>

      {/* Footer */}
      <footer className="py-8 md:py-12 border-t border-dark-border mt-12 md:mt-16">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8">
            <div className="col-span-2 md:col-span-1">
              <h3 className="text-base font-bold mb-3 text-neon-purple">About SolPit</h3>
              <p className="text-xs md:text-sm text-gray-400">
                Reclaim SOL from empty accounts, dust, Burn NFT, Pump.fun PDAs, PumpSwap PDAs, Drift, and cNFT close{CNFT_BURN_COMING_SOON ? ' (coming soon)' : ''}. Weekly F1 race (earn points, best lap wins). SolPit NFT Creator: mint F1-themed NFTs from eligible reclaims. Stake with PSOL or Marinade, or swap with Jupiter in-app.
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
                    href="https://discord.gg/4Df2TERj4" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-gray-400 hover:text-neon-pink transition-colors flex items-center gap-2"
                  >
                    <svg className="w-4 h-4 md:w-5 md:h-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515a.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0a12.64 12.64 0 0 0-.617-1.25a.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057a19.9 19.9 0 0 0 5.993 3.03a.078.078 0 0 0 .084-.028a14.09 14.09 0 0 0 1.226-1.994a.076.076 0 0 0-.041-.106a13.107 13.107 0 0 1-1.872-.892a.077.077 0 0 1-.008-.128a10.2 10.2 0 0 0 .372-.292a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127a12.299 12.299 0 0 1-1.873.892a.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028a19.839 19.839 0 0 0 6.002-3.03a.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.956-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.955-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.946 2.418-2.157 2.418z"/>
                    </svg>
                    Discord
                  </a>
                </li>
                <li>
                  <a 
                    href="https://t.me/+83kQLYgkQrQyMmZk" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-gray-400 hover:text-neon-pink transition-colors flex items-center gap-2"
                  >
                    <svg className="w-4 h-4 md:w-5 md:h-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12a12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472c-.18 1.898-.962 6.502-1.36 8.627c-.168.9-.499 1.201-.82 1.23c-.696.065-1.225-.46-1.9-.902c-1.056-.693-1.653-1.124-2.678-1.8c-1.185-.78-.417-1.21.258-1.91c.177-.184 3.247-2.977 3.307-3.23c.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345c-.48.33-.913.49-1.302.48c-.428-.008-1.252-.241-1.865-.44c-.752-.245-1.349-.374-1.297-.789c.027-.216.325-.437.893-.663c3.498-1.524 5.83-2.529 6.998-3.014c3.332-1.386 4.025-1.627 4.476-1.635z"/>
                    </svg>
                    Telegram
                  </a>
                </li>
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
            <p>© {new Date().getFullYear()} SolPit. All rights reserved.</p>
            <p className="mt-2">Built with 💜 on Solana</p>
          </div>
        </div>
      </footer>
    </>
  );
}
