'use client';

import Image from 'next/image';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { getBalance, getNinjaMinerState, saveNinjaMinerState, syncPoints } from '@/services/points';
import { getUserProfile } from '@/services/user';

interface NinjaMinerGameProps {
  walletAddress?: string;
  onOpenMoreChance?: () => void;
}

interface TapMinerState {
  ninjaBalance: number;
  tapCooldownEndsAt: number;
  chanceCooldownEndsAt: number;
  chanceRemaining: number;
  sessionStartedAt: number;
  sessionEndsAt: number;
  sessionEarned: number;
  sessionUsesChance: boolean;
  cooldownEndsAt?: number;
}

interface TapBurst {
  id: number;
  amount: number;
  x: number;
  y: number;
}

type PlayMode = 'tap' | 'chance';

const BALANCE_EVENT = 'inj-pass:ninja-balance-update';
const CHANCE_PURCHASE_SUBMITTED_EVENT = 'inj-pass:chance-purchase-submitted';
const DEFAULT_NINJA_BALANCE = 22;
const SESSION_DURATION_MS = 5_000;
const COOLDOWN_MS = 8 * 60 * 60 * 1000;
const CHANCE_COOLDOWN_MS = 20_000;
const SESSION_MAX_EARNED = 3;

function roundTo(value: number, digits = 2) {
  return Number(value.toFixed(digits));
}

function createInitialState(): TapMinerState {
  return {
    ninjaBalance: DEFAULT_NINJA_BALANCE,
    tapCooldownEndsAt: 0,
    chanceCooldownEndsAt: 0,
    chanceRemaining: 0,
    sessionStartedAt: 0,
    sessionEndsAt: 0,
    sessionEarned: 0,
    sessionUsesChance: false,
  };
}

