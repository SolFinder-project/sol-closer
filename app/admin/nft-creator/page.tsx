'use client';

import { useState, useEffect, useCallback } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import type { NftCreatorTier } from '@/types/nftCreator';

const ADMIN_SECRET_KEY = 'nft-creator-admin-secret';

const TIERS: NftCreatorTier[] = ['standard', 'silver', 'gold', 'platinum'];

type PendingSubmission = {
  id: string;
  wallet_address: string;
  image_uri: string;
  metadata_uri: string | null;
  name: string;
  description: string;
  attributes: unknown;
  status: string;
  tier: string | null;
  created_at: string;
};

type CirculationItem = {
  id: string;
  wallet_address: string;
  image_uri: string;
  name: string;
  description: string;
  tier: string;
  mint_address: string;
  created_at: string;
  approved_at: string | null;
  current_holder?: string | null;
};

type ApprovedPendingItem = {
  id: string;
  wallet_address: string;
  image_uri: string;
  name: string;
  description: string;
  tier: string | null;
  approved_at: string | null;
  expires_at: string | null;
  created_at: string;
};

function useAdminSecret() {
  const [secret, setSecretState] = useState<string | null>(null);
  useEffect(() => {
    const s = sessionStorage.getItem(ADMIN_SECRET_KEY);
    if (s) setSecretState(s);
  }, []);
  const setSecret = useCallback((value: string | null) => {
    if (value) sessionStorage.setItem(ADMIN_SECRET_KEY, value);
    else sessionStorage.removeItem(ADMIN_SECRET_KEY);
    setSecretState(value);
  }, []);
  return [secret, setSecret] as const;
}

function ExplorerLink({ mint, label }: { mint: string; label?: string }) {
  const network = process.env.NEXT_PUBLIC_SOLANA_NETWORK || 'mainnet-beta';
  const cluster = network === 'mainnet-beta' ? '' : 'devnet';
  const url = `https://explorer.solana.com/address/${mint}${cluster ? `?cluster=${cluster}` : ''}`;
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="text-red-400 hover:text-red-300 text-sm underline">
      {label ?? 'Explorer'}
    </a>
  );
}

