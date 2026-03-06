import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/server';
import type { NftCreatorTier } from '@/types/nftCreator';
import { NFT_CREATOR_FINALIZE_DAYS } from '@/types/nftCreator';

export const dynamic = 'force-dynamic';

function checkAdmin(request: NextRequest): boolean {
  const secret = request.headers.get('x-admin-secret') ?? request.nextUrl.searchParams.get('adminSecret');
  const expected = process.env.NFT_CREATOR_ADMIN_SECRET || process.env.F1_ADMIN_SECRET;
  return !!expected && secret === expected;
}

/**
 * POST /api/nft-creator/admin/review
 * Body: { submissionId, action: 'approve' | 'reject', tier?: 'standard'|'silver'|'gold'|'platinum', rejectionReason?: string }
 * Approve: set status=approved, tier, approved_at, expires_at (now + 7 days).
 * Reject: set status=rejected, rejection_reason.
 */
export async function POST(request: NextRequest) {
  if (!checkAdmin(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const admin = getSupabaseAdmin();
  if (!admin) {
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
  }

  let body: { submissionId?: string; action?: string; tier?: string; rejectionReason?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { submissionId, action, tier, rejectionReason } = body;
  if (!submissionId || !action) {
    return NextResponse.json({ error: 'submissionId and action are required' }, { status: 400 });
  }

  if (action === 'approve') {
    const validTiers: NftCreatorTier[] = ['standard', 'silver', 'gold', 'platinum'];
    const tierVal = (tier && validTiers.includes(tier as NftCreatorTier)) ? (tier as NftCreatorTier) : 'standard';
    const now = new Date();
    const expiresAt = new Date(now.getTime() + NFT_CREATOR_FINALIZE_DAYS * 24 * 60 * 60 * 1000);

    const { error: updateError } = await admin
      .from('nft_creator_submissions')
      .update({
        status: 'approved',
        tier: tierVal,
        approved_at: now.toISOString(),
        expires_at: expiresAt.toISOString(),
        rejection_reason: null,
        updated_at: now.toISOString(),
      })
      .eq('id', submissionId)
      .eq('status', 'pending');

    if (updateError) {
      console.error('[nft-creator/admin/review] approve', updateError);
      return NextResponse.json({ error: 'Failed to approve' }, { status: 500 });
    }
    return NextResponse.json({ ok: true, status: 'approved', tier: tierVal });
  }

  if (action === 'reject') {
    const { error: updateError } = await admin
      .from('nft_creator_submissions')
      .update({
        status: 'rejected',
        rejection_reason: rejectionReason ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', submissionId)
      .eq('status', 'pending');

    if (updateError) {
      console.error('[nft-creator/admin/review] reject', updateError);
      return NextResponse.json({ error: 'Failed to reject' }, { status: 500 });
    }
    return NextResponse.json({ ok: true, status: 'rejected' });
  }

  return NextResponse.json({ error: 'action must be approve or reject' }, { status: 400 });
}
