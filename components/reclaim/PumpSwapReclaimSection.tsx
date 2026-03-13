'use client';

import { useState, useEffect, useRef } from 'react';
import { PublicKey } from '@solana/web3.js';
import { useWallet } from '@solana/wallet-adapter-react';
import { scanPumpSwapPdas, pumpSwapReclaimableSol, type PumpSwapPdaAccount } from '@/lib/solana/pumpSwap';
import { closePumpSwapPdas } from '@/lib/solana/pumpSwapCloser';
import { useReferral } from '@/hooks/useReferral';

const isMainnet = process.env.NEXT_PUBLIC_SOLANA_NETWORK === 'mainnet-beta';

type Props = {
  wallet: PublicKey | null;
  /** Called after a successful reclaim (for stake/swap and balance refresh in parent). */
  onSuccess?: (result: { solReclaimed: number }) => void;
};

/**
 * PumpSwap PDA section (user_volume_accumulator). Scan by derivation; reclaim with fee/referral.
 * First swap on PumpSwap (AMM after bonding curve migration) locks ~0.0018 SOL in a PDA.
 */
export default function PumpSwapReclaimSection({ wallet, onSuccess }: Props) {
  const { signTransaction } = useWallet();
  const { referrerWallet } = useReferral();
  const [pdas, setPdas] = useState<PumpSwapPdaAccount[]>([]);
  const [loading, setLoading] = useState(false);
  const [closing, setClosing] = useState(false);
  const [hasScanned, setHasScanned] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [effectiveFeePercent, setEffectiveFeePercent] = useState(20);
  const [effectiveReferralPercent, setEffectiveReferralPercent] = useState(10);
  const effectiveFeeReferrerRef = useRef<string | null>(null);

  useEffect(() => {
    if (!wallet) return;
    effectiveFeeReferrerRef.current = referrerWallet;
    const referrerWhenRequested = referrerWallet;
    const params = new URLSearchParams({ wallet: wallet.toString() });
    if (referrerWallet) params.set('referrer', referrerWallet);
    fetch(`/api/nft-creator/effective-fee?${params}`)
      .then((r) => r.json())
      .then((d) => {
        if (effectiveFeeReferrerRef.current !== referrerWhenRequested) return;
        if (typeof d.feePercent === 'number') setEffectiveFeePercent(d.feePercent);
        if (typeof d.referralPercent === 'number') setEffectiveReferralPercent(d.referralPercent);
      })
      .catch(() => {});
  }, [wallet?.toString(), referrerWallet]);

  const handleScan = async () => {
    if (!wallet) return;
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const list = await scanPumpSwapPdas(wallet);
      setPdas(list);
      setHasScanned(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Scan failed');
      setHasScanned(true);
    } finally {
      setLoading(false);
    }
  };

  const handleReclaim = async () => {
    if (!wallet || !signTransaction || pdas.length === 0) return;
    setClosing(true);
    setError(null);
    setSuccess(null);
    try {
      const result = await closePumpSwapPdas(
        pdas,
        { publicKey: wallet, signTransaction },
        referrerWallet ?? undefined,
        { feePercent: effectiveFeePercent, referralPercent: effectiveReferralPercent }
      );
      if (result.success) {
        setSuccess(`Reclaimed ${result.solReclaimed.toFixed(6)} SOL (${result.accountsClosed} PDA(s) closed).`);
        setPdas([]);
        onSuccess?.({ solReclaimed: result.solReclaimed });
        if (result.warningMessage) {
          setError(result.warningMessage);
        }
      } else {
        setError(result.error ?? 'Reclaim failed');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Reclaim failed');
    } finally {
      setClosing(false);
    }
  };

  const reclaimable = pumpSwapReclaimableSol(pdas);
  const canReclaimInApp = pdas.length > 0 && wallet && signTransaction;
  const netPercent = 100 - effectiveFeePercent - (referrerWallet ? effectiveReferralPercent : 0);

  return (
    <div className="card-cyber border-cyan-500/30 bg-cyan-500/5 p-4 md:p-5 flex flex-col h-full text-center items-center">
      <div className="flex-1 w-full">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">PumpSwap</p>
        <h3 className="text-lg font-bold mb-2 font-[family-name:var(--font-orbitron)] text-cyan-400/90">
          PDA reclaim
        </h3>
        <p className="text-sm text-gray-400 mb-2">
          First swap on PumpSwap (after bonding curve) locks ~0.0018 SOL in a PDA. Reclaim that rent.
        </p>
        <p className="text-xs text-cyan-400/80 mb-4">
          With Pump.fun + PumpSwap you can reclaim up to ~0.0037 SOL (one PDA per program).
        </p>
        {!isMainnet && (
          <p className="text-xs text-cyan-400/80 mb-3">
            PumpSwap is on mainnet. On devnet this scan usually returns 0.
          </p>
        )}
      </div>
      <div className="w-full space-y-2 flex flex-col items-center">
        {hasScanned && (
          <p className="text-sm text-gray-300 text-center">
            {pdas.length > 0 ? (
              <>
                <strong className="text-white">{pdas.length}</strong> PDA(s) → <span className="font-mono text-neon-green">{reclaimable.toFixed(6)} SOL</span> reclaimable
              </>
            ) : (
              <span className="text-gray-400">Scan complete. No PumpSwap PDAs found for this wallet.</span>
            )}
          </p>
        )}
        <button
          type="button"
          onClick={handleScan}
          disabled={!wallet || loading}
          className="w-full px-5 py-2.5 rounded-xl font-semibold border border-cyan-500/40 bg-cyan-500/10 text-cyan-300 hover:bg-cyan-500/20 disabled:opacity-50 text-sm"
        >
          {loading ? 'Scanning...' : 'Scan PumpSwap PDAs'}
        </button>
        {canReclaimInApp && (
          <button
            type="button"
            onClick={handleReclaim}
            disabled={closing}
            className="w-full px-5 py-2.5 rounded-xl font-semibold border border-neon-green/50 bg-neon-green/10 text-neon-green hover:bg-neon-green/20 disabled:opacity-50 text-sm"
          >
            {closing ? 'Reclaiming...' : `Reclaim (~${(reclaimable * netPercent / 100).toFixed(6)} SOL after fee)`}
          </button>
        )}
      </div>
      {error && <p className="text-sm text-red-400 mt-2 text-center w-full">{error}</p>}
      {success && <p className="text-sm text-neon-green mt-2 text-center w-full">{success}</p>}
    </div>
  );
}
