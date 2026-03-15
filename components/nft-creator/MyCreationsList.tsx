'use client';

import { useState, useEffect, useRef } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { VersionedTransaction, Transaction } from '@solana/web3.js';
import { getMagicEdenItemUrl, getTensorItemUrl } from '@/lib/nftCreator/marketplaceUrls';

type Status = 'pending' | 'approved' | 'rejected' | 'finalized' | 'expired';

interface Submission {
  id: string;
  name: string;
  description: string;
  image_uri: string;
  status: Status;
  tier: string | null;
  rejection_reason: string | null;
  expires_at: string | null;
  mint_address: string | null;
  created_at: string;
  /** True if wallet still holds this NFT on-chain (false when burned/sold). Only set for finalized. */
  in_wallet?: boolean;
  /** True if this NFT was received by transfer (held but not created by this wallet). */
  received?: boolean;
}

type CollectionStatus = { inExpectedCollection: boolean; expectedCollectionMint: string | null };

export default function MyCreationsList() {
  const { publicKey, signTransaction } = useWallet();
  const { connection } = useConnection();
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [finalizingId, setFinalizingId] = useState<string | null>(null);
  const [addingToCollectionMint, setAddingToCollectionMint] = useState<string | null>(null);
  const [collectionStatus, setCollectionStatus] = useState<Record<string, CollectionStatus>>({});
  const fetchedCollectionMints = useRef<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    if (!publicKey) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/nft-creator/submissions?wallet=${encodeURIComponent(publicKey.toString())}`);
      const data = await res.json().catch(() => ({}));
      setSubmissions(data?.submissions ?? []);
    } catch {
      // Keep previous submissions on network error so finalized NFT still shows
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [publicKey?.toString()]);

  useEffect(() => {
    const mints = submissions
      .filter((s) => s.status === 'finalized' && s.mint_address && s.in_wallet !== false)
      .map((s) => s.mint_address!);
    mints.forEach((mint) => {
      if (fetchedCollectionMints.current.has(mint)) return;
      fetchedCollectionMints.current.add(mint);
      fetch(`/api/nft-creator/verify-collection?mint=${encodeURIComponent(mint)}`)
        .then((r) => r.json())
        .then((data: { inExpectedCollection?: boolean; expectedCollectionMint?: string | null }) => {
          setCollectionStatus((prev) => ({
            ...prev,
            [mint]: {
              inExpectedCollection: !!data.inExpectedCollection,
              expectedCollectionMint: data.expectedCollectionMint ?? null,
            },
          }));
        })
        .catch(() => {});
    });
  }, [submissions]);

  const handleAddToCollection = async (mint: string) => {
    if (!publicKey || !signTransaction) {
      setError('Wallet not connected or does not support signing.');
      return;
    }
    setError(null);
    setAddingToCollectionMint(mint);
    try {
      const res = await fetch('/api/nft-creator/add-to-collection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mint, wallet: publicKey.toString() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || 'Failed to build transaction');
        return;
      }
      const txBytes = Uint8Array.from(atob(data.transaction), (c) => c.charCodeAt(0));
      let signed;
      try {
        const tx = VersionedTransaction.deserialize(txBytes);
        signed = await signTransaction(tx);
      } catch {
        const tx = Transaction.from(txBytes);
        signed = await signTransaction(tx as unknown as VersionedTransaction);
      }
      const sig = await connection.sendRawTransaction(
        Buffer.from((signed as { serialize: () => Uint8Array }).serialize())
      );
      setCollectionStatus((prev) => ({
        ...prev,
        [mint]: { inExpectedCollection: true, expectedCollectionMint: prev[mint]?.expectedCollectionMint ?? null },
      }));
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Add to collection failed');
    } finally {
      setAddingToCollectionMint(null);
    }
  };

  const handleFinalize = async (submissionId: string) => {
    if (!publicKey || !signTransaction) {
      setError('Wallet not connected or does not support signing.');
      return;
    }
    setError(null);
    setFinalizingId(submissionId);
    try {
      const res = await fetch('/api/nft-creator/finalize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ submissionId, wallet: publicKey.toString() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || 'Failed to build transaction');
        return;
      }
      const { transaction: serializedTx, mintAddress } = data;
      const txBytes = Uint8Array.from(atob(serializedTx), (c) => c.charCodeAt(0));
      let signed;
      try {
        const tx = VersionedTransaction.deserialize(txBytes);
        signed = await signTransaction(tx);
      } catch {
        const tx = Transaction.from(txBytes);
        signed = await signTransaction(tx as unknown as VersionedTransaction);
      }
      const sig = await connection.sendRawTransaction(
        Buffer.from((signed as { serialize: () => Uint8Array }).serialize())
      );
      const confirmRes = await fetch('/api/nft-creator/confirm-finalize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          submissionId,
          wallet: publicKey.toString(),
          signature: sig,
          mintAddress,
        }),
      });
      if (!confirmRes.ok) {
        setError('Transaction sent but confirmation failed. Your NFT was minted.');
        load();
        return;
      }
      // Always add to collection right after mint (second signature). One click on Finalize = 2 signatures, no separate button.
      let collectionDone = false;
      try {
        const addRes = await fetch('/api/nft-creator/add-to-collection', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mint: mintAddress, wallet: publicKey.toString() }),
        });
        const addData = await addRes.json().catch(() => ({}));
        if (addRes.ok && addData.transaction) {
          const addTxBytes = Uint8Array.from(atob(addData.transaction), (c) => c.charCodeAt(0));
          let addSigned;
          try {
            const addTx = VersionedTransaction.deserialize(addTxBytes);
            addSigned = await signTransaction(addTx);
          } catch {
            const addTx = Transaction.from(addTxBytes);
            addSigned = await signTransaction(addTx as unknown as VersionedTransaction);
          }
          await connection.sendRawTransaction(
            Buffer.from((addSigned as { serialize: () => Uint8Array }).serialize())
          );
          collectionDone = true;
        } else if (addRes.ok && addData.collectionSkipped) {
          setError(addData.reason ?? 'NFT minted. Collection verification skipped (collection not set up). Your tier benefits still apply.');
        } else if (!addRes.ok) {
          setError(addData?.error ?? 'Second step (add to collection) failed. Use "Add to collection" on the NFT card to retry.');
        }
      } catch (addErr) {
        setError(addErr instanceof Error ? addErr.message : 'Add to collection failed. Use the button on the NFT card to retry.');
      }
      setCollectionStatus((prev) => ({
        ...prev,
        [mintAddress]: { expectedCollectionMint: prev[mintAddress]?.expectedCollectionMint ?? null, inExpectedCollection: collectionDone },
      }));
      if (collectionDone) {
        fetchedCollectionMints.current.add(mintAddress);
      }
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Finalize failed');
    } finally {
      setFinalizingId(null);
    }
  };

  if (!publicKey) return null;
  if (loading) {
    return (
      <div className="card-cyber border-dark-border p-6 text-center">
        <p className="text-sm text-gray-400">Loading your NFTs…</p>
      </div>
    );
  }

  const visibleSubmissions = submissions.filter(
    (s) => s.status !== 'finalized' || s.in_wallet !== false
  );

  const hasApprovedPendingPayment = submissions.some((s) => s.status === 'approved');

  if (visibleSubmissions.length === 0) {
    return (
      <div className="card-cyber border-dark-border p-6 text-center">
        <p className="text-sm text-gray-400">You have no Creator NFTs yet.</p>
      </div>
    );
  }

  const statusLabel: Record<Status, string> = {
    pending: 'Pending review',
    approved: 'Approved – Finalize to mint',
    rejected: 'Rejected',
    finalized: 'Finalized',
    expired: 'Expired',
  };

  return (
    <div className="space-y-4">
      {hasApprovedPendingPayment && (
        <div className="card-cyber border-amber-500/40 bg-amber-500/10 p-3 md:p-4">
          <p className="text-sm text-amber-200/95">
            You will need to sign twice: first to finalize the mint, then to add the NFT to the SolPit Creator collection.
          </p>
        </div>
      )}
      {error && <p className="text-sm text-red-400">{error}</p>}
      <div className="grid gap-4 sm:grid-cols-2">
        {visibleSubmissions.map((s) => {
          const inWallet = s.in_wallet !== false;
          return (
            <div key={s.id} className="card-cyber border-dark-border overflow-hidden">
              {s.image_uri && (
                <div className="aspect-square bg-dark-bg">
                  <img src={s.image_uri} alt={s.name} className="w-full h-full object-cover" />
                </div>
              )}
              <div className="p-3">
                <h3 className="font-semibold text-white truncate">{s.name}</h3>
                <p className="text-xs text-gray-400 mt-1">
                  {s.received ? 'Received' : statusLabel[s.status]}
                  {s.tier && ` · ${s.tier}`}
                </p>
              {s.status === 'rejected' && s.rejection_reason && (
                <p className="text-xs text-red-400 mt-1">{s.rejection_reason}</p>
              )}
              {s.status === 'approved' && (
                <button
                  type="button"
                  disabled={!!finalizingId}
                  onClick={() => handleFinalize(s.id)}
                  className="mt-2 w-full py-2 rounded-lg bg-neon-green/20 text-neon-green border border-neon-green/40 text-sm font-medium hover:bg-neon-green/30 disabled:opacity-50"
                >
                  {finalizingId === s.id ? 'Finalizing…' : 'Finalize (mint + pay)'}
                </button>
              )}
              {s.status === 'finalized' && s.mint_address && inWallet && collectionStatus[s.mint_address]?.expectedCollectionMint && !collectionStatus[s.mint_address]?.inExpectedCollection && (
                <button
                  type="button"
                  disabled={!!addingToCollectionMint}
                  onClick={() => handleAddToCollection(s.mint_address!)}
                  className="mt-2 w-full py-2 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/40 text-sm font-medium hover:bg-amber-500/30 disabled:opacity-50"
                >
                  {addingToCollectionMint === s.mint_address ? 'Adding…' : 'Add to collection'}
                </button>
              )}
              {s.status === 'finalized' && s.mint_address && (() => {
                const meUrl = getMagicEdenItemUrl(s.mint_address);
                const tensorUrl = getTensorItemUrl(s.mint_address);
                const isDevnet = process.env.NEXT_PUBLIC_SOLANA_NETWORK !== 'mainnet-beta';
                if (!meUrl && !tensorUrl) return null;
                return (
                  <div className="mt-3 pt-3 border-t border-dark-border space-y-1.5">
                    {isDevnet && inWallet && (
                      <p className="text-xs text-amber-400/90">
                        Magic Eden and Tensor are mainnet only. On devnet your NFT won’t appear there; use mainnet to list.
                      </p>
                    )}
                    <div className="flex flex-wrap gap-2">
                      {meUrl && (
                        <a
                          href={meUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 py-1.5 px-2.5 rounded-md bg-dark-bg border border-dark-border text-xs font-medium text-gray-300 hover:text-white hover:border-neon-purple/50 transition-colors"
                        >
                          {inWallet ? 'List on Magic Eden' : 'View on Magic Eden'}
                        </a>
                      )}
                      {tensorUrl && (
                        <a
                          href={tensorUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 py-1.5 px-2.5 rounded-md bg-dark-bg border border-dark-border text-xs font-medium text-gray-300 hover:text-white hover:border-neon-purple/50 transition-colors"
                        >
                          {inWallet ? 'List on Tensor' : 'View on Tensor'}
                        </a>
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
          );
        })}
      </div>
    </div>
  );
}
