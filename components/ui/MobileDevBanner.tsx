'use client';

import { useState, useEffect } from 'react';

const STORAGE_KEY = 'solcloser_mobile_dev_banner_dismissed';

function isLocalOrigin(hostname: string): boolean {
  return (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname.startsWith('192.168.') ||
    hostname.startsWith('10.')
  );
}

export default function MobileDevBanner() {
  const [visible, setVisible] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || typeof window === 'undefined') return;
    const dismissed = sessionStorage.getItem(STORAGE_KEY) === '1';
    const mobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    const local = isLocalOrigin(window.location.hostname);
    if (mobile && local && !dismissed) setVisible(true);
  }, [mounted]);

  const dismiss = () => {
    sessionStorage.setItem(STORAGE_KEY, '1');
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="sticky top-0 z-40 bg-amber-500/15 border-b border-amber-500/30 px-3 py-2 flex items-center justify-between gap-2 text-sm">
      <p className="text-amber-200 flex-1 min-w-0">
        <span className="font-semibold">Mobile + dev local :</span> pour connecter Phantom, utilise une URL HTTPS. Lance dans un 2ᵉ terminal : <code className="bg-black/30 px-1 rounded text-xs">npx ngrok http 3000</code>, puis ouvre l’URL <strong>https://</strong> affichée sur ton tel.
      </p>
      <button
        type="button"
        onClick={dismiss}
        className="shrink-0 p-1.5 rounded hover:bg-amber-500/20 text-amber-200"
        aria-label="Fermer"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}
