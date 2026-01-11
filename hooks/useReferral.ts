'use client';

import { useWallet } from '@solana/wallet-adapter-react';
import { useEffect, useState } from 'react';
import { getUserStats } from '@/lib/supabase/transactions';
import { isValidSolanaAddress } from '@/lib/solana/validators';

interface ReferralStats {
  totalReferrals: number;
  totalEarnings: number;
}

export function useReferral() {
  const { publicKey } = useWallet();
  const [referralCode, setReferralCode] = useState<string>('');
  const [referralStats, setReferralStats] = useState<ReferralStats | null>(null);
  const [referrerWallet, setReferrerWallet] = useState<string | null>(null);

  // Check URL for referral code on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const refWallet = params.get('ref');
      
      if (refWallet) {
        // ✅ VALIDATION: Clean and validate referrer wallet
        const cleanedWallet = refWallet.trim();
        
        if (isValidSolanaAddress(cleanedWallet)) {
          console.log('🎁 Valid referral wallet detected:', cleanedWallet.slice(0, 8) + '...');
          
          // Save referrer wallet to sessionStorage
          sessionStorage.setItem('solcloser_referrer_wallet', cleanedWallet);
          setReferrerWallet(cleanedWallet);
        } else {
          console.warn('⚠️ Invalid referral wallet in URL:', cleanedWallet.slice(0, 10));
        }
        
        // Clean URL without reloading
        const url = new URL(window.location.href);
        url.searchParams.delete('ref');
        window.history.replaceState({}, '', url.toString());
      } else {
        // Check if we have a referrer in current session
        const savedWallet = sessionStorage.getItem('solcloser_referrer_wallet');
        if (savedWallet) {
          const cleanedSaved = savedWallet.trim();
          if (isValidSolanaAddress(cleanedSaved)) {
            setReferrerWallet(cleanedSaved);
          } else {
            console.warn('⚠️ Invalid saved referrer wallet, clearing');
            sessionStorage.removeItem('solcloser_referrer_wallet');
          }
        }
      }
    }
  }, []);

  // Load user stats and set referral code when wallet connects
  useEffect(() => {
    async function loadStats() {
      if (publicKey) {
        const walletAddress = publicKey.toString();
        
        // Use wallet address as referral code
        setReferralCode(walletAddress);

        // Clear referrer if it's the same as current wallet (can't refer yourself)
        const savedReferrer = sessionStorage.getItem('solcloser_referrer_wallet');
        if (savedReferrer === walletAddress) {
          console.log('⚠️ Cannot refer yourself, clearing referrer');
          sessionStorage.removeItem('solcloser_referrer_wallet');
          setReferrerWallet(null);
        }

        // Load referral stats from Supabase
        const stats = await getUserStats(walletAddress);
        if (stats) {
          setReferralStats({
            totalReferrals: stats.referral_count || 0,
            totalEarnings: stats.referral_earnings || 0,
          });
        }
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
