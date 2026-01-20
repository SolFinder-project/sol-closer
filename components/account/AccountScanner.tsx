'use client';

import { useState, useEffect } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { scanWallet } from '@/lib/solana/scanner';
import { closeTokenAccounts } from '@/lib/solana/closer';
import { TokenAccount } from '@/types/token-account';
import { useReferral } from '@/hooks/useReferral';
import { LAMPORTS_PER_SOL } from '@solana/web3.js';

export default function AccountScanner() {
  const { publicKey, signTransaction } = useWallet();
  const { connection } = useConnection();
  const { referrerWallet } = useReferral();
  const [accounts, setAccounts] = useState<TokenAccount[]>([]);
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');
  const [warning, setWarning] = useState<string>('');
  const [walletBalance, setWalletBalance] = useState<number>(0);

  // 🔧 CORRECTION : Reset complet quand le wallet change
  useEffect(() => {
    // Réinitialiser tous les états quand publicKey change
    setAccounts([]);
    setSelectedAccounts([]);
    setError('');
    setSuccess('');
    setWarning('');
    setWalletBalance(0);
    setIsScanning(false);
    setIsClosing(false);

    // Si un wallet est connecté, récupérer son solde
    if (publicKey) {
      connection.getBalance(publicKey).then(balance => {
        setWalletBalance(balance / LAMPORTS_PER_SOL);
      });
    }
  }, [publicKey, connection]);

  useEffect(() => {
    console.log('🔍 Referral Debug:', {
      referrerWallet,
      hasReferrer: !!referrerWallet,
    });
  }, [referrerWallet]);

  const handleScan = async () => {
    if (!publicKey) {
      setError('Please connect your wallet first');
      return;
    }

    setIsScanning(true);
    setError('');
    setWarning('');
    setAccounts([]);
    setSelectedAccounts([]);

    try {
      const result = await scanWallet(publicKey);
      setAccounts(result);
      
      if (result.length === 0) {
        setError('No empty token accounts found! Your wallet is already clean 🎉');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to scan wallet');
    } finally {
      setIsScanning(false);
    }
  };

  const handleSelectAll = () => {
    if (selectedAccounts.length === accounts.length) {
      setSelectedAccounts([]);
    } else {
      setSelectedAccounts(accounts.map(acc => acc.pubkey.toString()));
    }
  };

  const toggleAccount = (pubkey: string) => {
    setSelectedAccounts(prev =>
      prev.includes(pubkey)
        ? prev.filter(p => p !== pubkey)
        : [...prev, pubkey]
    );
  };

  const handleClose = async () => {
    if (selectedAccounts.length === 0) {
      setError('Please select at least one account to close');
      return;
    }

    const MIN_SOL_REQUIRED = 0.001;
    if (walletBalance < MIN_SOL_REQUIRED) {
      setError(`⚠️ You need at least ${MIN_SOL_REQUIRED} SOL in your wallet to pay for network transaction fees. Please add some SOL first.`);
      return;
    }

    setIsClosing(true);
    setError('');
    setSuccess('');
    setWarning('');

    try {
      const accountsToClose = accounts.filter(acc =>
        selectedAccounts.includes(acc.pubkey.toString())
      );
      
      console.log('💰 Closing with referral:', {
        referrerWallet,
        accountsCount: accountsToClose.length,
      });

      const result = await closeTokenAccounts(
        accountsToClose,
        { publicKey, signTransaction },
        referrerWallet
      );

      console.log('🎯 Result:', result);

      if (result.success) {
        let successMsg = `Successfully closed ${result.accountsClosed} accounts! Reclaimed ${result.solReclaimed.toFixed(6)} SOL`;
        
        if (result.warningMessage) {
          console.log('⚠️ Setting warning:', result.warningMessage);
          setWarning(result.warningMessage);
        }
        
        if (referrerWallet && !result.warningMessage) {
          const shortReferrer = `${referrerWallet.slice(0, 4)}...${referrerWallet.slice(-4)}`;
          successMsg += ` | 🎁 10% bonus sent to your referrer (${shortReferrer})!`;
        }
        
        setSuccess(successMsg);
        
        // 🔧 Rescan en arrière-plan sans effacer le message de succès
        const newAccounts = await scanWallet(publicKey);
        setAccounts(newAccounts);
        setSelectedAccounts([]);
        
        const newBalance = await connection.getBalance(publicKey);
        setWalletBalance(newBalance / LAMPORTS_PER_SOL);
      } else {
        setError(result.error || 'Failed to close accounts');
      }
    } catch (err: any) {
      setError(err.message || 'Transaction failed');
      console.error('Close error:', err);
    } finally {
      setIsClosing(false);
    }
  };

  const selectedTotal = accounts
    .filter(acc => selectedAccounts.includes(acc.pubkey.toString()))
    .reduce((sum, acc) => sum + acc.rentExemptReserve, 0);

  const feePercentage = 20;
  const referralPercentage = 10;
  const feeAmount = (selectedTotal * feePercentage) / 100;
  const referralAmount = referrerWallet ? (selectedTotal * referralPercentage) / 100 : 0;
  const netAmount = selectedTotal - feeAmount - referralAmount;

  const referrerDisplay = referrerWallet 
    ? `${referrerWallet.slice(0, 4)}...${referrerWallet.slice(-4)}`
    : null;

  const MIN_SOL = 0.001;
  const needsMoreSOL = walletBalance < MIN_SOL;

  console.log('⚠️ Warning state:', warning);

  if (!publicKey) {
    return (
      <div className="card-cyber text-center py-12">
        <div className="text-6xl mb-4">🔐</div>
        <p className="text-xl text-gray-400">Connect your wallet to start scanning</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {needsMoreSOL && accounts.length > 0 && (
        <div className="card-cyber border-orange-500/50 bg-orange-500/10">
          <div className="flex items-center gap-3">
            <div className="text-4xl">⚠️</div>
            <div className="flex-1">
              <p className="text-xl font-bold text-orange-400 mb-2">Insufficient SOL</p>
              <p className="text-sm text-gray-300 mb-2">
                Your wallet has <strong>{walletBalance.toFixed(6)} SOL</strong>. You need at least <strong>{MIN_SOL} SOL</strong> to pay Solana network fees.
              </p>
              <div className="bg-dark-bg p-3 rounded-lg border border-orange-500/30 mt-3">
                <p className="text-xs text-gray-400 mb-1">💡 <strong>Why?</strong></p>
                <p className="text-xs text-gray-300">
                  Solana requires transaction fees (~0.001 SOL). <strong className="text-neon-green">Service fees (20%) and referral (10%) are deducted from claimed SOL</strong> - you don't pay those!
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {referrerWallet && (
        <div className="card-cyber border-neon-green/50 bg-gradient-to-r from-neon-green/10 to-transparent animate-slide-up">
          <div className="flex items-center gap-3">
            <div className="text-3xl animate-pulse">🎁</div>
            <div className="flex-1">
              <p className="text-lg font-bold text-neon-green">Referral Active!</p>
              <p className="text-sm text-gray-300">
                Your referrer will receive 10% of recovered SOL
              </p>
              <p className="text-xs text-gray-500 mt-1 font-mono">
                Referrer: {referrerDisplay}
              </p>
              <div className="mt-2 p-2 bg-orange-500/10 border border-orange-500/30 rounded-lg">
                <p className="text-xs text-orange-300">
                  ⚠️ <strong>Note:</strong> Referrer wallet must have at least 0.000001 SOL to receive the bonus
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="card-cyber text-center">
        <h2 className="text-3xl font-bold mb-4 font-[family-name:var(--font-orbitron)]">
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-neon-purple to-neon-pink">
            Scan Your Wallet
          </span>
        </h2>
        <p className="text-gray-400 mb-6">
          Find and close unused token accounts to reclaim your SOL
        </p>
        <button
          onClick={handleScan}
          disabled={isScanning}
          className="btn-cyber"
        >
          {isScanning ? '🔄 Scanning...' : '🔍 Scan My Wallet'}
        </button>
      </div>

      {error && (
        <div className="card-cyber border-red-500/50 bg-red-500/10">
          <p className="text-red-400">{error}</p>
        </div>
      )}

      {warning && (
        <div className="card-cyber border-orange-500/50 bg-orange-500/10 animate-pulse">
          <div className="flex items-center gap-4 p-2">
            <div className="text-4xl">⚠️</div>
            <div className="flex-1">
              <p className="text-xl font-bold text-orange-400 mb-1">⚠️ Referral Not Applied</p>
              <p className="text-sm text-orange-300 font-semibold mb-2">{warning}</p>
              <p className="text-xs text-gray-400">
                💡 Your referrer needs to initialize their wallet by receiving any amount of SOL first.
              </p>
            </div>
          </div>
        </div>
      )}

      {success && (
        <div className="card-cyber border-neon-green/50 bg-neon-green/10">
          <p className="text-neon-green">{success}</p>
        </div>
      )}

      {accounts.length > 0 && (
        <>
          <div className="card-cyber">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold font-[family-name:var(--font-orbitron)]">
                Closeable Accounts ({accounts.length})
              </h3>
              <button
                onClick={handleSelectAll}
                className="text-sm text-neon-purple hover:text-neon-pink transition-colors"
              >
                {selectedAccounts.length === accounts.length ? 'Deselect All' : 'Select All'}
              </button>
            </div>

            <div className="space-y-3 max-h-[400px] overflow-y-auto">
              {accounts.map((account) => (
                <div
                  key={account.pubkey.toString()}
                  onClick={() => toggleAccount(account.pubkey.toString())}
                  className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                    selectedAccounts.includes(account.pubkey.toString())
                      ? 'border-neon-purple bg-neon-purple/10'
                      : 'border-dark-border bg-dark-bg hover:border-neon-purple/50'
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <div className="min-w-0 flex-1">
                      <p className="font-mono text-sm text-gray-400 truncate">
                        {account.pubkey.toString().slice(0, 8)}...
                        {account.pubkey.toString().slice(-8)}
                      </p>
                      <p className="text-xs text-gray-500 truncate">
                        Mint: {account.mint.toString().slice(0, 12)}...
                      </p>
                    </div>
                    <div className="text-right ml-2 flex-shrink-0">
                      <p className="text-lg font-bold text-neon-green font-mono">
                        +{(account.rentExemptReserve / 1e9).toFixed(6)} SOL
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <p className="text-sm text-gray-500 mt-4">
              Selected: {selectedAccounts.length} / {accounts.length} accounts
            </p>
          </div>

          <div className="card-cyber border-neon-purple/30">
            <h3 className="text-2xl font-bold mb-4 text-center font-[family-name:var(--font-orbitron)]">
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-neon-purple to-neon-pink">
                Claim Summary
              </span>
            </h3>

            <div className="space-y-3">
              <div className="flex justify-between p-3 rounded-lg bg-dark-bg">
                <span className="text-gray-400">Selected Accounts</span>
                <span className="font-bold text-white font-mono">
                  {selectedAccounts.length}
                </span>
              </div>

              <div className="flex justify-between p-3 rounded-lg bg-dark-bg">
                <span className="text-gray-400">Total Reclaimable</span>
                <span className="font-bold text-neon-green font-mono">
                  {(selectedTotal / 1e9).toFixed(6)} SOL
                </span>
              </div>

              <div className="flex justify-between p-3 rounded-lg bg-dark-bg">
                <span className="text-gray-400">Service Fee (20%)</span>
                <span className="font-bold text-orange-500 font-mono">
                  -{(feeAmount / 1e9).toFixed(6)} SOL
                </span>
              </div>

              {referrerWallet && referralAmount > 0 && (
                <div className="flex justify-between p-3 rounded-lg bg-neon-green/10 border border-neon-green/30">
                  <span className="text-neon-green font-semibold">🎁 Referrer Bonus (10%)</span>
                  <span className="font-bold text-neon-green font-mono">
                    -{(referralAmount / 1e9).toFixed(6)} SOL
                  </span>
                </div>
              )}

              <div className="flex justify-between p-4 rounded-lg bg-gradient-to-r from-neon-purple/20 to-neon-pink/20 border-2 border-neon-purple/50">
                <span className="text-lg font-bold text-white">You Receive</span>
                <span className="text-2xl font-bold text-white font-mono">
                  {(netAmount / 1e9).toFixed(6)} SOL
                </span>
              </div>
            </div>

            <p className="text-xs text-gray-500 text-center mt-4">
              💡 Service fees deducted from claimed SOL. You only pay network fees (~0.001 SOL).
            </p>

            <button
              onClick={handleClose}
              disabled={isClosing || selectedAccounts.length === 0 || needsMoreSOL}
              className="btn-cyber w-full mt-6 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isClosing ? '⏳ Closing...' : needsMoreSOL ? `⚠️ Need ${MIN_SOL} SOL` : `🔓 Close ${selectedAccounts.length} Account${selectedAccounts.length !== 1 ? 's' : ''}`}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
