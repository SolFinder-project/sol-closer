/**
 * GET /api/nft-creator/wallet-benefits?wallet=<address>
 *
 * Returns SolPit Creator NFTs held by the wallet with name and tier.
 * Used by F1 page and reclaim UI to show concrete benefits (points bonus, race time bonus).
 * Uses request Origin/Referer to call DAS via the app's RPC proxy so Helius Allowed Domains accept the request.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCreatorNftsForWallet } from '@/lib/nftCreator';
import { isValidSolanaAddress } from '@/lib/solana/validators';

/** Build proxy RPC options from request so DAS works when route runs on server (avoids 401 / Allowed Domains). */
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

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const wallet = searchParams.get('wallet')?.trim();
  if (!wallet || !isValidSolanaAddress(wallet)) {
    return NextResponse.json(
      { error: 'Missing or invalid query parameter: wallet (Solana address)' },
      { status: 400 }
    );
  }

  const dasOpts = dasOptionsFromRequest(request);

  try {
    const nfts = await getCreatorNftsForWallet(wallet, dasOpts);
    return NextResponse.json({ nfts });
  } catch (e) {
    console.error('[nft-creator/wallet-benefits]', e);
    // Non-blocking: return empty list so UI (F1 banner, reclaim) still works; RPC/DAS failure must not break the page
    return NextResponse.json({ nfts: [] });
  }
}
