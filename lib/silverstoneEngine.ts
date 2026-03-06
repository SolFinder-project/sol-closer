/**
 * Silverstone Engine – moteur déterministe pour le mini-jeu F1 SOLcloser.
 * Circuit de référence : Silverstone, 52 tours. Zéro RNG.
 * À configuration identique + même nombre d'interactions = même temps à la ms près.
 */

/** 8 catégories d'amélioration de la voiture (points dépensés par le joueur). */
export const SILVERSTONE_CATEGORY_IDS = [
  'aero',
  'power',
  'tyreMgmt',
  'balance',
  'stability',
  'traction',
  'braking',
  'response',
] as const;

export type SilverstoneCategoryId = (typeof SILVERSTONE_CATEGORY_IDS)[number];

/** Configuration de la voiture : points alloués par catégorie. */
export type SilverstoneConfig = Record<SilverstoneCategoryId, number>;

/** Poids par catégorie pour Silverstone (ordre = SILVERSTONE_CATEGORY_IDS). */
const WEIGHTS: Record<SilverstoneCategoryId, number> = {
  aero: 0.25,
  power: 0.2,
  tyreMgmt: 0.15,
  balance: 0.12,
  stability: 0.12,
  traction: 0.07,
  braking: 0.05,
  response: 0.04,
};

/** Temps de base : 1h 32m 15s 000ms = 5 535 000 ms (52 tours Silverstone). */
export const SILVERSTONE_BASE_TIME_MS = 5_535_000;

/** Multiplicateur global pour que ~1000 points bien placés ≈ 4–5 min de gain. */
const GAIN_MULTIPLIER = 4000;

/** Exposant de rendement décroissant. */
const GAIN_EXPONENT = 0.85;

/** Coefficients de pénalité (ms par point d'excédent ou de déficit). */
const PENALTY_DRAG_MS_PER_POINT = 50;
const PENALTY_MAGGOTTS_MS_PER_POINT = 80;
const PENALTY_WHEELSPIN_MS_PER_POINT = 60;
/** Pénalité pneus : (charge - tyreMgmt) * 52 tours * ce facteur (ms). */
const PENALTY_TYRES_MS_PER_POINT_PER_LAP = 100;
const SILVERSTONE_LAPS = 52;

export interface SilverstoneResult {
  /** Temps final en millisecondes (pour tri leaderboard). */
  finalTimeMs: number;
  /** Temps formaté pour l'UI (ex: "1h 28m 14s 342ms"). */
  formattedTime: string;
  /** Messages d'avertissement si le joueur déclenche des pénalités. */
  warnings: string[];
}

/**
 * Lit une config arbitraire (Record<string, number>) et retourne les 8 valeurs
 * (0 si absent ou clé inconnue).
 */
function getConfigValues(config: Record<string, number>): Record<SilverstoneCategoryId, number> {
  const out = {} as Record<SilverstoneCategoryId, number>;
  for (const id of SILVERSTONE_CATEGORY_IDS) {
    out[id] = Math.max(0, Number(config[id] ?? 0)) || 0;
  }
  return out;
}

/**
 * Formate un temps en millisecondes en "Xh Ym Zs Wms".
 */
export function formatRaceTime(ms: number): string {
  const totalMs = Math.max(0, Math.round(ms));
  const h = Math.floor(totalMs / 3_600_000);
  const m = Math.floor((totalMs % 3_600_000) / 60_000);
  const s = Math.floor((totalMs % 60_000) / 1_000);
  const remainderMs = totalMs % 1_000;
  const parts: string[] = [];
  if (h > 0) parts.push(`${h}h`);
  parts.push(`${m}m`);
  parts.push(`${s}s`);
  parts.push(`${remainderMs}ms`);
  return parts.join(' ');
}

/** Short, generic messages (no category names) so the player has to figure out what to improve. */
const WARNINGS_EN = {
  drag: 'The car was slow on the straights.',
  maggotts: 'The car was nervous through the fast direction changes.',
  wheelspin: 'You lost drive coming out of the slow corners.',
  tyres: 'The car was hard on the tyres over the race distance.',
} as const;

/**
 * Moteur Silverstone : fonction pure.
 * @param config Points alloués par catégorie (clés = aero, power, tyreMgmt, balance, stability, traction, braking, response)
 * @param interactionCount Nombre d'actions du joueur sur SOLcloser dans la semaine (tie-breaker : -1 ms par interaction)
 * @param options.lang 'en' pour les warnings en anglais (ex: rapport post-course).
 * @returns Temps final, chaîne formatée, et warnings.
 */
export function computeSilverstoneRaceTime(
  config: Record<string, number>,
  interactionCount: number,
  options?: { lang?: 'en' }
): SilverstoneResult {
  const c = getConfigValues(config);
  const en = options?.lang === 'en';
  const warnings: string[] = [];

  // ─── A. Gain de temps brut (rendement décroissant) ───
  let rawGain = 0;
  for (const id of SILVERSTONE_CATEGORY_IDS) {
    const points = c[id];
    rawGain += Math.pow(points, GAIN_EXPONENT) * WEIGHTS[id];
  }
  const totalGainMs = rawGain * GAIN_MULTIPLIER;
  let timeMs = Math.max(0, SILVERSTONE_BASE_TIME_MS - totalGainMs);

  // ─── B. Pénalités (synergies / déséquilibres) ───
  let penaltyMs = 0;

  // Règle Drag (Aero vs Power)
  const powerThreshold = c.power * 1.5;
  if (c.aero > powerThreshold) {
    const excess = c.aero - powerThreshold;
    penaltyMs += excess * PENALTY_DRAG_MS_PER_POINT;
    warnings.push(en ? WARNINGS_EN.drag : 'La voiture était en perte de vitesse en ligne droite.');
  }

  // Règle Maggotts (Aero vs Balance)
  const balanceMin = c.aero * 0.4;
  if (c.balance < balanceMin) {
    const deficit = balanceMin - c.balance;
    penaltyMs += deficit * PENALTY_MAGGOTTS_MS_PER_POINT;
    warnings.push(en ? WARNINGS_EN.maggotts : 'La voiture était nerveuse dans les enchaînements rapides.');
  }

  // Règle Wheelspin (Power vs Grip)
  const grip = c.stability + c.traction;
  const gripThreshold = grip * 1.2;
  if (c.power > gripThreshold) {
    const excess = c.power - gripThreshold;
    penaltyMs += excess * PENALTY_WHEELSPIN_MS_PER_POINT;
    warnings.push(en ? WARNINGS_EN.wheelspin : 'Tu as perdu de la motricité en sortie de virages lents.');
  }

  // Règle Pneus (Usure vs TyreMgmt)
  const tyreLoad = (c.aero + c.power) * 0.25;
  if (c.tyreMgmt < tyreLoad) {
    const deficit = tyreLoad - c.tyreMgmt;
    penaltyMs += deficit * SILVERSTONE_LAPS * PENALTY_TYRES_MS_PER_POINT_PER_LAP;
    warnings.push(en ? WARNINGS_EN.tyres : 'La voiture a beaucoup usé les pneus sur la distance.');
  }

  timeMs += penaltyMs;

  // ─── C. Tie-breaker (récompense l'activité sur le dApp) ───
  const interactions = Math.max(0, Math.floor(Number(interactionCount) || 0));
  timeMs = Math.max(0, timeMs - interactions);

  return {
    finalTimeMs: Math.round(timeMs),
    formattedTime: formatRaceTime(timeMs),
    warnings,
  };
}
