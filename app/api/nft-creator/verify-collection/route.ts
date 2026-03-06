/**
 * GET /api/nft-creator/verify-collection?mint=<mint_address>
 *
 * Returns whether the given NFT mint is in the configured SolPit Creator collection.
 * Priority is given to on-chain Metaplex metadata (no indexing lag); DAS grouping is used
 * as a fallback / secondary signal.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCoreAssetCollection } from '@/lib/solana/das';
import { isValidSolanaAddress } from '@/lib/solana/validators';
import { getRpcUrl } from '@/lib/solana/connection';
import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import { mplTokenMetadata, findMetadataPda, safeFetchMetadataFromSeeds } from '@metaplex-foundation/mpl-token-metadata';
import { publicKey } from '@metaplex-foundation/umi-public-keys';

const EXPECTED_COLLECTION_MINT = process.env.NFT_CREATOR_COLLECTION_MINT?.trim() ?? '';

async function getOnChainCollectionMint(mint: string): Promise<{ collectionMint: string | null; verified: boolean }> {
  try {
    const rpcUrl = getRpcUrl();
    const umi = createUmi(rpcUrl).use(mplTokenMetadata());
    const mintPk = publicKey(mint);
    // safeFetchMetadataFromSeeds already derives the metadata PDA internally; no need to use findMetadataPda here.
    const metadata = await safeFetchMetadataFromSeeds(umi, { mint: mintPk });
    if (!metadata || !metadata.collection) {
      return { collectionMint: null, verified: false };
    }
    const key = metadata.collection.key.toString();
    if (!isValidSolanaAddress(key)) {
      return { collectionMint: null, verified: false };
    }
    return { collectionMint: key, verified: metadata.collection.verified === true };
  } catch {
    return { collectionMint: null, verified: false };
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const mint = searchParams.get('mint')?.trim();
  if (!mint || !isValidSolanaAddress(mint)) {
    return NextResponse.json(
      { error: 'Missing or invalid query parameter: mint (Solana address)' },
      { status: 400 }
    );
  }

  // 1) Source of truth: on-chain Token Metadata.
  const { collectionMint: onChainCollectionMint, verified } = await getOnChainCollectionMint(mint);

  // 2) Secondary signal: DAS Core asset grouping (may lag, but useful for debug / explorers).
  const dasCollectionMint = await getCoreAssetCollection(mint);

  const expected = EXPECTED_COLLECTION_MINT && isValidSolanaAddress(EXPECTED_COLLECTION_MINT)
    ? EXPECTED_COLLECTION_MINT
    : null;

  const chosenCollectionMint = onChainCollectionMint ?? dasCollectionMint ?? null;
  // In collection if: (on-chain key matches and verified) OR (DAS grouping says this collection).
  // Trust DAS so the button does not reappear after add-to-collection (on-chain read can differ by format).
  const inExpectedCollection =
    !!expected &&
    ((onChainCollectionMint === expected && verified) || (dasCollectionMint === expected));

  return NextResponse.json({
    mint,
    collectionMint: chosenCollectionMint,
    onChainCollectionMint,
    dasCollectionMint,
    verifiedOnChain: verified,
    expectedCollectionMint: expected ?? null,
    inExpectedCollection,
    message: inExpectedCollection
      ? 'NFT is in the SolPit Creator collection.'
      : chosenCollectionMint
        ? `NFT is in another collection (${chosenCollectionMint}). Expected: ${expected ?? 'not configured'}.`
        : expected
          ? 'NFT has no collection or DAS did not return one. Expected: ' + expected
          : 'No collection configured (NFT_CREATOR_COLLECTION_MINT).',
  });
}
