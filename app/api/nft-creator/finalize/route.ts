import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/server';
import { buildMintTransaction } from '@/lib/nftCreator/buildMintTransaction';
import { getEligibility } from '@/lib/nftCreator';
import { NFT_CREATOR_MIN_RECLAIM_SOL } from '@/types/nftCreator';

export const dynamic = 'force-dynamic';

const FEE_RECIPIENT_ENV = 'NEXT_PUBLIC_FEE_RECIPIENT_WALLET';

/**
 * POST /api/nft-creator/finalize
 * Body: { submissionId: string, wallet: string }
 * Returns { transaction: base64, mintAddress } for client to sign and send. Submission must be approved and not expired.
 * Requires an eligible reclaim (≥ min SOL) not yet used for another finalized NFT.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { submissionId, wallet } = body as { submissionId?: string; wallet?: string };

    if (!submissionId || !wallet || typeof wallet !== 'string' || wallet.length < 32) {
      return NextResponse.json({ error: 'submissionId and wallet required' }, { status: 400 });
    }

    const feeRecipient = process.env[FEE_RECIPIENT_ENV]?.trim();
    if (!feeRecipient) {
      return NextResponse.json({ error: 'Fee recipient not configured' }, { status: 500 });
    }

    const admin = getSupabaseAdmin();
    if (!admin) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    const eligibility = await getEligibility(wallet, admin);
    if (!eligibility.canCreateNft) {
      return NextResponse.json(
        {
          error:
            eligibility.lastNetSol < NFT_CREATOR_MIN_RECLAIM_SOL
              ? `No eligible reclaim (≥ ${NFT_CREATOR_MIN_RECLAIM_SOL} SOL net). Do a new reclaim first.`
              : 'This reclaim was already used for another NFT. Do a new reclaim to create another.',
        },
        { status: 400 }
      );
    }

    const { data: row, error: fetchErr } = await admin
      .from('nft_creator_submissions')
      .select('*')
      .eq('id', submissionId)
      .eq('wallet_address', wallet)
      .eq('status', 'approved')
      .maybeSingle();

    if (fetchErr || !row) {
      return NextResponse.json({ error: 'Submission not found or not approved' }, { status: 404 });
    }

    const expiresAt = row.expires_at ? new Date(row.expires_at).getTime() : null;
    if (expiresAt != null && Date.now() > expiresAt) {
      await admin
        .from('nft_creator_submissions')
        .update({ status: 'expired', updated_at: new Date().toISOString() })
        .eq('id', submissionId);
      return NextResponse.json({ error: 'Submission has expired' }, { status: 400 });
    }

    const metadataUri = (row.metadata_uri as string) || (row.image_uri as string) || '';
    if (!metadataUri) {
      return NextResponse.json({ error: 'Missing metadata URI' }, { status: 400 });
    }

    const { serializedTransaction, mintAddress, collectionIncludedInMintTx } = await buildMintTransaction({
      userWallet: wallet,
      name: String(row.name || 'SolPit Creator').slice(0, 32),
      metadataUri,
      feeRecipient,
    });

    return NextResponse.json({
      transaction: serializedTransaction,
      mintAddress,
      submissionId,
      collectionIncludedInMintTx: collectionIncludedInMintTx === true,
    });
  } catch (error) {
    console.error('[nft-creator/finalize]', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to build transaction' },
      { status: 500 }
    );
  }
}
