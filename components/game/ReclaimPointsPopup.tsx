'use client';

/**
 * Popup shown after a successful reclaim: "You earned X points for the F1 game" + CTA to game page.
 * Formula (must match getPointsForWallet in lib/supabase/game.ts): 2000 pts per 1 SOL (net) + bonus by reclaim type.
 */
const POINTS_PER_SOL = 2000;
const BONUS_BY_TYPE: Record<string, number> = {
  empty: 12,
  dust: 18,
  full_reclaim: 50,
  pump: 28,
  pumpswap: 34,
  drift: 22,
  nft_burn: 22,
  cnft_close: 22,
  openorders: 14,
};
const DEFAULT_BONUS = 14;

export function pointsFromReclaim(solReclaimed: number, reclaimType?: string): number {
  const bonus = (reclaimType && BONUS_BY_TYPE[reclaimType]) ?? DEFAULT_BONUS;
  return Math.floor(solReclaimed * POINTS_PER_SOL) + bonus;
}

export interface ReclaimPointsPopupProps {
  /** Points earned from this reclaim */
  points: number;
  /** SOL amount reclaimed (for display) */
  solReclaimed: number;
  onClose: () => void;
  onGoToGame: () => void;
}

export default function ReclaimPointsPopup({
  points,
  solReclaimed,
  onClose,
  onGoToGame,
}: ReclaimPointsPopupProps) {
  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="reclaim-points-title"
    >
      <div
        className="relative w-full max-w-md rounded-2xl border-2 border-red-500/40 bg-gradient-to-b from-dark-card to-dark-bg shadow-xl shadow-red-500/10 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Decorative top bar */}
        <div className="h-1.5 bg-gradient-to-r from-red-500 via-amber-500 to-red-500" />

        <div className="p-6 md:p-8 text-center">
          <div className="text-5xl mb-4">🏁</div>
          <h2 id="reclaim-points-title" className="text-xl md:text-2xl font-bold font-[family-name:var(--font-orbitron)] text-white mb-2">
            Points for your car!
          </h2>
          <p className="text-3xl md:text-4xl font-bold text-red-400 mb-1">
            +{points} pts
          </p>
          <p className="text-sm text-gray-500 mb-4">
            From {solReclaimed.toFixed(6)} SOL reclaimed
          </p>
          <p className="text-sm text-gray-400 mb-6">
            Use these points to upgrade your car in the <strong className="text-gray-300">Weekly F1 Race</strong>. Better upgrades = better lap time. Race runs automatically every Sunday — no need to be there.
          </p>
          <p className="text-xs text-amber-300/90 mb-4">
            Not registered yet? Enter this week&apos;s race and compete for the prize pool →
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              type="button"
              onClick={onGoToGame}
              className="px-6 py-3 rounded-xl font-semibold bg-red-500/90 hover:bg-red-500 text-white transition-colors border border-red-400/50"
            >
              Go to F1 Race →
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-3 rounded-xl font-medium border border-dark-border text-gray-400 hover:text-white hover:border-gray-500 transition-colors"
            >
              Maybe later
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
