/**
 * Build Marinade deposit transaction (SOL → mSOL) on the server so the Marinade/Anchor SDK
 * (which uses Node "fs") is never bundled in the client.
 * Returns serialized unsigned transaction; client signs and sends.
 */
import { NextResponse } from 'next/server';
import { PublicKey } from '@solana/web3.js';
import { getConnectionForRequest } from '@/lib/solana/connection';

export const dynamic = 'force-dynamic';

export interface MarinadeDepositBody {
  /** User wallet public key (base58) */
  publicKey: string;
  /** Amount to stake in lamports */
  amountLamports: number;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as MarinadeDepositBody;
    const { publicKey: publicKeyStr, amountLamports } = body;
    if (!publicKeyStr || amountLamports == null || amountLamports <= 0) {
      return NextResponse.json(
        { error: 'Invalid body: publicKey and amountLamports required' },
        { status: 400 }
      );
    }

    const publicKey = new PublicKey(publicKeyStr);
    const connection = getConnectionForRequest(request);

    const [{ Marinade, MarinadeConfig }, { default: BN }] = await Promise.all([
      import('@marinade.finance/marinade-ts-sdk'),
      import('bn.js'),
    ]);

    const config = new MarinadeConfig({ connection, publicKey });
    const marinade = new Marinade(config);
    const result = await marinade.deposit(new BN(amountLamports));

    const tx = result.transaction;
    tx.feePayer = publicKey;
    const { blockhash } = await connection.getLatestBlockhash('confirmed');
    tx.recentBlockhash = blockhash;

    const serialized = tx.serialize({
      requireAllSignatures: false,
      verifySignatures: false,
    });
    const base64 = Buffer.from(serialized).toString('base64');

    return NextResponse.json({ serializedTransaction: base64 });
  } catch (err) {
    let message = err instanceof Error ? err.message : 'Failed to build deposit transaction';
    if (/401|Unauthorized/i.test(message) && (/Authentication Required|<!doctype/i.test(message))) {
      message = 'Vercel Deployment Protection is blocking requests. In Vercel: Project → Settings → Deployment Protection → set Preview to "None" or add your preview domain to Exceptions.';
    } else if (/401|Unauthorized/i.test(message)) {
      message = 'RPC rejected (401). In Helius dashboard, ensure the API key has no "Allowed Domains" only (or add Allowed IPs for Vercel). Set HELIUS_API_KEY in Vercel env and redeploy.';
    }
    console.error('[api/marinade/deposit]', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
