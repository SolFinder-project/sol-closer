import { Connection, PublicKey } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID } from '@solana/spl-token';
import { getConnection } from './connection';
import { TokenAccount } from '@/types/token-account';

export async function scanWallet(walletPublicKey: PublicKey): Promise<TokenAccount[]> {
  const connection = getConnection();
  const emptyAccounts: TokenAccount[] = [];

  try {
    console.log('🔍 Starting wallet scan...');
    console.log('📍 Wallet:', walletPublicKey.toString());
    
    // Scan SPL Token accounts
    console.log('📦 Scanning SPL Token Program...');
    const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
      walletPublicKey,
      { programId: TOKEN_PROGRAM_ID }
    );

    console.log(`✅ Found ${tokenAccounts.value.length} SPL token accounts`);

    for (const account of tokenAccounts.value) {
      const accountInfo = account.account.data.parsed.info;
      const balance = accountInfo.tokenAmount.uiAmount;

      if (balance === 0) {
        console.log(`  ✅ Empty SPL account: ${account.pubkey.toString().slice(0, 8)}...`);
        emptyAccounts.push({
          pubkey: account.pubkey,
          mint: new PublicKey(accountInfo.mint),
          balance: 0,
          rentExemptReserve: account.account.lamports,
          programId: TOKEN_PROGRAM_ID, // ⭐ Important: marquer le program ID
        });
      }
    }

    // Scan Token-2022 accounts
    try {
      console.log('📦 Scanning Token-2022 Program...');
      const token2022Accounts = await connection.getParsedTokenAccountsByOwner(
        walletPublicKey,
        { programId: TOKEN_2022_PROGRAM_ID }
      );

      console.log(`✅ Found ${token2022Accounts.value.length} Token-2022 accounts`);

      for (const account of token2022Accounts.value) {
        const accountInfo = account.account.data.parsed.info;
        const balance = accountInfo.tokenAmount.uiAmount;

        if (balance === 0) {
          console.log(`  ✅ Empty Token-2022 account: ${account.pubkey.toString().slice(0, 8)}...`);
          emptyAccounts.push({
            pubkey: account.pubkey,
            mint: new PublicKey(accountInfo.mint),
            balance: 0,
            rentExemptReserve: account.account.lamports,
            programId: TOKEN_2022_PROGRAM_ID, // ⭐ Important: marquer le Token-2022 program
          });
        }
      }
    } catch (error) {
      console.log('ℹ️  No Token-2022 accounts found');
    }

    console.log(`\n🎯 Total empty accounts found: ${emptyAccounts.length}`);
    
    return emptyAccounts;
  } catch (error) {
    console.error('❌ Error scanning wallet:', error);
    throw new Error('Failed to scan wallet. Please try again.');
  }
}
