'use client';

import { useState, useEffect, useRef } from 'react';
import { PublicKey } from '@solana/web3.js';
import { useWallet } from '@solana/wallet-adapter-react';
import { scanNftBurnAccounts } from '@/lib/solana/scanner';
import { burnNftAccounts } from '@/lib/solana/nftBurnCloser';
import { MPL_CORE_PROGRAM_ID } from '@/lib/solana/constants';
import type { NftBurnAccount } from '@/types/token-account';
import { useReferral } from '@/hooks/useReferral';
import { MIN_SOL_NETWORK } from '@/lib/solana/constants';

type Props = {
  wallet: PublicKey | null;
  walletBalanceSol?: number;
  /** Called after a successful burn with net SOL received (for stake/swap and balance refresh). */
  onSuccess?: (result: { solReclaimed: number }) => void;
};

/**
 * Burn NFT (token account with 1 token, decimals 0) to reclaim token account rent.
 * Recoverable: ~0.002 SOL per NFT (token account only; Metadata/Edition not closed).
 */
export default function NftBurnReclaimSection({ wallet, walletBalanceSol = 0, onSuccess }: Props) {
  const { signTransaction } = useWallet();
  const { referrerWallet } = useReferral();
  const [nfts, setNfts] = useState<NftBurnAccount[]>([]);
  const [selectedMints, setSelectedMints] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [closing, setClosing] = useState(false);
  const [hasScanned, setHasScanned] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [collapseList, setCollapseList] = useState(false);
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
      const list = await scanNftBurnAccounts(wallet);
      setNfts(list);
      setSelectedMints(new Set(list.map((n) => n.mint.toString())));
      setHasScanned(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Scan failed');
      setHasScanned(true);
    } finally {
      setLoading(false);
    }
  };

  const toggleOne = (mint: string) => {
    setSelectedMints((prev) => {
      const next = new Set(prev);
      if (next.has(mint)) next.delete(mint);
      else next.add(mint);
      return next;
    });
  };

  const selectAll = () => {
    if (selectedMints.size === nfts.length) {
      setSelectedMints(new Set());
    } else {
      setSelectedMints(new Set(nfts.map((n) => n.mint.toString())));
    }
  };

  const handleBurn = async () => {
    if (!wallet || !signTransaction) return;
    const toBurn = nfts.filter((n) => selectedMints.has(n.mint.toString()));
    if (toBurn.length === 0) {
      setError('Select at least one NFT to burn.');
      return;
    }
    if (walletBalanceSol < MIN_SOL_NETWORK) {
      setError(`You need at least ${MIN_SOL_NETWORK} SOL for network fees.`);
      return;
    }
    setClosing(true);
    setError(null);
    setSuccess(null);
    try {
      const result = await burnNftAccounts(
        toBurn,
        { publicKey: wallet, signTransaction },
        referrerWallet ?? undefined,
        { feePercent: effectiveFeePercent, referralPercent: effectiveReferralPercent }
      );
      if (result.success) {
        setSuccess(`Burned ${result.accountsClosed} NFT(s). Reclaimed ${result.solReclaimed.toFixed(6)} SOL.`);
        setNfts((prev) => prev.filter((n) => !selectedMints.has(n.mint.toString())));
        setSelectedMints(new Set());
        if (result.warningMessage) setError(result.warningMessage);
        onSuccess?.({ solReclaimed: result.solReclaimed });
      } else {
        setError(result.error ?? 'Burn failed');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Burn failed');
    } finally {
      setClosing(false);
    }
  };

  const selected = nfts.filter((n) => selectedMints.has(n.mint.toString()));
  const totalLamports = selected.reduce((s, n) => s + n.rentExemptReserve, 0);
  const feeLamports = Math.floor((totalLamports * effectiveFeePercent) / 100);
  const referralLamports = referrerWallet ? Math.floor((totalLamports * effectiveReferralPercent) / 100) : 0;
  const netLamports = totalLamports - feeLamports - referralLamports;
  const netSol = netLamports / 1e9;
  const needsMoreSol = walletBalanceSol < MIN_SOL_NETWORK;

  return (
    <div className="card-cyber border-rose-500/30 bg-rose-500/5 p-4 md:p-5 flex flex-col h-full text-center items-center">
      <div className="flex-1 w-full">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">NFTs</p>
        <h3 className="text-base md:text-lg font-bold font-[family-name:var(--font-orbitron)] text-rose-400/90 mb-2">
          Burn & reclaim rent
        </h3>
        <p className="text-xs text-gray-400 mb-2">
          Burn unwanted NFTs (airdrops, junk) and recover ~0.002 SOL per token account. Only the token account is closed; Metadata/Edition stay on-chain.
        </p>
        <p className="text-xs text-amber-400/90 mb-2">
          Make sure the NFTs you burn have no value (no rare collection or resale).
        </p>
      </div>
      <div className="w-full space-y-2 flex flex-col items-center">
        {hasScanned && nfts.length === 0 && (
          <p className="text-sm text-gray-400">No burnable NFTs found (SPL / Token-2022 / Metaplex Core).</p>
        )}
        {hasScanned && nfts.length > 0 && (
          <>
            <p className="text-sm text-gray-300">
              <strong className="text-white">{nfts.length}</strong> NFT(s) → <span className="font-mono text-neon-green">+{(nfts.reduce((s, n) => s + n.rentExemptReserve, 0) / 1e9).toFixed(6)} SOL</span> reclaimable
            </p>
            <div className="border border-rose-500/20 rounded-lg p-3 space-y-2 max-h-[200px] overflow-y-auto">
              <div className="flex justify-between items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCollapseList((c) => !c)}
                  className="text-xs text-rose-400 hover:text-rose-300"
                >
                  {collapseList ? 'Show list' : 'Hide list'}
                </button>
                <button type="button" onClick={selectAll} className="text-xs text-rose-400 hover:text-rose-300">
                  {selectedMints.size === nfts.length ? 'Deselect all' : 'Select all'}
                </button>
              </div>
              {!collapseList && (
                <div className="space-y-1">
                  {nfts.map((n) => {
                    const isCore = n.programId.equals(MPL_CORE_PROGRAM_ID);
                    return (
                      <div
                        key={n.mint.toString()}
                        onClick={() => toggleOne(n.mint.toString())}
                        className={`p-2 rounded border cursor-pointer text-xs ${
                          selectedMints.has(n.mint.toString())
                            ? 'border-rose-500 bg-rose-500/10'
                            : 'border-dark-border bg-dark-bg hover:border-rose-500/50'
                        } ${isCore ? 'border-amber-500/30' : ''}`}
                      >
                        <span className="font-mono text-gray-400 truncate block">{n.mint.toString().slice(0, 8)}...{n.mint.toString().slice(-8)}</span>
                        <span className="text-neon-green font-mono">+{(n.rentExemptReserve / 1e9).toFixed(6)} SOL</span>
                        {isCore && <span className="block text-amber-400/90 text-[10px] mt-0.5">Metaplex Core</span>}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            <div className="text-xs text-gray-400 space-y-0.5">
              <p>Selected: {selected.length} → Gross: {(totalLamports / 1e9).toFixed(6)} SOL · Fee {effectiveFeePercent}%: -{(feeLamports / 1e9).toFixed(6)} SOL{referrerWallet ? ` · Referral ${effectiveReferralPercent}%: -${(referralLamports / 1e9).toFixed(6)} SOL` : ''}</p>
              <p className="font-semibold text-white">You receive: {(netLamports / 1e9).toFixed(6)} SOL</p>
            </div>
            <button
              type="button"
              onClick={handleBurn}
              disabled={closing || selected.length === 0 || needsMoreSol}
              className="w-full px-5 py-2.5 rounded-xl font-semibold border border-rose-500/40 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20 disabled:opacity-50 text-sm"
            >
              {closing ? 'Burning...' : needsMoreSol ? `Need ${MIN_SOL_NETWORK} SOL` : `Burn ${selected.length} NFT(s) & reclaim`}
            </button>
          </>
        )}
        {(!hasScanned || nfts.length === 0) && (
          <button
            type="button"
            onClick={handleScan}
            disabled={!wallet || loading}
            className="w-full px-5 py-2.5 rounded-xl font-semibold border border-rose-500/40 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20 disabled:opacity-50 text-sm"
          >
            {loading ? 'Scanning...' : 'Scan NFTs'}
          </button>
        )}
      </div>
      {error && <p className="text-sm text-red-400 mt-2 text-center w-full">{error}</p>}
      {success && <p className="text-sm text-neon-green mt-2 text-center w-full">{success}</p>}
    </div>
  );
}
