'use client';

import Image from 'next/image';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { getBalance, getNinjaMinerState, saveNinjaMinerState, syncPoints } from '@/services/points';

interface NinjaMinerGameProps {
  walletAddress?: string;
  onOpenMoreChance?: () => void;
}

interface TapMinerState {
  ninjaBalance: number;
  cooldownEndsAt: number;
  sessionStartedAt: number;
  sessionEndsAt: number;
  sessionEarned: number;
}

interface TapBurst {
  id: number;
  amount: number;
  x: number;
  y: number;
}

const BALANCE_EVENT = 'inj-pass:ninja-balance-update';
const DEFAULT_NINJA_BALANCE = 22;
const SESSION_DURATION_MS = 15_000;
const COOLDOWN_MS = 30 * 1000;

function roundTo(value: number, digits = 2) {
  return Number(value.toFixed(digits));
}

function createInitialState(): TapMinerState {
  return {
    ninjaBalance: DEFAULT_NINJA_BALANCE,
    cooldownEndsAt: 0,
    sessionStartedAt: 0,
    sessionEndsAt: 0,
    sessionEarned: 0,
  };
}

function normalizeState(state: TapMinerState, now: number): TapMinerState {
  const next = { ...state };

  if (next.sessionEndsAt > 0 && now >= next.sessionEndsAt) {
    next.sessionStartedAt = 0;
    next.sessionEndsAt = 0;
  }

  if (next.cooldownEndsAt > 0 && now >= next.cooldownEndsAt) {
    next.cooldownEndsAt = 0;
  }

  return next;
}

