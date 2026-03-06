'use client';

/**
 * Reclaim-to-Stake: two sections.
 * 1) Stake ONLY what was just reclaimed (reclaimedAmountSol).
 * 2) Stake additional SOL from wallet (user-entered amount).
 * In-app only: PSOL (Phantom) primary, Marinade as second option.
 * See docs/STAKING-INTEGRATION-ANALYSIS.md and docs/PHANTOM-PERPS-STAKING-PSOL-FEATURES-ANALYSE.md.
 */
import { useState, useEffect } from 'react';
import { useConnection } from '@solana/wallet-adapter-react';
import type { PublicKey } from '@solana/web3.js';
import { Transaction } from '@solana/web3.js';
import { getMaxStakeLamports } from '@/lib/solana/marinadeStake';

const LAMPORTS_PER_SOL = 1e9;
const RESERVE_SOL = 0.005;

type StakeProvider = 'psol' | 'marinade';

const STAKE_PROVIDERS: { id: StakeProvider; name: string; tokenName: string }[] = [
  { id: 'psol', name: 'Phantom (PSOL)', tokenName: 'PSOL' },
  { id: 'marinade', name: 'Marinade', tokenName: 'mSOL' },
];

export interface ReclaimToStakeProps {
  /** Wallet balance in SOL (for "stake from wallet" max) */
  walletBalanceSol?: number;
  /** SOL amount from last reclaim – enables "Stake reclaimed only" block */
  reclaimedAmountSol?: number;
  publicKey?: PublicKey | null;
  /** Sign legacy Transaction (Marinade deposit). If not provided, only links are shown. */
  signTransaction?: (tx: Transaction) => Promise<Transaction>;
  /** Called after a successful stake. When staking from reclaimed, the SOL amount staked is passed so parent can reduce available reclaimed. */
  onStakeDone?: (amountStakedSol?: number) => void;
}

