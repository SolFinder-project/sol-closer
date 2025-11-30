'use client';

import { useWallet } from '@solana/wallet-adapter-react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import { useCallback, useEffect, useState, useRef } from 'react';

export default function WalletButton() {
  const { publicKey, disconnect, connecting, connected, wallet } = useWallet();
  const { setVisible } = useWalletModal();
  const [isMobile, setIsMobile] = useState(false);
  const [isInWalletBrowser, setIsInWalletBrowser] = useState(false);
  const [currentWalletBrowser, setCurrentWalletBrowser] = useState<'phantom' | 'solflare' | null>(null);
  const [showMobileHelper, setShowMobileHelper] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const mobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    setIsMobile(mobile);
    
    const phantom = (window as any).phantom?.solana || (window as any).solana;
    const solflare = (window as any).solflare;
    
    if (phantom?.isPhantom) {
      setIsInWalletBrowser(true);
      setCurrentWalletBrowser('phantom');
    } else if (solflare?.isSolflare) {
      setIsInWalletBrowser(true);
      setCurrentWalletBrowser('solflare');
    } else {
      setIsInWalletBrowser(false);
      setCurrentWalletBrowser(null);
    }
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleClick = useCallback(() => {
    if (connected) {
      setShowDropdown(!showDropdown);
      return;
    }
    
    if (isMobile && !isInWalletBrowser) {
      setShowMobileHelper(true);
      return;
    }
    
    setVisible(true);
  }, [connected, showDropdown, isMobile, isInWalletBrowser, setVisible]);

  const handleDisconnect = () => {
    disconnect();
    setShowDropdown(false);
  };

  const copyAddress = () => {
    if (publicKey) {
      navigator.clipboard.writeText(publicKey.toBase58());
      setShowDropdown(false);
    }
  };

  const openInPhantom = () => {
    const currentUrl = window.location.href;
    // Phantom utilise le format: https://phantom.app/ul/browse/{url}
    // Le scheme phantom:// ne fonctionne pas bien pour le browse
    window.location.href = `https://phantom.app/ul/browse/${encodeURIComponent(currentUrl)}`;
  };

  const openInSolflare = () => {
    const currentUrl = window.location.href;
    // Solflare iOS: scheme direct
    window.location.href = `solflare://ul/v1/browse/${encodeURIComponent(currentUrl)}?ref=${encodeURIComponent(window.location.origin)}`;
  };

  const displayAddress = publicKey 
    ? `${publicKey.toBase58().slice(0, 4)}...${publicKey.toBase58().slice(-4)}`
    : null;

  const fullAddress = publicKey?.toBase58() || '';

  return (
    <>
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={handleClick}
          disabled={connecting}
          className="flex items-center gap-2 px-3 py-2 md:px-5 md:py-2.5 rounded-xl font-bold text-white text-sm
                     bg-gradient-to-r from-neon-purple to-neon-pink 
                     hover:opacity-90 transition-all duration-300
                     disabled:opacity-50 disabled:cursor-not-allowed
                     shadow-lg shadow-neon-purple/25 whitespace-nowrap"
        >
          {connected && wallet?.adapter?.icon ? (
            <img src={wallet.adapter.icon} alt={wallet.adapter.name} className="w-5 h-5 rounded-full" />
          ) : (
            <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 128 128" fill="none">
              <circle cx="64" cy="64" r="64" fill="white"/>
              <path d="M110.584 64.9142H99.142C99.142 41.7651 80.173 23 56.7724 23C33.6612 23 14.8716 41.3057 14.4118 64.0583C13.936 87.5223 35.8758 107.053 59.9884 105.926C71.2869 105.398 81.4565 100.188 88.6424 92.0656L109.943 66.4912C110.727 65.5497 110.727 64.9142 109.943 64.9142H110.584ZM40.2647 68.5765C40.2647 72.2388 37.2494 75.1917 33.5086 75.1917C29.7678 75.1917 26.7525 72.2388 26.7525 68.5765V59.5706C26.7525 55.9083 29.7678 52.9554 33.5086 52.9554C37.2494 52.9554 40.2647 55.9083 40.2647 59.5706V68.5765ZM62.4039 68.5765C62.4039 72.2388 59.3886 75.1917 55.6478 75.1917C51.907 75.1917 48.8917 72.2388 48.8917 68.5765V59.5706C48.8917 55.9083 51.907 52.9554 55.6478 52.9554C59.3886 52.9554 62.4039 55.9083 62.4039 59.5706V68.5765Z" fill="#AB9FF2"/>
            </svg>
          )}
          
          {connecting ? (
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
            </svg>
          ) : connected ? (
            <span className="flex items-center gap-1">
              {displayAddress}
              <svg className={`w-4 h-4 transition-transform ${showDropdown ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </span>
          ) : (
            <span>Connect</span>
          )}
        </button>

        {/* Dropdown menu */}
        {showDropdown && connected && (
          <div className="absolute right-0 mt-2 w-64 bg-dark-card border border-dark-border rounded-xl shadow-2xl overflow-hidden z-50 animate-slide-up">
            <div className="p-4 border-b border-dark-border bg-gradient-to-br from-neon-purple/10 to-transparent">
              <div className="flex items-center gap-3 mb-2">
                {wallet?.adapter?.icon && (
                  <img src={wallet.adapter.icon} alt={wallet.adapter.name} className="w-8 h-8 rounded-full" />
                )}
                <div>
                  <p className="font-bold text-white">{wallet?.adapter?.name}</p>
                  <p className="text-xs text-gray-400">Connected</p>
                </div>
              </div>
              <div className="bg-dark-bg rounded-lg p-2 mt-2">
                <p className="text-xs text-gray-500 mb-1">Address</p>
                <p className="text-xs font-mono text-gray-300 break-all">{fullAddress}</p>
              </div>
            </div>

            <div className="p-2">
              <button
                onClick={copyAddress}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-dark-border/50 transition-colors text-left"
              >
                <span className="text-lg">📋</span>
                <span className="text-sm text-gray-300">Copy Address</span>
              </button>
              
              <button
                onClick={() => {
                  window.open(`https://solscan.io/account/${fullAddress}?cluster=devnet`, '_blank');
                  setShowDropdown(false);
                }}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-dark-border/50 transition-colors text-left"
              >
                <span className="text-lg">🔍</span>
                <span className="text-sm text-gray-300">View on Solscan</span>
              </button>

              <div className="border-t border-dark-border my-2"></div>

              {/* Switch wallet - sur mobile dans un wallet browser */}
              {isMobile && isInWalletBrowser && (
                <>
                  {currentWalletBrowser === 'phantom' && (
                    <button
                      onClick={openInSolflare}
                      className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-dark-border/50 transition-colors text-left"
                    >
                      <span className="text-lg">🔄</span>
                      <span className="text-sm text-gray-300">Open in Solflare</span>
                    </button>
                  )}
                  {currentWalletBrowser === 'solflare' && (
                    <button
                      onClick={openInPhantom}
                      className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-dark-border/50 transition-colors text-left"
                    >
                      <span className="text-lg">🔄</span>
                      <span className="text-sm text-gray-300">Open in Phantom</span>
                    </button>
                  )}
                </>
              )}

              {/* Change wallet - sur desktop */}
              {!isMobile && (
                <button
                  onClick={() => {
                    disconnect();
                    setShowDropdown(false);
                    setTimeout(() => setVisible(true), 100);
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-dark-border/50 transition-colors text-left"
                >
                  <span className="text-lg">🔄</span>
                  <span className="text-sm text-gray-300">Change Wallet</span>
                </button>
              )}
              
              <button
                onClick={handleDisconnect}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-red-500/10 transition-colors text-left group"
              >
                <span className="text-lg">🔌</span>
                <span className="text-sm text-red-400 group-hover:text-red-300">Disconnect</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal d'aide pour mobile */}
      {showMobileHelper && (
        <div 
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
          onClick={() => setShowMobileHelper(false)}
        >
          <div 
            className="bg-dark-card border border-dark-border rounded-2xl p-6 max-w-sm w-full space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-center">
              <div className="text-5xl mb-3">📱</div>
              <h3 className="text-xl font-bold text-white mb-2">Connect on Mobile</h3>
              <p className="text-sm text-gray-400">
                Choose your wallet to connect
              </p>
            </div>

            <div className="space-y-3">
              {/* Phantom */}
              <button
                onClick={openInPhantom}
                className="w-full flex items-center gap-3 p-4 rounded-xl bg-[#AB9FF2]/10 border border-[#AB9FF2]/30 hover:bg-[#AB9FF2]/20 transition-colors"
              >
                <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center flex-shrink-0">
                  <svg className="w-6 h-6" viewBox="0 0 128 128" fill="none">
                    <path d="M110.584 64.9142H99.142C99.142 41.7651 80.173 23 56.7724 23C33.6612 23 14.8716 41.3057 14.4118 64.0583C13.936 87.5223 35.8758 107.053 59.9884 105.926C71.2869 105.398 81.4565 100.188 88.6424 92.0656L109.943 66.4912C110.727 65.5497 110.727 64.9142 109.943 64.9142H110.584ZM40.2647 68.5765C40.2647 72.2388 37.2494 75.1917 33.5086 75.1917C29.7678 75.1917 26.7525 72.2388 26.7525 68.5765V59.5706C26.7525 55.9083 29.7678 52.9554 33.5086 52.9554C37.2494 52.9554 40.2647 55.9083 40.2647 59.5706V68.5765ZM62.4039 68.5765C62.4039 72.2388 59.3886 75.1917 55.6478 75.1917C51.907 75.1917 48.8917 72.2388 48.8917 68.5765V59.5706C48.8917 55.9083 51.907 52.9554 55.6478 52.9554C59.3886 52.9554 62.4039 55.9083 62.4039 59.5706V68.5765Z" fill="#AB9FF2"/>
                  </svg>
                </div>
                <div className="text-left flex-1">
                  <div className="font-bold text-white">Phantom</div>
                  <div className="text-xs text-gray-400">Tap to open</div>
                </div>
                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>

              {/* Solflare */}
              <button
                onClick={openInSolflare}
                className="w-full flex items-center gap-3 p-4 rounded-xl bg-[#FC9F26]/10 border border-[#FC9F26]/30 hover:bg-[#FC9F26]/20 transition-colors"
              >
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#FC9F26] to-[#FFD93D] flex items-center justify-center flex-shrink-0">
                  <svg className="w-6 h-6" viewBox="0 0 32 32" fill="none">
                    <path d="M16 2L4 9V23L16 30L28 23V9L16 2Z" fill="white"/>
                    <path d="M16 6L8 10.5V19.5L16 24L24 19.5V10.5L16 6Z" fill="#FC9F26"/>
                  </svg>
                </div>
                <div className="text-left flex-1">
                  <div className="font-bold text-white">Solflare</div>
                  <div className="text-xs text-gray-400">Tap to open</div>
                </div>
                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>

            <p className="text-xs text-gray-500 text-center">
              Your wallet app will open this page in its built-in browser
            </p>

            <button
              onClick={() => setShowMobileHelper(false)}
              className="w-full py-2 text-sm text-gray-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </>
  );
}
