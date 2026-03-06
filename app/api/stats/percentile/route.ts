import { NextRequest, NextResponse } from 'next/server';
import { getReclaimPercentile } from '@/lib/supabase/transactions';

export const dynamic = 'force-dynamic';

/**
 * GET /api/stats/percentile?wallet=<address>
 * Returns percentile (0-100) for "Cleaner than X% of users". Safe for client call.
 */
export async function GET(request: NextRequest) {
  const wallet = request.nextUrl.searchParams.get('wallet');
  if (!wallet || typeof wallet !== 'string' || wallet.length < 32) {
    return NextResponse.json({ error: 'Missing or invalid wallet' }, { status: 400 });
  }

  try {
    const percentile = await getReclaimPercentile(wallet);
    if (percentile === null) {
      return NextResponse.json({ percentile: null });
    }
    return NextResponse.json({ percentile });
  } catch (error) {
    console.error('Percentile API error:', error);
    return NextResponse.json({ error: 'Failed to compute percentile' }, { status: 500 });
  }
}
