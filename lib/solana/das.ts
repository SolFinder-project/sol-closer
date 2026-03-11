/**
 * DAS (Digital Asset Standard) API – get compressed NFTs owned by a wallet.
 * Uses RPC method getAssetsByOwner (Helius/public RPCs that support DAS).
 */

import { PublicKey } from '@solana/web3.js';
import { getRpcUrl } from './connection';
import { isValidSolanaAddress } from './validators';

export interface DasAsset {
  id: string;
  compressed?: boolean;
}

/** RPC response for getAssetsByOwner – minimal shape we need. */
interface GetAssetsByOwnerResponse {
  result?:
    | {
        items?: Array<Record<string, unknown>>;
        total?: number;
        page?: number;
        limit?: number;
      }
    | Array<Record<string, unknown>>;
  error?: { code: number; message: string };
}

/** Classic (non-compressed) NFT mint + optional token account from DAS. mint can be empty when only tokenAccount is known (e.g. DAS returns short id). */
export interface ClassicNftFromDas {
  mint: string;
  tokenAccount?: string;
}

/** Optional: custom fetch (e.g. with Origin/Referer for proxy). Used when calling from server. */
export type DasFetch = (url: string, init?: RequestInit) => Promise<Response>;

/** Call DAS getAsset(id) and return result.id (full mint) and optional token account. Exported for scanner fallback when getTokenAccountsByOwner fails. */
export async function getAssetMintAndTokenAccount(
  rpcUrl: string,
  assetId: string,
  customFetch?: DasFetch
): Promise<{ mint: string; tokenAccount?: string } | null> {
  const doFetch = customFetch ?? fetch;
  const res = await doFetch(rpcUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 'das-get-asset-' + Date.now(),
      method: 'getAsset',
      params: { id: assetId },
    }),
  });
  if (!res.ok) return null;
  const json = (await res.json()) as {
    result?: { id?: string; compression?: { compressed?: boolean }; token_info?: { address?: string } };
    error?: { message: string };
  };
  if (json.error || !json.result) return null;
  const r = json.result;
  if (r.compression?.compressed === true) return null;
  const mint = typeof r.id === 'string' ? r.id.trim() : '';
  const tokenAccount =
    (r.token_info && typeof r.token_info === 'object' && typeof (r.token_info as { address?: string }).address === 'string' && (r.token_info as { address: string }).address) ||
    (r.token_info && typeof r.token_info === 'object' && typeof (r.token_info as { associated_token_address?: string }).associated_token_address === 'string' && (r.token_info as { associated_token_address: string }).associated_token_address);
  if (mint && isValidSolanaAddress(mint)) return { mint, tokenAccount: tokenAccount || undefined };
  if (tokenAccount && isValidSolanaAddress(tokenAccount)) return { mint: '', tokenAccount };
  return null;
}

/** Call DAS getAsset(id); returns true if the asset still exists and is not burned. */
async function getAssetExists(assetId: string): Promise<boolean> {
  const rpcUrl = getRpcUrl();
  const res = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 'das-asset-exists-' + Date.now() + '-' + Math.random().toString(36).slice(2, 9),
      method: 'getAsset',
      params: { id: assetId },
    }),
  });
  if (!res.ok) return false;
  const json = (await res.json()) as { result?: { burnt?: boolean }; error?: { message: string } };
  if (json.error || json.result == null) return false;
  return json.result.burnt !== true;
}

/**
 * Fetch compressed NFTs (cNFTs) owned by the given wallet via DAS getAssetsByOwner.
 * Returns asset ids (base58) for items with compression.compressed === true.
 * Filters out assets that no longer exist (burned/deleted) to avoid showing them after a close.
 */
export async function getCompressedNftsByOwner(owner: PublicKey): Promise<DasAsset[]> {
  const rpcUrl = getRpcUrl();
  const body = {
    jsonrpc: '2.0',
    id: 'das-get-assets-' + Date.now(),
    method: 'getAssetsByOwner',
    params: {
      ownerAddress: owner.toBase58(),
    },
  };

  const res = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(`DAS getAssetsByOwner failed: ${res.status}`);
  }

  const data = (await res.json()) as GetAssetsByOwnerResponse;
  const rawResult = data.result;
  const items = Array.isArray(rawResult)
    ? rawResult
    : (rawResult && typeof rawResult === 'object' && 'items' in rawResult ? (rawResult as { items?: unknown[] }).items : undefined) ?? [];
  const out: DasAsset[] = [];

  for (const item of items) {
    const it = item as { id?: string; compression?: { compressed?: boolean } };
    if (it?.compression?.compressed === true && it.id) {
      out.push({ id: it.id, compressed: true });
    }
  }

  if (out.length === 0) return out;
  const exists = await Promise.all(out.map((a) => getAssetExists(a.id)));
  return out.filter((_, i) => exists[i]);
}

