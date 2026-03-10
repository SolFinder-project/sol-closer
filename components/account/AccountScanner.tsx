'use client';

import { useState, useEffect, useRef, type ComponentProps } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { scanWallet, scanDustAccounts, scanNftBurnAccounts } from '@/lib/solana/scanner';
import { getCompressedNftsByOwner } from '@/lib/solana/das';
import type { DasAsset } from '@/lib/solana/das';
import { closeCnftAssets } from '@/lib/solana/cnftCloser';
import { closeTokenAccounts } from '@/lib/solana/closer';
import { burnAndCloseDustAccounts } from '@/lib/solana/dustCloser';
import { fullReclaimSingleTx } from '@/lib/solana/fullReclaimCloser';
import { scanPumpPdas } from '@/lib/solana/pump';
import type { PumpPdaAccount } from '@/lib/solana/pump';
import { TokenAccount, DustAccount, NftBurnAccount } from '@/types/token-account';
import { useReferral } from '@/hooks/useReferral';
import { useReclaimEstimate } from '@/hooks/useReclaimEstimate';
import { useRugcheckSummaries } from '@/hooks/useRugcheckSummaries';
import { getWalletHealthFromEmptyCount, formatPercentileLabel } from '@/lib/utils/walletHealth';
import { LAMPORTS_PER_SOL } from '@solana/web3.js';
import { MIN_SOL_NETWORK } from '@/lib/solana/constants';
import { logger } from '@/lib/utils/logger';
import PostReclaimSwap from '@/components/swap/PostReclaimSwap';
import ReclaimToStake from '@/components/reclaim/ReclaimToStake';
import PumpReclaimSection from '@/components/reclaim/PumpReclaimSection';
import PumpSwapReclaimSection from '@/components/reclaim/PumpSwapReclaimSection';
import DriftReclaimSection from '@/components/reclaim/DriftReclaimSection';
import NftBurnReclaimSection from '@/components/reclaim/NftBurnReclaimSection';
import CnftReclaimSection from '@/components/reclaim/CnftReclaimSection';
import { scanPumpSwapPdas } from '@/lib/solana/pumpSwap';
import type { PumpSwapPdaAccount } from '@/lib/solana/pumpSwap';
import ReclaimPointsPopup, { pointsFromReclaim } from '@/components/game/ReclaimPointsPopup';
import type { NftCreatorTier } from '@/types/nftCreator';
import { CREATOR_POINTS_BONUS, CREATOR_COLLECTOR_POINTS } from '@/types/nftCreator';

export interface AccountScannerProps {
  /** Called when user taps "Go to F1 Race" in the post-reclaim points popup */
  onNavigateToGame?: () => void;
  /** Called after any successful reclaim so the app can refresh global stats and live feed */
  onReclaimSuccess?: () => void;
}

