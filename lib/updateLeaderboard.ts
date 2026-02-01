import { google } from 'googleapis';

// Décode les credentials Google depuis Vercel
const credentials = JSON.parse(
  Buffer.from(process.env.GOOGLE_CREDENTIALS!, 'base64').toString('utf-8')
);

// Authentification avec Google
const auth = new google.auth.GoogleAuth({
  credentials,
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

// Client Google Sheets
const sheets = google.sheets({ version: 'v4', auth });

// Fonction pour mettre à jour Top Users
export async function updateTopUsers() {
  console.log('🔄 Updating Top Users...');
  
  // Pour l'instant, on met des données de test
  // Tu remplaceras ça plus tard par tes vraies données Helius
  const testUsers = [
    { wallet: '7xK9...test1', solReclaimed: 1.234, txHash: 'txABC123' },
    { wallet: '5pQ2...test2', solReclaimed: 0.876, txHash: 'txDEF456' },
    { wallet: '3mN4...test3', solReclaimed: 0.543, txHash: 'txGHI789' },
  ];
  
  // Trie par SOL réclamé (du plus grand au plus petit)
  const sorted = testUsers.sort((a, b) => b.solReclaimed - a.solReclaimed);
  
  // Formate pour Google Sheets
  const rows = sorted.map((user, index) => [
    index + 1,  // Rang
    user.wallet,
    user.solReclaimed.toFixed(4),  // 4 décimales
    `https://solscan.io/tx/${user.txHash}`,
  ]);
  
  // Envoie à Google Sheets
  await sheets.spreadsheets.values.update({
    spreadsheetId: process.env.GOOGLE_SHEET_ID!,
    range: "'🏆 Top Users'!A2:D100",
    valueInputOption: 'RAW',
    requestBody: { values: rows },
  });
  
  console.log('✅ Top Users updated:', rows.length, 'entries');
}

// Fonction pour mettre à jour Top Referrers
export async function updateTopReferrers() {
  console.log('🔄 Updating Top Referrers...');
  
  // Données de test
  const testReferrers = [
    { wallet: '8yL5...ref1', count: 12 },
    { wallet: '2hB3...ref2', count: 8 },
    { wallet: '9zC6...ref3', count: 5 },
  ];
  
  const sorted = testReferrers.sort((a, b) => b.count - a.count);
  
  const rows = sorted.map((ref, index) => [
    index + 1,
    ref.wallet,
    ref.count,
    'Verified ✓',
  ]);
  
  await sheets.spreadsheets.values.update({
    spreadsheetId: process.env.GOOGLE_SHEET_ID!,
    range: "'🏆 Top Referrers'!A2:D100",
    valueInputOption: 'RAW',
    requestBody: { values: rows },
  });
  
  console.log('✅ Top Referrers updated:', rows.length, 'entries');
}

// Fonction pour mettre à jour Top Posters
export async function updateTopPosters() {
  console.log('🔄 Updating Top Posters...');
  
  // Données de test
  const testPosters = [
    { handle: 'CryptoMax', count: 15, lastTweet: 'https://x.com/CryptoMax/status/123' },
    { handle: 'SolanaFan', count: 9, lastTweet: 'https://x.com/SolanaFan/status/456' },
    { handle: 'Web3Builder', count: 6, lastTweet: 'https://x.com/Web3Builder/status/789' },
  ];
  
  const sorted = testPosters.sort((a, b) => b.count - a.count);
  
  const rows = sorted.map((poster, index) => [
    index + 1,
    `@${poster.handle}`,
    poster.count,
    poster.lastTweet,
  ]);
  
  await sheets.spreadsheets.values.update({
    spreadsheetId: process.env.GOOGLE_SHEET_ID!,
    range: "'🏆 Top Posters'!A2:D100",
    valueInputOption: 'RAW',
    requestBody: { values: rows },
  });
  
  console.log('✅ Top Posters updated:', rows.length, 'entries');
}
