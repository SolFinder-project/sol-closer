import { 
  PublicKey, 
  Transaction, 
  SystemProgram,
  ComputeBudgetProgram,
} from '@solana/web3.js';
import { 
  createCloseAccountInstruction,
  TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
} from '@solana/spl-token';
import { getConnection } from './connection';
import { TokenAccount, CloseAccountResult } from '@/types/token-account';
import { saveTransaction } from '@/lib/supabase/transactions';
import { safePublicKey, cleanEnvAddress } from './validators';

const BATCH_SIZE = 10;

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
    
    const cleanedFeeRecipient = cleanEnvAddress(process.env.NEXT_PUBLIC_FEE_RECIPIENT_WALLET);
    const feeRecipient = new PublicKey(cleanedFeeRecipient);
    
    console.log('✅ Fee recipient validated:', feeRecipient.toString().slice(0, 8) + '...');

    // ⭐ PAS DE VALIDATION - Juste vérifier que c'est une adresse valide
    let validReferrerPubkey: PublicKey | null = null;
    if (referrerWallet && referrerWallet !== walletAdapter.publicKey.toString()) {
      try {
        const referrerPubkey = safePublicKey(referrerWallet);
        if (referrerPubkey && !referrerPubkey.equals(walletAdapter.publicKey)) {
          validReferrerPubkey = referrerPubkey;
          console.log(`✅ Referrer: ${referrerWallet.slice(0, 8)}...`);
        }
      } catch (e) {
        console.warn('⚠️ Invalid referrer address');
      }
    }

    const batches = chunk(accounts, BATCH_SIZE);
    console.log(`📦 Processing ${accounts.length} accounts in ${batches.length} batches`);

    let totalAccountsClosed = 0;
    let totalReclaimable = 0;
    let allSignatures: string[] = [];
    let finalReferralAmount = 0;

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      console.log(`🔄 Batch ${i + 1}/${batches.length} (${batch.length} accounts)`);

      const transaction = new Transaction();
      transaction.add(ComputeBudgetProgram.setComputeUnitLimit({ units: 400_000 }));

      let batchReclaimable = 0;

      // ⭐ Fermer les comptes
      for (const account of batch) {
        const programId = account.programId || TOKEN_PROGRAM_ID;
        console.log(`  Closing ${account.pubkey.toString().slice(0, 8)}...`);
        
        transaction.add(createCloseAccountInstruction(
          account.pubkey,
          walletAdapter.publicKey,
          walletAdapter.publicKey,
          [],
          programId
        ));
        batchReclaimable += account.rentExemptReserve;
      }

      totalReclaimable += batchReclaimable;
      const batchFeeAmount = Math.floor(batchReclaimable * feePercentage / 100);
      const batchReferralAmount = validReferrerPubkey ? Math.floor(batchReclaimable * referralFeePercentage / 100) : 0;

      // ⭐ Transférer les frais (le SOL est maintenant disponible après les closes)
      if (batchFeeAmount > 0) {
        transaction.add(SystemProgram.transfer({
          fromPubkey: walletAdapter.publicKey,
          toPubkey: feeRecipient,
          lamports: batchFeeAmount,
        }));
        console.log(`  💰 Platform: ${batchFeeAmount / 1e9} SOL`);
      }

      if (batchReferralAmount > 0 && validReferrerPubkey) {
        transaction.add(SystemProgram.transfer({
          fromPubkey: walletAdapter.publicKey,
          toPubkey: validReferrerPubkey,
          lamports: batchReferralAmount,
        }));
        finalReferralAmount += batchReferralAmount;
        console.log(`  🎁 Referral: ${batchReferralAmount / 1e9} SOL`);
      }

      const { blockhash } = await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = walletAdapter.publicKey;

      const signed = await walletAdapter.signTransaction(transaction);
      const signature = await connection.sendRawTransaction(signed.serialize());
      await connection.confirmTransaction(signature, 'confirmed');

      totalAccountsClosed += batch.length;
      allSignatures.push(signature);

      console.log(`✅ Batch ${i + 1} complete: ${signature.slice(0, 8)}...`);
    }

    const solReclaimed = totalReclaimable / 1e9;
    const totalFeeAmount = Math.floor(totalReclaimable * feePercentage / 100);
    const totalFeesPaid = (totalFeeAmount + finalReferralAmount) / 1e9;
    const netReceived = solReclaimed - totalFeesPaid;

    console.log(`🎉 Total: ${solReclaimed} SOL | Net: ${netReceived} SOL | Fees: ${totalFeesPaid} SOL`);

    try {
      await saveTransaction({
        signature: allSignatures[0],
        wallet_address: walletAdapter.publicKey.toString(),
        accounts_closed: totalAccountsClosed,
        sol_reclaimed: solReclaimed,
        fee: totalFeesPaid,
        net_received: netReceived,
        referrer_code: referrerWallet || undefined,
        referral_earned: finalReferralAmount > 0 ? finalReferralAmount / 1e9 : undefined,
        timestamp: Date.now(),
      });
    } catch (supabaseError) {
      console.error('⚠️ Supabase error:', supabaseError);
    }

    return {
      signature: allSignatures[0],
      accountsClosed: totalAccountsClosed,
      solReclaimed: netReceived,
      success: true,
    };
  } catch (error: any) {
    console.error('❌ Error:', error);
    return {
      signature: '',
      accountsClosed: 0,
      solReclaimed: 0,
      success: false,
      error: error.message,
    };
  }
}