export default function AccountScanner({ onNavigateToGame, onReclaimSuccess }: AccountScannerProps = {}) {
  const { publicKey, signTransaction } = useWallet();
  const { connection } = useConnection();
  const { referrerWallet } = useReferral();
  const { estimate, loading: estimateLoading, refresh: refreshEstimate } = useReclaimEstimate(publicKey);
  const [accounts, setAccounts] = useState<TokenAccount[]>([]);
  const rugcheckMints = accounts.map((a) => a.mint.toString());
  const { summaries: rugcheckSummaries, loading: rugcheckLoading } = useRugcheckSummaries(accounts.length > 0 ? rugcheckMints : []);
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [error, setError] = useState<string>('');
  /** Where to show the error: under the cards (empty/dust) or under Full Reclaim. null = error block at bottom. */
  const [errorSource, setErrorSource] = useState<'empty' | 'dust' | 'full_reclaim' | null>(null);
  const [success, setSuccess] = useState<string>('');
  /** Which action triggered the success message → show the message under the correct Claim Summary */
  const [lastSuccessType, setLastSuccessType] = useState<'full_reclaim' | 'empty' | 'dust' | null>(null);
  const [warning, setWarning] = useState<string>('');
  const [walletBalance, setWalletBalance] = useState<number>(0);
  const [percentileAfterReclaim, setPercentileAfterReclaim] = useState<number | null>(null);
  const [healthAfterReclaim, setHealthAfterReclaim] = useState<string | null>(null);
  const [dustAccounts, setDustAccounts] = useState<DustAccount[]>([]);
  const [selectedDust, setSelectedDust] = useState<string[]>([]);
  const [isScanningDust, setIsScanningDust] = useState(false);
  const [isClosingDust, setIsClosingDust] = useState(false);
  const [pumpPdas, setPumpPdas] = useState<PumpPdaAccount[]>([]);
  const [pumpSwapPdas, setPumpSwapPdas] = useState<PumpSwapPdaAccount[]>([]);
  /** NFTs to include in Full Reclaim (scan all). */
  const [fullReclaimNftAccounts, setFullReclaimNftAccounts] = useState<NftBurnAccount[]>([]);
  /** cNFTs to include in Full Reclaim (burn = wallet cleanup, 0 SOL). */
  const [fullReclaimCnftAssets, setFullReclaimCnftAssets] = useState<DasAsset[]>([]);
  /** Selected NFT/Pump/PumpSwap/cNFT pubkeys or ids for Full Reclaim (user can uncheck to exclude). */
  const [selectedFullReclaimNftPubkeys, setSelectedFullReclaimNftPubkeys] = useState<string[]>([]);
  const [selectedPumpPdaPubkeys, setSelectedPumpPdaPubkeys] = useState<string[]>([]);
  const [selectedPumpSwapPdaPubkeys, setSelectedPumpSwapPdaPubkeys] = useState<string[]>([]);
  const [selectedFullReclaimCnftIds, setSelectedFullReclaimCnftIds] = useState<string[]>([]);
  /** Expand "Customize selection" in Full Reclaim Summary */
  const [expandFullReclaimSelection, setExpandFullReclaimSelection] = useState(false);
  /** SOL amount from the last reclaim (empty or dust) – used to show post-reclaim block. */
  const [lastReclaimedSol, setLastReclaimedSol] = useState<number>(0);
  /** Remaining reclaimed SOL available for swap/stake. Decreases when user swaps or stakes from "reclaimed"; reset on new reclaim. */
  const [availableReclaimedSol, setAvailableReclaimedSol] = useState<number>(0);
  /** One-Click Full Reclaim: execution in a single tx */
  const [isFullReclaiming, setIsFullReclaiming] = useState(false);
  /** Full Reclaim mode: scan via "Full Reclaim" → only show Full Reclaim Summary, not separate Claim Summaries */
  const [isFullReclaimMode, setIsFullReclaimMode] = useState(false);
  /** Collapsible sections: Closeable / Dust (collapsed = true) */
  const [collapseCloseable, setCollapseCloseable] = useState(false);
  const [collapseDust, setCollapseDust] = useState(false);
  /** Masquer toute la section Empty ou Dust (liste + summary) pour changer d'option */
  const [hideEmptySection, setHideEmptySection] = useState(false);
  const [hideDustSection, setHideDustSection] = useState(false);
  /** Ref to avoid race: only update balance if the wallet did not change during the fetch. */
  const walletKeyRef = useRef<string | null>(null);
  /** Post-reclaim F1 points popup: show after any successful reclaim with SOL reclaimed > 0 */
  const [reclaimPointsPopup, setReclaimPointsPopup] = useState<{ points: number; solReclaimed: number } | null>(null);
  /** SolPit Creator NFTs in wallet (for benefits banner) */
  const [creatorNfts, setCreatorNfts] = useState<{ mint: string; name: string; tier: NftCreatorTier }[] | null>(null);
  /** Tier-based fee/referral % (from effective-fee API). */
  const [effectiveFeePercent, setEffectiveFeePercent] = useState(20);
  const [effectiveReferralPercent, setEffectiveReferralPercent] = useState(10);

  const showReclaimPointsPopup = (solReclaimed: number, reclaimType?: string, creatorBonus = 0) => {
    if (solReclaimed <= 0) return;
    const basePoints = pointsFromReclaim(solReclaimed, reclaimType);
    const points = basePoints + creatorBonus;
    setReclaimPointsPopup({ points, solReclaimed });
  };

  /** Creator bonus per reclaim (for popup). Best tier + collector (2+ NFTs). */
  const TIER_ORDER: NftCreatorTier[] = ['platinum', 'gold', 'silver', 'standard'];
  const creatorBonusPerReclaim =
    creatorNfts && creatorNfts.length > 0
      ? CREATOR_POINTS_BONUS[
          creatorNfts.reduce((a, b) =>
            TIER_ORDER.indexOf(b.tier) < TIER_ORDER.indexOf(a.tier) ? b : a
          ).tier
        ] + (creatorNfts.length >= 2 ? CREATOR_COLLECTOR_POINTS : 0)
      : 0;

  // Reset complet quand le wallet change
  useEffect(() => {
    setAccounts([]);
    setSelectedAccounts([]);
    setDustAccounts([]);
    setSelectedDust([]);
    setPumpPdas([]);
    setPumpSwapPdas([]);
    setFullReclaimNftAccounts([]);
    setFullReclaimCnftAssets([]);
    setSelectedFullReclaimNftPubkeys([]);
    setSelectedPumpPdaPubkeys([]);
    setSelectedPumpSwapPdaPubkeys([]);
    setSelectedFullReclaimCnftIds([]);
    setExpandFullReclaimSelection(false);
    setError('');
    setErrorSource(null);
    setSuccess('');
    setLastSuccessType(null);
    setWarning('');
    setWalletBalance(0);
    setLastReclaimedSol(0);
    setAvailableReclaimedSol(0);
    setReclaimPointsPopup(null);
    setPercentileAfterReclaim(null);
    setHealthAfterReclaim(null);
    setIsScanning(false);
    setIsClosing(false);
    setIsScanningDust(false);
    setIsClosingDust(false);
    setIsFullReclaimMode(false);
    setCollapseCloseable(false);
    setCollapseDust(false);
    setHideEmptySection(false);
    setHideDustSection(false);
    setCreatorNfts(null);

    if (publicKey) {
      const keyStr = publicKey.toString();
      walletKeyRef.current = keyStr;
      connection.getBalance(publicKey).then((balance) => {
        if (walletKeyRef.current === keyStr) {
          setWalletBalance(balance / LAMPORTS_PER_SOL);
        }
      });
    } else {
      walletKeyRef.current = null;
    }
  }, [publicKey, connection]);

  // SolPit Creator NFTs in wallet (for benefits banner)
  useEffect(() => {
    if (!publicKey) return;
    let cancelled = false;
    fetch(`/api/nft-creator/wallet-benefits?wallet=${encodeURIComponent(publicKey.toString())}`)
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled && Array.isArray(d.nfts) && d.nfts.length > 0) {
          setCreatorNfts(d.nfts);
        } else {
          setCreatorNfts(null);
        }
      })
      .catch(() => {
        if (!cancelled) setCreatorNfts(null);
      });
    return () => {
      cancelled = true;
    };
  }, [publicKey]);

  // Effective fee/referral % by Creator tier (payer + referrer)
  useEffect(() => {
    if (!publicKey) {
      setEffectiveFeePercent(20);
      setEffectiveReferralPercent(10);
      return;
    }
    let cancelled = false;
    const params = new URLSearchParams({ wallet: publicKey.toString() });
    if (referrerWallet) params.set('referrer', referrerWallet);
    fetch(`/api/nft-creator/effective-fee?${params}`)
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled && typeof d.feePercent === 'number') setEffectiveFeePercent(d.feePercent);
        if (!cancelled && typeof d.referralPercent === 'number') setEffectiveReferralPercent(d.referralPercent);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [publicKey?.toString(), referrerWallet]);

  const handleScan = async () => {
    if (!publicKey) {
      setError('Please connect your wallet first');
      setErrorSource(null);
      return;
    }
    setIsFullReclaimMode(false);
    setIsScanning(true);
    setError('');
    setErrorSource(null);
    setWarning('');
    setAccounts([]);
    setSelectedAccounts([]);

    try {
      const result = await scanWallet(publicKey);
      setAccounts(result);
      setHideEmptySection(false);
      refreshEstimate();
      if (result.length === 0) {
        setError('No empty token accounts found! Your wallet is already clean 🎉');
        setErrorSource('empty');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to scan wallet');
      setErrorSource(null);
    } finally {
      setIsScanning(false);
    }
  };

  const handleSelectAll = () => {
    if (selectedAccounts.length === accounts.length) {
      setSelectedAccounts([]);
    } else {
      setSelectedAccounts(accounts.map(acc => acc.pubkey.toString()));
    }
  };

  const toggleAccount = (pubkey: string) => {
    setSelectedAccounts(prev =>
      prev.includes(pubkey)
        ? prev.filter(p => p !== pubkey)
        : [...prev, pubkey]
    );
  };

  const handleScanDust = async () => {
    if (!publicKey) {
      setError('Please connect your wallet first');
      setErrorSource(null);
      return;
    }
    setIsFullReclaimMode(false);
    setIsScanningDust(true);
    setError('');
    setErrorSource(null);
    setDustAccounts([]);
    setSelectedDust([]);
    try {
      const result = await scanDustAccounts(publicKey);
      setDustAccounts(result);
      setHideDustSection(false);
      if (result.length === 0) {
        setError('No dust accounts found (balance > 0 and ≤ 0.01 tokens).');
        setErrorSource('dust');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to scan for dust');
      setErrorSource(null);
    } finally {
      setIsScanningDust(false);
    }
  };

  const handleSelectAllDust = () => {
    if (selectedDust.length === dustAccounts.length) {
      setSelectedDust([]);
    } else {
      setSelectedDust(dustAccounts.map((a) => a.pubkey.toString()));
    }
  };

  const toggleDust = (pubkey: string) => {
    setSelectedDust((prev) =>
      prev.includes(pubkey) ? prev.filter((p) => p !== pubkey) : [...prev, pubkey]
    );
  };

  const handleBurnAndCloseDust = async () => {
    if (!publicKey || selectedDust.length === 0) {
      setError(selectedDust.length === 0 ? 'Please select at least one dust account.' : 'Wallet not connected');
      setErrorSource(null);
      return;
    }
    if (walletBalance < MIN_SOL_NETWORK) {
      setError(`You need at least ${MIN_SOL_NETWORK} SOL for network fees.`);
      setErrorSource(null);
      return;
    }
    setIsClosingDust(true);
    setError('');
    setErrorSource(null);
    setSuccess('');
    setLastSuccessType(null);
    try {
      const toClose = dustAccounts.filter((a) => selectedDust.includes(a.pubkey.toString()));
      const result = await burnAndCloseDustAccounts(
        toClose,
        { publicKey, signTransaction },
        referrerWallet,
        { feePercent: effectiveFeePercent, referralPercent: effectiveReferralPercent }
      );
      if (result.success) {
        setSuccess(`Dust: closed ${result.accountsClosed} account(s). Reclaimed ${result.solReclaimed.toFixed(6)} SOL.`);
        setLastSuccessType('dust');
        setLastReclaimedSol(result.solReclaimed);
        setAvailableReclaimedSol(result.solReclaimed);
        showReclaimPointsPopup(result.solReclaimed, 'dust', creatorBonusPerReclaim);
        if (result.warningMessage) setWarning(result.warningMessage);
        setDustAccounts((prev) => prev.filter((a) => !selectedDust.includes(a.pubkey.toString())));
        setSelectedDust([]);
        refreshEstimate();
        onReclaimSuccess?.();
        const newBalance = await connection.getBalance(publicKey);
        setWalletBalance(newBalance / LAMPORTS_PER_SOL);
        // Same success card: show wallet health (empty + dust remaining)
        const remainingDust = dustAccounts.length - selectedDust.length;
        const totalReclaimableLeft = accounts.length + remainingDust;
        setHealthAfterReclaim(getWalletHealthFromEmptyCount(totalReclaimableLeft).label);
        fetch(`/api/stats/percentile?wallet=${publicKey.toString()}`)
          .then((r) => r.json())
          .then((d) => typeof d.percentile === 'number' && setPercentileAfterReclaim(d.percentile))
          .catch(() => {});
      } else {
        setError(result.error ?? 'Failed to burn & close');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Burn & close failed');
    } finally {
      setIsClosingDust(false);
    }
  };

  /** Scan empty + dust + Pump PDA in parallel then select all (Full Reclaim mode). */
  const handleScanAll = async () => {
    if (!publicKey) {
      setError('Please connect your wallet first');
      setErrorSource(null);
      return;
    }
    setIsFullReclaimMode(true);
    setError('');
    setErrorSource(null);
    setWarning('');
    setAccounts([]);
    setDustAccounts([]);
    setPumpPdas([]);
    setSelectedAccounts([]);
    setSelectedDust([]);
    setIsScanning(true);
    setIsScanningDust(true);
    try {
      const [emptyResult, dustResult, nftResult, pumpResult, pumpSwapResult, cnftResult] = await Promise.all([
        scanWallet(publicKey),
        scanDustAccounts(publicKey),
        scanNftBurnAccounts(publicKey),
        scanPumpPdas(publicKey),
        scanPumpSwapPdas(publicKey),
        getCompressedNftsByOwner(publicKey),
      ]);
      setAccounts(emptyResult);
      setDustAccounts(dustResult);
      setFullReclaimNftAccounts(nftResult);
      setPumpPdas(pumpResult);
      setPumpSwapPdas(pumpSwapResult);
      setFullReclaimCnftAssets(cnftResult);
      setSelectedAccounts(emptyResult.map((a) => a.pubkey.toString()));
      setSelectedDust(dustResult.map((a) => a.pubkey.toString()));
      setSelectedFullReclaimNftPubkeys(nftResult.map((a) => a.pubkey.toString()));
      setSelectedPumpPdaPubkeys(pumpResult.map((p) => p.pubkey.toString()));
      setSelectedPumpSwapPdaPubkeys(pumpSwapResult.map((p) => p.pubkey.toString()));
      setSelectedFullReclaimCnftIds(cnftResult.map((a) => a.id));
      refreshEstimate();
      if (emptyResult.length === 0 && dustResult.length === 0 && nftResult.length === 0 && pumpResult.length === 0 && pumpSwapResult.length === 0 && cnftResult.length === 0) {
        setError('No empty, dust, NFT, Pump, PumpSwap or cNFT accounts found. Your wallet is already clean.');
        setErrorSource('full_reclaim');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Scan failed');
      setErrorSource(null);
    } finally {
      setIsScanning(false);
      setIsScanningDust(false);
    }
  };

  /** One-Click Full Reclaim: une seule transaction (close + burn+close + Pump PDA + fee + referral). */
  const handleFullReclaim = async () => {
    if (!publicKey || !signTransaction) {
      setError('Wallet not connected');
      setErrorSource(null);
      return;
    }
    const emptyToClose = accounts.filter((a) => selectedAccounts.includes(a.pubkey.toString()));
    const dustToClose = dustAccounts.filter((a) => selectedDust.includes(a.pubkey.toString()));
    const nftToReclaim = fullReclaimNftAccounts.filter((a) => selectedFullReclaimNftPubkeys.includes(a.pubkey.toString()));
    const pumpToReclaim = pumpPdas.filter((p) => selectedPumpPdaPubkeys.includes(p.pubkey.toString()));
    const pumpSwapToReclaim = pumpSwapPdas.filter((p) => selectedPumpSwapPdaPubkeys.includes(p.pubkey.toString()));
    const cnftToReclaim = fullReclaimCnftAssets.filter((a) => selectedFullReclaimCnftIds.includes(a.id));
    const hasSingleTxAccounts = emptyToClose.length > 0 || dustToClose.length > 0 || nftToReclaim.length > 0 || pumpToReclaim.length > 0 || pumpSwapToReclaim.length > 0;
    const hasCnft = cnftToReclaim.length > 0;
    if (!hasSingleTxAccounts && !hasCnft) {
      setError('Select at least one empty, dust, NFT, Pump, PumpSwap or cNFT account.');
      setErrorSource(null);
      return;
    }
    if (walletBalance < MIN_SOL_NETWORK) {
      setError(`You need at least ${MIN_SOL_NETWORK} SOL for network fees.`);
      setErrorSource(null);
      return;
    }
    setIsFullReclaiming(true);
    setError('');
    setErrorSource(null);
    setSuccess('');
    setLastSuccessType(null);
    setWarning('');
    try {
      let reclaimedSol = 0;
      if (hasSingleTxAccounts) {
        const result = await fullReclaimSingleTx(
          emptyToClose,
          dustToClose,
          nftToReclaim,
          pumpToReclaim,
          pumpSwapToReclaim,
          { publicKey, signTransaction },
          referrerWallet,
          { feePercent: effectiveFeePercent, referralPercent: effectiveReferralPercent }
        );
        if (!result.success) {
          setError(result.error ?? 'Full reclaim failed');
          setErrorSource(null);
          return;
        }
        if (result.warningMessage) setWarning(result.warningMessage);
        reclaimedSol = result.solReclaimed;
        setAccounts((prev) => prev.filter((a) => !selectedAccounts.includes(a.pubkey.toString())));
        setSelectedAccounts([]);
        setDustAccounts((prev) => prev.filter((a) => !selectedDust.includes(a.pubkey.toString())));
        setSelectedDust([]);
        setFullReclaimNftAccounts((prev) => prev.filter((a) => !selectedFullReclaimNftPubkeys.includes(a.pubkey.toString())));
        setSelectedFullReclaimNftPubkeys([]);
        setPumpPdas((prev) => prev.filter((p) => !selectedPumpPdaPubkeys.includes(p.pubkey.toString())));
        setSelectedPumpPdaPubkeys([]);
        setPumpSwapPdas((prev) => prev.filter((p) => !selectedPumpSwapPdaPubkeys.includes(p.pubkey.toString())));
        setSelectedPumpSwapPdaPubkeys([]);
      }
      let cnftClosedCount = 0;
      if (hasCnft) {
        cnftClosedCount = cnftToReclaim.length;
        const cnftResult = await closeCnftAssets(
          cnftToReclaim,
          { publicKey, signTransaction },
          referrerWallet ?? undefined,
          { feePercent: effectiveFeePercent, referralPercent: effectiveReferralPercent }
        );
        if (!cnftResult.success) {
          setError(cnftResult.error ?? 'cNFT close failed');
          setErrorSource(null);
          return;
        }
        setFullReclaimCnftAssets((prev) => prev.filter((a) => !selectedFullReclaimCnftIds.includes(a.id)));
        setSelectedFullReclaimCnftIds([]);
      }
      const msg = hasSingleTxAccounts && hasCnft
        ? `Full reclaim: recovered ${reclaimedSol.toFixed(6)} SOL (empty + dust + NFT + Pump + PumpSwap) and closed ${cnftClosedCount} cNFT(s) (wallet cleanup).`
        : hasCnft
          ? `Full reclaim: closed ${cnftClosedCount} cNFT(s) (wallet cleanup).`
          : `Full reclaim: recovered ${reclaimedSol.toFixed(6)} SOL in one transaction (empty + dust + NFT + Pump + PumpSwap).`;
      setSuccess(msg);
      setLastSuccessType('full_reclaim');
      setLastReclaimedSol(reclaimedSol);
      setAvailableReclaimedSol(reclaimedSol);
      showReclaimPointsPopup(reclaimedSol, 'full_reclaim', creatorBonusPerReclaim);
      refreshEstimate();
      onReclaimSuccess?.();
      const newBalance = await connection.getBalance(publicKey);
      setWalletBalance(newBalance / LAMPORTS_PER_SOL);
      setHealthAfterReclaim(getWalletHealthFromEmptyCount(0).label);
      fetch(`/api/stats/percentile?wallet=${publicKey.toString()}`)
        .then((r) => r.json())
        .then((d) => typeof d.percentile === 'number' && setPercentileAfterReclaim(d.percentile))
        .catch(() => {});
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Full reclaim failed');
      setErrorSource(null);
    } finally {
      setIsFullReclaiming(false);
    }
  };

  const handleClose = async () => {
    if (!publicKey) {
      setError('Wallet not connected');
      setErrorSource(null);
      return;
    }
    if (selectedAccounts.length === 0) {
      setError('Please select at least one account to close');
      setErrorSource(null);
      return;
    }

    if (walletBalance < MIN_SOL_NETWORK) {
      setError(`⚠️ You need at least ${MIN_SOL_NETWORK} SOL in your wallet to pay for network transaction fees. Please add some SOL first.`);
      setErrorSource(null);
      return;
    }

    setIsClosing(true);
    setError('');
    setErrorSource(null);
    setSuccess('');
    setLastSuccessType(null);
    setWarning('');

    try {
      const accountsToClose = accounts.filter(acc =>
        selectedAccounts.includes(acc.pubkey.toString())
      );
      
      logger.debug('Closing with referral', { referrerWallet, accountsCount: accountsToClose.length });

      const result = await closeTokenAccounts(
        accountsToClose,
        { publicKey, signTransaction },
        referrerWallet,
        { feePercent: effectiveFeePercent, referralPercent: effectiveReferralPercent }
      );

      if (result.success) {
        let successMsg = `Successfully closed ${result.accountsClosed} accounts! Reclaimed ${result.solReclaimed.toFixed(6)} SOL`;
        
        if (result.warningMessage) {
          setWarning(result.warningMessage);
        }
        
        if (referrerWallet && !result.warningMessage) {
          const shortReferrer = `${referrerWallet.slice(0, 4)}...${referrerWallet.slice(-4)}`;
          successMsg += ` | 🎁 ${effectiveReferralPercent}% bonus sent to your referrer (${shortReferrer})!`;
        }
        
        setSuccess(successMsg);
        setLastSuccessType('empty');
        setLastReclaimedSol(result.solReclaimed);
        setAvailableReclaimedSol(result.solReclaimed);
        showReclaimPointsPopup(result.solReclaimed, 'empty', creatorBonusPerReclaim);
        onReclaimSuccess?.();
        const walletPk = publicKey;
        // 🔧 Rescan in background without clearing the success message
        const newAccounts = await scanWallet(walletPk);
        setAccounts(newAccounts);
        setSelectedAccounts([]);
        setHealthAfterReclaim(getWalletHealthFromEmptyCount(newAccounts.length).label);
        refreshEstimate();
        fetch(`/api/stats/percentile?wallet=${walletPk.toString()}`)
          .then((r) => r.json())
          .then((d) => typeof d.percentile === 'number' && setPercentileAfterReclaim(d.percentile))
          .catch(() => {});

        const newBalance = await connection.getBalance(walletPk);
        setWalletBalance(newBalance / LAMPORTS_PER_SOL);
      } else {
        setError(result.error || 'Failed to close accounts');
        setErrorSource(null);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Transaction failed';
      setError(message);
      setErrorSource(null);
      logger.error('Close error:', err);
    } finally {
      setIsClosing(false);
    }
  };

  const selectedTotal = accounts
    .filter(acc => selectedAccounts.includes(acc.pubkey.toString()))
    .reduce((sum, acc) => sum + acc.rentExemptReserve, 0);

  const feeAmount = (selectedTotal * effectiveFeePercent) / 100;
  const referralAmount = referrerWallet ? (selectedTotal * effectiveReferralPercent) / 100 : 0;
  const netAmount = selectedTotal - feeAmount - referralAmount;

  const referrerDisplay = referrerWallet 
    ? `${referrerWallet.slice(0, 4)}...${referrerWallet.slice(-4)}`
    : null;

  const needsMoreSOL = walletBalance < MIN_SOL_NETWORK;

  if (!publicKey) {
    return (
      <div className="animate-slide-up max-w-xl mx-auto space-y-4">
        <div className="card-cyber text-center py-10 md:py-12 border-dark-border">
          <div className="text-5xl md:text-6xl mb-4">🔐</div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Scanner</p>
          <h2 className="text-2xl md:text-3xl font-bold font-[family-name:var(--font-orbitron)] text-white mb-3">Connect your wallet</h2>
          <p className="text-sm text-gray-400">Connect your wallet to scan and reclaim SOL from empty accounts, dust, Pump PDA, PumpSwap PDA, Drift, NFT burn & cNFT close.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-slide-up space-y-8 md:space-y-10">
      <div className="card-cyber border-neon-cyan/30 bg-neon-cyan/5 p-3 md:p-4">
        <p className="text-sm text-gray-300">
          <span className="text-neon-cyan font-medium">ℹ️</span> If you close many accounts at once, the reclaim may be split into <strong>several transactions</strong>. Sign each confirmation in your wallet until the process completes.
        </p>
      </div>
      {needsMoreSOL && accounts.length > 0 && (
        <div className="card-cyber border-orange-500/50 bg-orange-500/10 p-4 md:p-5">
          <div className="flex items-center gap-3">
            <div className="text-3xl md:text-4xl shrink-0">⚠️</div>
            <div className="min-w-0 flex-1">
              <p className="text-base md:text-lg font-bold text-orange-400 mb-1">Insufficient SOL</p>
              <p className="text-sm text-gray-300 mb-2">
                Your wallet has <strong>{walletBalance.toFixed(6)} SOL</strong>. You need at least <strong>{MIN_SOL_NETWORK} SOL</strong> to pay Solana network fees.
              </p>
              <div className="bg-dark-bg p-3 rounded-lg border border-orange-500/30 mt-3">
                <p className="text-xs text-gray-400 mb-1">💡 <strong>Why?</strong></p>
                <p className="text-xs text-gray-300">
                  Solana requires transaction fees (~0.001 SOL). <strong className="text-neon-green">Service fee ({effectiveFeePercent}%) and referral ({effectiveReferralPercent}%) are deducted from claimed SOL</strong> — you don&apos;t pay those!
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reclaim potential (estimation sans clic) */}
      {publicKey && (
        <div className="card-cyber border-neon-cyan/30 bg-neon-cyan/5 p-4 md:p-5">
          {estimateLoading ? (
            <p className="text-sm text-gray-400">Checking reclaim potential...</p>
          ) : estimate && (estimate.emptyCount + estimate.dustCount + (estimate.nftBurnCount ?? 0) + (estimate.pumpPdaCount ?? 0) + (estimate.pumpSwapPdaCount ?? 0) + (estimate.driftCount ?? 0) + (estimate.cnftCount ?? 0)) > 0 ? (
            <p className="text-sm">
              <span className="text-neon-cyan font-semibold">~{(estimate.estimatedSol * (100 - effectiveFeePercent - (referrerWallet ? effectiveReferralPercent : 0)) / 100).toFixed(4)} SOL</span>
              <span className="text-gray-400"> to receive after {referrerWallet ? `${effectiveFeePercent}% fee + ${effectiveReferralPercent}% referral` : `${effectiveFeePercent}% fee`} ({estimate.emptyCount} empty + {estimate.dustCount} dust + {estimate.nftBurnCount ?? 0} NFT{(estimate.pumpPdaCount ?? 0) ? ` + ${estimate.pumpPdaCount} Pump` : ''}{(estimate.pumpSwapPdaCount ?? 0) ? ` + ${estimate.pumpSwapPdaCount} PumpSwap` : ''}{(estimate.driftCount ?? 0) ? ` + ${estimate.driftCount} Drift` : ''}{(estimate.cnftCount ?? 0) ? ` + ${estimate.cnftCount} cNFT` : ''}, ~{estimate.estimatedSol.toFixed(4)} SOL gross{(estimate.cnftCount ?? 0) > 0 ? ' + cNFT wallet cleanup' : ''}). Run a scan to confirm and close.</span>
            </p>
          ) : estimate && estimate.emptyCount === 0 && estimate.dustCount === 0 && (estimate.nftBurnCount ?? 0) === 0 && (estimate.pumpPdaCount ?? 0) === 0 && (estimate.pumpSwapPdaCount ?? 0) === 0 && (estimate.driftCount ?? 0) === 0 && (estimate.cnftCount ?? 0) === 0 ? (
            <p className="text-sm text-gray-400">Your wallet looks clean – no empty, dust, NFT, Pump PDA, PumpSwap, Drift or cNFT accounts detected. Run a scan to double-check.</p>
          ) : null}
        </div>
      )}

      {/* SolPit Creator NFT detected: name, tier, benefits (points, fee reduction, referral, F1 time) */}
      {creatorNfts && creatorNfts.length > 0 && (() => {
        const best = creatorNfts.reduce((a, b) => (TIER_ORDER.indexOf(b.tier) < TIER_ORDER.indexOf(a.tier) ? b : a));
        const names = creatorNfts.map((n) => `${n.name} (${n.tier})`).join(', ');
        const pointsBonus = CREATOR_POINTS_BONUS[best.tier] + (creatorNfts.length >= 2 ? CREATOR_COLLECTOR_POINTS : 0);
        const feePct = effectiveFeePercent;
        const benefitsParts = [
          `+${pointsBonus} pts per reclaim`,
          feePct < 20 ? `${feePct}% reclaim fee (reduced)` : null,
          referrerWallet && effectiveReferralPercent > 10 ? `referrer gets ${effectiveReferralPercent}%` : null,
        ].filter(Boolean);
        return (
          <div className="card-cyber border-amber-500/40 bg-amber-500/10 p-4 md:p-5">
            <p className="text-xs font-semibold text-amber-400 uppercase tracking-wider mb-1">
              SolPit Creator NFT detected
            </p>
            <p className="text-sm text-gray-200 mb-1">
              <span className="font-semibold text-white">{names}</span>
            </p>
            <p className="text-sm text-amber-200/90">
              Your benefits: {benefitsParts.join(' · ')}
            </p>
          </div>
        );
      })()}

      {referrerWallet && (
        <div className="card-cyber border-neon-green/50 bg-neon-green/5 p-4 md:p-5">
          <div className="flex items-center gap-3">
            <div className="text-2xl md:text-3xl animate-pulse shrink-0">🎁</div>
            <div className="min-w-0 flex-1">
              <p className="text-base font-bold text-neon-green">Referral active</p>
              <p className="text-sm text-gray-300">Your referrer will receive {effectiveReferralPercent}% of reclaimed SOL → {referrerDisplay}</p>
              <p className="text-xs text-gray-400 mt-1">Referrer wallet must exist on-chain (have received SOL at least once), otherwise referral is disabled to avoid transaction failure.</p>
            </div>
          </div>
        </div>
      )}

      {/* 4 cards: Empty, Dust, Pump PDA, PumpSwap PDA — 2x2 responsive */}
      <div className="grid grid-cols-2 gap-3 md:gap-4">
        {/* Empty */}
        <div className="card-cyber border-dark-border flex flex-col p-4 md:p-5 min-h-[180px] text-center items-center">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Empty accounts</p>
          <h3 className="text-base md:text-lg font-bold font-[family-name:var(--font-orbitron)] text-neon-purple mb-2">Reclaim empty</h3>
          <p className="text-xs text-gray-400 mb-4 flex-1">SPL / Token-2022. Close to recover ~0.002 SOL each.</p>
          <div className="w-full flex flex-col items-center">
            <button
              onClick={handleScan}
              disabled={isScanning}
              className="w-full px-5 py-2.5 rounded-xl font-semibold border border-neon-purple/40 bg-neon-purple/10 text-neon-purple hover:bg-neon-purple/20 disabled:opacity-50 text-sm"
            >
              {isScanning ? 'Scanning...' : 'Scan empty'}
            </button>
          </div>
        </div>
        {/* Dust */}
        <div className="card-cyber border-dark-border flex flex-col p-4 md:p-5 min-h-[180px] text-center items-center">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Dust</p>
          <h3 className="text-base md:text-lg font-bold font-[family-name:var(--font-orbitron)] text-orange-400 mb-2">Burn + close</h3>
          <p className="text-xs text-gray-400 mb-4 flex-1">Small balances (≤ 0.01 tokens). Reclaim rent.</p>
          <div className="w-full flex flex-col items-center">
            <button
              onClick={handleScanDust}
              disabled={isScanningDust}
              className="w-full px-5 py-2.5 rounded-xl font-semibold border border-orange-500/40 bg-orange-500/10 text-orange-300 hover:bg-orange-500/20 disabled:opacity-50 text-sm"
            >
              {isScanningDust ? 'Scanning...' : 'Scan for dust'}
            </button>
          </div>
        </div>
        {/* Pump PDA — same height as PumpSwap via grid + h-full */}
        <div className="flex flex-col min-h-[180px] h-full [&>.card-cyber]:h-full [&>.card-cyber]:min-h-0 [&>.card-cyber]:flex [&>.card-cyber]:flex-col">
          <PumpReclaimSection
            wallet={publicKey}
            onSuccess={(result) => {
              setLastReclaimedSol(result.solReclaimed);
              setAvailableReclaimedSol(result.solReclaimed);
              showReclaimPointsPopup(result.solReclaimed, 'pump', creatorBonusPerReclaim);
              refreshEstimate();
              onReclaimSuccess?.();
              connection.getBalance(publicKey!).then((b) => setWalletBalance(b / LAMPORTS_PER_SOL));
            }}
          />
        </div>
        {/* PumpSwap PDA — same height as Pump PDA */}
        <div className="flex flex-col min-h-[180px] h-full [&>.card-cyber]:h-full [&>.card-cyber]:min-h-0 [&>.card-cyber]:flex [&>.card-cyber]:flex-col">
          <PumpSwapReclaimSection
            wallet={publicKey}
            onSuccess={(result) => {
              setLastReclaimedSol(result.solReclaimed);
              setAvailableReclaimedSol(result.solReclaimed);
              showReclaimPointsPopup(result.solReclaimed, 'pumpswap', creatorBonusPerReclaim);
              refreshEstimate();
              onReclaimSuccess?.();
              connection.getBalance(publicKey!).then((b) => setWalletBalance(b / LAMPORTS_PER_SOL));
            }}
          />
        </div>
      </div>

      {/* Drift + Burn NFT + cNFT close — side by side (same height) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
        <div className="min-h-[180px] [&>.card-cyber]:h-full [&>.card-cyber]:min-h-0 [&>.card-cyber]:flex [&>.card-cyber]:flex-col">
          <DriftReclaimSection
            wallet={publicKey}
            onSuccess={(result) => {
              setLastReclaimedSol(result.solReclaimed);
              setAvailableReclaimedSol(result.solReclaimed);
              showReclaimPointsPopup(result.solReclaimed, 'drift', creatorBonusPerReclaim);
              refreshEstimate();
              onReclaimSuccess?.();
              connection.getBalance(publicKey!).then((b) => setWalletBalance(b / LAMPORTS_PER_SOL));
            }}
          />
        </div>
        <div className="min-h-[180px] [&>.card-cyber]:h-full [&>.card-cyber]:min-h-0 [&>.card-cyber]:flex [&>.card-cyber]:flex-col">
          <NftBurnReclaimSection
            wallet={publicKey}
            walletBalanceSol={walletBalance}
            onSuccess={(result) => {
              setLastReclaimedSol(result.solReclaimed);
              setAvailableReclaimedSol(result.solReclaimed);
              showReclaimPointsPopup(result.solReclaimed, 'nft_burn', creatorBonusPerReclaim);
              refreshEstimate();
              onReclaimSuccess?.();
              connection.getBalance(publicKey!).then((b) => setWalletBalance(b / LAMPORTS_PER_SOL));
            }}
          />
        </div>
        <div className="min-h-[180px] [&>.card-cyber]:h-full [&>.card-cyber]:min-h-0 [&>.card-cyber]:flex [&>.card-cyber]:flex-col">
          <CnftReclaimSection wallet={publicKey} walletBalanceSol={walletBalance} onSuccess={() => { onReclaimSuccess?.(); connection.getBalance(publicKey!).then((b) => setWalletBalance(b / LAMPORTS_PER_SOL)); }} />
        </div>
      </div>

      {/* Empty: list + Claim Summary — directly under the cards */}
      {!isFullReclaimMode && accounts.length > 0 && !hideEmptySection && (
        <>
          <div className="card-cyber border-dark-border p-4 md:p-5">
            <div
              className="flex justify-between items-center gap-2 cursor-pointer select-none"
              onClick={() => setCollapseCloseable((c) => !c)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && setCollapseCloseable((c) => !c)}
              aria-expanded={!collapseCloseable}
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-neon-purple transition-transform duration-200 shrink-0" style={{ transform: collapseCloseable ? 'rotate(-90deg)' : 'rotate(0deg)' }}>
                  ▼
                </span>
                <h3 className="text-base md:text-lg font-bold font-[family-name:var(--font-orbitron)]">Closeable accounts ({accounts.length})</h3>
                <span className="text-sm text-gray-500">· Selected: {selectedAccounts.length} / {accounts.length}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button onClick={(e) => { e.stopPropagation(); handleSelectAll(); }} className="text-sm text-neon-purple hover:text-neon-pink transition-colors">
                  {selectedAccounts.length === accounts.length ? 'Deselect All' : 'Select All'}
                </button>
                <button onClick={(e) => { e.stopPropagation(); setHideEmptySection(true); }} className="text-sm text-gray-400 hover:text-white transition-colors" title="Close this section">
                  × Close
                </button>
              </div>
            </div>
            {!collapseCloseable && (
            <div className="space-y-3 max-h-[400px] overflow-y-auto mt-4">
              {accounts.map((account) => {
                const mintStr = account.mint.toString();
                const rugcheck = rugcheckSummaries[mintStr];
                return (
                  <div
                    key={account.pubkey.toString()}
                    onClick={() => toggleAccount(account.pubkey.toString())}
                    className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                      selectedAccounts.includes(account.pubkey.toString()) ? 'border-neon-purple bg-neon-purple/10' : 'border-dark-border bg-dark-bg hover:border-neon-purple/50'
                    }`}
                  >
                    <div className="flex justify-between items-center gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="font-mono text-sm text-gray-400 truncate">{account.pubkey.toString().slice(0, 8)}...{account.pubkey.toString().slice(-8)}</p>
                        <p className="text-xs text-gray-500 truncate">Mint: {mintStr.slice(0, 12)}...</p>
                        {rugcheckLoading ? <span className="inline-block mt-1.5 text-xs text-gray-500">Checking…</span> : rugcheck ? (
                          <span className="inline-flex items-center gap-1.5 mt-1.5 flex-wrap">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                              rugcheck.label === 'Verified' ? 'bg-neon-green/20 text-neon-green border border-neon-green/40' :
                              rugcheck.label === 'Caution' ? 'bg-orange-500/20 text-orange-400 border border-orange-500/40' :
                              rugcheck.label === 'Danger' ? 'bg-red-500/20 text-red-400 border border-red-500/40' : 'bg-gray-500/20 text-gray-400 border border-gray-500/40'
                            }`}>{rugcheck.label}</span>
                            <a href={rugcheck.url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="text-xs text-neon-cyan hover:underline">View on Rugcheck →</a>
                          </span>
                        ) : null}
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-lg font-bold text-neon-green font-mono">+{(account.rentExemptReserve / 1e9).toFixed(6)} SOL</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            )}
          </div>
          <div className="card-cyber border-neon-purple/30 p-4 md:p-5">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider text-center mb-2">Summary</p>
            <h3 className="text-lg font-bold mb-4 text-center font-[family-name:var(--font-orbitron)] text-white">
              Claim (empty accounts)
            </h3>
            <div className="space-y-3">
              <div className="flex justify-between p-3 rounded-lg bg-dark-bg">
                <span className="text-gray-400">Selected Accounts</span>
                <span className="font-bold text-white font-mono">{selectedAccounts.length}</span>
              </div>
              <div className="flex justify-between p-3 rounded-lg bg-dark-bg">
                <span className="text-gray-400">Total Reclaimable</span>
                <span className="font-bold text-neon-green font-mono">{(selectedTotal / 1e9).toFixed(6)} SOL</span>
              </div>
              <div className="flex justify-between p-3 rounded-lg bg-dark-bg">
                <span className="text-gray-400">Service Fee ({effectiveFeePercent}%)</span>
                <span className="font-bold text-orange-500 font-mono">-{(feeAmount / 1e9).toFixed(6)} SOL</span>
              </div>
              {referrerWallet && referralAmount > 0 && (
                <div className="flex justify-between p-3 rounded-lg bg-neon-green/10 border border-neon-green/30">
                  <span className="text-neon-green font-semibold">🎁 Referrer Bonus ({effectiveReferralPercent}%)</span>
                  <span className="font-bold text-neon-green font-mono">-{(referralAmount / 1e9).toFixed(6)} SOL</span>
                </div>
              )}
              <div className="flex justify-between p-4 rounded-lg bg-gradient-to-r from-neon-purple/20 to-neon-pink/20 border-2 border-neon-purple/50">
                <span className="text-lg font-bold text-white">You Receive</span>
                <span className="text-2xl font-bold text-white font-mono">{(netAmount / 1e9).toFixed(6)} SOL</span>
              </div>
            </div>
            <p className="text-xs text-gray-500 text-center mt-4">Service fees are deducted from claimed SOL. You only pay network fees (~0.001 SOL).</p>
            <button onClick={handleClose} disabled={isClosing || selectedAccounts.length === 0 || needsMoreSOL} className="w-full mt-4 px-6 py-3 rounded-xl font-semibold bg-neon-purple text-white hover:bg-neon-purple/90 disabled:opacity-50 disabled:cursor-not-allowed">
              {isClosing ? '⏳ Closing...' : needsMoreSOL ? `⚠️ Need ${MIN_SOL_NETWORK} SOL` : `🔓 Close ${selectedAccounts.length} Account${selectedAccounts.length !== 1 ? 's' : ''}`}
            </button>
          </div>
        </>
      )}
      {!isFullReclaimMode && accounts.length > 0 && hideEmptySection && (
        <div className="flex items-center justify-between gap-2 p-3 rounded-lg border border-dark-border bg-dark-bg/50">
          <span className="text-sm text-gray-400">Empty: {accounts.length} closeable account{accounts.length !== 1 ? 's' : ''} hidden</span>
          <button onClick={() => setHideEmptySection(false)} className="text-sm text-neon-purple hover:text-neon-pink transition-colors">Show</button>
        </div>
      )}
      {success && lastSuccessType === 'empty' && (
        <div className="card-cyber border-neon-green/50 bg-neon-green/10">
          <p className="text-neon-green">{success}</p>
        </div>
      )}

      {/* Dust: list + Claim Summary — directly under the cards */}
      {!isFullReclaimMode && dustAccounts.length > 0 && !hideDustSection && (
        <>
          <div className="card-cyber border-orange-500/30 p-4 md:p-5">
            <div
              className="flex justify-between items-center gap-2 cursor-pointer select-none"
              onClick={() => setCollapseDust((c) => !c)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && setCollapseDust((c) => !c)}
              aria-expanded={!collapseDust}
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-orange-400 transition-transform duration-200 shrink-0" style={{ transform: collapseDust ? 'rotate(-90deg)' : 'rotate(0deg)' }}>
                  ▼
                </span>
                <h3 className="text-base md:text-lg font-bold font-[family-name:var(--font-orbitron)] text-orange-400/90">Dust accounts ({dustAccounts.length})</h3>
                <span className="text-sm text-gray-500">· Selected: {selectedDust.length} / {dustAccounts.length}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button onClick={(e) => { e.stopPropagation(); handleSelectAllDust(); }} className="text-sm text-orange-400 hover:text-orange-300 transition-colors">
                  {selectedDust.length === dustAccounts.length ? 'Deselect all' : 'Select all'}
                </button>
                <button onClick={(e) => { e.stopPropagation(); setHideDustSection(true); }} className="text-sm text-gray-400 hover:text-white transition-colors" title="Close this section">
                  × Close
                </button>
              </div>
            </div>
            {!collapseDust && (
            <>
              <div className="mt-4 p-3 rounded-lg bg-amber-500/10 border border-amber-500/40 text-sm text-amber-200/95">
                <strong className="text-amber-300">⚠️ Warning</strong>: closing dust accounts recovers SOL (rent) per account. Token amounts shown are ≤ 0.01 and usually have no real value (e.g. memecoins); the SOL you recover is the rent. <strong>0.01 SOL is non-negligible</strong> — only close accounts you&apos;re sure you want to burn.
              </div>
              <div className="mt-4 flex flex-col md:flex-row gap-4">
                <div className="md:w-[280px] md:shrink-0 p-3 rounded-lg bg-dark-bg/80 border border-orange-500/20 text-sm text-gray-300">
                  <p className="font-semibold text-orange-400/90 mb-1">What you&apos;re closing</p>
                  <p className="text-xs leading-relaxed">Dust = token accounts with balance ≤ 0.01 tokens. Each row shows the <strong>token mint</strong> (look up the name on Solscan if needed). Closing <strong>burns the tokens</strong> and recovers the rent (SOL) shown per account. Tiny amounts of memecoins have no value; the SOL recovered is real — only close what you want to burn.</p>
                </div>
                <div className="space-y-3 flex-1 min-w-0 max-h-[300px] overflow-y-auto">
              {dustAccounts.map((acc) => {
                const mintStr = acc.mint.toString();
                return (
                <div
                  key={acc.pubkey.toString()}
                  onClick={() => toggleDust(acc.pubkey.toString())}
                  className={`p-3 rounded-lg border-2 cursor-pointer transition-all ${
                    selectedDust.includes(acc.pubkey.toString()) ? 'border-orange-500 bg-orange-500/10' : 'border-dark-border bg-dark-bg hover:border-orange-500/50'
                  }`}
                >
                  <div className="flex justify-between items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="font-mono text-xs text-gray-400 break-all" title="Token mint — copy to look up on Solscan">{mintStr}</p>
                      <p className="font-mono text-xs text-gray-500 truncate mt-0.5">Account: {acc.pubkey.toString().slice(0, 6)}…{acc.pubkey.toString().slice(-6)}</p>
                      <p className="text-xs text-gray-500 mt-0.5">Balance: {acc.balanceUi.toFixed(6)} · +{(acc.rentExemptReserve / 1e9).toFixed(6)} SOL rent</p>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); navigator.clipboard?.writeText(mintStr); }}
                      className="shrink-0 px-2 py-1 text-xs font-medium rounded bg-orange-500/20 text-orange-400 hover:bg-orange-500/30 border border-orange-500/40"
                      title="Copy full mint address"
                    >
                      Copy mint
                    </button>
                  </div>
                </div>
                );
              })}
                </div>
              </div>
            </>
            )}
          </div>
          <div className="card-cyber border-orange-500/30 p-4 md:p-5">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider text-center mb-2">Summary</p>
            <h3 className="text-lg font-bold mb-4 text-center font-[family-name:var(--font-orbitron)] text-orange-400/90">
              Claim (dust)
            </h3>
            {(() => {
              const dustTotalLamports = dustAccounts.filter((a) => selectedDust.includes(a.pubkey.toString())).reduce((s, a) => s + a.rentExemptReserve, 0);
              const dustGrossSol = dustTotalLamports / 1e9;
              const dustFeeAmount = dustTotalLamports * (effectiveFeePercent / 100);
              const dustReferralAmount = referrerWallet ? dustTotalLamports * (effectiveReferralPercent / 100) : 0;
              const dustNetSol = (dustTotalLamports - dustFeeAmount - dustReferralAmount) / 1e9;
              return (
                <>
                  <div className="space-y-3">
                    <div className="flex justify-between p-3 rounded-lg bg-dark-bg">
                      <span className="text-gray-400">Selected Accounts</span>
                      <span className="font-bold text-white font-mono">{selectedDust.length}</span>
                    </div>
                    <div className="flex justify-between p-3 rounded-lg bg-dark-bg">
                      <span className="text-gray-400">Total Reclaimable</span>
                      <span className="font-bold text-neon-green font-mono">{dustGrossSol.toFixed(6)} SOL</span>
                    </div>
                    <div className="flex justify-between p-3 rounded-lg bg-dark-bg">
                      <span className="text-gray-400">Service Fee ({effectiveFeePercent}%)</span>
                      <span className="font-bold text-orange-500 font-mono">-{(dustFeeAmount / 1e9).toFixed(6)} SOL</span>
                    </div>
                    {referrerWallet && dustReferralAmount > 0 && (
                      <div className="flex justify-between p-3 rounded-lg bg-neon-green/10 border border-neon-green/30">
                        <span className="text-neon-green font-semibold">🎁 Referrer Bonus ({effectiveReferralPercent}%)</span>
                        <span className="font-bold text-neon-green font-mono">-{(dustReferralAmount / 1e9).toFixed(6)} SOL</span>
                      </div>
                    )}
                    <div className="flex justify-between p-4 rounded-lg bg-gradient-to-r from-orange-500/20 to-amber-500/20 border-2 border-orange-500/50">
                      <span className="text-lg font-bold text-white">You Receive</span>
                      <span className="text-2xl font-bold text-white font-mono">{dustNetSol.toFixed(6)} SOL</span>
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 text-center mt-4">💡 Service fees deducted from claimed SOL. You only pay network fees (~0.001 SOL).</p>
                  <button
                    onClick={handleBurnAndCloseDust}
                    disabled={isClosingDust || selectedDust.length === 0 || needsMoreSOL}
                    className="w-full mt-4 px-6 py-3 rounded-xl font-semibold border border-orange-500/40 text-orange-400 hover:bg-orange-500/10 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isClosingDust ? '⏳ Burning & closing...' : needsMoreSOL ? `⚠️ Need ${MIN_SOL_NETWORK} SOL` : `🔥 Burn & close ${selectedDust.length} account(s)`}
                  </button>
                </>
              );
            })()}
          </div>
        </>
      )}
      {!isFullReclaimMode && dustAccounts.length > 0 && hideDustSection && (
        <div className="flex items-center justify-between gap-2 p-3 rounded-lg border border-dark-border bg-dark-bg/50">
          <span className="text-sm text-gray-400">Dust: {dustAccounts.length} account{dustAccounts.length !== 1 ? 's' : ''} hidden</span>
          <button onClick={() => setHideDustSection(false)} className="text-sm text-orange-400 hover:text-orange-300 transition-colors">Show</button>
        </div>
      )}
      {success && lastSuccessType === 'dust' && (
        <div className="card-cyber border-neon-green/50 bg-neon-green/10">
          <p className="text-neon-green">{success}</p>
        </div>
      )}

      {/* Messages "no empty" / "no dust" — between results (empty/dust) and Full Reclaim */}
      {errorSource === 'empty' && error && (
        <div className="card-cyber border-neon-purple/30 bg-neon-purple/5 p-4 md:p-5">
          <p className="text-sm text-neon-purple">{error}</p>
        </div>
      )}
      {errorSource === 'dust' && error && (
        <div className="card-cyber border-orange-500/30 bg-orange-500/5 p-4 md:p-5">
          <p className="text-sm text-orange-400">{error}</p>
        </div>
      )}

      {/* Full Reclaim — block under the cards / empty / dust */}
      <div className="card-cyber border-neon-cyan/30 bg-neon-cyan/5 p-4 md:p-5 text-center">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Full reclaim</p>
        <h3 className="text-lg font-bold font-[family-name:var(--font-orbitron)] text-neon-cyan mb-2">Empty + dust + Pump in one go</h3>
        <p className="text-sm text-gray-400 mb-4">Scan all types and reclaim in one go (empty + dust + NFT + Pump + PumpSwap + cNFT).</p>
        <div className="flex justify-center">
          <button
            onClick={handleScanAll}
            disabled={isScanning || isScanningDust}
            className="px-5 py-2.5 rounded-xl font-semibold border border-neon-cyan/40 bg-neon-cyan/10 text-neon-cyan hover:bg-neon-cyan/20 disabled:opacity-50 text-sm"
          >
            {isScanning || isScanningDust ? 'Scanning all...' : 'Full Reclaim (empty + dust + NFT + Pump + PumpSwap + cNFT)'}
          </button>
        </div>
      </div>

      {/* Message "no accounts" Full Reclaim — sous le bloc Full Reclaim */}
      {errorSource === 'full_reclaim' && error && (
        <div className="card-cyber border-neon-cyan/40 bg-neon-cyan/5 p-4 md:p-5">
          <p className="text-sm text-neon-cyan">{error}</p>
        </div>
      )}

      {/* Full Reclaim Summary — affiché en dessous du bloc Full Reclaim */}
      {isFullReclaimMode && (accounts.length > 0 || dustAccounts.length > 0 || fullReclaimNftAccounts.length > 0 || pumpPdas.length > 0 || pumpSwapPdas.length > 0 || fullReclaimCnftAssets.length > 0) && (
        <div className="card-cyber border-neon-cyan/40 bg-neon-cyan/5 p-4 md:p-5">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Summary</p>
          <h3 className="text-lg font-bold mb-4 font-[family-name:var(--font-orbitron)] text-neon-cyan">
            Full Reclaim
          </h3>
          {(() => {
            const emptySelected = accounts.filter((a) => selectedAccounts.includes(a.pubkey.toString()));
            const dustSelected = dustAccounts.filter((a) => selectedDust.includes(a.pubkey.toString()));
            const nftSelected = fullReclaimNftAccounts.filter((a) => selectedFullReclaimNftPubkeys.includes(a.pubkey.toString()));
            const pumpSelected = pumpPdas.filter((p) => selectedPumpPdaPubkeys.includes(p.pubkey.toString()));
            const pumpSwapSelected = pumpSwapPdas.filter((p) => selectedPumpSwapPdaPubkeys.includes(p.pubkey.toString()));
            const cnftSelected = fullReclaimCnftAssets.filter((a) => selectedFullReclaimCnftIds.includes(a.id));
            const emptyLamports = emptySelected.reduce((s, a) => s + a.rentExemptReserve, 0);
            const dustLamports = dustSelected.reduce((s, a) => s + a.rentExemptReserve, 0);
            const nftLamports = nftSelected.reduce((s, a) => s + a.rentExemptReserve, 0);
            const pumpLamports = pumpSelected.reduce((s, p) => s + p.lamports, 0);
            const pumpSwapLamports = pumpSwapSelected.reduce((s, p) => s + p.lamports, 0);
            const totalLamports = emptyLamports + dustLamports + nftLamports + pumpLamports + pumpSwapLamports;
            const feeLamports = (totalLamports * effectiveFeePercent) / 100;
            const referralLamports = referrerWallet ? (totalLamports * effectiveReferralPercent) / 100 : 0;
            const netLamports = totalLamports - feeLamports - referralLamports;
            const totalAccountsCount = emptySelected.length + dustSelected.length + nftSelected.length + pumpSelected.length + pumpSwapSelected.length;
            const totalWithCnft = totalAccountsCount + cnftSelected.length;
            const hasSelection = totalWithCnft > 0;
            const hasCustomizable = dustAccounts.length > 0 || fullReclaimNftAccounts.length > 0 || pumpPdas.length > 0 || pumpSwapPdas.length > 0 || fullReclaimCnftAssets.length > 0;
            return (
              <>
                {dustAccounts.length > 0 && (
                  <div className="mb-4 p-3 rounded-lg bg-amber-500/10 border border-amber-500/40 text-sm text-amber-200/95">
                    <strong className="text-amber-300">⚠️ Warning — Dust included</strong>: closing dust burns the tokens (≤ 0.01 per account) and recovers rent (SOL). Those token amounts have no real value; the SOL recovered is real. <strong>0.01 SOL is non-negligible</strong> — only include dust you want to burn.
                  </div>
                )}
                <div className="space-y-2 mb-4">
                  {accounts.length > 0 && (
                    <p className="text-sm text-gray-300">
                      Empty: <strong className="text-white">{emptySelected.length}</strong> selected → <span className="font-mono text-neon-green">+{(emptyLamports / 1e9).toFixed(6)} SOL</span>
                    </p>
                  )}
                  {dustAccounts.length > 0 && (
                    <p className="text-sm text-gray-300">
                      Dust: <strong className="text-white">{dustSelected.length}</strong> selected → <span className="font-mono text-orange-400">+{(dustLamports / 1e9).toFixed(6)} SOL</span>
                      <span className="block text-xs text-gray-500 mt-0.5">(≤ 0.01 tokens per account; closing burns tokens and recovers rent)</span>
                    </p>
                  )}
                  {fullReclaimNftAccounts.length > 0 && (
                    <p className="text-sm text-gray-300">
                      NFT: <strong className="text-white">{nftSelected.length}</strong> of {fullReclaimNftAccounts.length} included → <span className="font-mono text-rose-400">+{(nftLamports / 1e9).toFixed(6)} SOL</span>
                    </p>
                  )}
                  {pumpPdas.length > 0 && (
                    <p className="text-sm text-gray-300">
                      Pump PDA: <strong className="text-white">{pumpSelected.length}</strong> of {pumpPdas.length} included → <span className="font-mono text-amber-400">+{(pumpLamports / 1e9).toFixed(6)} SOL</span>
                    </p>
                  )}
                  {pumpSwapPdas.length > 0 && (
                    <p className="text-sm text-gray-300">
                      PumpSwap PDA: <strong className="text-white">{pumpSwapSelected.length}</strong> of {pumpSwapPdas.length} included → <span className="font-mono text-cyan-400">+{(pumpSwapLamports / 1e9).toFixed(6)} SOL</span>
                    </p>
                  )}
                  {fullReclaimCnftAssets.length > 0 && (
                    <p className="text-sm text-gray-300">
                      cNFT: <strong className="text-white">{cnftSelected.length}</strong> of {fullReclaimCnftAssets.length} included → <span className="text-amber-400">wallet cleanup (0 SOL)</span>
                    </p>
                  )}
                  {hasCustomizable && (
                    <div className="mt-3">
                      <button
                        type="button"
                        onClick={() => setExpandFullReclaimSelection((v) => !v)}
                        className="text-sm text-neon-cyan hover:underline flex items-center gap-1"
                      >
                        {expandFullReclaimSelection ? '▼' : '▶'} Customize selection (uncheck to keep)
                      </button>
                      {expandFullReclaimSelection && (
                        <div className="mt-2 p-3 rounded-lg bg-dark-bg/80 space-y-3 text-sm">
                          {dustAccounts.length > 0 && (
                            <div>
                              <p className="font-semibold text-gray-300 mb-1">Dust accounts (uncheck to keep)</p>
                              <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
                                {dustAccounts.map((acc) => {
                                  const checked = selectedDust.includes(acc.pubkey.toString());
                                  const mintStr = acc.mint.toString();
                                  return (
                                    <label key={acc.pubkey.toString()} className="flex items-center gap-2 cursor-pointer rounded px-2 py-1 bg-dark-bg hover:bg-dark-border/30">
                                      <input
                                        type="checkbox"
                                        checked={checked}
                                        onChange={() => {
                                          setSelectedDust((prev) =>
                                            checked ? prev.filter((k) => k !== acc.pubkey.toString()) : [...prev, acc.pubkey.toString()]
                                          );
                                        }}
                                        className="rounded border-gray-500 text-orange-400 focus:ring-orange-400"
                                      />
                                      <span className="font-mono text-xs truncate max-w-[140px]" title={mintStr}>{mintStr.slice(0, 6)}…{mintStr.slice(-4)}</span>
                                      <span className="text-gray-500 text-xs">({acc.balanceUi.toFixed(4)})</span>
                                    </label>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                          {fullReclaimNftAccounts.length > 0 && (
                            <div>
                              <p className="font-semibold text-gray-300 mb-1">NFTs to burn (uncheck to keep)</p>
                              <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
                                {fullReclaimNftAccounts.map((nft) => {
                                  const checked = selectedFullReclaimNftPubkeys.includes(nft.pubkey.toString());
                                  return (
                                    <label key={nft.pubkey.toString()} className="flex items-center gap-2 cursor-pointer rounded px-2 py-1 bg-dark-bg hover:bg-dark-border/30">
                                      <input
                                        type="checkbox"
                                        checked={checked}
                                        onChange={() => {
                                          setSelectedFullReclaimNftPubkeys((prev) =>
                                            checked ? prev.filter((k) => k !== nft.pubkey.toString()) : [...prev, nft.pubkey.toString()]
                                          );
                                        }}
                                        className="rounded border-gray-500 text-rose-400 focus:ring-rose-400"
                                      />
                                      <span className="font-mono text-xs truncate max-w-[120px]" title={nft.mint.toString()}>{nft.mint.toString().slice(0, 6)}…{nft.mint.toString().slice(-4)}</span>
                                    </label>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                          {pumpPdas.length > 0 && (
                            <div>
                              <p className="font-semibold text-gray-300 mb-1">Pump PDAs</p>
                              <div className="flex flex-wrap gap-2 max-h-24 overflow-y-auto">
                                {pumpPdas.map((p) => {
                                  const checked = selectedPumpPdaPubkeys.includes(p.pubkey.toString());
                                  return (
                                    <label key={p.pubkey.toString()} className="flex items-center gap-2 cursor-pointer rounded px-2 py-1 bg-dark-bg hover:bg-dark-border/30">
                                      <input
                                        type="checkbox"
                                        checked={checked}
                                        onChange={() => {
                                          setSelectedPumpPdaPubkeys((prev) =>
                                            checked ? prev.filter((k) => k !== p.pubkey.toString()) : [...prev, p.pubkey.toString()]
                                          );
                                        }}
                                        className="rounded border-gray-500 text-amber-400 focus:ring-amber-400"
                                      />
                                      <span className="font-mono text-xs truncate max-w-[100px]">{p.pubkey.toString().slice(0, 6)}…</span>
                                    </label>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                          {pumpSwapPdas.length > 0 && (
                            <div>
                              <p className="font-semibold text-gray-300 mb-1">PumpSwap PDAs</p>
                              <div className="flex flex-wrap gap-2 max-h-24 overflow-y-auto">
                                {pumpSwapPdas.map((p) => {
                                  const checked = selectedPumpSwapPdaPubkeys.includes(p.pubkey.toString());
                                  return (
                                    <label key={p.pubkey.toString()} className="flex items-center gap-2 cursor-pointer rounded px-2 py-1 bg-dark-bg hover:bg-dark-border/30">
                                      <input
                                        type="checkbox"
                                        checked={checked}
                                        onChange={() => {
                                          setSelectedPumpSwapPdaPubkeys((prev) =>
                                            checked ? prev.filter((k) => k !== p.pubkey.toString()) : [...prev, p.pubkey.toString()]
                                          );
                                        }}
                                        className="rounded border-gray-500 text-cyan-400 focus:ring-cyan-400"
                                      />
                                      <span className="font-mono text-xs truncate max-w-[100px]">{p.pubkey.toString().slice(0, 6)}…</span>
                                    </label>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                          {fullReclaimCnftAssets.length > 0 && (
                            <div>
                              <p className="font-semibold text-gray-300 mb-1">cNFTs to burn (uncheck to keep)</p>
                              <div className="flex flex-wrap gap-2 max-h-24 overflow-y-auto">
                                {fullReclaimCnftAssets.map((a) => {
                                  const checked = selectedFullReclaimCnftIds.includes(a.id);
                                  return (
                                    <label key={a.id} className="flex items-center gap-2 cursor-pointer rounded px-2 py-1 bg-dark-bg hover:bg-dark-border/30">
                                      <input
                                        type="checkbox"
                                        checked={checked}
                                        onChange={() => {
                                          setSelectedFullReclaimCnftIds((prev) =>
                                            checked ? prev.filter((id) => id !== a.id) : [...prev, a.id]
                                          );
                                        }}
                                        className="rounded border-gray-500 text-amber-400 focus:ring-amber-400"
                                      />
                                      <span className="font-mono text-xs truncate max-w-[100px]">{a.id.slice(0, 6)}…</span>
                                    </label>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                  <div className="flex justify-between p-3 rounded-lg bg-dark-bg">
                    <span className="text-gray-400">Total reclaimable</span>
                    <span className="font-bold text-neon-green font-mono">{(totalLamports / 1e9).toFixed(6)} SOL</span>
                  </div>
                  <div className="flex justify-between p-3 rounded-lg bg-dark-bg">
                    <span className="text-gray-400">Service fee ({effectiveFeePercent}%)</span>
                    <span className="font-mono text-orange-500">-{(feeLamports / 1e9).toFixed(6)} SOL</span>
                  </div>
                  {referrerWallet && referralLamports > 0 && (
                    <div className="flex justify-between p-3 rounded-lg bg-neon-green/10 border border-neon-green/30">
                      <span className="text-neon-green">Referrer ({effectiveReferralPercent}%)</span>
                      <span className="font-mono text-neon-green">-{(referralLamports / 1e9).toFixed(6)} SOL</span>
                    </div>
                  )}
                  <div className="flex justify-between p-4 rounded-lg bg-neon-cyan/10 border border-neon-cyan/30">
                    <span className="font-bold text-white">You receive</span>
                    <span className="text-xl font-bold text-white font-mono">{(netLamports / 1e9).toFixed(6)} SOL</span>
                  </div>
                </div>
                <button
                  onClick={handleFullReclaim}
                  disabled={!hasSelection || isFullReclaiming || needsMoreSOL}
                  className="w-full px-6 py-3 rounded-xl font-semibold border border-neon-cyan/50 text-neon-cyan hover:bg-neon-cyan/10 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isFullReclaiming ? '⏳ Reclaiming...' : needsMoreSOL ? `⚠️ Need ${MIN_SOL_NETWORK} SOL` : `✨ Reclaim all (${totalWithCnft} accounts)`}
                </button>
              </>
            );
          })()}
        </div>
      )}
      {success && lastSuccessType === 'full_reclaim' && (
        <div className="card-cyber border-neon-green/50 bg-neon-green/10">
          <p className="text-neon-green">{success}</p>
        </div>
      )}

      {/* Erreurs globales (wallet, tx failed, etc.) — en bas de page uniquement quand pas d'erreur "in-context" */}
      {error && errorSource === null && (
        <div className="card-cyber border-red-500/50 bg-red-500/10 p-4 md:p-5">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {warning && (
        <div className="card-cyber border-orange-500/50 bg-orange-500/10 p-4 md:p-5">
          <div className="flex items-center gap-3">
            <span className="text-2xl shrink-0">⚠️</span>
            <div className="min-w-0">
              <p className="text-base font-bold text-orange-400 mb-1">Referral not applied</p>
              <p className="text-sm text-orange-300 mb-1">{warning}</p>
              <p className="text-xs text-gray-400">Referrer must receive SOL first to get the bonus.</p>
            </div>
          </div>
        </div>
      )}

      {/* Health score + Swap + Stake post-reclaim: show when we have a success message (empty/dust/full) OR when lastReclaimedSol was set (Pump/PumpSwap/Drift/NFT sections call onSuccess). */}
      {(success || lastReclaimedSol > 0) && (healthAfterReclaim !== null || percentileAfterReclaim !== null || (publicKey && signTransaction && walletBalance > MIN_SOL_NETWORK)) && (
        <div className="card-cyber border-neon-purple/30 p-4 md:p-5">
          {(healthAfterReclaim !== null || percentileAfterReclaim !== null) && (
            <div className="flex flex-wrap justify-center items-center gap-3 text-xs md:text-sm mb-4 text-center">
              {healthAfterReclaim !== null && (
                <span className="text-gray-300">Wallet Health: <strong className="text-white">{healthAfterReclaim}</strong></span>
              )}
              {percentileAfterReclaim !== null && (
                <span className="text-gray-300">{formatPercentileLabel(percentileAfterReclaim)}</span>
              )}
            </div>
          )}
          {publicKey && signTransaction && walletBalance > MIN_SOL_NETWORK && (
            <PostReclaimSwap
              walletBalanceSol={walletBalance}
              reclaimedAmountSol={lastReclaimedSol > 0 ? availableReclaimedSol : undefined}
              publicKey={publicKey}
              signTransaction={signTransaction as ComponentProps<typeof PostReclaimSwap>['signTransaction']}
              onSwapDone={(amountSwappedSol) => {
                setAvailableReclaimedSol((prev) => Math.max(0, prev - amountSwappedSol));
                connection.getBalance(publicKey).then((b) => setWalletBalance(b / LAMPORTS_PER_SOL));
              }}
            />
          )}
          <div className="mt-4">
            <ReclaimToStake
              walletBalanceSol={walletBalance}
              reclaimedAmountSol={lastReclaimedSol > 0 ? availableReclaimedSol : undefined}
              publicKey={publicKey}
              signTransaction={signTransaction ?? undefined}
              onStakeDone={(amountStakedSol) => {
                if (amountStakedSol != null && amountStakedSol > 0) {
                  setAvailableReclaimedSol((prev) => Math.max(0, prev - amountStakedSol));
                }
                connection.getBalance(publicKey!).then((b) => setWalletBalance(b / LAMPORTS_PER_SOL));
              }}
            />
          </div>
        </div>
      )}

      {/* Reclaim-to-Stake visible when wallet connected and no reclaim yet (discovery). Hide when we already show the post-reclaim block (success or lastReclaimedSol > 0) to avoid duplicate Stake section. */}
      {publicKey && !success && lastReclaimedSol <= 0 && walletBalance > MIN_SOL_NETWORK && (
        <div className="mt-6">
          <ReclaimToStake
            walletBalanceSol={walletBalance}
            publicKey={publicKey}
            signTransaction={signTransaction ?? undefined}
            onStakeDone={() => connection.getBalance(publicKey!).then((b) => setWalletBalance(b / LAMPORTS_PER_SOL))}
          />
        </div>
      )}

      {reclaimPointsPopup && (
        <ReclaimPointsPopup
          points={reclaimPointsPopup.points}
          solReclaimed={reclaimPointsPopup.solReclaimed}
          onClose={() => setReclaimPointsPopup(null)}
          onGoToGame={() => {
            onNavigateToGame?.();
            setReclaimPointsPopup(null);
          }}
        />
      )}
    </div>
  );
}