/**
 * Fetch classic (non-compressed) NFTs owned by the wallet via DAS getAssetsByOwner.
 * Same approach as tools like Sol Incinerator: use DAS as source of truth, then resolve token accounts.
 * Returns mints (and token account when provided by RPC) for items where compression.compressed !== true.
 * Paginates up to 1000 per page.
 * Optional options.rpcUrl and options.fetch: use proxy + headers when calling from server (avoids 401).
 */
export async function getClassicNftMintsByOwner(
  owner: PublicKey,
  options?: { rpcUrl?: string; fetch?: DasFetch }
): Promise<ClassicNftFromDas[]> {
  const rpcUrl = options?.rpcUrl ?? getRpcUrl();
  const doFetch = options?.fetch ?? fetch;
  const out: ClassicNftFromDas[] = [];
  let page = 1;
  const limit = 1000;

  while (true) {
    // Helius accepts displayOptions; sending "options" too causes "duplicate field 'options'" from some RPCs
    const body = {
      jsonrpc: '2.0',
      id: 'das-classic-nfts-' + Date.now() + '-' + page,
      method: 'getAssetsByOwner',
      params: {
        ownerAddress: owner.toBase58(),
        page,
        limit,
        displayOptions: { showFungible: false },
      },
    };

    const res = await doFetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      throw new Error(`DAS getAssetsByOwner failed: ${res.status}`);
    }

    const data = (await res.json()) as GetAssetsByOwnerResponse;
    if (data.error) {
      throw new Error(`DAS error: ${data.error.message}`);
    }
    const rawResult = data.result;
    const items = Array.isArray(rawResult)
      ? rawResult
      : (rawResult && typeof rawResult === 'object' && 'items' in rawResult
          ? (rawResult as { items?: unknown[] }).items
          : undefined) ?? [];
    const total =
      typeof rawResult === 'object' && rawResult != null && !Array.isArray(rawResult) && 'total' in rawResult
        ? (rawResult as { total?: number }).total ?? items.length
        : items.length;

    for (const item of items) {
      const it = item as Record<string, unknown> & {
        id?: string;
        mint?: string;
        interface?: string;
        compression?: { compressed?: boolean };
        token_info?: { address?: string; token_account?: string; associated_token_address?: string };
        token_account?: string;
        ownership?: { token_id?: string };
      };
      if (!it?.id) continue;
      if (it.compression?.compressed === true) continue;
      if (it.interface === 'FungibleToken' || it.interface === 'FungibleAsset') continue;
      const tokenAccountFromItem =
        (typeof it.token_account === 'string' && it.token_account) ||
        (it.token_info && typeof it.token_info === 'object' && typeof (it.token_info as { address?: string }).address === 'string' && (it.token_info as { address: string }).address) ||
        (it.token_info && typeof it.token_info === 'object' && typeof (it.token_info as { associated_token_address?: string }).associated_token_address === 'string' && (it.token_info as { associated_token_address: string }).associated_token_address) ||
        (it.token_info && typeof it.token_info === 'object' && typeof (it.token_info as { token_account?: string }).token_account === 'string' && (it.token_info as { token_account: string }).token_account) ||
        (it.ownership && typeof it.ownership === 'object' && typeof (it.ownership as { token_id?: string }).token_id === 'string' && (it.ownership as { token_id: string }).token_id);
      // RPC getTokenAccountsByOwner(mint) requires a valid 32-byte base58 mint; DAS can return short "id" (e.g. GmwBvSCU) that is not the mint
      let mint: string | null =
        (typeof it.mint === 'string' && it.mint.trim()) || (typeof it.id === 'string' && it.id.trim()) || null;
      if (mint && !isValidSolanaAddress(mint)) {
        // Short id: try getAsset for full mint; otherwise if we have token account, add it and scanner will derive mint from chain
        const resolved = await getAssetMintAndTokenAccount(rpcUrl, it.id!, doFetch);
        if (resolved?.mint) {
          out.push({
            mint: resolved.mint,
            tokenAccount: resolved.tokenAccount || tokenAccountFromItem || undefined,
          });
        } else if (resolved?.tokenAccount && isValidSolanaAddress(resolved.tokenAccount)) {
          out.push({ mint: '', tokenAccount: resolved.tokenAccount });
        } else if (tokenAccountFromItem && isValidSolanaAddress(tokenAccountFromItem)) {
          // Classic NFT with short id but DAS gave token account (e.g. Magic Eden "NFTs" section) – scanner will read mint from account data
          out.push({ mint: '', tokenAccount: tokenAccountFromItem });
        }
        continue;
      }
      if (!mint || !isValidSolanaAddress(mint)) continue;
      // When item has no token account, getAsset(id) may return token_info.address (e.g. Honeyland classic NFT where id is DAS asset id, not SPL mint)
      let tokenAccount = tokenAccountFromItem;
      let finalMint = mint;
      if (!tokenAccount && it.id) {
        const resolved = await getAssetMintAndTokenAccount(rpcUrl, it.id, doFetch);
        if (resolved?.tokenAccount) tokenAccount = resolved.tokenAccount;
        if (resolved?.mint) finalMint = resolved.mint;
      }
      // Push when we have token account (preferred) or a valid-length mint – getTokenAccountsByOwner(owner, { mint }) works for real SPL mints (e.g. GmwBvSCU1ZRKMFdouqdfRWegpgSmcHhRkez2HpvutNSc)
      out.push({
        mint: finalMint,
        tokenAccount: tokenAccount || undefined,
      });
    }

    if (items.length < limit || (total != null && out.length >= total)) break;
    page += 1;
  }

  return out;
}

