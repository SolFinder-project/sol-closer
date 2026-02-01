const { Connection, PublicKey, TOKEN_PROGRAM_ID } = require('@solana/web3.js');

async function checkReclaimableSOL(walletAddress) {
  const connection = new Connection('https://api.mainnet-beta.solana.com'); // Remplace par ton Helius RPC pour +speed
  const owner = new PublicKey(walletAddress);
  
  const filters = [
    { dataSize: 165 },
    { memcmp: { offset: 32, bytes: owner.toBase58() } }
  ];
  
  const accounts = await connection.getParsedProgramAccounts(TOKEN_PROGRAM_ID, { filters });
  
  let emptyCount = 0;
  for (const acc of accounts) {
    const balance = acc.account.data.parsed.info.tokenAmount.uiAmount;
    if (balance === 0 || balance === '0') emptyCount++;
  }
  
  const rentPerAccount = 0.002039;
  const totalReclaimable = emptyCount * rentPerAccount;
  console.log(`Adresse: ${walletAddress}`);
  console.log(`Comptes vides: ${emptyCount}`);
  console.log(`SOL récupérable: ~${totalReclaimable.toFixed(4)} SOL`);
}

const WALLET_ADDRESS = process.argv[2] || 'EXEMPLE_ADRESSE_ICI';
checkReclaimableSOL(WALLET_ADDRESS);
