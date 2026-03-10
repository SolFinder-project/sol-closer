import { PublicKey } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { getConnection, getRpcUrl } from './connection';
import { TokenAccount, DustAccount, NftBurnAccount } from '@/types/token-account';

import type { ReclaimEstimate } from '@/types/reclaim';
import { getPumpUserVolumeAccumulatorPda, PUMP_PROGRAM_ID, PUMP_PDA_RENT_LAMPORTS } from './pump';
import { getPumpSwapUserVolumeAccumulatorPda, PUMP_SWAP_PROGRAM_ID, PUMP_SWAP_PDA_RENT_LAMPORTS } from './pumpSwap';
import { getCompressedNftsByOwner, getCoreAssetsByOwner } from './das';
import { MPL_CORE_PROGRAM_ID, CORE_BURN_RETAINED_LAMPORTS } from './constants';
import { logger } from '@/lib/utils/logger';

/** Derive Associated Token Account address for a mint + owner (SPL or Token-2022). */
function getAssociatedTokenAddressSync(
  mint: PublicKey,
  owner: PublicKey,
  programId: PublicKey
): PublicKey {
  const [ata] = PublicKey.findProgramAddressSync(
    [owner.toBuffer(), programId.toBuffer(), mint.toBuffer()],
    ASSOCIATED_TOKEN_PROGRAM_ID
  );
  return ata;
}

/** SPL token account size (mint+owner+amount+...). Mint account is 82 bytes – we only accept token accounts. */
const SPL_TOKEN_ACCOUNT_MIN_SIZE = 165;

/** SPL token account layout: mint 0:32, owner 32:64, amount 64:72 (u64 LE). */
function toBytes(data: Buffer | Uint8Array | string | number[] | undefined): Uint8Array | null {
  if (data == null) return null;
  if (typeof data === 'string') {
    try {
      return Uint8Array.from(atob(data), (c) => c.charCodeAt(0));
    } catch {
      return null;
    }
  }
  if (Array.isArray(data)) {
    if (data.length >= 1 && typeof data[0] === 'string') return toBytes(data[0] as string);
    return new Uint8Array(data as number[]);
  }
  return data instanceof Buffer ? new Uint8Array(data) : new Uint8Array(data);
}

function parseMintFromTokenAccountData(data: Buffer | Uint8Array | string | number[] | undefined): PublicKey | null {
  const bytes = toBytes(data);
  if (!bytes || bytes.length < SPL_TOKEN_ACCOUNT_MIN_SIZE) return null;
  try {
    return new PublicKey(bytes.slice(0, 32));
  } catch {
    return null;
  }
}

/** Parse owner (32:64) from SPL token account data. */
function parseOwnerFromTokenAccountData(data: Buffer | Uint8Array | string | number[] | undefined): PublicKey | null {
  const bytes = toBytes(data);
  if (!bytes || bytes.length < 64) return null;
  try {
    return new PublicKey(bytes.slice(32, 64));
  } catch {
    return null;
  }
}

/** Parse amount (64:72, u64 LE) from SPL token account data. Returns null if data too short. */
function parseAmountFromTokenAccountData(data: Buffer | Uint8Array | string | number[] | undefined): bigint | null {
  const bytes = toBytes(data);
  if (!bytes || bytes.length < 72) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return view.getBigUint64(64, true);
}

/** RPC getTokenLargestAccounts(mint) – returns token account addresses with amount/decimals. Works even when Connection method is missing. */
async function getTokenLargestAccountsRpc(mint: PublicKey): Promise<Array<{ address: string; amount: string; decimals: number }>> {
  const res = await fetch(getRpcUrl(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 'tl-' + Date.now(),
      method: 'getTokenLargestAccounts',
      params: [mint.toBase58(), { commitment: 'confirmed' }],
    }),
  });
  const json = (await res.json()) as {
    result?: { value?: Array<{ address: string; amount: string; decimals: number }> } | Array<{ address: string; amount: string; decimals: number }>;
    error?: { message: string };
  };
  if (json.error) throw new Error(json.error.message);
  const result = json.result;
  if (Array.isArray(result)) return result;
  return result?.value ?? [];
}