export default function ReclaimToStake({
  walletBalanceSol = 0,
  reclaimedAmountSol,
  publicKey,
  signTransaction,
  onStakeDone,
}: ReclaimToStakeProps) {
  const { connection } = useConnection();
  const [stakeLoading, setStakeLoading] = useState<'reclaimed' | 'wallet' | null>(null);
  const [walletAmountSol, setWalletAmountSol] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  /** Once the user has staked the reclaimed amount, hide the "From your last reclaim" block until they do a new reclaim. */
  const [hasStakedReclaimed, setHasStakedReclaimed] = useState(false);

  useEffect(() => {
    setHasStakedReclaimed(false);
  }, [reclaimedAmountSol]);

  const canStakeInApp = Boolean(publicKey && signTransaction);
  const walletBalanceLamports = Math.floor(walletBalanceSol * LAMPORTS_PER_SOL);
  const maxStakeLamports = getMaxStakeLamports(walletBalanceLamports);
  const maxStakeSol = maxStakeLamports / LAMPORTS_PER_SOL;

  const runDeposit = async (amountLamports: number, source: 'reclaimed' | 'wallet', provider: StakeProvider) => {
    if (!publicKey || !signTransaction || amountLamports <= 0) return;
    setError('');
    setSuccess('');
    setStakeLoading(source);
    const endpoint = provider === 'psol' ? '/api/psol/deposit' : '/api/marinade/deposit';
    const tokenName = STAKE_PROVIDERS.find((p) => p.id === provider)?.tokenName ?? (provider === 'psol' ? 'PSOL' : 'mSOL');
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          publicKey: publicKey.toString(),
          amountLamports,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to build transaction');
      const raw = Uint8Array.from(atob(data.serializedTransaction), (c) => c.charCodeAt(0));
      const transaction = Transaction.from(raw);
      const signed = await signTransaction(transaction);
      const sig = await connection.sendRawTransaction(signed.serialize(), {
        skipPreflight: false,
        preflightCommitment: 'confirmed',
      });
      await connection.confirmTransaction(sig, 'confirmed');
      const sol = (amountLamports / LAMPORTS_PER_SOL).toFixed(6);
      setSuccess(`Staked ${sol} SOL. You received ${tokenName}.`);
      setWalletAmountSol('');
      if (source === 'reclaimed') setHasStakedReclaimed(true);
      const amountStakedSol = source === 'reclaimed' ? amountLamports / LAMPORTS_PER_SOL : undefined;
      onStakeDone?.(amountStakedSol);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Stake failed');
    } finally {
      setStakeLoading(null);
    }
  };

  const handleStakeReclaimed = (provider: StakeProvider) => {
    if (reclaimedAmountSol == null || reclaimedAmountSol <= 0) return;
    const reclaimedLamports = Math.floor(reclaimedAmountSol * LAMPORTS_PER_SOL);
    if (reclaimedLamports <= 0) {
      setError('No SOL available to stake.');
      return;
    }
    if (walletBalanceLamports < reclaimedLamports) {
      setError('Insufficient balance to stake the reclaimed amount. Try again after the reclaim is confirmed.');
      return;
    }
    runDeposit(reclaimedLamports, 'reclaimed', provider);
  };

  const handleStakeFromWallet = (provider: StakeProvider) => {
    const sol = parseFloat(walletAmountSol);
    if (Number.isNaN(sol) || sol <= 0) {
      setError('Enter a valid amount.');
      return;
    }
    const lamports = Math.floor(sol * LAMPORTS_PER_SOL);
    if (lamports > maxStakeLamports) {
      setError(`Max ${maxStakeSol.toFixed(6)} SOL (reserve ${RESERVE_SOL} SOL for fees).`);
      return;
    }
    runDeposit(lamports, 'wallet', provider);
  };

  const hasReclaimed = reclaimedAmountSol != null && reclaimedAmountSol > 0 && !hasStakedReclaimed;
  const hasWalletSol = walletBalanceSol > RESERVE_SOL;

  return (
    <div className="card-cyber border-amber-500/30 bg-amber-500/5 text-center flex flex-col items-center">
      <h3 className="text-lg font-bold mb-2 font-[family-name:var(--font-orbitron)] text-amber-400/90">
        Stake or save your SOL
      </h3>
      <p className="text-sm text-gray-400 mb-1 max-w-xl">
        Staking lets your SOL earn rewards (like interest) while helping secure the network—you can still use or swap your staked value anytime with liquid staking.
      </p>
      <p className="text-sm text-gray-500 mb-4">
        Stake in-app with PSOL (Phantom) or Marinade—you receive liquid staking tokens.
      </p>

      {/* Section A: Stake reclaimed only */}
      {hasReclaimed && (
        <div className="mb-6 p-4 rounded-lg border border-amber-500/30 bg-amber-500/10 w-full max-w-md flex flex-col items-center">
          <h4 className="text-sm font-bold text-amber-300/90 mb-2">From your last reclaim</h4>
          <p className="text-sm text-gray-400 mb-3">
            Stake the SOL you just recovered ({reclaimedAmountSol.toFixed(6)} SOL).
          </p>
          <p className="text-xs text-gray-500 mb-2">
            First time? Your wallet may show extra SOL (stake + one-time rent for the token account). Only the reclaimed amount is staked.
          </p>
          {canStakeInApp ? (
            <div className="flex flex-wrap gap-2 justify-center items-center">
              <button
                type="button"
                onClick={() => handleStakeReclaimed('psol')}
                disabled={stakeLoading !== null || walletBalanceLamports < Math.floor(reclaimedAmountSol * LAMPORTS_PER_SOL)}
                className="px-4 py-2 rounded-lg border-2 border-amber-500/50 bg-amber-500/20 text-amber-200 hover:bg-amber-500/30 disabled:opacity-50 text-sm font-medium"
              >
                {stakeLoading === 'reclaimed' ? 'Staking…' : 'Stake with PSOL'}
              </button>
              <span className="text-gray-500 text-xs">or</span>
              <button
                type="button"
                onClick={() => handleStakeReclaimed('marinade')}
                disabled={stakeLoading !== null || walletBalanceLamports < Math.floor(reclaimedAmountSol * LAMPORTS_PER_SOL)}
                className="px-4 py-2 rounded-lg border-2 border-amber-500/40 bg-amber-500/10 text-amber-200 hover:bg-amber-500/20 disabled:opacity-50 text-sm font-medium"
              >
                Stake with Marinade
              </button>
            </div>
          ) : (
            <p className="text-xs text-gray-500">Connect your wallet to stake in-app.</p>
          )}
        </div>
      )}

      {/* Section B: Stake from wallet */}
      {hasWalletSol && (
        <div className="mb-6 p-4 rounded-lg border border-amber-500/30 bg-amber-500/10 w-full max-w-md flex flex-col items-center">
          <h4 className="text-sm font-bold text-amber-300/90 mb-2">From your wallet</h4>
          <p className="text-sm text-gray-400 mb-3">
            Stake any amount from your balance (max {maxStakeSol.toFixed(6)} SOL after reserve).
          </p>
          <p className="text-xs text-gray-500 mb-2">
            First time? Your wallet may show a higher SOL amount (stake + one-time rent for the token account). The amount you enter is what gets staked.
          </p>
          {canStakeInApp ? (
            <div className="flex flex-col sm:flex-row flex-wrap items-center justify-center gap-2">
              <input
                type="number"
                min={0}
                max={maxStakeSol}
                step="0.001"
                placeholder="0.00"
                value={walletAmountSol}
                onChange={(e) => setWalletAmountSol(e.target.value)}
                className="w-32 px-3 py-2 rounded-lg border border-amber-500/40 bg-dark-bg text-white font-mono text-sm"
              />
              <span className="text-gray-500 text-sm">SOL</span>
              <button
                type="button"
                onClick={() => setWalletAmountSol(String(maxStakeSol))}
                className="text-xs text-amber-400 hover:text-amber-300"
              >
                Max
              </button>
              <button
                type="button"
                onClick={() => handleStakeFromWallet('psol')}
                disabled={stakeLoading !== null || !walletAmountSol.trim()}
                className="px-4 py-2 rounded-lg border-2 border-amber-500/50 bg-amber-500/20 text-amber-200 hover:bg-amber-500/30 disabled:opacity-50 text-sm font-medium"
              >
                {stakeLoading === 'wallet' ? 'Staking…' : 'Stake with PSOL'}
              </button>
              <button
                type="button"
                onClick={() => handleStakeFromWallet('marinade')}
                disabled={stakeLoading !== null || !walletAmountSol.trim()}
                className="px-4 py-2 rounded-lg border-2 border-amber-500/40 bg-amber-500/10 text-amber-200 hover:bg-amber-500/20 disabled:opacity-50 text-sm font-medium"
              >
                Stake with Marinade
              </button>
            </div>
          ) : (
            <p className="text-xs text-gray-500">Connect your wallet to stake in-app.</p>
          )}
        </div>
      )}

      {error && <p className="text-sm text-red-400 mb-3 w-full">{error}</p>}
      {success && <p className="text-sm text-green-400 mb-3 w-full">{success}</p>}

    </div>
  );
}
