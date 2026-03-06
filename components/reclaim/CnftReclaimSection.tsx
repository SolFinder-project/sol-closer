'use client';

import { useState, useEffect } from 'react';
import { PublicKey } from '@solana/web3.js';
import { useWallet } from '@solana/wallet-adapter-react';
import { getCompressedNftsByOwner } from '@/lib/solana/das';
import { closeCnftAssets } from '@/lib/solana/cnftCloser';
import type { DasAsset } from '@/lib/solana/das';
import { useReferral } from '@/hooks/useReferral';
import { MIN_SOL_NETWORK } from '@/lib/solana/constants';

type Props = {
  wallet: PublicKey | null;
  walletBalanceSol?: number;
  onSuccess?: () => void;
};

/**
 * Burn compressed NFTs (cNFTs) to reclaim rent. Uses DAS + Metaplex Bubblegum.
 * Reclaimed SOL = balance after burns − balance before; fee/referral % by Creator tier (effective-fee API).
 */
export default function CnftReclaimSection({ wallet, walletBalanceSol = 0, onSuccess }: Props) {
  const { signTransaction } = useWallet();
  const { referrerWallet } = useReferral();
  const [assets, setAssets] = useState<DasAsset[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [closing, setClosing] = useState(false);
  const [hasScanned, setHasScanned] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [collapseList, setCollapseList] = useState(false);
  const [effectiveFeePercent, setEffectiveFeePercent] = useState(20);
  const [effectiveReferralPercent, setEffectiveReferralPercent] = useState(10);

  useEffect(() => {
    if (!wallet) return;
    const params = new URLSearchParams({ wallet: wallet.toString() });
    if (referrerWallet) params.set('referrer', referrerWallet);
    fetch(`/api/nft-creator/effective-fee?${params}`)
      .then((r) => r.json())
      .then((d) => {
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
      const list = await getCompressedNftsByOwner(wallet);
      setAssets(list);
      setSelectedIds(new Set(list.map((a) => a.id)));
      setHasScanned(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Scan failed');
      setHasScanned(true);
    } finally {
      setLoading(false);
    }
  };

  const toggleOne = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (selectedIds.size === assets.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(assets.map((a) => a.id)));
    }
  };

  const handleClose = async () => {
    if (!wallet || !signTransaction) return;
    const toClose = assets.filter((a) => selectedIds.has(a.id));
    if (toClose.length === 0) {
      setError('Select at least one cNFT to close.');
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
      const result = await closeCnftAssets(
        toClose,
        { publicKey: wallet, signTransaction },
        referrerWallet ?? undefined,
        { feePercent: effectiveFeePercent, referralPercent: effectiveReferralPercent }
      );
      if (result.success) {
        const msg =
          result.solReclaimed > 0
            ? `Closed ${result.accountsClosed} cNFT(s). Reclaimed ${result.solReclaimed.toFixed(6)} SOL.`
            : `Closed ${result.accountsClosed} cNFT(s). Wallet cleaned (cNFTs have no rent-bearing accounts — 0 SOL is normal).`;
        setSuccess(msg);
        setAssets((prev) => prev.filter((a) => !selectedIds.has(a.id)));
        setSelectedIds(new Set());
        if (result.warningMessage) setError(result.warningMessage);
        onSuccess?.();
      } else {
        setError(result.error ?? 'Close failed');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Close failed');
    } finally {
      setClosing(false);
    }
  };

  const selected = assets.filter((a) => selectedIds.has(a.id));
  const needsMoreSol = walletBalanceSol < MIN_SOL_NETWORK;

  return (
    <div className="card-cyber border-amber-500/30 bg-amber-500/5 p-4 md:p-5 flex flex-col h-full text-center items-center">
      <div className="flex-1 w-full">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">cNFTs</p>
        <h3 className="text-base md:text-lg font-bold font-[family-name:var(--font-orbitron)] text-amber-400/90 mb-2">
          Close cNFTs (wallet cleanup)
        </h3>
        <p className="text-xs text-gray-400 mb-2">
          Burn cNFTs to remove them from your wallet. cNFTs use a shared tree (no per-item accounts), so <strong>0 SOL is always recovered</strong>. Use &quot;Burn NFT&quot; for classic SPL NFTs to reclaim ~0.002 SOL each.
        </p>
      </div>
      <div className="w-full space-y-2 flex flex-col items-center">
        {hasScanned && assets.length === 0 && (
          <div className="text-sm text-gray-400">
            No compressed NFTs found. Only cNFTs (e.g. Bubblegum) are listed here; standard SPL NFTs use the &quot;Burn NFT&quot; section.
          </div>
        )}
        {hasScanned && assets.length > 0 && (
          <>
            <p className="text-sm text-gray-300">
              <strong className="text-white">{assets.length}</strong> cNFT(s) found
            </p>
            <div className="border border-amber-500/20 rounded-lg p-3 space-y-2 max-h-[200px] overflow-y-auto">
              <div className="flex justify-between items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCollapseList((c) => !c)}
                  className="text-xs text-amber-400 hover:text-amber-300"
                >
                  {collapseList ? 'Show list' : 'Hide list'}
                </button>
                <button type="button" onClick={selectAll} className="text-xs text-amber-400 hover:text-amber-300">
                  {selectedIds.size === assets.length ? 'Deselect all' : 'Select all'}
                </button>
              </div>
              {!collapseList && (
                <div className="space-y-1">
                  {assets.map((a) => (
                    <div
                      key={a.id}
                      onClick={() => toggleOne(a.id)}
                      className={`p-2 rounded border cursor-pointer text-xs ${
                        selectedIds.has(a.id)
                          ? 'border-amber-500 bg-amber-500/10'
                          : 'border-dark-border bg-dark-bg hover:border-amber-500/50'
                      }`}
                    >
                      <span className="font-mono text-gray-400 truncate block">{a.id.slice(0, 8)}...{a.id.slice(-8)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="text-xs text-gray-400">
              <p>Selected: {selected.length}. Removes cNFTs from your wallet (no SOL recovery — by design of compression).</p>
            </div>
            <button
              type="button"
              onClick={handleClose}
              disabled={closing || selected.length === 0 || needsMoreSol}
              className="w-full px-5 py-2.5 rounded-xl font-semibold border border-amber-500/40 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20 disabled:opacity-50 text-sm"
            >
              {closing ? 'Closing...' : needsMoreSol ? `Need ${MIN_SOL_NETWORK} SOL` : `Close ${selected.length} cNFT(s)`}
            </button>
          </>
        )}
        {(!hasScanned || assets.length === 0) && (
          <button
            type="button"
            onClick={handleScan}
            disabled={!wallet || loading}
            className="w-full px-5 py-2.5 rounded-xl font-semibold border border-amber-500/40 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20 disabled:opacity-50 text-sm"
          >
            {loading ? 'Scanning...' : 'Scan cNFTs'}
          </button>
        )}
      </div>
      {error && <p className="text-sm text-red-400 mt-2 text-center w-full">{error}</p>}
      {success && <p className="text-sm text-neon-green mt-2 text-center w-full">{success}</p>}
    </div>
  );
}
