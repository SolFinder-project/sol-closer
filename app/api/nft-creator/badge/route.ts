import { NextRequest, NextResponse } from 'next/server';
import { hasCreatorNft } from '@/lib/nftCreator';
import { dasOptionsFromRequest } from '@/lib/api/dasOptionsFromRequest';

export const dynamic = 'force-dynamic';

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
