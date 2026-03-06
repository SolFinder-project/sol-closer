import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/server';
import { getLastReclaim, isReclaimAlreadyUsed } from '@/lib/nftCreator';
import { NFT_CREATOR_MIN_RECLAIM_SOL } from '@/types/nftCreator';

export const dynamic = 'force-dynamic';

/**
 * POST /api/nft-creator/confirm-finalize
 * Body: { submissionId: string, wallet: string, signature: string, mintAddress: string }
 * After client has signed and sent the mint tx, call this to mark submission as finalized and register mint in nft_creator_tiers.
 * Consumes the wallet's current last reclaim (one reclaim = one NFT); rejects if that reclaim was already used.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { submissionId, wallet, signature, mintAddress } = body as {
      submissionId?: string;
      wallet?: string;
      signature?: string;
      mintAddress?: string;
    };

    if (!submissionId || !wallet || !signature || !mintAddress) {
      return NextResponse.json(
        { error: 'submissionId, wallet, signature, and mintAddress required' },
        { status: 400 }
      );
    }

    const admin = getSupabaseAdmin();
    if (!admin) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    const lastReclaim = await getLastReclaim(wallet, admin);
    if (!lastReclaim || lastReclaim.net_received < NFT_CREATOR_MIN_RECLAIM_SOL) {
      return NextResponse.json(
        { error: `No eligible reclaim (≥ ${NFT_CREATOR_MIN_RECLAIM_SOL} SOL net). Do a new reclaim to create an NFT.` },
        { status: 400 }
      );
    }
    if (await isReclaimAlreadyUsed(wallet, lastReclaim.signature, admin)) {
      return NextResponse.json(
        { error: 'This reclaim was already used for another NFT. Do a new reclaim to create another.' },
        { status: 400 }
      );
    }

    const { data: row, error: fetchErr } = await admin
      .from('nft_creator_submissions')
      .select('id, tier')
      .eq('id', submissionId)
      .eq('wallet_address', wallet)
      .eq('status', 'approved')
      .maybeSingle();

    if (fetchErr || !row) {
      return NextResponse.json({ error: 'Submission not found or not approved' }, { status: 404 });
    }

    const tier = (row.tier as string) || 'standard';
    const validTiers = ['standard', 'silver', 'gold', 'platinum'];
    if (!validTiers.includes(tier)) {
      return NextResponse.json({ error: 'Invalid tier' }, { status: 400 });
    }

    const { error: updateErr } = await admin
      .from('nft_creator_submissions')
      .update({
        status: 'finalized',
        mint_address: mintAddress,
        reclaim_signature: lastReclaim.signature,
        updated_at: new Date().toISOString(),
      })
      .eq('id', submissionId)
      .eq('wallet_address', wallet);

    if (updateErr) {
      console.error('[nft-creator/confirm-finalize] update', updateErr);
      return NextResponse.json({ error: 'Failed to update submission' }, { status: 500 });
    }

    const { error: tierErr } = await admin.from('nft_creator_tiers').upsert(
      {
        mint_address: mintAddress,
        tier,
        created_at: new Date().toISOString(),
      },
      { onConflict: 'mint_address' }
    );

    if (tierErr) {
      console.error('[nft-creator/confirm-finalize] tier insert', tierErr);
      // submission already finalized; tier might already exist
    }

    return NextResponse.json({
      ok: true,
      status: 'finalized',
      mintAddress,
      signature,
    });
  } catch (error) {
    console.error('[nft-creator/confirm-finalize]', error);
    return NextResponse.json({ error: 'Failed to confirm' }, { status: 500 });
  }
}
