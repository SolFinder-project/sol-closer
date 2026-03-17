'use client';

/**
 * F1 Weekly Race – full UI: points, registration, upgrades, leaderboard.
 * Reclaim SOL → earn points → upgrade your car → compete for the best lap time.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { PublicKey, Transaction, SystemProgram } from '@solana/web3.js';
import { UPGRADE_CATEGORIES } from '@/lib/supabase/game';
import { formatRaceTime, SILVERSTONE_BASE_TIME_MS } from '@/lib/silverstoneEngine';
import type { NftCreatorTier } from '@/types/nftCreator';

const LAMPORTS_PER_SOL = 1e9;
const F1_TREASURY = process.env.NEXT_PUBLIC_F1_TREASURY_WALLET ?? '';

/** Next Sunday 17:00 UTC in ms (or next week if past). */
function getNextRaceEndMs(): number {
  const now = new Date();
  const utc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), now.getUTCHours(), now.getUTCMinutes()));
  const day = utc.getUTCDay();
  const daysUntilSunday = day === 0 ? 0 : 7 - day;
  const nextSunday = new Date(utc);
  nextSunday.setUTCDate(utc.getUTCDate() + daysUntilSunday);
  nextSunday.setUTCHours(17, 0, 0, 0);
  let ts = nextSunday.getTime();
  if (ts <= Date.now()) ts += 7 * 86400000;
  return ts;
}