function normalizeState(state: TapMinerState, now: number): TapMinerState {
  const next = { ...state };

  if (next.sessionEndsAt > 0 && now >= next.sessionEndsAt) {
    next.sessionStartedAt = 0;
    next.sessionEndsAt = 0;
    next.sessionUsesChance = false;
  }

  if (next.tapCooldownEndsAt > 0 && now >= next.tapCooldownEndsAt) {
    next.tapCooldownEndsAt = 0;
    next.sessionStartedAt = 0;
    next.sessionEndsAt = 0;
    next.sessionEarned = 0;
    next.sessionUsesChance = false;
  }

  if (next.chanceCooldownEndsAt > 0 && now >= next.chanceCooldownEndsAt) {
    next.chanceCooldownEndsAt = 0;
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
  const [playMode, setPlayMode] = useState<PlayMode>('tap');
  const [bursts, setBursts] = useState<TapBurst[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [isSyncing, setIsSyncing] = useState(false);
  const prevIsActiveRef = useRef(false);
  const lastSyncedSessionKeyRef = useRef<string | null>(null);
  const gameStateRef = useRef(gameState);

  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  useEffect(() => {
    let cancelled = false;

    const hydrateFromBackend = async () => {
      const currentNow = Date.now();

      try {
        const [savedState, balance, profile] = await Promise.all([
          walletAddress ? getNinjaMinerState(walletAddress) : Promise.resolve(null),
          walletAddress ? getBalance() : Promise.resolve(DEFAULT_NINJA_BALANCE),
          walletAddress ? getUserProfile() : Promise.resolve(null),
        ]);

        if (cancelled) return;

        const restored = normalizeState(
          {
            ninjaBalance: typeof savedState?.ninjaBalance === 'number'
              ? roundTo(savedState.ninjaBalance, 2)
              : DEFAULT_NINJA_BALANCE,
            tapCooldownEndsAt: typeof savedState?.tapCooldownEndsAt === 'number'
              ? savedState.tapCooldownEndsAt
              : typeof savedState?.cooldownEndsAt === 'number'
                ? savedState.cooldownEndsAt
                : 0,
            chanceCooldownEndsAt: typeof profile?.chanceCooldownEndsAt === 'number'
              ? profile.chanceCooldownEndsAt
              : typeof savedState?.chanceCooldownEndsAt === 'number'
                ? savedState.chanceCooldownEndsAt
                : 0,
            chanceRemaining: typeof profile?.chanceRemaining === 'number'
              ? profile.chanceRemaining
              : typeof savedState?.chanceRemaining === 'number'
                ? savedState.chanceRemaining
                : 0,
            sessionStartedAt: typeof savedState?.sessionStartedAt === 'number' ? savedState.sessionStartedAt : 0,
            sessionEndsAt: typeof savedState?.sessionEndsAt === 'number' ? savedState.sessionEndsAt : 0,
            sessionEarned: typeof savedState?.sessionEarned === 'number' ? roundTo(savedState.sessionEarned, 2) : 0,
            sessionUsesChance: typeof (savedState as { sessionUsesChance?: unknown })?.sessionUsesChance === 'boolean'
              ? Boolean((savedState as { sessionUsesChance?: unknown }).sessionUsesChance)
              : false,
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

  useEffect(() => {
    if (!walletAddress) return;

    const sleep = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

    const syncChanceFromProfile = async () => {
      for (let attempt = 0; attempt < 8; attempt += 1) {
        try {
          const profile = await getUserProfile();
          if (profile) {
            const current = gameStateRef.current;
            const nextChanceRemaining = Number.isFinite(Number(profile.chanceRemaining))
              ? Math.max(0, Math.floor(Number(profile.chanceRemaining)))
              : current.chanceRemaining;
            const nextChanceCooldownEndsAt = Number.isFinite(Number(profile.chanceCooldownEndsAt))
              ? Math.max(0, Math.floor(Number(profile.chanceCooldownEndsAt)))
              : current.chanceCooldownEndsAt;
            const changed =
              nextChanceRemaining !== current.chanceRemaining ||
              nextChanceCooldownEndsAt !== current.chanceCooldownEndsAt;

            if (changed) {
              setGameState((prev) => ({
                ...prev,
                chanceRemaining: nextChanceRemaining,
                chanceCooldownEndsAt: nextChanceCooldownEndsAt,
              }));
              return;
            }
          }
        } catch (error) {
          console.warn('[NinjaMiner] Failed to refresh profile after chance purchase:', error);
        }

        await sleep(1500);
      }
    };

    const handleChancePurchaseSubmitted = () => {
      void syncChanceFromProfile();
    };

    window.addEventListener(CHANCE_PURCHASE_SUBMITTED_EVENT, handleChancePurchaseSubmitted);
    return () => {
      window.removeEventListener(CHANCE_PURCHASE_SUBMITTED_EVENT, handleChancePurchaseSubmitted);
    };
  }, [walletAddress]);

  const normalizedState = useMemo(() => normalizeState(gameState, now), [gameState, now]);
  const isActive = normalizedState.sessionEndsAt > now;
  const isTapCoolingDown = !isActive && normalizedState.tapCooldownEndsAt > now;
  const tapCooldownRemainingMs = Math.max(0, normalizedState.tapCooldownEndsAt - now);
  const chanceCooldownRemainingMs = Math.max(0, normalizedState.chanceCooldownEndsAt - now);
  const isChanceCoolingDown = chanceCooldownRemainingMs > 0;
  const chanceAvailable = normalizedState.chanceRemaining > 0;
  const activeSessionMode: PlayMode = normalizedState.sessionUsesChance ? 'chance' : 'tap';
  const isViewingActiveSessionMode = !isActive || playMode === activeSessionMode;
  const modeIsCoolingDown = playMode === 'tap' ? isTapCoolingDown : isChanceCoolingDown;
  const modeCanStartSession = playMode === 'tap'
    ? !isTapCoolingDown
    : (chanceAvailable && !isChanceCoolingDown);
  const canTapInCurrentMode = isActive ? isViewingActiveSessionMode : modeCanStartSession;

  useEffect(() => {
    if (!hydrated) return;

    const sessionKey = `${gameState.sessionStartedAt}:${gameState.sessionEndsAt}`;
    const shouldSync =
      prevIsActiveRef.current &&
      !isActive &&
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
        const result = await syncPoints(gameState.sessionEarned, {
          consumeChance: gameState.sessionUsesChance,
          chanceCooldownSeconds: CHANCE_COOLDOWN_MS / 1000,
        });
        if (result.success && result.balance !== undefined) {
          const settledBalance = Number(result.balance);
          setGameState((prev) => ({
            ...prev,
            ninjaBalance: Number.isFinite(settledBalance) ? settledBalance : prev.ninjaBalance,
            chanceRemaining: Number.isFinite(Number(result.chanceRemaining))
              ? Math.max(0, Math.floor(Number(result.chanceRemaining)))
              : prev.chanceRemaining,
            chanceCooldownEndsAt: Number.isFinite(Number(result.chanceCooldownEndsAt))
              ? Math.max(0, Math.floor(Number(result.chanceCooldownEndsAt)))
              : prev.chanceCooldownEndsAt,
            sessionStartedAt: 0,
            sessionEndsAt: 0,
            sessionEarned: 0,
            sessionUsesChance: false,
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
  }, [hydrated, isActive, gameState.sessionEarned, gameState.sessionStartedAt, gameState.sessionEndsAt, isSyncing]);

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
  const activeProgress = isActive ? (activeRemainingMs / SESSION_DURATION_MS) * 100 : 0;
  const tapCooldownProgress = isTapCoolingDown
    ? ((COOLDOWN_MS - tapCooldownRemainingMs) / COOLDOWN_MS) * 100
    : 0;
  const chanceCooldownProgress = isChanceCoolingDown
    ? ((CHANCE_COOLDOWN_MS - chanceCooldownRemainingMs) / CHANCE_COOLDOWN_MS) * 100
    : 0;
  const progressValue = isActive
    ? activeProgress
    : playMode === 'tap'
      ? (isTapCoolingDown ? tapCooldownProgress : 100)
      : (isChanceCoolingDown ? chanceCooldownProgress : 100);
  const isLight = theme === 'light';

  const modeStatusLabel = playMode === 'tap'
    ? (isTapCoolingDown ? `Tap cooldown ${formatDuration(tapCooldownRemainingMs)}` : 'Tap ready')
    : (chanceAvailable
      ? (isChanceCoolingDown ? `Chance cooldown ${formatDuration(chanceCooldownRemainingMs)}` : 'Chance ready')
      : 'No chance left');

  const progressLabel = isActive
    ? `Session ${(activeRemainingMs / 1000).toFixed(1)}s`
    : playMode === 'tap'
      ? isTapCoolingDown
        ? `Tap cooldown ${formatDuration(tapCooldownRemainingMs)}`
        : 'Tap LAM to earn'
      : chanceAvailable
        ? isChanceCoolingDown
          ? `Chance cooldown ${formatDuration(chanceCooldownRemainingMs)}`
          : 'Chance ready'
        : 'No chance left';

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
    if (!hydrated || !canTapInCurrentMode) return;

    const tapAt = Date.now();
    const reward = randomReward();

    setGameState((current) => {
      const synced = normalizeState(current, tapAt);

      const sessionAlreadyActive = synced.sessionEndsAt > tapAt;
      const tapCooldownActive = synced.tapCooldownEndsAt > tapAt;
      const chanceReadyNow = synced.chanceRemaining > 0 && synced.chanceCooldownEndsAt <= tapAt;
      const activeSessionEarned = sessionAlreadyActive ? synced.sessionEarned : 0;
      const remainingCapacity = Math.max(0, SESSION_MAX_EARNED - activeSessionEarned);
      const sessionUsesChance = sessionAlreadyActive ? synced.sessionUsesChance : playMode === 'chance';
      const sessionMode: PlayMode = sessionUsesChance ? 'chance' : 'tap';

      if (sessionAlreadyActive && playMode !== sessionMode) {
        return synced;
      }

      if (remainingCapacity <= 0) {
        return {
          ...synced,
          sessionStartedAt: 0,
          sessionEndsAt: tapAt,
          tapCooldownEndsAt: sessionUsesChance ? synced.tapCooldownEndsAt : tapAt + COOLDOWN_MS,
          sessionUsesChance,
        };
      }

      const effectiveReward = Math.min(reward, remainingCapacity);
      const nextSessionEarned = roundTo(activeSessionEarned + effectiveReward, 2);
      const hitCap = nextSessionEarned >= SESSION_MAX_EARNED;

      if (!sessionAlreadyActive && playMode === 'chance') {
        if (!chanceReadyNow) {
          return synced;
        }

        return {
          ninjaBalance: roundTo(synced.ninjaBalance + effectiveReward, 2),
          tapCooldownEndsAt: synced.tapCooldownEndsAt,
          chanceCooldownEndsAt: tapAt + CHANCE_COOLDOWN_MS,
          chanceRemaining: Math.max(0, synced.chanceRemaining - 1),
          sessionStartedAt: tapAt,
          sessionEndsAt: tapAt + SESSION_DURATION_MS,
          sessionEarned: effectiveReward,
          sessionUsesChance: true,
        };
      }

      if (!sessionAlreadyActive && tapCooldownActive) {
        return synced;
      }

      return {
        ninjaBalance: roundTo(synced.ninjaBalance + effectiveReward, 2),
        sessionStartedAt: sessionAlreadyActive ? synced.sessionStartedAt : tapAt,
        sessionEndsAt: hitCap ? tapAt : (sessionAlreadyActive ? synced.sessionEndsAt : tapAt + SESSION_DURATION_MS),
        tapCooldownEndsAt: hitCap
          ? (sessionUsesChance ? synced.tapCooldownEndsAt : tapAt + COOLDOWN_MS)
          : (sessionAlreadyActive ? synced.tapCooldownEndsAt : tapAt + SESSION_DURATION_MS + COOLDOWN_MS),
        chanceCooldownEndsAt: synced.chanceCooldownEndsAt,
        chanceRemaining: synced.chanceRemaining,
        sessionEarned: nextSessionEarned,
        sessionUsesChance,
      };
    });

    setNow(tapAt);
    const visibleReward = Math.min(reward, Math.max(0, SESSION_MAX_EARNED - normalizedState.sessionEarned));
    if (visibleReward > 0) {
      spawnBurst(visibleReward);
    }
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
      className="flex h-full flex-col items-center justify-between px-5 py-4"
    >
      <div className="mb-1 flex w-full flex-col gap-1.5">
        <div className="flex items-center justify-between gap-2">
          <div className={`inline-flex rounded-full border p-1 ${
            isLight ? 'border-slate-700/80 bg-slate-900' : 'border-white/10 bg-white/[0.04]'
          }`}>
            <button
              type="button"
              onClick={() => setPlayMode('tap')}
              className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] transition-all ${
                playMode === 'tap'
                  ? (isLight ? 'bg-slate-700 text-white' : 'bg-white/20 text-white')
                  : (isLight ? 'text-white/85 hover:text-white' : 'text-gray-300 hover:text-white')
              }`}
            >
              Tap
            </button>
            <button
              type="button"
              onClick={() => setPlayMode('chance')}
              className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] transition-all ${
                playMode === 'chance'
                  ? (isLight ? 'bg-slate-700 text-white' : 'bg-white/20 text-white')
                  : (isLight ? 'text-white/85 hover:text-white' : 'text-gray-300 hover:text-white')
              }`}
            >
              Chance
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-semibold uppercase tracking-[0.18em]">
          <div className={isLight ? 'text-slate-500' : 'text-gray-500'}>
            {modeStatusLabel}
          </div>
          <div className="text-white">
            Chance left · {normalizedState.chanceRemaining}
          </div>
        </div>
        <div className="flex items-center justify-end gap-2.5">
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
      </div>

      <div className="relative mt-0 flex flex-1 items-center justify-center">
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
          disabled={!canTapInCurrentMode}
          className={`ninja-tap-shell ${isActive ? 'is-active' : ''} ${!isActive && modeIsCoolingDown ? 'is-cooling' : ''} ${
            isLight ? 'border-slate-300/75 bg-slate-100/80' : 'border-white/10 bg-white/[0.04]'
          }`}
          aria-label={!canTapInCurrentMode ? 'Current mode unavailable' : 'Tap LAM'}
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

      <div className="w-full max-w-[360px] space-y-1 pb-1">
        {!isActive && !modeIsCoolingDown ? (
          <div className={`text-center text-[11px] font-semibold uppercase tracking-[0.22em] ${isLight ? 'text-slate-500' : 'text-gray-500'}`}>
            {playMode === 'chance' && chanceAvailable ? 'Chance mode ready' : 'Tap LAM to Earn'}
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

        {(isActive || modeIsCoolingDown || (isActive && !isViewingActiveSessionMode)) && (
          <div className={`text-center text-[11px] font-semibold uppercase tracking-[0.18em] ${isLight ? 'text-slate-500' : 'text-gray-500'}`}>
            {isActive && !isViewingActiveSessionMode
              ? `Current session in ${activeSessionMode.toUpperCase()} mode`
              : progressLabel}
          </div>
        )}
      </div>

      <style jsx>{`
        .ninja-tap-shell {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          width: 13.5rem;
          height: 13.5rem;
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
          width: 9.75rem;
          height: 9.75rem;
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
