'use client';

import { useState } from 'react';
import { useConnection } from '@solana/wallet-adapter-react';
import { PublicKey, VersionedTransaction } from '@solana/web3.js';
import { getOutputTokens, isSwapEnabled, JUPITER_SWAP_V1_BASE, MINT_SOL } from '@/lib/jupiter/config';
import type { JupiterQuoteResponse } from '@/types/jupiter';

/** Official Jupiter Metis Swap API (dev.jup.ag). API key required – use NEXT_PUBLIC_JUPITER_API_KEY. */
const SLIPPAGE_BPS = 50;
const RESERVE_SOL_FOR_FEES = 0.005;

interface PostReclaimSwapProps {
  walletBalanceSol: number;
  /** Remaining reclaimed SOL available for this swap (shared with stake; decreases when user swaps or stakes from reclaimed). */
  reclaimedAmountSol?: number;
  publicKey: PublicKey;
  /** Wallet adapter: must support signing VersionedTransaction (Phantom, etc.) */
  signTransaction: (tx: VersionedTransaction) => Promise<VersionedTransaction>;
  /** Called after a successful swap. Pass the SOL amount swapped so parent can reduce available reclaimed. */
  onSwapDone?: (amountSwappedSol: number) => void;
}

export default function PostReclaimSwap({
  walletBalanceSol,
  reclaimedAmountSol,
  publicKey,
  signTransaction,
  onSwapDone,
}: PostReclaimSwapProps) {
  const { connection } = useConnection();
  const network = process.env.NEXT_PUBLIC_SOLANA_NETWORK ?? 'mainnet-beta';
  const outputTokens = getOutputTokens(network);

  const [selectedOutputIndex, setSelectedOutputIndex] = useState(0);
  const [amountPreset, setAmountPreset] = useState<0.25 | 0.5 | 1>(0.5);
  const [quote, setQuote] = useState<JupiterQuoteResponse | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [swapLoading, setSwapLoading] = useState(false);
  const [localError, setLocalError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');

  const jupiterApiKey = typeof window !== 'undefined' ? process.env.NEXT_PUBLIC_JUPITER_API_KEY : undefined;
  const hasApiKey = Boolean(jupiterApiKey?.trim());

  if (!isSwapEnabled(network) || outputTokens.length === 0) return null;

  // Montant swappable : si on a un "reclaimed" récent, 25%/50%/Max s'appliquent à ce montant uniquement ; sinon au solde (moins réserve).
  const maxSwapSol = reclaimedAmountSol != null && reclaimedAmountSol > 0
    ? Math.min(reclaimedAmountSol, walletBalanceSol)
    : reclaimedAmountSol === 0
      ? 0
      : Math.max(0, walletBalanceSol - RESERVE_SOL_FOR_FEES);
  const isReclaimedContext = reclaimedAmountSol !== undefined;
  const noReclaimedLeft = isReclaimedContext && reclaimedAmountSol <= 0;
  const amountSol = Math.min(amountPreset * maxSwapSol, maxSwapSol);
  const amountLamports = Math.floor(amountSol * 1e9);

  const selectedToken = outputTokens[selectedOutputIndex];
  const canSwap = amountLamports > 0 && selectedToken && hasApiKey && !noReclaimedLeft;

  const clearError = () => setLocalError('');

  /** Direct call to Jupiter API (official: https://api.jup.ag/swap/v1/quote) – no Next.js route. */
  const fetchQuote = async () => {
    if (!canSwap || !jupiterApiKey) return;
    setQuote(null);
    setLocalError('');
    setSuccess('');
    setQuoteLoading(true);
    try {
      const params = new URLSearchParams({
        inputMint: MINT_SOL,
        outputMint: selectedToken.mint,
        amount: String(amountLamports),
        slippageBps: String(SLIPPAGE_BPS),
        restrictIntermediateTokens: 'true',
      });
      const res = await fetch(`${JUPITER_SWAP_V1_BASE}/quote?${params}`, {
        headers: { 'x-api-key': jupiterApiKey },
      });
      const data = await res.json();
      if (res.status === 401) {
        throw new Error('Invalid Jupiter API key. Check NEXT_PUBLIC_JUPITER_API_KEY (portal.jup.ag)');
      }
      if (!res.ok) throw new Error(data.error || data.message || 'Quote failed');
      if (data.error) throw new Error(data.error);
      setQuote(data as JupiterQuoteResponse);
    } catch (e) {
      setLocalError(e instanceof Error ? e.message : 'Failed to get quote');
    } finally {
      setQuoteLoading(false);
    }
  };

  /** Direct call to Jupiter API (official: https://api.jup.ag/swap/v1/swap) – no Next.js route. */
  const executeSwap = async () => {
    if (!quote || !canSwap || !jupiterApiKey) return;
    setSwapLoading(true);
    setLocalError('');
    try {
      const res = await fetch(`${JUPITER_SWAP_V1_BASE}/swap`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': jupiterApiKey,
        },
        body: JSON.stringify({
          quoteResponse: quote,
          userPublicKey: publicKey.toString(),
          dynamicComputeUnitLimit: true,
          wrapAndUnwrapSol: true,
        }),
      });
      const data = await res.json();
      if (res.status === 401) {
        throw new Error('Invalid Jupiter API key. Check NEXT_PUBLIC_JUPITER_API_KEY (portal.jup.ag)');
      }
      if (!res.ok) throw new Error(data.error || data.message || 'Swap build failed');
      if (data.error) throw new Error(data.error);
      if (!data.swapTransaction) throw new Error('No swap transaction in response');

      const raw = atob(data.swapTransaction);
      const buf = new Uint8Array(raw.length);
      for (let i = 0; i < raw.length; i++) buf[i] = raw.charCodeAt(i);
      const tx = VersionedTransaction.deserialize(buf);
      const signed = await signTransaction(tx);
      const sig = await connection.sendRawTransaction(signed.serialize(), {
        skipPreflight: false,
        preflightCommitment: 'confirmed',
        maxRetries: 2,
      });
      setQuote(null);
      const amountSwappedSol = amountLamports / 1e9;
      const outAmt = quote && typeof (quote as { outAmount?: string }).outAmount === 'string'
        ? (Number((quote as { outAmount: string }).outAmount) / 10 ** (selectedToken?.decimals ?? 6)).toFixed(4)
        : '—';
      setSuccess(`Swapped ${amountSwappedSol.toFixed(6)} SOL. You received ${outAmt} ${selectedToken?.symbol ?? ''}. Verify: solscan.io/tx/${sig}`);
      onSwapDone?.(amountSwappedSol);
      void connection.confirmTransaction(sig, 'confirmed').catch(() => {});
    } catch (e) {
      setLocalError(e instanceof Error ? e.message : 'Swap failed');
    } finally {
      setSwapLoading(false);
    }
  };

  const outAmount = quote && typeof (quote as { outAmount?: string }).outAmount === 'string'
    ? (quote as { outAmount: string }).outAmount
    : null;
  const outDecimals = selectedToken?.decimals ?? 6;
  const outFormatted = outAmount
    ? (Number(outAmount) / 10 ** outDecimals).toFixed(4)
    : '—';

  return (
    <div className="mt-4 pt-4 border-t border-neon-purple/20 flex flex-col items-center text-center">
      <p className="text-sm font-semibold text-gray-300 mb-3">Swap your reclaimed SOL</p>
      {noReclaimedLeft && (
        <p className="text-amber-400/90 text-sm mb-3">No reclaimed SOL left to swap. Swap and stake share the same reclaimed amount.</p>
      )}
      {!hasApiKey && (
        <p className="text-amber-400 text-sm mb-3">
          Set <code className="bg-black/30 px-1 rounded">NEXT_PUBLIC_JUPITER_API_KEY</code> in .env.local (get key at portal.jup.ag).
        </p>
      )}
      <div className="flex flex-wrap justify-center gap-2 mb-3">
        {([0.25, 0.5, 1] as const).map((p) => (
          <button
            key={p}
            type="button"
            disabled={noReclaimedLeft}
            onClick={() => { setAmountPreset(p); setQuote(null); clearError(); setSuccess(''); }}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 ${
              amountPreset === p
                ? 'bg-neon-purple/30 text-white border border-neon-purple/50'
                : 'bg-dark-bg text-gray-400 border border-dark-border hover:border-neon-purple/40'
            }`}
          >
            {p === 1 ? 'Max' : `${p * 100}%`}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap justify-center items-center gap-2 mb-3">
        <span className="text-gray-400 text-sm">→</span>
        {outputTokens.map((t, i) => (
          <button
            key={t.mint}
            type="button"
            onClick={() => { setSelectedOutputIndex(i); setQuote(null); clearError(); setSuccess(''); }}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              selectedOutputIndex === i
                ? 'bg-neon-purple/30 text-white border border-neon-purple/50'
                : 'bg-dark-bg text-gray-400 border border-dark-border hover:border-neon-purple/40'
            }`}
          >
            {t.symbol}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap justify-center items-center gap-2">
        <button
          type="button"
          onClick={fetchQuote}
          disabled={!canSwap || quoteLoading}
          className="btn-cyber text-sm py-2 disabled:opacity-50"
        >
          {quoteLoading ? 'Getting quote…' : 'Get quote'}
        </button>
        {quote && (
          <>
            <span className="text-gray-400 text-sm">
              ≈ {outFormatted} {selectedToken.symbol}
            </span>
            <button
              type="button"
              onClick={executeSwap}
              disabled={swapLoading}
              className="btn-cyber text-sm py-2 border-neon-green/50 text-neon-green hover:bg-neon-green/10 disabled:opacity-50"
            >
              {swapLoading ? 'Swapping…' : 'Swap'}
            </button>
          </>
        )}
      </div>
      {success && (
        <p className="text-sm text-green-400 mt-3 w-full">{success}</p>
      )}
      {localError && (
        <p className="text-red-400 text-sm mt-2">{localError}</p>
      )}
    </div>
  );
}