/** RPC getTokenAccountsByOwner(owner, { mint }, { encoding: 'jsonParsed' }) – direct call so request shape is explicit (mint as base58). */
async function getTokenAccountsByOwnerRpc(
  ownerB58: string,
  mintB58: string
): Promise<Array<{ pubkey: string; account: { lamports: number; owner: string; data?: unknown } }>> {
  const res = await fetch(getRpcUrl(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 'tabo-' + Date.now(),
      method: 'getTokenAccountsByOwner',
      params: [ownerB58, { mint: mintB58 }, { encoding: 'jsonParsed', commitment: 'confirmed' }],
    }),
  });
  const json = (await res.json()) as {
    result?: { value?: Array<{ pubkey: string; account: { lamports: number; owner: string; data?: unknown } }> };
    error?: { message: string };
  };
  if (json.error) throw new Error(json.error?.message ?? 'getTokenAccountsByOwner failed');
  return json.result?.value ?? [];
}

/** Normalize RPC response: result can be { context, value } or direct array (some RPCs). */
function normalizeTokenAccountsByOwnerResponse(
  json: { result?: unknown; error?: { message: string } }
): Array<{ pubkey: string; account: { lamports: number; data: string[] | string } }> {
  if (json.error) throw new Error(json.error?.message ?? 'getTokenAccountsByOwner failed');
  const raw = json.result;
  if (!raw) return [];
  const arr = Array.isArray(raw) ? raw : (raw as { value?: unknown[] }).value;
  return Array.isArray(arr) ? arr : [];
}

/** RPC getTokenAccountsByOwner(owner, { programId }, { encoding: 'base64' }). Fallback when Connection method fails or returns empty. */
async function getTokenAccountsByOwnerProgramRpc(
  ownerB58: string,
  programIdB58: string
): Promise<Array<{ pubkey: string; account: { lamports: number; data: string[] | string } }>> {
  const res = await fetch(getRpcUrl(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 'tabop-' + Date.now(),
      method: 'getTokenAccountsByOwner',
      params: [ownerB58, { programId: programIdB58 }, { encoding: 'base64', commitment: 'confirmed' }],
    }),
  });
  const json = (await res.json()) as { result?: unknown; error?: { message: string } };
  return normalizeTokenAccountsByOwnerResponse(json);
}

/** SPL Mint account: 82 bytes. Decimals at offset 44 (u8). */
const SPL_MINT_SIZE = 82;
const SPL_MINT_DECIMALS_OFFSET = 44;

function parseDecimalsFromMintData(data: Buffer | Uint8Array | string | undefined): number | null {
  const bytes = toBytes(data);
  if (!bytes || bytes.length < SPL_MINT_DECIMALS_OFFSET + 1) return null;
  return bytes[SPL_MINT_DECIMALS_OFFSET] ?? null;
}

/** Max token balance (ui) to consider as "dust" – e.g. 0.01 tokens. */
const DUST_THRESHOLD_UI = 0.01;

/** NFT = token with decimals 0 and amount 1. Many RPCs return uiAmount: null for NFTs; use uiAmountString or amount. */
const NFT_DECIMALS = 0;
const NFT_AMOUNT_RAW = '1';

function isNftAmount(tokenAmount: { amount: string; decimals: number; uiAmount?: number | null; uiAmountString?: string } | undefined): boolean {
  if (!tokenAmount || tokenAmount.decimals !== NFT_DECIMALS) return false;
  // Many RPCs return uiAmount: null for NFTs; rely on amount + decimals first
  const raw = tokenAmount.amount;
  const amountStr = typeof raw === 'string' ? raw.trim() : String(raw);
  if (amountStr === NFT_AMOUNT_RAW || (typeof raw === 'number' && raw === 1)) return true;
  const uiStr = tokenAmount.uiAmountString?.trim();
  return (
    tokenAmount.uiAmount === 1 ||
    uiStr === '1' ||
    uiStr === '1.0' ||
    String(Number(amountStr)) === '1'
  );
}

/** Normalize mint to base58 string from various RPC shapes. */
function normalizeMint(mint: unknown): string | null {
  if (typeof mint === 'string' && mint.length > 0) return mint;
  if (mint != null && typeof (mint as { toBase58?: () => string }).toBase58 === 'function') return (mint as { toBase58: () => string }).toBase58();
  return null;
}

