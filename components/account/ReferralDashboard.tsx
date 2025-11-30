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
      <div className="card-cyber text-center py-12">
        <div className="text-6xl mb-6">🔗</div>
        <h3 className="text-2xl font-bold mb-4 font-[family-name:var(--font-orbitron)] text-transparent bg-clip-text bg-gradient-to-r from-neon-purple to-neon-pink">
          Referral Program
        </h3>
        <p className="text-gray-400 mb-6 max-w-md mx-auto">
          Connect your wallet to access your unique referral link and start earning {referralPercentage}% on every transaction from users you refer!
        </p>
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-neon-purple/10 border border-neon-purple/30">
          <span className="text-neon-purple">👆</span>
          <span className="text-sm text-gray-300">Click "Connect" to get started</span>
        </div>
      </div>
    );
  }

  if (!referralCode) {
    return (
      <div className="card-cyber text-center py-12">
        <div className="text-4xl mb-4 animate-spin">⏳</div>
        <p className="text-gray-400">Loading your referral code...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-3xl md:text-4xl font-bold font-[family-name:var(--font-orbitron)] mb-2">
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-neon-purple to-neon-pink">
            🎁 Referral Program
          </span>
        </h2>
        <p className="text-gray-400">
          Share your link and earn {referralPercentage}% of every transaction!
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="card-cyber bg-gradient-to-br from-neon-purple/20 to-transparent">
          <p className="text-sm text-gray-400 mb-1">Total Referrals</p>
          <p className="text-3xl font-bold text-neon-purple font-[family-name:var(--font-orbitron)]">
            {referralStats?.totalReferrals || 0}
          </p>
          <p className="text-xs text-gray-500 mt-1">Users who used your link</p>
        </div>
        
        <div className="card-cyber bg-gradient-to-br from-neon-green/20 to-transparent">
          <p className="text-sm text-gray-400 mb-1">Total Earned</p>
          <p className="text-3xl font-bold text-neon-green font-[family-name:var(--font-orbitron)]">
            {(referralStats?.totalEarnings || 0).toFixed(6)} SOL
          </p>
          <p className="text-xs text-gray-500 mt-1">From referral commissions</p>
        </div>
      </div>

      {/* Referral Link - Primary CTA */}
      <div className="card-cyber border-neon-pink/30">
        <p className="text-sm text-gray-400 mb-3">Your Referral Link</p>
        <div className="bg-dark-bg rounded-lg p-3 mb-3">
          <p className="text-sm text-neon-cyan break-all font-mono">
            {getReferralLink()}
          </p>
        </div>
        <button
          onClick={copyReferralLink}
          className="w-full btn-cyber"
        >
          {copiedLink ? '✓ Link Copied!' : '📋 Copy Referral Link'}
        </button>
      </div>

      {/* Wallet Address for manual sharing */}
      <div className="card-cyber">
        <p className="text-sm text-gray-400 mb-3">Your Wallet Address (Referral Code)</p>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <code className="flex-1 bg-dark-bg px-4 py-3 rounded-lg font-mono text-sm border border-dark-border text-center sm:text-left break-all">
            {displayCode}
          </code>
          <button
            onClick={copyReferralCode}
            className="px-4 py-2 rounded-lg bg-dark-border hover:bg-dark-border/70 transition-colors text-sm"
          >
            {copied ? '✓ Copied!' : 'Copy Full Address'}
          </button>
        </div>
      </div>

      <div className="card-cyber border-blue-500/30 bg-gradient-to-br from-blue-500/10 to-transparent">
        <h4 className="font-bold text-blue-300 mb-3 flex items-center gap-2">
          <span>💡</span> How it works
        </h4>
        <ul className="space-y-2 text-sm text-gray-400">
          <li className="flex items-start gap-2">
            <span className="text-neon-purple">1.</span>
            Share your unique referral link with friends
          </li>
          <li className="flex items-start gap-2">
            <span className="text-neon-pink">2.</span>
            They close their empty token accounts using SOLcloser
          </li>
          <li className="flex items-start gap-2">
            <span className="text-neon-green">3.</span>
            You automatically receive {referralPercentage}% of the SOL they reclaim!
          </li>
        </ul>
      </div>

      {/* Live indicator */}
      <div className="text-center">
        <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-green-500/10 border border-green-500/30 text-green-400 text-sm">
          <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></span>
          Stats updated in real-time
        </span>
      </div>
    </div>
  );
}
