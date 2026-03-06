import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

function checkAdmin(request: NextRequest): boolean {
  const secret = request.headers.get('x-admin-secret') ?? request.nextUrl.searchParams.get('adminSecret');
  const expected = process.env.NFT_CREATOR_ADMIN_SECRET || process.env.F1_ADMIN_SECRET;
  return !!expected && secret === expected;
}

/**
 * GET /api/nft-creator/admin/pending
 * Returns all submissions with status = 'pending'. Requires x-admin-secret header or ?adminSecret=.
 */
export async function GET(request: NextRequest) {
  if (!checkAdmin(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const admin = getSupabaseAdmin();
  if (!admin) {
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
  }

  const { data, error } = await admin
    .from('nft_creator_submissions')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: true });

  if (error) {
    console.error('[nft-creator/admin/pending]', error);
    return NextResponse.json({ error: 'Failed to fetch pending' }, { status: 500 });
  }

  return NextResponse.json({ submissions: data ?? [] });
}
