import { NextRequest, NextResponse } from 'next/server';
import { PublicKey } from '@solana/web3.js';
import { supabase } from '@/lib/supabase/client';
import { getClassicNftMintsByOwner } from '@/lib/solana/das';
import { getCreatorNftsForWallet } from '@/lib/nftCreator';
import type { NftCreatorSubmissionStatus } from '@/types/nftCreator';

export const dynamic = 'force-dynamic';

/** Build proxy RPC options from request so DAS/RPC work when route runs on server (avoids 401). */
function dasOptionsFromRequest(request: NextRequest): { rpcUrl: string; fetch: (url: string, init?: RequestInit) => Promise<Response> } | undefined {
  const origin = request.headers.get('origin')?.trim();
  const referer = request.headers.get('referer')?.trim();
  const baseUrl = origin || (referer ? (() => { try { return new URL(referer).origin; } catch { return ''; } })() : '');
  if (!baseUrl) return undefined;
  const rpcUrl = `${baseUrl.replace(/\/$/, '')}/api/rpc`;
  const customFetch: (url: string, init?: RequestInit) => Promise<Response> = (url, init) =>
    fetch(url, { ...init, headers: { ...(init?.headers as Record<string, string>), ...(origin && { Origin: origin }), ...(referer && { Referer: referer }) } });
  return { rpcUrl, fetch: customFetch };
}

/**
 * GET /api/nft-creator/submissions?wallet=<address>
 * Returns submissions for the given wallet (creator) plus Creator NFTs they hold but did not create (e.g. received by transfer).
 * For finalized submissions with mint_address, adds inWallet: true/false by checking on-chain ownership (DAS).
 */
export async function GET(request: NextRequest) {
  const wallet = request.nextUrl.searchParams.get('wallet');
  if (!wallet || typeof wallet !== 'string' || wallet.length < 32) {
    return NextResponse.json({ error: 'Missing or invalid wallet' }, { status: 400 });
  }

  const dasOpts = dasOptionsFromRequest(request);

  try {
    const { data, error } = await supabase
      .from('nft_creator_submissions')
      .select('*')
      .eq('wallet_address', wallet)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[nft-creator/submissions]', error);
      return NextResponse.json({ error: 'Failed to fetch submissions' }, { status: 500 });
    }

    const rows = (data ?? []) as Record<string, unknown>[];
    const hasFinalizedWithMint = rows.some(
      (r) => r.status === 'finalized' && typeof r.mint_address === 'string' && r.mint_address.trim()
    );

    let heldMints = new Set<string>();
    if (hasFinalizedWithMint) {
      try {
        const nfts = await getClassicNftMintsByOwner(new PublicKey(wallet), dasOpts);
        heldMints = new Set(nfts.map((n) => n.mint).filter(Boolean));
      } catch (dasErr) {
        console.warn('[nft-creator/submissions] DAS check failed, inWallet may be wrong:', dasErr);
      }
    }

    const list = rows.map((row) => {
      const status = row.status as NftCreatorSubmissionStatus;
      const mintAddress = typeof row.mint_address === 'string' ? row.mint_address.trim() : null;
      const inWallet =
        status !== 'finalized' || !mintAddress ? true : heldMints.has(mintAddress);

      return {
        id: row.id,
        wallet_address: row.wallet_address,
        image_uri: row.image_uri,
        metadata_uri: row.metadata_uri,
        name: row.name,
        description: row.description,
        attributes: row.attributes,
        status,
        tier: row.tier,
        rejection_reason: row.rejection_reason,
        approved_at: row.approved_at,
        expires_at: row.expires_at,
        mint_address: row.mint_address,
        created_at: row.created_at,
        updated_at: row.updated_at,
        in_wallet: inWallet,
        received: false,
      };
    });

    const submissionMintSet = new Set(
      list
        .filter((r) => r.mint_address)
        .map((r) => (r.mint_address as string).trim())
    );

    let heldOnly: Array<{
      id: string;
      wallet_address: string;
      image_uri: unknown;
      metadata_uri: unknown;
      name: string;
      description: string;
      attributes: unknown;
      status: NftCreatorSubmissionStatus;
      tier: string | null;
      rejection_reason: null;
      approved_at: string | null;
      expires_at: null;
      mint_address: string;
      created_at: string;
      updated_at: string;
      in_wallet: boolean;
      received: boolean;
    }> = [];

    try {
      const creatorNfts = await getCreatorNftsForWallet(wallet, dasOpts);
      const heldOnlyMints = creatorNfts
        .filter((n) => !submissionMintSet.has(n.mint))
        .map((n) => n.mint);
      if (heldOnlyMints.length > 0) {
        const { data: heldRows } = await supabase
          .from('nft_creator_submissions')
          .select('id, image_uri, metadata_uri, name, description, attributes, tier, mint_address, created_at, updated_at')
          .in('mint_address', heldOnlyMints)
          .eq('status', 'finalized');
        const byMint = new Map(
          (heldRows ?? []).map((r) => [(r as { mint_address: string }).mint_address?.trim(), r as Record<string, unknown>])
        );
        for (const n of creatorNfts) {
          if (submissionMintSet.has(n.mint)) continue;
          const row = byMint.get(n.mint);
          heldOnly.push({
            id: `held:${n.mint}`,
            wallet_address: wallet,
            image_uri: row?.image_uri ?? null,
            metadata_uri: row?.metadata_uri ?? null,
            name: (row?.name as string) ?? n.name,
            description: (row?.description as string) ?? '',
            attributes: row?.attributes ?? null,
            status: 'finalized',
            tier: n.tier,
            rejection_reason: null,
            approved_at: null,
            expires_at: null,
            mint_address: n.mint,
            created_at: (row?.created_at as string) ?? new Date().toISOString(),
            updated_at: (row?.updated_at as string) ?? new Date().toISOString(),
            in_wallet: true,
            received: true,
          });
        }
      }
    } catch (heldErr) {
      console.warn('[nft-creator/submissions] held Creator NFTs fetch failed:', heldErr);
    }

    const combined = [...list, ...heldOnly].sort((a, b) => {
      const aTime = new Date(a.created_at).getTime();
      const bTime = new Date(b.created_at).getTime();
      return bTime - aTime;
    });

    return NextResponse.json({ submissions: combined });
  } catch (error) {
    console.error('[nft-creator/submissions]', error);
    return NextResponse.json({ error: 'Failed to fetch submissions' }, { status: 500 });
  }
}
