import { 
  PublicKey, 
  Transaction, 
  SystemProgram,
  ComputeBudgetProgram,
} from '@solana/web3.js';
import { 
  createCloseAccountInstruction,
} from '@solana/spl-token';
import { getConnection } from './connection';
import { TokenAccount, CloseAccountResult } from '@/types/token-account';
import { TOKEN_PROGRAM_ID } from './constants';
import { saveTransaction } from '@/lib/supabase/transactions';

const BATCH_SIZE = 20;

function chunk<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

export async function closeTokenAccounts(
  accounts: TokenAccount[],
  walletAdapter: any,
  referrerWallet?: string | null
): Promise<CloseAccountResult> {
  try {
    if (!walletAdapter.publicKey) {
      throw new Error('Wallet not connected');
    }

    if (!process.env.NEXT_PUBLIC_FEE_RECIPIENT_WALLET) {
      throw new Error('Fee recipient wallet not configured. Please contact support.');
    }

    const connection = getConnection();
    const feePercentage = Number(process.env.NEXT_PUBLIC_SERVICE_FEE_PERCENTAGE || 20);
    const referralFeePercentage = Number(process.env.NEXT_PUBLIC_REFERRAL_FEE_PERCENTAGE || 10);
    const feeRecipient = new PublicKey(process.env.NEXT_PUBLIC_FEE_RECIPIENT_WALLET);

    const batches = chunk(accounts, BATCH_SIZE);
    console.log(`📦 Processing ${accounts.length} accounts in ${batches.length} batches`);

    let totalAccountsClosed = 0;
    let totalReclaimable = 0;
    let allSignatures: string[] = [];
    let finalReferralAmount = 0;

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      console.log(`🔄 Processing batch ${i + 1}/${batches.length} (${batch.length} accounts)`);

      const transaction = new Transaction();

      transaction.add(
        ComputeBudgetProgram.setComputeUnitLimit({
          units: 300_000,
        })
      );

      let batchReclaimable = 0;

      for (const account of batch) {
        const closeInstruction = createCloseAccountInstruction(
          account.pubkey,
          walletAdapter.publicKey,
          walletAdapter.publicKey,
          [],
          TOKEN_PROGRAM_ID
        );
        transaction.add(closeInstruction);
        batchReclaimable += account.rentExemptReserve;
      }

      // Fees sur le dernier batch seulement
      if (i === batches.length - 1) {
        const grandTotal = totalReclaimable + batchReclaimable;
        const totalFeeAmount = Math.floor(grandTotal * feePercentage / 100);

        if (referrerWallet && referrerWallet !== walletAdapter.publicKey.toString()) {
          try {
            const referrerPubkey = new PublicKey(referrerWallet);
            finalReferralAmount = Math.floor(grandTotal * referralFeePercentage / 100);
            const platformAmount = totalFeeAmount - finalReferralAmount;
            
            if (platformAmount > 0) {
              transaction.add(SystemProgram.transfer({
                fromPubkey: walletAdapter.publicKey,
                toPubkey: feeRecipient,
                lamports: platformAmount,
              }));
            }
            
            if (finalReferralAmount > 0) {
              transaction.add(SystemProgram.transfer({
                fromPubkey: walletAdapter.publicKey,
                toPubkey: referrerPubkey,
                lamports: finalReferralAmount,
              }));
            }

            console.log(`✅ Referral: ${finalReferralAmount / 1e9} SOL to ${referrerWallet.slice(0, 8)}`);
          } catch (error) {
            console.error('Invalid referrer wallet:', error);
            finalReferralAmount = 0;
            transaction.add(SystemProgram.transfer({
              fromPubkey: walletAdapter.publicKey,
              toPubkey: feeRecipient,
              lamports: totalFeeAmount,
            }));
          }
        } else {
          transaction.add(SystemProgram.transfer({
            fromPubkey: walletAdapter.publicKey,
            toPubkey: feeRecipient,
            lamports: totalFeeAmount,
          }));
        }
      }

      const { blockhash } = await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = walletAdapter.publicKey;

      const signed = await walletAdapter.signTransaction(transaction);
      const signature = await connection.sendRawTransaction(signed.serialize());

      await connection.confirmTransaction(signature, 'confirmed');

      totalAccountsClosed += batch.length;
      totalReclaimable += batchReclaimable;
      allSignatures.push(signature);

      console.log(`✅ Batch ${i + 1} complete: ${signature.slice(0, 8)}...`);
    }

    const solReclaimed = totalReclaimable / 1e9;
    const totalFeeAmount = Math.floor((totalReclaimable * feePercentage) / 100);
    const fee = totalFeeAmount / 1e9;
    const netReceived = solReclaimed - fee;
    const referralEarnedSol = finalReferralAmount / 1e9;

    // Save to Supabase
    try {
      await saveTransaction({
        signature: allSignatures[0],
        wallet_address: walletAdapter.publicKey.toString(),
        accounts_closed: totalAccountsClosed,
        sol_reclaimed: solReclaimed,
        fee,
        net_received: netReceived,
        referrer_code: referrerWallet || undefined,
        referral_earned: referralEarnedSol > 0 ? referralEarnedSol : undefined,
        timestamp: Date.now(),
      });
      console.log('✅ Transaction saved to Supabase');
    } catch (supabaseError) {
      console.error('⚠️ Failed to save to Supabase:', supabaseError);
    }

    return {
      signature: allSignatures[0],
      accountsClosed: totalAccountsClosed,
      solReclaimed: netReceived,
      success: true,
    };
  } catch (error: any) {
    console.error('Error closing accounts:', error);
    return {
      signature: '',
      accountsClosed: 0,
      solReclaimed: 0,
      success: false,
      error: error.message,
    };
  }
}
