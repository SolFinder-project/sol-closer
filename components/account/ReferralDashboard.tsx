'use client';

import { useReferral } from '@/hooks/useReferral';
import { useWallet } from '@solana/wallet-adapter-react';
import { useState } from 'react';

export default function ReferralDashboard() {
  const { connected } = useWallet();
  const { referralCode, displayCode, referralStats, getReferralLink } = useReferral();
  const [copied, setCopied] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const copyReferralCode = () => {
    if (referralCode) {
      navigator.clipboard.writeText(referralCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const copyReferralLink = () => {
    const link = getReferralLink();
    if (link) {
      navigator.clipboard.writeText(link);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  const referralPercentage = process.env.NEXT_PUBLIC_REFERRAL_FEE_PERCENTAGE || '10';

  if (!connected) {
    return (
      <div className="animate-slide-up max-w-xl mx-auto">
        <div className="card-cyber text-center py-10 md:py-12 border-dark-border">
          <div className="text-5xl md:text-6xl mb-4">🔗</div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Referral Program</p>
          <h2 className="text-2xl md:text-3xl font-bold font-[family-name:var(--font-orbitron)] text-white mb-3">
            Connect to get your link
          </h2>
          <p className="text-sm text-gray-400 mb-6 max-w-md mx-auto">
            Connect your wallet to access your unique referral link and earn {referralPercentage}% on every transaction from users you refer.
          </p>
          <span className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-neon-purple/10 border border-neon-purple/30 text-neon-purple text-sm">
            👆 Click &quot;Connect&quot; above to get started
          </span>
        </div>
      </div>
    );
  }

  if (!referralCode) {
    return (
      <div className="card-cyber text-center py-10 md:py-12 border-dark-border">
        <div className="text-4xl mb-3 animate-spin">⏳</div>
        <p className="text-sm text-gray-400">Loading your referral code...</p>
      </div>
    );
  }

  return (
    <div className="animate-slide-up space-y-8 md:space-y-10">
      <div className="text-center mb-8 md:mb-10">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Referral Program</p>
        <h1 className="text-2xl md:text-4xl lg:text-5xl font-bold font-[family-name:var(--font-orbitron)] text-white mb-2">
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-neon-purple to-neon-pink">Refer & earn</span>
        </h1>
        <p className="text-sm text-gray-400">Share your link and earn {referralPercentage}% of every transaction.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:gap-4">
        <div className="card-cyber border-dark-border bg-dark-card/80 text-center py-5 px-4">
          <p className="text-xs text-gray-400 mb-1">Total Referrals</p>
          <p className="text-xl md:text-2xl font-bold text-neon-purple font-[family-name:var(--font-orbitron)]">
            {referralStats?.totalReferrals || 0}
          </p>
          <p className="text-xs text-gray-500 mt-1">Users who used your link</p>
        </div>
        <div className="card-cyber border-dark-border bg-dark-card/80 text-center py-5 px-4">
          <p className="text-xs text-gray-400 mb-1">Total Earned</p>
          <p className="text-xl md:text-2xl font-bold text-neon-green font-[family-name:var(--font-orbitron)]">
            {(referralStats?.totalEarnings || 0).toFixed(6)} SOL
          </p>
          <p className="text-xs text-gray-500 mt-1">From commissions</p>
        </div>
      </div>

      <div>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Your Referral Link</h2>
        <div className="card-cyber border-neon-pink/30 p-4 md:p-5">
          <div className="bg-dark-bg rounded-lg p-3 mb-4">
            <p className="text-xs md:text-sm text-neon-cyan break-all font-mono">
              {getReferralLink()}
            </p>
          </div>
          <button
            onClick={copyReferralLink}
            className="w-full px-6 py-3 rounded-xl font-semibold bg-neon-purple text-white hover:bg-neon-purple/90 transition-all"
          >
            {copiedLink ? '✓ Link Copied!' : 'Copy Referral Link'}
          </button>
        </div>
      </div>

      <div>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Wallet address (referral code)</h2>
        <div className="card-cyber border-dark-border p-4 md:p-5">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <code className="flex-1 bg-dark-bg px-4 py-3 rounded-lg font-mono text-xs md:text-sm border border-dark-border break-all">
              {displayCode}
            </code>
            <button
              onClick={copyReferralCode}
              className="px-4 py-2.5 rounded-xl font-medium border border-dark-border text-gray-300 hover:bg-white/5 hover:border-neon-purple/40 transition-all text-sm shrink-0"
            >
              {copied ? '✓ Copied!' : 'Copy Address'}
            </button>
          </div>
        </div>
      </div>

      <div className="card-cyber border-blue-500/20 bg-blue-500/5 p-4 md:p-5">
        <h3 className="text-sm font-bold text-blue-300 mb-3 uppercase tracking-wider">How it works</h3>
        <ul className="space-y-2 text-xs md:text-sm text-gray-400">
          <li className="flex items-start gap-2">
            <span className="text-neon-purple shrink-0">1.</span>
            Share your unique referral link with friends.
          </li>
          <li className="flex items-start gap-2">
            <span className="text-neon-pink shrink-0">2.</span>
            They use SolPit to reclaim SOL (empty accounts, dust, Pump PDA, PumpSwap PDA).
          </li>
          <li className="flex items-start gap-2">
            <span className="text-neon-green shrink-0">3.</span>
            You automatically receive {referralPercentage}% of the SOL they reclaim.
          </li>
        </ul>
      </div>

      <div className="text-center">
        <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-green-500/10 border border-green-500/30 text-green-400 text-xs md:text-sm">
          <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></span>
          Stats updated in real-time
        </span>
      </div>
    </div>
  );
}