/** RPC can return data.parsed.info, data.info, or raw base64; extract mint in all cases. */
function getParsedTokenInfo(
  account: { data: unknown }
): { mint: string; tokenAmount?: { amount: string; decimals: number; uiAmount?: number | null; uiAmountString?: string } } | null {
  const data = account.data;
  if (!data) return null;
  if (typeof data === 'string' || (Array.isArray(data) && typeof data[0] === 'string')) {
    const bytes = toBytes(data);
    if (bytes && bytes.length >= 72) {
      try {
        const mint = new PublicKey(bytes.slice(0, 32)).toBase58();
        const amount = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getBigUint64(64, true);
        return {
          mint,
          tokenAmount: amount === BigInt(1) ? { amount: '1', decimals: 0, uiAmount: 1, uiAmountString: '1' } : { amount: String(amount), decimals: 0 },
        };
      } catch {
        return null;
      }
    }
    return null;
  }
  if (typeof data !== 'object') return null;
  const d = data as Record<string, unknown>;
  // Some RPCs nest under data.data
  const top = (d.data as Record<string, unknown> | undefined) ?? d;
  const parsed = (top.parsed as Record<string, unknown> | undefined) ?? (d.parsed as Record<string, unknown> | undefined) ?? top ?? d;
  if (!parsed || typeof parsed !== 'object') return null;
  const info = (parsed.info as Record<string, unknown> | undefined) ?? parsed;
  if (!info || typeof info !== 'object') return null;
  const mint = normalizeMint(info.mint ?? (parsed as Record<string, unknown>).mint ?? d.mint);
  if (!mint) return null;
  let tokenAmount = info.tokenAmount as { amount?: string; decimals?: number; uiAmount?: number | null; uiAmountString?: string } | undefined;
  const decimals = tokenAmount?.decimals ?? (info.decimals as number | undefined);
  if (decimals === 0 && (tokenAmount == null || tokenAmount.amount == null) && (info.amount === '1' || info.amount === 1)) {
    tokenAmount = { amount: '1', decimals: 0, uiAmount: 1, uiAmountString: '1' };
  }
  return { mint, tokenAmount };
}

export async function scanWallet(walletPublicKey: PublicKey): Promise<TokenAccount[]> {
  const connection = getConnection();
  const emptyAccounts: TokenAccount[] = [];

  try {
    logger.debug('Starting wallet scan', walletPublicKey.toString());
    const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
      walletPublicKey,
      { programId: TOKEN_PROGRAM_ID }
    );

    for (const account of tokenAccounts.value) {
      const accountInfo = account.account.data.parsed.info;
      const balance = accountInfo.tokenAmount.uiAmount;

      if (balance === 0) {
        emptyAccounts.push({
          pubkey: account.pubkey,
          mint: new PublicKey(accountInfo.mint),
          balance: 0,
          rentExemptReserve: account.account.lamports,
          programId: TOKEN_PROGRAM_ID, // ⭐ Important: marquer le program ID
        });
      }
    }

    try {
      const token2022Accounts = await connection.getParsedTokenAccountsByOwner(
        walletPublicKey,
        { programId: TOKEN_2022_PROGRAM_ID }
      );

      for (const account of token2022Accounts.value) {
        const accountInfo = account.account.data.parsed.info;
        const balance = accountInfo.tokenAmount.uiAmount;

        if (balance === 0) {
          emptyAccounts.push({
            pubkey: account.pubkey,
            mint: new PublicKey(accountInfo.mint),
            balance: 0,
            rentExemptReserve: account.account.lamports,
            programId: TOKEN_2022_PROGRAM_ID, // ⭐ Important: marquer le Token-2022 program
          });
        }
      }
    } catch {
      // No Token-2022 accounts or RPC error – continue with SPL only
    }

    return emptyAccounts;
  } catch (error) {
    logger.error('Error scanning wallet:', error);
    throw new Error('Failed to scan wallet. Please try again.');
  }
}

/**
 * Lightweight estimate of reclaimable SOL: empty token accounts + dust (burn+close).
 * Does not build full lists – use for "reclaim potential" without full scan.
 * Safe to call on wallet connect; does not mutate any state.
 */
