'use client';

import { useState, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import CreateNftForm from './CreateNftForm';
import MyCreationsList from './MyCreationsList';
import { NFT_CREATOR_MIN_RECLAIM_SOL } from '@/types/nftCreator';

export default function NftCreatorPage() {
  const { publicKey } = useWallet();
  const [eligibility, setEligibility] = useState<{
    lastNetSol: number;
    canCreateNft: boolean;
    ceilingSol: number;
  } | null>(null);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    if (!publicKey) {
      setEligibility(null);
      return;
    }
    fetch(`/api/nft-creator/eligibility?wallet=${encodeURIComponent(publicKey.toString())}`)
      .then((res) => res.ok ? res.json() : null)
      .then((data) => setEligibility(data))
      .catch(() => setEligibility(null));
  }, [publicKey?.toString()]);

  if (!publicKey) {
    return (
      <div className="animate-slide-up max-w-xl mx-auto">
        <div className="card-cyber text-center py-10 md:py-12 border-dark-border">
          <div className="text-5xl md:text-6xl mb-4">🔐</div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">NFT Creator</p>
          <h2 className="text-2xl md:text-3xl font-bold font-[family-name:var(--font-orbitron)] text-white mb-3">Connect your wallet</h2>
          <p className="text-sm text-gray-400">Connect your wallet to create an F1-themed NFT from your reclaimed SOL.</p>
        </div>
      </div>
    );
  }

  if (showForm && eligibility?.canCreateNft) {
    return (
      <div className="animate-slide-up max-w-xl mx-auto">
        <div className="card-cyber py-8 px-6 border-dark-border">
          <h2 className="text-lg font-bold font-[family-name:var(--font-orbitron)] text-white mb-2">Create your NFT</h2>
          <p className="text-sm text-gray-400 mb-6">F1 theme required. Human review within 24h. Payment only at finalization.</p>
          <CreateNftForm
            wallet={publicKey.toString()}
            ceilingSol={eligibility.ceilingSol}
            onSuccess={() => { setShowForm(false); }}
            onCancel={() => setShowForm(false)}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="animate-slide-up max-w-3xl mx-auto space-y-8">
      <div className="text-center md:text-left">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">NFT Creator</p>
        <h1 className="text-2xl md:text-4xl font-bold font-[family-name:var(--font-orbitron)] text-white mb-2">
          Create an F1-themed NFT
        </h1>
        <p className="text-sm text-gray-400 max-w-2xl">
          Use SOL from your last reclaim to mint a verified NFT in the SolPit Creator collection. After human review, each approved NFT gets a tier (Standard, Silver, Gold, or Platinum). Higher tiers unlock better perks: more points per reclaim, faster F1 race time, lower reclaim fees, and higher referral earnings. Hold 2+ Creator NFTs for an extra collector bonus.
        </p>
      </div>

      <div className="card-cyber border-neon-cyan/30 bg-neon-cyan/5 p-4 md:p-5">
        <h2 className="text-sm font-semibold text-neon-cyan uppercase tracking-wider mb-3">How tiers work</h2>
        <p className="text-xs text-gray-400 mb-4">
          One tier applies per wallet (your best NFT). Collector bonus adds on top when you hold 2+ Creator NFTs.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="text-gray-500 border-b border-dark-border">
                <th className="py-2 pr-4 font-medium">Tier</th>
                <th className="py-2 pr-4 font-medium">Points/reclaim</th>
                <th className="py-2 pr-4 font-medium">F1 time</th>
                <th className="py-2 pr-4 font-medium">Reclaim fee</th>
                <th className="py-2 font-medium">Referral</th>
              </tr>
            </thead>
            <tbody className="text-gray-300">
              <tr className="border-b border-dark-border/80">
                <td className="py-2.5 pr-4">Standard</td>
                <td className="py-2.5 pr-4">+2</td>
                <td className="py-2.5 pr-4">—</td>
                <td className="py-2.5 pr-4">20%</td>
                <td className="py-2.5">10%</td>
              </tr>
              <tr className="border-b border-dark-border/80">
                <td className="py-2.5 pr-4">Silver</td>
                <td className="py-2.5 pr-4">+4</td>
                <td className="py-2.5 pr-4">−1.5 s</td>
                <td className="py-2.5 pr-4">17%</td>
                <td className="py-2.5">12%</td>
              </tr>
              <tr className="border-b border-dark-border/80">
                <td className="py-2.5 pr-4 text-amber-400">Gold</td>
                <td className="py-2.5 pr-4">+8</td>
                <td className="py-2.5 pr-4">−4 s</td>
                <td className="py-2.5 pr-4">14%</td>
                <td className="py-2.5">14%</td>
              </tr>
              <tr>
                <td className="py-2.5 pr-4 text-neon-cyan">Platinum</td>
                <td className="py-2.5 pr-4">+14</td>
                <td className="py-2.5 pr-4">−6 s</td>
                <td className="py-2.5 pr-4">10%</td>
                <td className="py-2.5">17%</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="text-xs text-gray-500 mt-3">
          Collector (2+ NFTs): +2 pts/reclaim and −1 s race time on top of your tier.
        </p>
      </div>

      {eligibility && !eligibility.canCreateNft && (
        <div className="card-cyber border-amber-500/30 p-4">
          {eligibility.reason === 'reclaim_already_used' ? (
            <p className="text-sm text-amber-200">
              Your last reclaim (<span className="font-mono">{eligibility.lastNetSol.toFixed(4)} SOL</span>) was already used to create an NFT. Do a <strong>new reclaim</strong> (≥ {NFT_CREATOR_MIN_RECLAIM_SOL} SOL net) to unlock creation of another.
            </p>
          ) : eligibility.reason === 'no_reclaim' ? (
            <p className="text-sm text-amber-200">
              No reclaim yet. Do a reclaim of at least <span className="font-mono font-semibold">{NFT_CREATOR_MIN_RECLAIM_SOL} SOL</span> net to unlock NFT creation.
            </p>
          ) : (
            <p className="text-sm text-amber-200">
              Minimum <span className="font-mono font-semibold">{NFT_CREATOR_MIN_RECLAIM_SOL} SOL</span> net from your last reclaim is required. Your last reclaim: <span className="font-mono">{eligibility.lastNetSol.toFixed(4)} SOL</span>.
            </p>
          )}
        </div>
      )}

      {eligibility?.canCreateNft && !showForm && (
        <div className="card-cyber border-dark-border p-6 text-center">
          <p className="text-sm text-gray-400 mb-1">
            Eligible (last reclaim net): up to <span className="font-mono text-amber-400">{eligibility.ceilingSol.toFixed(4)} SOL</span>.
          </p>
          <p className="text-xs text-gray-500 mb-4">
            You pay only the mint cost (network rent + SolPit fee, typically ~0.01–0.02 SOL), not the full amount.
          </p>
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="py-2.5 px-6 rounded-lg font-medium bg-neon-purple text-white hover:opacity-90"
          >
            Create an NFT
          </button>
        </div>
      )}

      <div>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">My NFTs</h2>
        <MyCreationsList />
      </div>
    </div>
  );
}