/** Core asset from DAS (interface === 'MplCoreAsset'). */
export interface CoreAssetFromDas {
  id: string;
}

/**
 * Fetch Metaplex Core assets (MplCoreAsset) owned by the wallet via DAS getAssetsByOwner.
 * Used to show Honeyland Generations and other Core NFTs in Burn & reclaim (detection only; burn requires Mpl Core instruction).
 */
export async function getCoreAssetsByOwner(owner: PublicKey): Promise<CoreAssetFromDas[]> {
  const rpcUrl = getRpcUrl();
  const out: CoreAssetFromDas[] = [];
  let page = 1;
  const limit = 100;

  while (true) {
    const body = {
      jsonrpc: '2.0',
      id: 'das-core-assets-' + Date.now() + '-' + page,
      method: 'getAssetsByOwner',
      params: {
        ownerAddress: owner.toBase58(),
        page,
        limit,
      },
    };

    const res = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) break;
    const data = (await res.json()) as GetAssetsByOwnerResponse;
    if (data.error) break;
    const rawResult = data.result;
    const items = Array.isArray(rawResult)
      ? rawResult
      : (rawResult && typeof rawResult === 'object' && 'items' in rawResult
          ? (rawResult as { items?: unknown[] }).items
          : undefined) ?? [];

    for (const item of items) {
      const it = item as { id?: string; interface?: string };
      if (it?.interface === 'MplCoreAsset' && it.id) {
        out.push({ id: it.id });
      }
    }

    if (items.length < limit) break;
    page += 1;
  }

  return out;
}

/**
 * Fetch Core asset details via DAS getAsset; return collection address if the asset is in a collection.
 * Used when building Metaplex Core burn instruction (collection account required for assets in a collection).
 */
export async function getCoreAssetCollection(assetId: string): Promise<string | null> {
  const rpcUrl = getRpcUrl();
  const res = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 'das-get-asset-collection-' + Date.now(),
      method: 'getAsset',
      params: { id: assetId },
    }),
  });
  if (!res.ok) return null;
  const json = (await res.json()) as {
    result?: { updateAuthority?: { type?: string; address?: string }; grouping?: Array<{ group_key: string; group_value?: string }> };
    error?: { message: string };
  };
  if (json.error || !json.result) return null;
  const r = json.result;
  const ua = r.updateAuthority;
  if (ua && typeof ua === 'object' && (ua as { type?: string }).type === 'Collection' && typeof (ua as { address?: string }).address === 'string') {
    const addr = (ua as { address: string }).address;
    if (isValidSolanaAddress(addr)) return addr;
  }
  const grouping = r.grouping;
  if (Array.isArray(grouping)) {
    const collection = grouping.find((g) => g.group_key === 'collection');
    if (collection?.group_value && isValidSolanaAddress(collection.group_value)) return collection.group_value;
  }
  return null;
}