export async function getReclaimEstimate(walletPublicKey: PublicKey): Promise<ReclaimEstimate> {
  const connection = getConnection();
  let emptyCount = 0;
  let dustCount = 0;
  let nftBurnCount = 0;
  let pumpPdaCount = 0;
  let pumpSwapPdaCount = 0;
  let driftCount = 0;
  let cnftCount = 0;
  let estimatedLamports = 0;

  try {
    const splAccounts = await connection.getParsedTokenAccountsByOwner(
      walletPublicKey,
      { programId: TOKEN_PROGRAM_ID }
    );
    for (const account of splAccounts.value) {
      const info = getParsedTokenInfo(account.account);
      const tokenAmount = info?.tokenAmount;
      const uiAmount = tokenAmount?.uiAmount ?? 0;
      const lamports = account.account.lamports ?? 0;
      if (isNftAmount(tokenAmount)) {
        nftBurnCount += 1;
        estimatedLamports += lamports;
      } else if (uiAmount === 0 || uiAmount === null) {
        emptyCount += 1;
        estimatedLamports += lamports;
      } else if (uiAmount > 0 && uiAmount <= DUST_THRESHOLD_UI) {
        dustCount += 1;
        estimatedLamports += lamports;
      }
    }

    try {
      const token2022Accounts = await connection.getParsedTokenAccountsByOwner(
        walletPublicKey,
        { programId: TOKEN_2022_PROGRAM_ID }
      );
      for (const account of token2022Accounts.value) {
        const info = getParsedTokenInfo(account.account);
        const tokenAmount = info?.tokenAmount;
        const uiAmount = tokenAmount?.uiAmount ?? 0;
        const lamports = account.account.lamports ?? 0;
        if (isNftAmount(tokenAmount)) {
          nftBurnCount += 1;
          estimatedLamports += lamports;
        } else if (uiAmount === 0 || uiAmount === null) {
          emptyCount += 1;
          estimatedLamports += lamports;
        } else if (uiAmount > 0 && uiAmount <= DUST_THRESHOLD_UI) {
          dustCount += 1;
          estimatedLamports += lamports;
        }
      }
    } catch {
      // Token-2022 not critical for estimate
    }

    try {
      const coreAssets = await getCoreAssetsByOwner(walletPublicKey);
      if (coreAssets.length > 0) {
        const corePubkeys = coreAssets.map((a) => new PublicKey(a.id));
        const coreInfos = await connection.getMultipleAccountsInfo(corePubkeys, { commitment: 'confirmed' });
        for (let i = 0; i < corePubkeys.length; i++) {
          const info = coreInfos[i];
          if (info && info.lamports > 0) {
            const reclaimable = Math.max(0, info.lamports - CORE_BURN_RETAINED_LAMPORTS);
            if (reclaimable > 0) {
              nftBurnCount += 1;
              estimatedLamports += reclaimable;
            }
          }
        }
      }
    } catch {
      // Core assets not critical for estimate
    }

    try {
      const pumpPda = getPumpUserVolumeAccumulatorPda(walletPublicKey);
      const pumpInfo = await connection.getAccountInfo(pumpPda, 'confirmed');
      if (pumpInfo && pumpInfo.owner.equals(PUMP_PROGRAM_ID) && pumpInfo.lamports >= PUMP_PDA_RENT_LAMPORTS) {
        pumpPdaCount = 1;
        estimatedLamports += pumpInfo.lamports;
      }
    } catch {
      // Pump PDA not critical for estimate
    }

    try {
      const pumpSwapPda = getPumpSwapUserVolumeAccumulatorPda(walletPublicKey);
      const pumpSwapInfo = await connection.getAccountInfo(pumpSwapPda, 'confirmed');
      if (pumpSwapInfo && pumpSwapInfo.owner.equals(PUMP_SWAP_PROGRAM_ID) && pumpSwapInfo.lamports >= PUMP_SWAP_PDA_RENT_LAMPORTS) {
        pumpSwapPdaCount = 1;
        estimatedLamports += pumpSwapInfo.lamports;
      }
    } catch {
      // PumpSwap PDA not critical for estimate
    }

    try {
      const { scanDriftUserAccounts } = await import('./drift');
      const driftAccounts = await scanDriftUserAccounts(walletPublicKey);
      driftCount = driftAccounts.length;
      for (const a of driftAccounts) estimatedLamports += a.lamports;
    } catch {
      // Drift not critical for estimate
    }

    try {
      const cnftList = await getCompressedNftsByOwner(walletPublicKey);
      cnftCount = cnftList.length;
      // cNFTs recover 0 SOL (rent in shared tree)
    } catch {
      // cNFT count not critical for estimate
    }

    return {
      emptyCount,
      dustCount,
      nftBurnCount,
      pumpPdaCount,
      pumpSwapPdaCount,
      driftCount,
      cnftCount,
      estimatedLamports,
      estimatedSol: estimatedLamports / 1e9,
    };
  } catch (error) {
    logger.error('getReclaimEstimate error:', error);
    return { emptyCount: 0, dustCount: 0, nftBurnCount: 0, pumpPdaCount: 0, pumpSwapPdaCount: 0, driftCount: 0, cnftCount: 0, estimatedLamports: 0, estimatedSol: 0 };
  }
}

