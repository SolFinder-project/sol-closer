'use client';

import { useWallet } from '@solana/wallet-adapter-react';
import { useEffect, useState } from 'react';
import { getUserStats } from '@/lib/supabase/transactions';
import { isValidSolanaAddress } from '@/lib/solana/validators';

interface ReferralStats {
  totalReferrals: number;
  totalEarnings: number;
}

/** Read referrer from URL (ref=) or sessionStorage synchronously so first render has it (avoids effective-fee race with 10% default). */
function getInitialReferrer(): string | null {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  const refWallet = params.get('ref');
  if (refWallet) {
    const cleaned = refWallet.trim();
    if (isValidSolanaAddress(cleaned)) {
      sessionStorage.setItem('solcloser_referrer_wallet', cleaned);
      return cleaned;
    }
  }
  const saved = sessionStorage.getItem('solcloser_referrer_wallet');
  if (saved) {
    const cleaned = saved.trim();
    return isValidSolanaAddress(cleaned) ? cleaned : null;
  }
  return null;
}

export function useReferral() {
  const { publicKey } = useWallet();
  const [referralCode, setReferralCode] = useState<string>('');
  const [referralStats, setReferralStats] = useState<ReferralStats | null>(null);
  const [referrerWallet, setReferrerWallet] = useState<string | null>(getInitialReferrer);

  // Clean URL when ref was in query (state already set by getInitialReferrer). Keep session in sync on hydration.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const refWallet = params.get('ref');
    if (refWallet) {
      const url = new URL(window.location.href);
      url.searchParams.delete('ref');
      window.history.replaceState({}, '', url.toString());
      return;
    }
    const savedWallet = sessionStorage.getItem('solcloser_referrer_wallet');
    if (savedWallet) {
      const cleanedSaved = savedWallet.trim();
      if (!isValidSolanaAddress(cleanedSaved)) sessionStorage.removeItem('solcloser_referrer_wallet');
    }
  }, []);

  // Load user stats and set referral code when wallet connects; clear immediately on wallet change
  useEffect(() => {
    if (!publicKey) {
      setReferralCode('');
      setReferralStats(null);
      return;
    }
    setReferralStats(null);
    async function loadStats() {
      if (!publicKey) return;
      const walletAddress = publicKey.toString();
      setReferralCode(walletAddress);

      const savedReferrer = sessionStorage.getItem('solcloser_referrer_wallet');
      if (savedReferrer === walletAddress) {
        sessionStorage.removeItem('solcloser_referrer_wallet');
        setReferrerWallet(null);
      }

      const stats = await getUserStats(walletAddress);
      if (stats) {
        setReferralStats({
          totalReferrals: stats.referral_count || 0,
          totalEarnings: stats.referral_earnings || 0,
        });
      }
    }
    loadStats();
  }, [publicKey]);

  const getReferralLink = () => {
    if (!referralCode) return '';
    
    const baseUrl = typeof window !== 'undefined' 
      ? window.location.origin 
      : process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    return `${baseUrl}?ref=${referralCode}`;
  };

  // Get shortened display code (first 4 + last 4 chars)
  const getDisplayCode = () => {
    if (!referralCode) return '';
    return `${referralCode.slice(0, 4)}...${referralCode.slice(-4)}`;
  };

  return {
    referralCode,        // Full wallet address
    displayCode: getDisplayCode(),  // Shortened for display
    referralStats,
    referrerWallet,      // Referrer's full wallet address (validated)
    getReferralLink,
  };
}
