'use client';

import { useState, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { scanWallet } from '@/lib/solana/scanner';
import { closeTokenAccounts } from '@/lib/solana/closer';
import { TokenAccount } from '@/types/token-account';
import { useReferral } from '@/hooks/useReferral';

export default function AccountScanner() {
  const { publicKey, signTransaction } = useWallet();
  const { referrerWallet } = useReferral();
  const [accounts, setAccounts] = useState<TokenAccount[]>([]);
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');

  // Debug referral
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

    setIsClosing(true);
    setError('');
    setSuccess('');

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

      if (result.success) {
        let successMsg = `Successfully closed ${result.accountsClosed} accounts! Reclaimed ${result.solReclaimed.toFixed(6)} SOL`;
        
        if (referrerWallet) {
          const shortReferrer = `${referrerWallet.slice(0, 4)}...${referrerWallet.slice(-4)}`;
          successMsg += ` | 🎁 10% bonus sent to your referrer (${shortReferrer})!`;
        }
        
        setSuccess(successMsg);
        await handleScan();
        setSelectedAccounts([]);
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
  const feeAmount = (selectedTotal * feePercentage) / 100;
  const referralAmount = referrerWallet ? (selectedTotal * 10) / 100 : 0;
const netAmount = selectedTotal - feeAmount - referralAmount;

  // Format referrer display
  const referrerDisplay = referrerWallet 
    ? `${referrerWallet.slice(0, 4)}...${referrerWallet.slice(-4)}`
    : null;

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
      {/* Referral banner */}
      {referrerWallet && (
        <div className="card-cyber border-neon-green/50 bg-gradient-to-r from-neon-green/10 to-transparent animate-slide-up">
          <div className="flex items-center gap-3">
            <div className="text-3xl animate-pulse">🎁</div>
            <div>
              <p className="text-lg font-bold text-neon-green">Referral Active!</p>
              <p className="text-sm text-gray-300">
                Your referrer will receive 10% of recovered SOL
              </p>
              <p className="text-xs text-gray-500 mt-1 font-mono">
                Referrer: {referrerDisplay}
              </p>
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
              💡 Service fee helps maintain and improve SOLcloser
            </p>

            <button
              onClick={handleClose}
              disabled={isClosing || selectedAccounts.length === 0}
              className="btn-cyber w-full mt-6 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isClosing ? '⏳ Closing...' : `🔓 Close ${selectedAccounts.length} Account${selectedAccounts.length !== 1 ? 's' : ''}`}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