export default function NftCreatorAdminPage() {
  const { publicKey, connected } = useWallet();
  const [secret, setSecret] = useAdminSecret();
  const [secretInput, setSecretInput] = useState('');
  const [secretError, setSecretError] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingSubmission[]>([]);
  const [approvedPending, setApprovedPending] = useState<ApprovedPendingItem[]>([]);
  const [circulation, setCirculation] = useState<CirculationItem[]>([]);
  const [loadingPending, setLoadingPending] = useState(false);
  const [loadingApprovedPending, setLoadingApprovedPending] = useState(false);
  const [loadingCirculation, setLoadingCirculation] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState<Record<string, string>>({});
  const [accessAllowed, setAccessAllowed] = useState<boolean | null>(null);

  useEffect(() => {
    if (!publicKey) {
      setAccessAllowed(null);
      return;
    }
    let cancelled = false;
    fetch(`/api/nft-creator/admin/check-access?wallet=${encodeURIComponent(publicKey.toBase58())}`)
      .then((r) => r.json())
      .then((data: { allowed?: boolean }) => {
        if (!cancelled) setAccessAllowed(data.allowed === true);
      })
      .catch(() => {
        if (!cancelled) setAccessAllowed(false);
      });
    return () => {
      cancelled = true;
    };
  }, [publicKey?.toBase58()]);

  const isAdminWallet = accessAllowed === true;
  const accessCheckLoading = publicKey != null && accessAllowed === null;

  const headers = (): HeadersInit => ({
    'Content-Type': 'application/json',
    ...(secret ? { 'x-admin-secret': secret } : {}),
  });

  const fetchPending = useCallback(async () => {
    if (!secret) return;
    setLoadingPending(true);
    try {
      const res = await fetch('/api/nft-creator/admin/pending', { headers: headers() });
      if (res.status === 401) {
        setSecret(null);
        setPending([]);
        return;
      }
      const data = await res.json();
      setPending(data.submissions ?? []);
    } catch {
      setPending([]);
    } finally {
      setLoadingPending(false);
    }
  }, [secret]);

  const fetchApprovedPending = useCallback(async () => {
    if (!secret) return;
    setLoadingApprovedPending(true);
    try {
      const res = await fetch('/api/nft-creator/admin/approved-pending', { headers: headers() });
      if (res.status === 401) {
        setSecret(null);
        setApprovedPending([]);
        return;
      }
      const data = await res.json();
      setApprovedPending(data.submissions ?? []);
    } catch {
      setApprovedPending([]);
    } finally {
      setLoadingApprovedPending(false);
    }
  }, [secret]);

  const fetchCirculation = useCallback(async () => {
    if (!secret) return;
    setLoadingCirculation(true);
    try {
      const res = await fetch('/api/nft-creator/admin/circulation', { headers: headers() });
      if (res.status === 401) {
        setSecret(null);
        setCirculation([]);
        return;
      }
      const data = await res.json();
      setCirculation(data.items ?? []);
    } catch {
      setCirculation([]);
    } finally {
      setLoadingCirculation(false);
    }
  }, [secret]);

  useEffect(() => {
    if (secret && isAdminWallet) {
      fetchPending();
      fetchApprovedPending();
      fetchCirculation();
    } else {
      setPending([]);
      setApprovedPending([]);
      setCirculation([]);
    }
  }, [secret, isAdminWallet, fetchPending, fetchApprovedPending, fetchCirculation]);

  const handleSecretSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSecretError(null);
    const s = secretInput.trim();
    if (!s) return;
    try {
      const res = await fetch('/api/nft-creator/admin/pending', {
        headers: { 'x-admin-secret': s },
      });
      if (res.status === 401) {
        setSecretError('Invalid secret');
        return;
      }
      setSecret(s);
      setSecretInput('');
    } catch {
      setSecretError('Request failed');
    }
  };

  const handleReview = async (
    submissionId: string,
    action: 'approve' | 'reject',
    tier?: NftCreatorTier,
    rejectionReason?: string
  ) => {
    if (!secret) return;
    setActionLoading(submissionId);
    try {
      const body: { submissionId: string; action: string; tier?: string; rejectionReason?: string } = {
        submissionId,
        action,
      };
      if (action === 'approve' && tier) body.tier = tier;
      if (action === 'reject' && rejectionReason) body.rejectionReason = rejectionReason;
      const res = await fetch('/api/nft-creator/admin/review', {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify(body),
      });
      if (res.status === 401) {
        setSecret(null);
        return;
      }
      const data = await res.json();
      if (res.ok && data.ok) {
        setPending((prev) => prev.filter((s) => s.id !== submissionId));
        if (action === 'approve') {
          fetchApprovedPending();
          fetchCirculation();
        }
      }
    } finally {
      setActionLoading(null);
    }
  };

  if (accessCheckLoading) {
    return (
      <div className="min-h-screen bg-dark-bg text-white flex items-center justify-center p-6">
        <div className="text-center">
          <p className="text-gray-400">Checking access…</p>
        </div>
      </div>
    );
  }

  if (!connected || !publicKey) {
    return (
      <div className="min-h-screen bg-dark-bg text-white flex items-center justify-center p-6">
        <div className="max-w-md text-center">
          <h1 className="text-2xl font-bold font-[family-name:var(--font-orbitron)] text-white mb-2">NFT Creator Admin</h1>
          <p className="text-gray-400 text-sm">Connect your wallet to access the admin panel.</p>
        </div>
      </div>
    );
  }

  if (!isAdminWallet) {
    const connectedAddress = publicKey?.toBase58();
    return (
      <div className="min-h-screen bg-dark-bg text-white flex items-center justify-center p-6">
        <div className="max-w-md text-center space-y-3">
          <h1 className="text-2xl font-bold font-[family-name:var(--font-orbitron)] text-red-400">Access denied</h1>
          <p className="text-gray-400 text-sm">
            This page is restricted to the configured admin wallet(s). Add your address to{' '}
            <code className="text-gray-500">NEXT_PUBLIC_NFT_CREATOR_ADMIN_WALLETS</code> or{' '}
            <code className="text-gray-500">NFT_CREATOR_ADMIN_WALLETS</code> (Vercel → Environment Variables), then reload — no redeploy needed.
          </p>
          {connectedAddress && (
            <p className="text-gray-500 text-xs font-mono">
              Connected: {connectedAddress.slice(0, 4)}…{connectedAddress.slice(-4)} — this address must be in the env var (comma-separated if several).
            </p>
          )}
        </div>
      </div>
    );
  }

  if (!secret) {
    return (
      <div className="min-h-screen bg-dark-bg text-white flex items-center justify-center p-6">
        <div className="max-w-md w-full">
          <h1 className="text-2xl font-bold font-[family-name:var(--font-orbitron)] text-white mb-2">NFT Creator Admin</h1>
          <p className="text-gray-400 text-sm mb-6">Enter the admin secret to continue.</p>
          <form onSubmit={handleSecretSubmit} className="space-y-3">
            <input
              type="password"
              value={secretInput}
              onChange={(e) => setSecretInput(e.target.value)}
              placeholder="Admin secret"
              className="w-full px-4 py-2 rounded-lg bg-dark-card border border-dark-border text-white placeholder-gray-500 focus:ring-2 focus:ring-red-500/50 focus:border-red-500/50"
              autoComplete="off"
            />
            {secretError && <p className="text-red-400 text-sm">{secretError}</p>}
            <button
              type="submit"
              className="w-full py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white font-medium transition-colors"
            >
              Continue
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-dark-bg text-white p-4 md:p-8 max-w-6xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold font-[family-name:var(--font-orbitron)] text-white">
            NFT Creator Admin
          </h1>
          <p className="text-gray-400 text-sm mt-1">Review submissions and view NFTs in circulation.</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => { setSecret(null); setPending([]); setApprovedPending([]); setCirculation([]); }}
            className="px-4 py-2 rounded-lg border border-dark-border text-gray-400 hover:text-white hover:border-gray-500 text-sm"
          >
            Sign out
          </button>
          <button
            type="button"
            onClick={() => { fetchPending(); fetchApprovedPending(); fetchCirculation(); }}
            className="px-4 py-2 rounded-lg bg-dark-card border border-dark-border text-white hover:border-gray-500 text-sm"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Pending submissions */}
      <section className="mb-12">
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-amber-500" />
          Pending submissions ({pending.length})
        </h2>
        {loadingPending ? (
          <p className="text-gray-500 text-sm">Loading…</p>
        ) : pending.length === 0 ? (
          <p className="text-gray-500 text-sm">No pending submissions.</p>
        ) : (
          <div className="grid gap-6 md:grid-cols-2">
            {pending.map((sub) => (
              <div
                key={sub.id}
                className="rounded-xl border border-dark-border bg-dark-card overflow-hidden"
              >
                <div className="aspect-square bg-dark-bg relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={sub.image_uri}
                    alt={sub.name}
                    className="w-full h-full object-contain"
                  />
                </div>
                <div className="p-4 space-y-3">
                  <h3 className="font-semibold text-white truncate">{sub.name}</h3>
                  <p className="text-gray-400 text-sm line-clamp-3">{sub.description}</p>
                  <p className="text-gray-500 text-xs font-mono">Creator: {sub.wallet_address.slice(0, 8)}…{sub.wallet_address.slice(-6)}</p>
                  <div className="flex flex-wrap gap-2 pt-2">
                    <select
                      id={`tier-${sub.id}`}
                      className="px-3 py-1.5 rounded-lg bg-dark-bg border border-dark-border text-white text-sm"
                    >
                      {TIERS.map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => {
                        const sel = document.getElementById(`tier-${sub.id}`) as HTMLSelectElement;
                        const tier = (sel?.value ?? 'standard') as NftCreatorTier;
                        handleReview(sub.id, 'approve', tier);
                      }}
                      disabled={actionLoading === sub.id}
                      className="px-3 py-1.5 rounded-lg bg-green-600/80 hover:bg-green-500 text-white text-sm font-medium disabled:opacity-50"
                    >
                      {actionLoading === sub.id ? '…' : 'Approve'}
                    </button>
                    <div className="flex flex-wrap gap-2 items-center">
                      <input
                        type="text"
                        placeholder="Rejection reason (optional)"
                        value={rejectReason[sub.id] ?? ''}
                        onChange={(e) => setRejectReason((r) => ({ ...r, [sub.id]: e.target.value }))}
                        className="px-2 py-1 rounded border border-dark-border bg-dark-bg text-white text-sm w-32"
                      />
                      <button
                        type="button"
                        onClick={() => handleReview(sub.id, 'reject', undefined, rejectReason[sub.id] || undefined)}
                        disabled={actionLoading === sub.id}
                        className="px-3 py-1.5 rounded-lg bg-red-600/80 hover:bg-red-500 text-white text-sm font-medium disabled:opacity-50"
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Approved, pending payment */}
      <section className="mb-12">
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-blue-500" />
          Approved, pending payment ({approvedPending.length})
        </h2>
        <p className="text-gray-500 text-sm mb-4">Validated by you; creator has not yet finalized (mint + pay).</p>
        {loadingApprovedPending ? (
          <p className="text-gray-500 text-sm">Loading…</p>
        ) : approvedPending.length === 0 ? (
          <p className="text-gray-500 text-sm">None.</p>
        ) : (
          <div className="grid gap-6 md:grid-cols-2">
            {approvedPending.map((sub) => (
              <div key={sub.id} className="rounded-xl border border-dark-border bg-dark-card overflow-hidden">
                <div className="aspect-square bg-dark-bg relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={sub.image_uri} alt={sub.name} className="w-full h-full object-contain" />
                </div>
                <div className="p-4 space-y-2">
                  <h3 className="font-semibold text-white truncate">{sub.name}</h3>
                  <p className="text-gray-400 text-sm line-clamp-2">{sub.description}</p>
                  <p className="text-gray-500 text-xs font-mono">Creator: {sub.wallet_address.slice(0, 8)}…{sub.wallet_address.slice(-6)}</p>
                  {sub.tier && <p className="text-gray-400 text-xs">Tier: {sub.tier}</p>}
                  {sub.approved_at && (
                    <p className="text-gray-500 text-xs">Approved: {new Date(sub.approved_at).toLocaleString()}</p>
                  )}
                  {sub.expires_at && (
                    <p className="text-amber-400/90 text-xs">Expires: {new Date(sub.expires_at).toLocaleString()}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* NFTs in circulation */}
      <section>
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-green-500" />
          NFTs in circulation ({circulation.length})
        </h2>
        <p className="text-gray-500 text-sm mb-4">Finalized NFTs still on-chain (burned NFTs are excluded).</p>
        {loadingCirculation ? (
          <p className="text-gray-500 text-sm">Loading…</p>
        ) : circulation.length === 0 ? (
          <p className="text-gray-500 text-sm">None yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-dark-border">
                  <th className="py-2 pr-4 text-gray-400 text-sm font-medium">Image</th>
                  <th className="py-2 pr-4 text-gray-400 text-sm font-medium">Name</th>
                  <th className="py-2 pr-4 text-gray-400 text-sm font-medium">Tier</th>
                  <th className="py-2 pr-4 text-gray-400 text-sm font-medium">Mint</th>
                  <th className="py-2 pr-4 text-gray-400 text-sm font-medium">Creator</th>
                  <th className="py-2 pr-4 text-gray-400 text-sm font-medium">Current holder</th>
                </tr>
              </thead>
              <tbody>
                {circulation.map((item) => (
                  <tr key={item.id} className="border-b border-dark-border/50">
                    <td className="py-3 pr-4">
                      <div className="w-12 h-12 rounded-lg overflow-hidden bg-dark-bg flex-shrink-0">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={item.image_uri} alt={item.name} className="w-full h-full object-cover" />
                      </div>
                    </td>
                    <td className="py-3 pr-4 text-white font-medium">{item.name}</td>
                    <td className="py-3 pr-4">
                      <span
                        className={
                          item.tier === 'platinum'
                            ? 'text-cyan-400'
                            : item.tier === 'gold'
                              ? 'text-amber-400'
                              : item.tier === 'silver'
                                ? 'text-gray-300'
                                : 'text-gray-400'
                        }
                      >
                        {item.tier}
                      </span>
                    </td>
                    <td className="py-3 pr-4 font-mono text-sm text-gray-400">
                      {item.mint_address.slice(0, 8)}…{item.mint_address.slice(-6)}{' '}
                      <ExplorerLink mint={item.mint_address} />
                    </td>
                    <td className="py-3 pr-4 font-mono text-xs text-gray-500">
                      {item.wallet_address.slice(0, 6)}…{item.wallet_address.slice(-4)}
                    </td>
                    <td className="py-3 pr-4 font-mono text-xs text-gray-400">
                      {item.current_holder
                        ? `${item.current_holder.slice(0, 6)}…${item.current_holder.slice(-4)}`
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
