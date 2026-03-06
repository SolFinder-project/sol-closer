'use client';

import { ScanResult } from '@/types/token-account';

interface ClaimSummaryProps {
  scanResult: ScanResult | null;
  selectedCount: number;
  /** Optional: tier-based fee % (from effective-fee API). When provided, display matches actual reclaim. */
  feePercent?: number;
  /** Optional: tier-based referral % (from effective-fee API). When provided, subtract from net if referrer active. */
  referralPercent?: number;
  /** Optional: whether a referrer is active (to show referral deduction in summary). */
  hasReferrer?: boolean;
}

export default function ClaimSummary({ scanResult, selectedCount, feePercent, referralPercent = 0, hasReferrer = false }: ClaimSummaryProps) {
  if (!scanResult) return null;

  const selectedReclaimable = (selectedCount * (scanResult.closeableAccounts[0]?.rentExemptReserve || 0)) / 1e9;
  const feePercentage = feePercent ?? Number(process.env.NEXT_PUBLIC_SERVICE_FEE_PERCENTAGE || 20);
  const referralPercentage = hasReferrer ? (referralPercent ?? Number(process.env.NEXT_PUBLIC_REFERRAL_FEE_PERCENTAGE || 10)) : 0;
  const selectedFee = (selectedReclaimable * feePercentage) / 100;
  const selectedReferral = (selectedReclaimable * referralPercentage) / 100;
  const selectedNet = selectedReclaimable - selectedFee - selectedReferral;

  return (
    <div className="card-cyber neon-border">
      <h3 className="text-2xl font-bold font-[family-name:var(--font-orbitron)] mb-6 text-glow">
        <span className="text-transparent bg-clip-text bg-gradient-to-r from-neon-purple to-neon-pink">
          Claim Summary
        </span>
      </h3>
      
      <div className="space-y-4">
        <div className="flex justify-between items-center p-3 rounded-lg bg-dark-bg/50">
          <span className="text-gray-400">Selected Accounts</span>
          <span className="font-bold text-xl font-mono text-neon-cyan">{selectedCount}</span>
        </div>
        
        <div className="flex justify-between items-center p-3 rounded-lg bg-dark-bg/50">
          <span className="text-gray-400">Total Reclaimable</span>
          <span className="font-bold text-xl font-mono text-neon-green">
            {selectedReclaimable.toFixed(6)} SOL
          </span>
        </div>
        
        <div className="flex justify-between items-center p-3 rounded-lg bg-dark-bg/50">
          <span className="text-gray-400">Service Fee ({feePercentage}%)</span>
          <span className="font-bold text-xl font-mono text-orange-500">
            -{selectedFee.toFixed(6)} SOL
          </span>
        </div>
        {hasReferrer && referralPercentage > 0 && (
          <div className="flex justify-between items-center p-3 rounded-lg bg-dark-bg/50">
            <span className="text-gray-400">Referrer ({referralPercentage}%)</span>
            <span className="font-bold text-xl font-mono text-neon-green">
              -{selectedReferral.toFixed(6)} SOL
            </span>
          </div>
        )}
        <div className="pt-4 border-t-2 border-neon-purple/30">
          <div className="flex justify-between items-center p-4 rounded-lg bg-gradient-to-r from-neon-purple/20 to-neon-pink/20">
            <span className="text-lg font-semibold text-gray-200">You Receive</span>
            <span className="text-3xl font-bold font-mono text-glow">
              {selectedNet.toFixed(6)} SOL
            </span>
          </div>
        </div>
      </div>

      <p className="text-xs text-gray-500 mt-6 text-center font-mono">
        💡 Service fee helps maintain and improve SolPit
      </p>
    </div>
  );
}
