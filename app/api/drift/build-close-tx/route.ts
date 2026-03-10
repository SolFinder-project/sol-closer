/**
 * Build Drift deleteUser transaction on the server so @drift-labs/sdk (Node/fs) is not bundled in the client.
 * Returns serialized unsigned transaction; client signs and sends.
 */
import { NextResponse } from 'next/server';
import {
  PublicKey,
  Transaction,
  SystemProgram,
  ComputeBudgetProgram,
} from '@solana/web3.js';
import { getConnectionForRequest } from '@/lib/solana/connection';

export const dynamic = 'force-dynamic';

export interface DriftBuildCloseTxBody {
  /** Drift user account pubkeys to close (base58) */
  accountPubkeys: string[];
  /** Authority (wallet) public key base58 */
  authority: string;
  feeLamports: number;
  referralLamports: number;
  /** Referrer public key base58, or null */
  referrerPubkey: string | null;
  /** Fee recipient pubkey base58 */
  feeRecipient: string;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as DriftBuildCloseTxBody;
    const {
      accountPubkeys,
      authority: authorityStr,
      feeLamports,
      referralLamports,
      referrerPubkey,
      feeRecipient: feeRecipientStr,
    } = body;

    if (!accountPubkeys?.length || !authorityStr || !feeRecipientStr) {
      return NextResponse.json(
        { error: 'Invalid body: accountPubkeys, authority, feeRecipient required' },
        { status: 400 }
      );
    }

    const authority = new PublicKey(authorityStr);
    const feeRecipient = new PublicKey(feeRecipientStr);
    // Use proxy (same as client) so RPC goes through /api/rpc with client Origin; avoids 401 when Helius rejects direct server calls.
    const connection = getConnectionForRequest(request);

    const { DriftClient } = await import('@drift-labs/sdk');

    const env = process.env.NEXT_PUBLIC_SOLANA_NETWORK === 'mainnet-beta' ? 'mainnet-beta' : 'devnet';
    const driftClient = new DriftClient({
      connection,
      wallet: {
        publicKey: authority,
        signTransaction: async (tx: Transaction) => tx,
        signAllTransactions: async (txs: Transaction[]) => txs,
      },
      env,
    });

    const transaction = new Transaction();
    transaction.add(ComputeBudgetProgram.setComputeUnitLimit({ units: 200_000 }));

    for (const pubkeyStr of accountPubkeys) {
      const userAccountPubkey = new PublicKey(pubkeyStr);
      const ix = await driftClient.getUserDeletionIx(userAccountPubkey);
      transaction.add(ix);
    }

    if (feeLamports > 0) {
      transaction.add(
        SystemProgram.transfer({
          fromPubkey: authority,
          toPubkey: feeRecipient,
          lamports: feeLamports,
        })
      );
    }
    if (referralLamports > 0 && referrerPubkey) {
      const referrer = new PublicKey(referrerPubkey);
      transaction.add(
        SystemProgram.transfer({
          fromPubkey: authority,
          toPubkey: referrer,
          lamports: referralLamports,
        })
      );
    }

    const { blockhash } = await connection.getLatestBlockhash('confirmed');
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = authority;

    const serialized = transaction.serialize({
      requireAllSignatures: false,
      verifySignatures: false,
    });
    const base64 = Buffer.from(serialized).toString('base64');

    return NextResponse.json({ serializedTransaction: base64 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to build Drift close transaction';
    console.error('[api/drift/build-close-tx]', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