function formatCountdown(ms: number): string {
  if (ms <= 0) return 'Race closed';
  const d = Math.floor(ms / 86400000);
  const h = Math.floor((ms % 86400000) / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return `${d}d ${h}h ${m}m`;
}

/** Benefit copy per Creator tier for F1 page (race time only; no reclaim on this page). */
function getCreatorTierBenefitsCopyF1(tier: NftCreatorTier): string {
  switch (tier) {
    case 'platinum':
      return '−6s on your race time';
    case 'gold':
      return '−4s on your race time';
    case 'silver':
      return '−1.5s on your race time';
    default:
      return 'Creator badge (no race time bonus)';
  }
}

interface GameEvent {
  id: string;
  leagueName: string;
  entryFeeSol: number;
  weekEnd: string;
  status: string;
  participantCount?: number;
  prizePoolSol?: number;
}

interface RegStatus {
  eventId: string;
  leagueName: string;
  registered: boolean;
  upgradeConfig: Record<string, number>;
  /** Not sent by API before race closes (keeps suspense). */
  lapTimeMs?: number | null;
}

export default function F1GamePage() {
  const { connected, publicKey, sendTransaction } = useWallet();
  const { connection } = useConnection();
  const [countdownMs, setCountdownMs] = useState<number>(() => Math.max(0, getNextRaceEndMs() - Date.now()));

  const [points, setPoints] = useState<number | null>(null);
  const [events, setEvents] = useState<GameEvent[]>([]);
  const [lastClosedEvents, setLastClosedEvents] = useState<GameEvent[]>([]);
  const [registrations, setRegistrations] = useState<RegStatus[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [registeringEventId, setRegisteringEventId] = useState<string | null>(null);
  const [upgradeSaving, setUpgradeSaving] = useState(false);
  const [selectedLeaderboardEventId, setSelectedLeaderboardEventId] = useState<string | null>(null);
  const [leaderboard, setLeaderboard] = useState<{ position: number; wallet: string; lapTimeMs: number | null; isYou?: boolean }[]>([]);
  const [leaderboardEventClosed, setLeaderboardEventClosed] = useState(false);
  const [leaderboardParticipantCount, setLeaderboardParticipantCount] = useState(0);
  const [prizePoolSol, setPrizePoolSol] = useState<number>(0);
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);
  const [playerWarnings, setPlayerWarnings] = useState<string[]>([]);
  const [upgradeSuccessMessage, setUpgradeSuccessMessage] = useState('');
  const [myLastRaceResult, setMyLastRaceResult] = useState<{ position: number; leagueName: string } | null>(null);
  const [creatorNfts, setCreatorNfts] = useState<{ mint: string; name: string; tier: NftCreatorTier }[] | null>(null);

  const walletStr = publicKey?.toBase58() ?? '';

  const fetchGameState = useCallback(async () => {
    if (!walletStr) return;
    setLoading(true);
    setError('');
    try {
      const [pointsRes, eventsRes, regRes] = await Promise.all([
        fetch(`/api/game/points?wallet=${encodeURIComponent(walletStr)}`, { cache: 'no-store' }),
        fetch('/api/game/events', { cache: 'no-store' }),
        fetch(`/api/game/registration?wallet=${encodeURIComponent(walletStr)}`, { cache: 'no-store' }),
      ]);
      if (pointsRes.ok) {
        const d = await pointsRes.json();
        setPoints(d.points ?? 0);
      }
      if (eventsRes.ok) {
        const d = await eventsRes.json();
        setEvents(d.events ?? []);
        setLastClosedEvents(d.lastClosedEvents ?? []);
      }
      if (regRes.ok) {
        const d = await regRes.json();
        setRegistrations(d.registrations ?? []);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load game state');
    } finally {
      setLoading(false);
    }
  }, [walletStr]);

  useEffect(() => {
    if (!connected || !walletStr) {
      setPoints(null);
      setEvents([]);
      setLastClosedEvents([]);
      setRegistrations([]);
      setLeaderboard([]);
      setMyLastRaceResult(null);
      return;
    }
    setPoints(null);
    setEvents([]);
    setLastClosedEvents([]);
    setRegistrations([]);
    setLeaderboard([]);
    setMyLastRaceResult(null);
    setLoading(true);
    fetchGameState();
  }, [connected, walletStr, fetchGameState]);

  const leaderboardTabs = lastClosedEvents.length > 0 ? lastClosedEvents : events;
  useEffect(() => {
    if (leaderboardTabs.length > 0 && (!selectedLeaderboardEventId || !leaderboardTabs.some((e) => e.id === selectedLeaderboardEventId)))
      setSelectedLeaderboardEventId(leaderboardTabs[0].id);
  }, [events, lastClosedEvents, selectedLeaderboardEventId]);

  // Countdown: use event week_end when available (aligns with backend close), else next Sunday 17:00 UTC
  useEffect(() => {
    const tick = () => {
      const endMs =
        events.length > 0 ? new Date(events[0].weekEnd).getTime() : getNextRaceEndMs();
      setCountdownMs(Math.max(0, endMs - Date.now()));
    };
    tick();
    const id = setInterval(tick, 60000);
    return () => clearInterval(id);
  }, [events]);

  useEffect(() => {
    if (!selectedLeaderboardEventId) {
      setLeaderboard([]);
      setLeaderboardEventClosed(false);
      setLeaderboardParticipantCount(0);
      setPrizePoolSol(0);
      setPlayerWarnings([]);
      return;
    }
    setLeaderboardLoading(true);
    const url = walletStr
      ? `/api/game/leaderboard?eventId=${encodeURIComponent(selectedLeaderboardEventId)}&wallet=${encodeURIComponent(walletStr)}`
      : `/api/game/leaderboard?eventId=${encodeURIComponent(selectedLeaderboardEventId)}`;
    fetch(url, { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => {
        setLeaderboard(d.leaderboard ?? []);
        setLeaderboardEventClosed(d.isEventClosed === true);
        setLeaderboardParticipantCount(d.participantCount ?? 0);
        setPrizePoolSol(d.prizePoolSol ?? 0);
        setPlayerWarnings(Array.isArray(d.playerWarnings) ? d.playerWarnings : []);
      })
      .catch(() => setLeaderboard([]))
      .finally(() => setLeaderboardLoading(false));
  }, [selectedLeaderboardEventId, walletStr]);

  // Compute "my last race" from closed events so we can show the banner at top (no tab dependency)
  useEffect(() => {
    if (!walletStr || lastClosedEvents.length === 0) {
      setMyLastRaceResult(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const results = await Promise.all(
        lastClosedEvents.map((ev) =>
          fetch(`/api/game/leaderboard?eventId=${encodeURIComponent(ev.id)}&wallet=${encodeURIComponent(walletStr)}`, { cache: 'no-store' }).then((r) => r.json())
        )
      );
      if (cancelled) return;
      for (let i = 0; i < results.length; i++) {
        const d = results[i];
        const row = (d.leaderboard ?? []).find((r: { isYou?: boolean }) => r.isYou);
        if (row && lastClosedEvents[i]) {
          setMyLastRaceResult({ position: row.position, leagueName: lastClosedEvents[i].leagueName });
          return;
        }
      }
      setMyLastRaceResult(null);
    })();
    return () => {
      cancelled = true;
    };
  }, [walletStr, lastClosedEvents]);

  // SolPit Creator NFTs in wallet (name + tier) for benefits banner
  useEffect(() => {
    if (!walletStr) {
      setCreatorNfts(null);
      return;
    }
    let cancelled = false;
    fetch(`/api/nft-creator/wallet-benefits?wallet=${encodeURIComponent(walletStr)}`)
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled && Array.isArray(d.nfts) && d.nfts.length > 0) {
          setCreatorNfts(d.nfts);
        } else {
          setCreatorNfts(null);
        }
      })
      .catch(() => {
        if (!cancelled) setCreatorNfts(null);
      });
    return () => {
      cancelled = true;
    };
  }, [walletStr]);

  const handleRegister = async (eventId: string, entryFeeSol: number) => {
    if (!publicKey || !sendTransaction || !F1_TREASURY) {
      setError('Wallet or treasury not configured');
      return;
    }
    setRegisteringEventId(eventId);
    setError('');
    try {
      const lamports = Math.round(entryFeeSol * LAMPORTS_PER_SOL);
      const tx = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: publicKey,
          toPubkey: new PublicKey(F1_TREASURY),
          lamports,
        })
      );
      const sig = await sendTransaction(tx, connection, { skipPreflight: false });
      // Wait for confirmation so the server can read the tx (avoids "paid but not registered").
      const CONFIRM_MS = 45_000;
      const POLL_MS = 2_000;
      const deadline = Date.now() + CONFIRM_MS;
      while (Date.now() < deadline) {
        const status = await connection.getSignatureStatus(sig);
        if (status?.value?.confirmationStatus === 'confirmed' || status?.value?.confirmationStatus === 'finalized') {
          break;
        }
        await new Promise((r) => setTimeout(r, POLL_MS));
      }
      const body = { eventId, wallet: walletStr, signature: sig };
      const doRegister = () =>
        fetch('/api/game/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
      let res = await doRegister();
      let data: { error?: string } = await res.json().catch(() => ({}));
      if (!res.ok && typeof data?.error === 'string' && data.error.includes('Transaction not found or not confirmed')) {
        for (let i = 0; i < 5; i++) {
          await new Promise((r) => setTimeout(r, 2000));
          res = await doRegister();
          data = await res.json().catch(() => ({}));
          if (res.ok) break;
          if (!data?.error?.includes('Transaction not found or not confirmed')) break;
        }
      }
      if (!res.ok) throw new Error(data?.error || 'Registration failed');
      await fetchGameState();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Registration failed');
    } finally {
      setRegisteringEventId(null);
    }
  };

  const myRegistration = registrations.find((r) => r.registered);
  const currentConfig = myRegistration?.upgradeConfig ?? {};

  const [localUpgrades, setLocalUpgrades] = useState<Record<string, number>>(currentConfig);
  useEffect(() => {
    setLocalUpgrades(currentConfig);
  }, [myRegistration?.eventId, JSON.stringify(currentConfig)]);

  const totalSpent = Object.values(localUpgrades).reduce((a, b) => a + (Number(b) || 0), 0);
  const pointsAvailable = points ?? 0;
  const totalSpentFromServer = Object.values(currentConfig).reduce((a, b) => a + (Number(b) || 0), 0);
  const effectivePointsAvailable = Math.max(pointsAvailable, totalSpentFromServer);
  const overSpent = totalSpent > effectivePointsAvailable;

  const handleSaveUpgrades = async () => {
    if (!myRegistration || !walletStr || overSpent) return;
    setUpgradeSaving(true);
    setError('');
    setUpgradeSuccessMessage('');
    try {
      const res = await fetch('/api/game/registration', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventId: myRegistration.eventId,
          wallet: walletStr,
          upgradeConfig: localUpgrades,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save failed');
      await fetchGameState();
      setUpgradeSuccessMessage('Upgrades saved. They are locked until race day.');
      setTimeout(() => setUpgradeSuccessMessage(''), 5000);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setUpgradeSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      {/* Hero */}
      <div className="text-center mb-10 md:mb-12">
        <p className="text-xs font-medium text-red-500/90 uppercase tracking-wider mb-2">
          Weekly competition
        </p>
        <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold font-[family-name:var(--font-orbitron)] text-white mb-3">
          SolPit F1 Race
        </h1>
        <p className="text-base text-gray-400 max-w-2xl mx-auto">
          Reclaim SOL → earn points → upgrade your car → compete for the best lap time. One race per week. Prize pool in SOL for the top 3. Skill-based, no luck.
        </p>
      </div>

      {/* Last race: visible as soon as the user lands on the page, above the 3 sections */}
      {connected && myLastRaceResult && (
        <div className="mb-6 p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-center">
          <p className="text-sm text-amber-300">
            Last race: you finished <span className="font-bold text-white">#{myLastRaceResult.position}</span> in <span className="font-semibold text-white">{myLastRaceResult.leagueName}</span>
          </p>
        </div>
      )}

      {/* SolPit Creator NFT detected: name, type, concrete benefits */}
      {connected && creatorNfts && creatorNfts.length > 0 && (() => {
        const TIER_ORDER_F1: NftCreatorTier[] = ['platinum', 'gold', 'silver', 'standard'];
        const best = creatorNfts.reduce((a, b) =>
          TIER_ORDER_F1.indexOf(b.tier) < TIER_ORDER_F1.indexOf(a.tier) ? b : a
        );
        const names = creatorNfts.map((n) => `${n.name} (${n.tier})`).join(', ');
        const benefits = getCreatorTierBenefitsCopyF1(best.tier);
        const collectorNote = creatorNfts.length >= 2 ? ' + collector bonus (−1s with 2+ NFTs)' : '';
        return (
          <div className="mb-6 p-4 rounded-xl bg-amber-500/10 border border-amber-500/40 text-left">
            <p className="text-xs font-semibold text-amber-400 uppercase tracking-wider mb-1">
              SolPit Creator NFT detected
            </p>
            <p className="text-sm text-gray-200 mb-1">
              <span className="font-semibold text-white">{names}</span>
            </p>
            <p className="text-sm text-amber-200/90">
              Your benefits: {benefits}{collectorNote}
            </p>
          </div>
        );
      })()}

      {/* How it works */}
      <div className="grid md:grid-cols-3 gap-4 mb-10">
        <div className="card-cyber border-red-500/20 bg-red-500/5 p-5 text-center">
          <span className="text-3xl block mb-2">🏁</span>
          <h3 className="font-bold text-red-400 mb-1">1. Reclaim & earn points</h3>
          <p className="text-xs text-gray-400">Every reclaim gives you points. Use them to upgrade braking, power, aero, balance, traction.</p>
        </div>
        <div className="card-cyber border-amber-500/20 bg-amber-500/5 p-5 text-center">
          <span className="text-3xl block mb-2">🔧</span>
          <h3 className="font-bold text-amber-400 mb-1">2. Pit stop</h3>
          <p className="text-xs text-gray-400">Before race day, spend your points on upgrades. Your setup = your lap time.</p>
        </div>
        <div className="card-cyber border-neon-green/20 bg-neon-green/5 p-5 text-center">
          <span className="text-3xl block mb-2">🏆</span>
          <h3 className="font-bold text-neon-green mb-1">3. Race day (Sunday)</h3>
          <p className="text-xs text-gray-400">At 17:00 UTC the race runs automatically. Best time wins. No action needed.</p>
        </div>
      </div>

      {/* Reference track (Silverstone 52 laps) */}
      <div className="card-cyber border-dark-border p-5 mb-6">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">
          This week&apos;s track: Silverstone — 52 laps · Base time: {formatRaceTime(SILVERSTONE_BASE_TIME_MS)}
        </h2>
        <p className="text-sm text-gray-400 leading-relaxed">
          Fast, flowing circuit with long straights and sweeping high-speed corners. The opening sequence mixes fast sections and slower hairpins. The middle of the lap is dominated by very fast direction changes where high-speed stability is crucial and heavily loads the front-left tyre. The end of the lap combines a long full-throttle section with a more technical zone where precision is decisive.
        </p>
      </div>

      {/* Countdown */}
      <div className="card-cyber border-red-500/20 bg-red-500/5 p-4 mb-6 text-center">
        <p className="text-xs text-gray-500 uppercase tracking-wider">Race closes</p>
        <p className="text-2xl font-mono font-bold text-red-400">{formatCountdown(countdownMs)}</p>
        <p className="text-xs text-gray-500 mt-1">Sunday 17:00 UTC</p>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-500/20 border border-red-500/40 text-red-300 text-sm">
          {error}
        </div>
      )}

      {!connected ? (
        <div className="card-cyber border-neon-purple/30 bg-neon-purple/5 p-6 md:p-8 mb-10 text-center">
          <p className="text-gray-300 mb-4">Connect your wallet to see your points, register for a league, and upgrade your car.</p>
          <p className="text-sm text-gray-500">Use the wallet button above to connect.</p>
        </div>
      ) : (
        <>
          {/* Points & Race hub */}
          <div className="card-cyber border-neon-purple/30 bg-neon-purple/5 p-6 md:p-8 mb-6">
            <h2 className="text-xl font-bold font-[family-name:var(--font-orbitron)] text-white mb-2">Your race hub</h2>
            {loading ? (
              <p className="text-gray-500">Loading…</p>
            ) : (
              <>
                <p className="text-sm text-gray-400 mb-2">
                  This week&apos;s points: <strong className="text-white font-mono">{effectivePointsAvailable}</strong> pts
                  {myRegistration && (
                    <>
                      <span className="ml-2 text-amber-300"> · Registered in {myRegistration.leagueName}</span>
                      {(() => {
                        const spent = Object.values(myRegistration.upgradeConfig ?? {}).reduce((a, b) => a + (Number(b) || 0), 0);
                        const effMax = Math.max(points ?? 0, spent);
                        const available = Math.max(0, effMax - spent);
                        return (
                          <span className="block mt-1 text-gray-400">
                            Spent on upgrades: <span className="font-mono text-amber-300">{spent}</span> pts · Available: <span className="font-mono text-white">{available}</span> pts
                          </span>
                        );
                      })()}
                    </>
                  )}
                </p>
                {myRegistration && countdownMs > 0 && (
                  <div className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-500/20 text-amber-300 text-sm mt-2">
                    <span>🔧</span> Pit stop — Reclaim to earn more points, improve your car before race day!
                  </div>
                )}
              </>
            )}
          </div>

          {/* Leagues & Register */}
          <div className="mb-10">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider text-center mb-1">
              Leagues (entry fee per week)
            </h2>
            <p className="text-xs text-gray-500 text-center mb-4">One league per week. Once registered, you cannot join another until the next week.</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {events.map((ev) => {
                const reg = registrations.find((r) => r.eventId === ev.id);
                const isRegistered = reg?.registered ?? false;
                const isRegistering = registeringEventId === ev.id;
                return (
                  <div
                    key={ev.id}
                    className={`card-cyber p-4 text-center ${
                      ev.leagueName === 'Bronze'
                        ? 'border-amber-700/40 bg-amber-500/10'
                        : ev.leagueName === 'Silver'
                          ? 'border-gray-400/40 bg-gray-500/10'
                          : 'border-amber-400/40 bg-amber-400/10'
                    }`}
                  >
                    <p className="font-bold text-gray-200">{ev.leagueName}</p>
                    <p className="text-lg font-mono text-white">{ev.entryFeeSol} SOL</p>
                    <p className="text-xs text-gray-400 mt-1">
                      {ev.participantCount != null ? (
                        <><span className="font-mono text-gray-300">{ev.participantCount}</span> participant{ev.participantCount !== 1 ? 's' : ''}</>
                      ) : (
                        '—'
                      )}
                      {ev.prizePoolSol != null && (
                        <> · <span className="font-mono text-amber-400/90">{ev.prizePoolSol.toFixed(4)} SOL</span> prize pool</>
                      )}
                    </p>
                    {isRegistered ? (
                      <p className="text-xs text-neon-green mt-1">You&apos;re in this league</p>
                    ) : myRegistration ? (
                      <p className="text-xs text-gray-500 mt-1">Other league (one per week)</p>
                    ) : (
                      <button
                        type="button"
                        disabled={isRegistering || !!myRegistration}
                        onClick={() => handleRegister(ev.id, ev.entryFeeSol)}
                        className="mt-2 px-4 py-2 rounded-lg bg-red-500/80 hover:bg-red-500 text-white text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isRegistering ? 'Sending…' : `Register – ${ev.entryFeeSol} SOL`}
                      </button>
                    )}
                  </div>
                );
              })}
              {events.length === 0 && !loading && (
                <p className="col-span-full text-center text-gray-500 text-sm">
                  No open events this week. Next race will open soon. See last race results below.
                </p>
              )}
            </div>
          </div>

          {/* Upgrades (if registered) */}
          {myRegistration && (
            <div className="card-cyber border-amber-500/20 bg-amber-500/5 p-6 mb-10">
              <h2 className="text-lg font-bold font-[family-name:var(--font-orbitron)] text-white mb-4">Upgrades (Pit stop)</h2>
              <p className="text-sm text-gray-400 mb-4">
                Spend your points (max {effectivePointsAvailable} this week). Silverstone 52 laps: aero, power, tyre mgmt, balance, stability, traction, braking, response. Equilibrate or you get time penalties.
              </p>
              <div className="space-y-3 mb-4">
                {UPGRADE_CATEGORIES.map((cat) => {
                  const currentVal = localUpgrades[cat.id] ?? 0;
                  const savedVal = currentConfig[cat.id] ?? 0;
                  const otherSpent = totalSpent - currentVal;
                  const maxForCategory = Math.max(savedVal, effectivePointsAvailable - otherSpent);
                  const minForCategory = savedVal;
                  return (
                    <div key={cat.id} className="flex items-center gap-3">
                      <label className="w-28 text-sm text-gray-400" title={cat.label}>{cat.shortLabel ?? cat.label}</label>
                      <input
                        type="number"
                        min={minForCategory}
                        max={maxForCategory}
                        step={1}
                        value={currentVal}
                        onChange={(e) => {
                          const raw = Math.max(minForCategory, Number(e.target.value) || 0);
                          const capped = Math.min(raw, maxForCategory);
                          setLocalUpgrades((prev) => ({ ...prev, [cat.id]: capped }));
                        }}
                        className="flex-1 rounded-lg bg-dark-bg border border-dark-border px-3 py-2 text-white font-mono text-sm"
                      />
                      <span className="text-xs text-gray-500 w-16">pts{savedVal > 0 ? ` (min ${savedVal} saved)` : ''}</span>
                    </div>
                  );
                })}
              </div>
              <div className="mb-3 rounded-lg bg-dark-bg/80 border border-dark-border p-3">
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">
                  Current allocation (saved on server)
                </p>
                <p className="text-sm text-gray-300 mb-1">
                  {UPGRADE_CATEGORIES.map((cat) => {
                    const savedVal = currentConfig[cat.id] ?? 0;
                    return (
                      <span key={cat.id}>
                        {cat.shortLabel ?? cat.label}: <span className="font-mono text-white">{savedVal}</span> pts
                        {cat.id !== UPGRADE_CATEGORIES[UPGRADE_CATEGORIES.length - 1].id ? ' · ' : ''}
                      </span>
                    );
                  })}
                </p>
                <p className={`text-sm font-medium ${overSpent ? 'text-red-400' : totalSpent <= effectivePointsAvailable ? 'text-neon-green' : 'text-gray-400'}`}>
                  Total saved: <span className="font-mono">{Object.values(currentConfig).reduce((a, b) => a + (Number(b) || 0), 0)}</span> / {effectivePointsAvailable} pts
                  {overSpent && ' (over limit)'}
                </p>
              </div>
              {upgradeSuccessMessage && (
                <p className="mb-3 text-sm text-neon-green font-medium">{upgradeSuccessMessage}</p>
              )}
              <button
                type="button"
                disabled={upgradeSaving || overSpent}
                onClick={handleSaveUpgrades}
                className="px-4 py-2 rounded-lg bg-amber-500/80 hover:bg-amber-500 text-white text-sm font-medium disabled:opacity-50"
              >
                {upgradeSaving ? 'Saving…' : 'Save upgrades'}
              </button>
            </div>
          )}

          {/* Leaderboard: last race results (closed) or current week (open) */}
          <div className="card-cyber border-dark-border p-6">
            <h2 className="text-lg font-bold font-[family-name:var(--font-orbitron)] text-white mb-4">
              {lastClosedEvents.length > 0 ? 'Last race results' : 'Leaderboard'}
            </h2>
            {leaderboardTabs.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-4">
                {leaderboardTabs.map((ev) => (
                  <button
                    key={ev.id}
                    type="button"
                    onClick={() => setSelectedLeaderboardEventId(ev.id)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
                      selectedLeaderboardEventId === ev.id
                        ? 'bg-red-500/80 text-white'
                        : 'bg-dark-bg border border-dark-border text-gray-400 hover:text-white'
                    }`}
                  >
                    {ev.leagueName}
                    {lastClosedEvents.length > 0 ? ' (results)' : ''}
                  </button>
                ))}
              </div>
            )}
            <p className="text-sm text-gray-500 mb-2">
              Prize pool: <span className="font-mono text-white">{prizePoolSol.toFixed(4)} SOL</span> (90% to top 3: 70% / 20% / 10%)
            </p>
            {lastClosedEvents.length > 0 && leaderboardEventClosed && leaderboard.some((r) => r.isYou) && (
              <div className="mb-4 rounded-lg bg-amber-500/10 border border-amber-500/30 p-3">
                <p className="text-xs font-medium text-amber-400 uppercase tracking-wider mb-2">
                  Last week, your mechanics reported that:
                </p>
                {playerWarnings.length > 0 ? (
                  <ul className="text-sm text-amber-200/90 space-y-1 list-disc list-inside">
                    {playerWarnings.map((msg, i) => (
                      <li key={i}>{msg}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-amber-200/90">No major issues with your setup.</p>
                )}
              </div>
            )}
            {leaderboardLoading ? (
              <p className="text-gray-500 py-4">Loading…</p>
            ) : leaderboardEventClosed ? (
              leaderboard.length === 0 ? (
                <p className="text-sm text-gray-500 py-4">No participants.</p>
              ) : (
                <ul className="space-y-1">
                  {leaderboard.map((r) => (
                    <li
                      key={r.position}
                      className={`flex justify-between text-sm ${r.isYou ? 'text-amber-400 font-medium' : ''}`}
                    >
                      <span className="text-gray-400">#{r.position}</span>
                      <span className="font-mono text-gray-300">
                        {r.wallet}
                        {r.isYou && ' (You)'}
                      </span>
                      <span className="font-mono text-white">
                        {r.lapTimeMs != null ? formatRaceTime(r.lapTimeMs) : '—'}
                      </span>
                    </li>
                  ))}
                </ul>
              )
            ) : (
              <div className="py-4">
                <p className="text-sm text-gray-300">
                  Registered: <span className="font-mono font-semibold text-white">{leaderboardParticipantCount}</span> player{leaderboardParticipantCount !== 1 ? 's' : ''}
                </p>
                <p className="text-xs text-amber-300/90 mt-2">
                  Ranking and lap times will be revealed when the race closes (Sunday 17:00 UTC).
                </p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
