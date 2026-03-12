import { NextRequest, NextResponse } from 'next/server';
import { hasCreatorNft } from '@/lib/nftCreator';

export const dynamic = 'force-dynamic';

/** Build proxy RPC options from request so DAS works when route runs on server (avoids 401). */
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
 * GET /api/nft-creator/badge?wallet=<address>
 * Returns { hasCreator: boolean } for badge display (profile, leaderboard).
 */
export async function GET(request: NextRequest) {
  const wallet = request.nextUrl.searchParams.get('wallet');
  if (!wallet || typeof wallet !== 'string' || wallet.length < 32) {
    return NextResponse.json({ error: 'Missing or invalid wallet' }, { status: 400 });
  }

  const dasOpts = dasOptionsFromRequest(request);

  try {
    const hasCreator = await hasCreatorNft(wallet, dasOpts);
    return NextResponse.json({ hasCreator });
  } catch (error) {
    console.error('[nft-creator/badge]', error);
    return NextResponse.json({ hasCreator: false });
  }
}
