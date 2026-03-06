import { NextRequest, NextResponse } from 'next/server';
import { getEligibility } from '@/lib/nftCreator';
import { getSupabaseAdmin } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/nft-creator/eligibility?wallet=<address>
 * Returns last reclaim net (SOL), canCreateNft (>= min threshold and reclaim not yet used for a finalized NFT), and ceiling.
 */
export async function GET(request: NextRequest) {
  const wallet = request.nextUrl.searchParams.get('wallet');
  if (!wallet || typeof wallet !== 'string' || wallet.length < 32) {
    return NextResponse.json({ error: 'Missing or invalid wallet' }, { status: 400 });
  }

  try {
    const admin = getSupabaseAdmin();
    const result = await getEligibility(wallet, admin ?? undefined);
    return NextResponse.json(result);
  } catch (error) {
    console.error('[nft-creator/eligibility]', error);
    return NextResponse.json({ error: 'Failed to get eligibility' }, { status: 500 });
  }
}