/**
 * Scan for token accounts with small balance (dust): 0 < balance <= DUST_THRESHOLD_UI.
 * Used for "burn + close" to reclaim rent. SPL and Token-2022.
 */
export async function scanDustAccounts(walletPublicKey: PublicKey): Promise<DustAccount[]> {
  const connection = getConnection();
  const dustAccounts: DustAccount[] = [];

  try {
    const [splAccounts, token2022Accounts] = await Promise.all([
      connection.getParsedTokenAccountsByOwner(walletPublicKey, { programId: TOKEN_PROGRAM_ID }),
      connection.getParsedTokenAccountsByOwner(walletPublicKey, { programId: TOKEN_2022_PROGRAM_ID }).catch(() => ({ value: [] })),
    ]);

    const processParsed = (
      list: Array<{ account: { data: unknown; lamports?: number }; pubkey: PublicKey }>,
      programId: PublicKey
    ) => {
      for (const account of list) {
        const info = getParsedTokenInfo(account.account);
        const tokenAmount = info?.tokenAmount;
        if (!tokenAmount || !info?.mint) continue;
        const uiAmount = tokenAmount.uiAmount ?? 0;
        if (uiAmount <= 0 || uiAmount > DUST_THRESHOLD_UI) continue;
        const amountRaw = String(tokenAmount.amount ?? '0');
        const decimals = tokenAmount.decimals ?? 6;
        dustAccounts.push({
          pubkey: account.pubkey as PublicKey,
          mint: new PublicKey(info.mint),
          balanceUi: uiAmount,
          balanceRaw: BigInt(amountRaw),
          decimals,
          rentExemptReserve: account.account.lamports ?? 0,
          programId,
        });
      }
    };

    processParsed(splAccounts.value as Array<{ account: { data: unknown; lamports?: number }; pubkey: PublicKey }>, TOKEN_PROGRAM_ID);
    if (Array.isArray(token2022Accounts?.value)) processParsed(token2022Accounts.value as Array<{ account: { data: unknown; lamports?: number }; pubkey: PublicKey }>, TOKEN_2022_PROGRAM_ID);

    logger.debug('Total dust accounts found:', dustAccounts.length);
    return dustAccounts;
  } catch (error) {
    logger.error('scanDustAccounts error:', error);
    throw new Error('Failed to scan for dust. Please try again.');
  }
}

/**
 * Scan for NFT token accounts (balance 1, decimals 0). Burning them closes the token account and returns rent to the owner.
 * SPL and Token-2022. Does not close Metadata/Edition (would require Metaplex program).
 *
 * Official path: Connection.getTokenAccountsByOwner(owner, { programId }) — SDK uses encoding base64 and decodes to Buffer.
 * Fallback: raw RPC getTokenAccountsByOwner(programId) if SDK fails or returns empty (e.g. RPC response shape).
 * 1) Parse mint (0:32), owner (32:64), amount (64:72); keep only owner === wallet and amount === 1.
 * 2) Batch fetch mint accounts; parse decimals at offset 44; keep only decimals === 0 (NFT).
 */