function formatDuration(ms: number) {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function randomReward() {
  return roundTo((Math.floor(Math.random() * 9) + 1) / 100, 2);
}

export default function NinjaMinerGame({ walletAddress, onOpenMoreChance }: NinjaMinerGameProps) {
  const { theme } = useTheme();
  const [gameState, setGameState] = useState<TapMinerState>(() => createInitialState());
  const [bursts, setBursts] = useState<TapBurst[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [isSyncing, setIsSyncing] = useState(false);
  const prevIsActiveRef = useRef(false);
  const lastSyncedSessionKeyRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const hydrateFromBackend = async () => {
      const currentNow = Date.now();

      try {
        const [savedState, balance] = await Promise.all([
          walletAddress ? getNinjaMinerState(walletAddress) : Promise.resolve(null),
          walletAddress ? getBalance() : Promise.resolve(DEFAULT_NINJA_BALANCE),
        ]);

        if (cancelled) return;

        const restored = normalizeState(
          {
            ninjaBalance: typeof savedState?.ninjaBalance === 'number'
              ? roundTo(savedState.ninjaBalance, 2)
              : DEFAULT_NINJA_BALANCE,
            cooldownEndsAt: typeof savedState?.cooldownEndsAt === 'number' ? savedState.cooldownEndsAt : 0,
            sessionStartedAt: typeof savedState?.sessionStartedAt === 'number' ? savedState.sessionStartedAt : 0,
            sessionEndsAt: typeof savedState?.sessionEndsAt === 'number' ? savedState.sessionEndsAt : 0,
            sessionEarned: typeof savedState?.sessionEarned === 'number' ? roundTo(savedState.sessionEarned, 2) : 0,
          },
          currentNow,
        );

        const safeBalance = Number(balance);
        const nextBalance = Number.isFinite(safeBalance)
          ? roundTo(Math.max(0, safeBalance), 2)
          : restored.ninjaBalance;

        setGameState({
          ...restored,
          ninjaBalance: nextBalance,
        });
      } catch (error) {
        console.error('[NinjaMiner] Failed to hydrate state from backend:', error);
        if (!cancelled) {
          setGameState(createInitialState());
        }
      } finally {
        if (!cancelled) {
          setNow(currentNow);
          setHydrated(true);
        }
      }
    };

    setHydrated(false);
    void hydrateFromBackend();

    return () => {
      cancelled = true;
    };
  }, [walletAddress]);

  useEffect(() => {
    if (!hydrated) return;

    const timer = window.setInterval(() => {
      setNow(Date.now());
    }, 120);

    return () => window.clearInterval(timer);
  }, [hydrated]);

  const normalizedState = useMemo(() => normalizeState(gameState, now), [gameState, now]);
  const isActive = normalizedState.sessionEndsAt > now;
  const isCoolingDown = !isActive && normalizedState.cooldownEndsAt > now;

  useEffect(() => {
    if (!hydrated) return;

    const sessionKey = `${gameState.sessionStartedAt}:${gameState.sessionEndsAt}`;
    const shouldSync =
      prevIsActiveRef.current &&
      !isActive &&
      isCoolingDown &&
      gameState.sessionEarned > 0 &&
      !isSyncing &&
      lastSyncedSessionKeyRef.current !== sessionKey;

    prevIsActiveRef.current = isActive;

    if (!shouldSync) {
      return;
    }

    lastSyncedSessionKeyRef.current = sessionKey;
    void (async () => {
      setIsSyncing(true);
      try {
        const result = await syncPoints(gameState.sessionEarned);
        if (result.success && result.balance !== undefined) {
          const settledBalance = Number(result.balance);
          setGameState((prev) => ({
            ...prev,
            ninjaBalance: Number.isFinite(settledBalance) ? settledBalance : prev.ninjaBalance,
          }));
          window.dispatchEvent(new CustomEvent(BALANCE_EVENT, {
            detail: {
              walletAddress,
              ninjaBalance: Number.isFinite(settledBalance) ? settledBalance : undefined,
              reason: 'session-settled',
            },
          }));
          console.log('[NinjaMiner] Synced to backend:', gameState.sessionEarned, 'LAM, new balance:', result.balance);
        } else {
          lastSyncedSessionKeyRef.current = null;
        }
      } catch (error) {
        lastSyncedSessionKeyRef.current = null;
        console.error('[NinjaMiner] Sync failed:', error);
      } finally {
        setIsSyncing(false);
      }
    })();
  }, [hydrated, isActive, isCoolingDown, gameState.sessionEarned, gameState.sessionStartedAt, gameState.sessionEndsAt, isSyncing]);

  useEffect(() => {
    if (!hydrated || !walletAddress) return;

    const saveTimer = window.setTimeout(() => {
      void saveNinjaMinerState(walletAddress, gameState);
    }, 600);

    return () => {
      window.clearTimeout(saveTimer);
    };
  }, [gameState, hydrated, walletAddress]);

  const activeRemainingMs = Math.max(0, normalizedState.sessionEndsAt - now);
  const cooldownRemainingMs = Math.max(0, normalizedState.cooldownEndsAt - now);
  const activeProgress = isActive ? (activeRemainingMs / SESSION_DURATION_MS) * 100 : 0;
  const cooldownProgress = isCoolingDown
    ? ((COOLDOWN_MS - cooldownRemainingMs) / COOLDOWN_MS) * 100
    : 0;
  const progressValue = isActive ? activeProgress : isCoolingDown ? cooldownProgress : 100;
  const isLight = theme === 'light';

  const progressLabel = isActive
    ? `${(activeRemainingMs / 1000).toFixed(1)}s`
    : isCoolingDown
      ? `Reset in ${formatDuration(cooldownRemainingMs)}`
      : 'Ready';

  const spawnBurst = (amount: number) => {
    const burst = {
      id: Date.now() + Math.floor(Math.random() * 10_000),
      amount,
      x: Math.round((Math.random() - 0.5) * 88),
      y: Math.round(Math.random() * -26),
    };

    setBursts((current) => [...current, burst]);
    window.setTimeout(() => {
      setBursts((current) => current.filter((item) => item.id !== burst.id));
    }, 900);
  };

  const handleTap = () => {
    if (!hydrated || isCoolingDown) return;

    const tapAt = Date.now();
    const reward = randomReward();

    setGameState((current) => {
      const synced = normalizeState(current, tapAt);

      // Block late taps after a session has ended but before the UI has rendered cooldown.
      if (synced.cooldownEndsAt > tapAt && synced.sessionEndsAt === 0) {
        return synced;
      }

      const sessionAlreadyActive = synced.sessionEndsAt > tapAt;
      return {
        ninjaBalance: roundTo(synced.ninjaBalance + reward, 2),
        sessionStartedAt: sessionAlreadyActive ? synced.sessionStartedAt : tapAt,
        sessionEndsAt: sessionAlreadyActive ? synced.sessionEndsAt : tapAt + SESSION_DURATION_MS,
        cooldownEndsAt: sessionAlreadyActive ? synced.cooldownEndsAt : tapAt + SESSION_DURATION_MS + COOLDOWN_MS,
        sessionEarned: roundTo((sessionAlreadyActive ? synced.sessionEarned : 0) + reward, 2),
      };
    });

    setNow(tapAt);
    spawnBurst(reward);
  };

  if (!hydrated) {
    return (
      <div
        className={`flex h-full items-center justify-center px-6 py-6 ${
          isLight ? 'text-slate-500' : 'text-gray-500'
        }`}
      >
        Preparing LAM...
      </div>
    );
  }

  return (
    <div
      className="flex h-full flex-col items-center justify-center px-6 py-7"
    >
      <div className="mb-4 flex w-full items-center justify-end gap-2.5">
        <button
          type="button"
          onClick={onOpenMoreChance}
          className={`rounded-full border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] transition-all ${
            isLight
              ? 'border-slate-300/80 bg-white/88 text-slate-700 hover:bg-slate-100'
              : 'border-white/10 bg-white/[0.05] text-gray-300 hover:bg-white/[0.08] hover:text-white'
          }`}
        >
          More Chance
        </button>
        <div className={`rounded-full border px-3 py-1.5 text-[12px] font-mono font-semibold ${
          isLight ? 'border-slate-300/80 bg-white/88 text-slate-900' : 'border-white/10 bg-white/[0.05] text-white'
        }`}>
          +{normalizedState.sessionEarned.toFixed(2)} LAM
        </div>
      </div>

      <div className="relative -mt-5 flex flex-1 items-center justify-center">
        {bursts.map((burst) => (
          <div
            key={burst.id}
            className="tap-burst pointer-events-none absolute z-20 font-mono text-sm font-semibold text-[#8f76ff]"
            style={{ transform: `translate(${burst.x}px, ${burst.y}px)` }}
          >
            +{burst.amount.toFixed(2)}
          </div>
        ))}

        <button
          type="button"
          onClick={handleTap}
          disabled={isCoolingDown}
          className={`ninja-tap-shell ${isActive ? 'is-active' : ''} ${isCoolingDown ? 'is-cooling' : ''} ${
            isLight ? 'border-slate-300/75 bg-slate-100/80' : 'border-white/10 bg-white/[0.04]'
          }`}
          aria-label={isCoolingDown ? 'LAM tap cooldown active' : 'Tap LAM'}
        >
          <div className="ninja-logo-wrap">
            <Image
              src="/NINJA.png"
              alt="LAM"
              width={152}
              height={152}
              className="h-32 w-32 select-none rounded-full object-cover ring-1 ring-white/10 md:h-36 md:w-36"
              priority={false}
            />
          </div>
        </button>
      </div>

      <div className="w-full max-w-[360px] space-y-2">
        {!isActive && !isCoolingDown ? (
          <div className={`text-center text-[11px] font-semibold uppercase tracking-[0.22em] ${isLight ? 'text-slate-500' : 'text-gray-500'}`}>
            Tap LAM to Earn
          </div>
        ) : (
          <div className={`h-2 overflow-hidden rounded-full ${isLight ? 'bg-slate-200/90' : 'bg-white/8'}`}>
            <div
              className={`h-full rounded-full transition-[width,background-color] duration-150 ${
                isActive
                  ? 'bg-[#8f76ff]'
                  : isLight
                    ? 'bg-slate-500/80'
                    : 'bg-white/28'
              }`}
              style={{ width: `${Math.max(0, Math.min(100, progressValue))}%` }}
            />
          </div>
        )}

        <div className={`text-center text-[11px] font-semibold uppercase tracking-[0.18em] ${isLight ? 'text-slate-500' : 'text-gray-500'}`}>
          {progressLabel}
        </div>
      </div>

      <style jsx>{`
        .ninja-tap-shell {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          width: 15rem;
          height: 15rem;
          border-radius: 999px;
          transition: transform 180ms ease, opacity 180ms ease, border-color 180ms ease, box-shadow 180ms ease;
          overflow: hidden;
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.05);
        }

        .ninja-tap-shell:not(.is-cooling) {
          cursor: pointer;
        }

        .ninja-tap-shell:not(.is-cooling):hover {
          transform: translateY(-2px) scale(1.01);
        }

        .ninja-tap-shell:not(.is-cooling):active {
          transform: scale(0.985);
        }

        .ninja-tap-shell.is-active {
          box-shadow: 0 0 0 1px rgba(143, 118, 255, 0.15), 0 0 32px rgba(143, 118, 255, 0.12);
        }

        .ninja-tap-shell.is-cooling {
          opacity: 0.5;
          filter: grayscale(0.08);
          cursor: not-allowed;
        }

        .ninja-tap-shell::after {
          content: '';
          position: absolute;
          inset: -30%;
          background: linear-gradient(115deg, transparent 28%, rgba(255,255,255,0.22) 48%, transparent 68%);
          transform: translateX(-130%) rotate(12deg);
          animation: crestSweep 6.8s linear infinite;
          pointer-events: none;
        }

        .ninja-logo-wrap {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 11rem;
          height: 11rem;
          border-radius: 999px;
        }

        .tap-burst {
          animation: tapBurstFloat 880ms cubic-bezier(0.2, 0.9, 0.18, 1) forwards;
          text-shadow: 0 6px 18px rgba(143, 118, 255, 0.22);
        }

        @keyframes crestSweep {
          0% {
            transform: translateX(-130%) rotate(12deg);
            opacity: 0;
          }
          18% {
            opacity: 0.7;
          }
          52% {
            opacity: 0.12;
          }
          100% {
            opacity: 0;
            transform: translateX(130%) rotate(12deg);
          }
        }

        @keyframes tapBurstFloat {
          0% {
            opacity: 0;
          }
          12% {
            opacity: 1;
          }
          100% {
            opacity: 0;
            transform: translateY(-52px);
          }
        }
      `}</style>
    </div>
  );
}
