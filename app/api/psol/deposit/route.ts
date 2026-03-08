/**
 * Build PSOL (Phantom) deposit transaction (SOL → PSOL) via SPL Stake Pool.
 * Server builds the tx and signs with the ephemeral keypair; client signs and sends.
 */
import { NextResponse } from 'next/server';
import { PublicKey, Transaction } from '@solana/web3.js';
import { getConnection } from '@/lib/solana/connection';
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
    const connection = getConnection();

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
    let message = err instanceof Error ? err.message : 'Failed to build PSOL deposit transaction';
    if (/401|Unauthorized/i.test(message) && (/Authentication Required|<!doctype/i.test(message))) {
      message = 'Vercel Deployment Protection is blocking requests. In Vercel: Project → Settings → Deployment Protection → set Preview to "None" or add your preview domain to Exceptions.';
    } else if (/401|Unauthorized/i.test(message)) {
      message = 'RPC rejected (401). In Helius dashboard, ensure the API key has no "Allowed Domains" only (or add Allowed IPs for Vercel). Set HELIUS_API_KEY in Vercel env and redeploy.';
    }
    console.error('[api/psol/deposit]', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