export async function scanNftBurnAccounts(walletPublicKey: PublicKey): Promise<NftBurnAccount[]> {
  const connection = getConnection();
  const walletB58 = walletPublicKey.toBase58();

  type Candidate = { pubkey: string; mint: PublicKey; lamports: number; programId: PublicKey };

  function addCandidatesFromBytes(
    candidates: Candidate[],
    list: Array<{ pubkey: string | PublicKey; account: { lamports: number; data: unknown } }>,
    programId: PublicKey
  ) {
    for (const item of list) {
      const lamports = Number(item.account.lamports ?? 0);
      if (lamports <= 0) continue;
      const data = item.account.data;
      const raw = Array.isArray(data) && typeof data[0] === 'string' ? data[0] : data;
      const bytes = toBytes(raw);
      if (!bytes || bytes.length < 72) continue;
      const owner = parseOwnerFromTokenAccountData(bytes);
      if (!owner || owner.toBase58() !== walletB58) continue;
      const amount = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getBigUint64(64, true);
      if (amount !== BigInt(1)) continue; // NFT = balance 1 (raw); fungible tokens excluded
      const mint = parseMintFromTokenAccountData(bytes);
      if (!mint) continue;
      candidates.push({
        pubkey: typeof item.pubkey === 'string' ? item.pubkey : item.pubkey.toBase58(),
        mint,
        lamports,
        programId,
      });
    }
  }

  const candidates: Candidate[] = [];

  try {
    // 1) Official SDK path: Connection.getTokenAccountsByOwner(owner, { programId }) — base64 decoded to Buffer
    try {
      const [splRes, token2022Res] = await Promise.all([
        connection.getTokenAccountsByOwner(walletPublicKey, { programId: TOKEN_PROGRAM_ID }),
        connection.getTokenAccountsByOwner(walletPublicKey, { programId: TOKEN_2022_PROGRAM_ID }).catch(() => ({ value: [] })),
      ]);
      const splList = splRes?.value ?? [];
      const t22List = Array.isArray(token2022Res?.value) ? token2022Res.value : [];
      logger.debug('[NFT scan] Step 1 (SDK): SPL accounts=', splList.length, ', Token2022=', t22List.length);
      addCandidatesFromBytes(
        candidates,
        splList as Array<{ pubkey: PublicKey; account: { lamports: number; data: unknown } }>,
        TOKEN_PROGRAM_ID
      );
      addCandidatesFromBytes(
        candidates,
        t22List as Array<{ pubkey: PublicKey; account: { lamports: number; data: unknown } }>,
        TOKEN_2022_PROGRAM_ID
      );
      logger.debug('[NFT scan] Step 1: candidates after parse=', candidates.length);
    } catch (sdkErr) {
      logger.debug('NFT scan: Connection.getTokenAccountsByOwner failed, trying raw RPC', (sdkErr as Error)?.message ?? sdkErr);
    }

    // 2) Fallback: raw RPC getTokenAccountsByOwner(programId) base64
    if (candidates.length === 0) {
      const [splList, token2022List] = await Promise.all([
        getTokenAccountsByOwnerProgramRpc(walletB58, TOKEN_PROGRAM_ID.toBase58()),
        getTokenAccountsByOwnerProgramRpc(walletB58, TOKEN_2022_PROGRAM_ID.toBase58()).catch(() => []),
      ]);
      logger.debug('[NFT scan] Step 2 (raw RPC): SPL accounts=', splList.length, ', Token2022=', token2022List.length);
      addCandidatesFromBytes(
        candidates,
        splList as Array<{ pubkey: string; account: { lamports: number; data: unknown } }>,
        TOKEN_PROGRAM_ID
      );
      addCandidatesFromBytes(
        candidates,
        token2022List as Array<{ pubkey: string; account: { lamports: number; data: unknown } }>,
        TOKEN_2022_PROGRAM_ID
      );
      logger.debug('[NFT scan] Step 2: candidates after parse=', candidates.length);
    }

    // 3) Fallback: getParsedTokenAccountsByOwner (same as getReclaimEstimate) then confirm decimals via mint accounts
    if (candidates.length === 0) {
      try {
        const [parsedSpl, parsedT22] = await Promise.all([
          connection.getParsedTokenAccountsByOwner(walletPublicKey, { programId: TOKEN_PROGRAM_ID }),
          connection.getParsedTokenAccountsByOwner(walletPublicKey, { programId: TOKEN_2022_PROGRAM_ID }).catch(() => ({ value: [] })),
        ]);
        const parsedSplLen = parsedSpl?.value?.length ?? 0;
        const parsedT22Len = parsedT22?.value?.length ?? 0;
        logger.debug('[NFT scan] Step 3 (parsed): SPL accounts=', parsedSplLen, ', Token2022=', parsedT22Len);
        const processParsed = (
          list: Array<{ pubkey: PublicKey; account: { data: unknown; lamports?: number } }>,
          programId: PublicKey
        ) => {
          for (const account of list) {
            const info = getParsedTokenInfo(account.account);
            if (!info?.mint || !isNftAmount(info.tokenAmount)) continue;
            const lamports = Number(account.account.lamports ?? 0);
            if (lamports <= 0) continue;
            candidates.push({
              pubkey: account.pubkey.toBase58(),
              mint: new PublicKey(info.mint),
              lamports,
              programId,
            });
          }
        };
        processParsed(parsedSpl.value as Array<{ pubkey: PublicKey; account: { data: unknown; lamports?: number } }>, TOKEN_PROGRAM_ID);
        if (Array.isArray(parsedT22?.value)) processParsed(parsedT22.value as Array<{ pubkey: PublicKey; account: { data: unknown; lamports?: number } }>, TOKEN_2022_PROGRAM_ID);
        logger.debug('[NFT scan] Step 3: candidates after parse=', candidates.length);
      } catch (parsedErr) {
        logger.debug('NFT scan: parsed fallback failed', (parsedErr as Error)?.message ?? parsedErr);
      }
    }

    const out: NftBurnAccount[] = [];
    if (candidates.length > 0) {
      logger.debug('[NFT scan] Candidates before mint check=', candidates.length, ', unique mints=', new Set(candidates.map((c) => c.mint.toBase58())).size);
      const uniqueMints = [...new Set(candidates.map((c) => c.mint.toBase58()))].map((b58) => new PublicKey(b58));
      const mintInfos = await connection.getMultipleAccountsInfo(uniqueMints, { commitment: 'confirmed' });
      const mintDecimals = new Map<string, number>();
      for (let i = 0; i < uniqueMints.length; i++) {
        const info = mintInfos[i];
        const mintB58 = uniqueMints[i].toBase58();
        const decimals = info?.data != null ? parseDecimalsFromMintData(info.data) : null;
        if (decimals !== null) mintDecimals.set(mintB58, decimals);
        logger.debug('[NFT scan] Mint', mintB58.slice(0, 8) + '...', 'decimals=', decimals, 'mintAccountExists=', !!info);
      }
      for (const c of candidates) {
        const decimals = mintDecimals.get(c.mint.toBase58());
        if (decimals !== 0) continue;
        out.push({
          pubkey: new PublicKey(c.pubkey),
          mint: c.mint,
          rentExemptReserve: c.lamports,
          programId: c.programId,
        });
      }
      logger.debug('[NFT scan] After decimals===0 filter: out.length=', out.length);
    }

    // Metaplex Core assets (e.g. Honeyland Generations) – DAS MplCoreAsset; burn requires Mpl Core instruction (not SPL)
    try {
      const coreAssets = await getCoreAssetsByOwner(walletPublicKey);
      if (coreAssets.length > 0) {
        const corePubkeys = coreAssets.map((a) => new PublicKey(a.id));
        const coreInfos = await connection.getMultipleAccountsInfo(corePubkeys, { commitment: 'confirmed' });
        for (let i = 0; i < corePubkeys.length; i++) {
          const info = coreInfos[i];
          if (info && info.lamports > 0) {
            const reclaimable = Math.max(0, info.lamports - CORE_BURN_RETAINED_LAMPORTS);
            if (reclaimable <= 0) continue;
            out.push({
              pubkey: corePubkeys[i],
              mint: corePubkeys[i],
              rentExemptReserve: reclaimable,
              programId: MPL_CORE_PROGRAM_ID,
            });
          }
        }
        logger.debug('[NFT scan] Metaplex Core assets added:', coreInfos?.filter(Boolean).length ?? 0);
      }
    } catch (coreErr) {
      logger.debug('NFT scan: getCoreAssetsByOwner failed (non-fatal)', (coreErr as Error)?.message ?? coreErr);
    }

    if (out.length === 0) {
      logger.debug(
        '[NFT scan] No burnable NFTs (SPL/Token-2022/Core). Total NFT burn accounts found: 0'
      );
    }
    logger.debug('Total NFT burn accounts found:', out.length);
    return out;
  } catch (error) {
    logger.error('scanNftBurnAccounts error:', error);
    throw new Error('Failed to scan for NFTs. Please try again.');
  }
}
