/**
 * POST /api/nft-creator/add-to-collection
 * Body: { mint: string, wallet: string }
 *
 * Builds a setAndVerifyCollection transaction so an existing Creator NFT (minted without
 * collection due to fallback) can be added to the SolPit Creator collection.
 * Server signs with collection authority; client must sign as payer and send.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getConnectionForRequest } from '@/lib/solana/connection';
import { buildAddToCollectionTransaction } from '@/lib/nftCreator/buildMintTransaction';
import { isValidSolanaAddress } from '@/lib/solana/validators';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { mint, wallet } = body as { mint?: string; wallet?: string };

    if (!mint || !wallet || typeof mint !== 'string' || typeof wallet !== 'string') {
      return NextResponse.json(
        { error: 'Body must include mint and wallet (Solana addresses).' },
        { status: 400 }
      );
    }
    if (!isValidSolanaAddress(mint) || !isValidSolanaAddress(wallet)) {
      return NextResponse.json({ error: 'Invalid mint or wallet address.' }, { status: 400 });
    }

    const connection = getConnectionForRequest(request);
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
    const { serializedTransaction } = await buildAddToCollectionTransaction(mint.trim(), wallet.trim(), {
      blockhash,
      lastValidBlockHeight,
    });
    return NextResponse.json({ transaction: serializedTransaction });
  } catch (error) {
    console.error('[nft-creator/add-to-collection]', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to build add-to-collection transaction' },
      { status: 500 }
    );
  }
}
