/**
 * Build PSOL (Phantom) deposit transaction (SOL → PSOL) via SPL Stake Pool.
 * Server builds the tx and signs with the ephemeral keypair; client signs and sends.
 */
import { NextResponse } from 'next/server';
import { PublicKey, Transaction } from '@solana/web3.js';
import { getConnectionForRequest } from '@/lib/solana/connection';
import { PSOL_STAKE_POOL_ADDRESS } from '@/lib/solana/psolStake';

export const dynamic = 'force-dynamic';

export interface PsolDepositBody {
  /** User wallet public key (base58) */
  publicKey: string;
  /** Amount to stake in lamports */
  amountLamports: number;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as PsolDepositBody;
    const { publicKey: publicKeyStr, amountLamports } = body;
    if (!publicKeyStr || amountLamports == null || amountLamports <= 0) {
      return NextResponse.json(
        { error: 'Invalid body: publicKey and amountLamports required' },
        { status: 400 }
      );
    }

    const publicKey = new PublicKey(publicKeyStr);
    const connection = getConnectionForRequest(request);

    const { depositSol } = await import('@solana/spl-stake-pool');

    const { instructions, signers } = await depositSol(
      connection,
      PSOL_STAKE_POOL_ADDRESS,
      publicKey,
      amountLamports,
      undefined,
      undefined,
      undefined
    );

    const tx = new Transaction();
    tx.add(...instructions);
    tx.feePayer = publicKey;
    const { blockhash } = await connection.getLatestBlockhash('confirmed');
    tx.recentBlockhash = blockhash;

    if (signers.length > 0) {
      tx.partialSign(...signers);
    }

    const serialized = tx.serialize({
      requireAllSignatures: false,
      verifySignatures: false,
    });
    const base64 = Buffer.from(serialized).toString('base64');

    return NextResponse.json({ serializedTransaction: base64 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to build PSOL deposit transaction';
    console.error('[api/psol/deposit]', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
