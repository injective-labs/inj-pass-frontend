'use client';

/**
 * Testnet Faucet Page
 *
 * Distributes 0.1 INJ (always) + optionally 0.02 ETH on one companion chain,
 * once per account address per UTC day.
 *
 * @author Alex <jsxj81@163.com>
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useWallet } from '@/contexts/WalletContext';
import { COMPANION_NETWORKS } from '@/config/faucet';

interface NetworkBalance {
  id: string;
  symbol: string;
  chainName: string;
  amount: string;
  balance: string;
  color: string;
  isBase: boolean;
}

interface ClaimResult {
  injTxHash: string;
  ethTxHash: string | null;
  injExplorerUrl: string;
  ethExplorerUrl: string | null;
}

type PageState = 'loading-balances' | 'idle' | 'claiming' | 'success' | 'error';

export default function FaucetPage() {
  const router = useRouter();
  const { isUnlocked, address, isCheckingSession } = useWallet();

  const [balances, setBalances] = useState<NetworkBalance[]>([]);
  const [selectedCompanion, setSelectedCompanion] = useState<string | null>(null);
  const [pageState, setPageState] = useState<PageState>('loading-balances');
  const [claimResult, setClaimResult] = useState<ClaimResult | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (isCheckingSession) return;
    if (!isUnlocked) router.push('/');
  }, [isUnlocked, isCheckingSession, router]);

  useEffect(() => {
    if (isCheckingSession || !isUnlocked) return;
    fetchBalances();
  }, [isCheckingSession, isUnlocked]);

  const fetchBalances = async () => {
    setPageState('loading-balances');
    try {
      const res = await fetch('/api/faucet/balance');
      const data = await res.json();
      if (data.balances) setBalances(data.balances);
    } catch {
      // degrade gracefully — show '—' inventory
    } finally {
      setPageState('idle');
    }
  };

  const handleClaim = async () => {
    if (!address) return;
    setPageState('claiming');
    setErrorMsg('');
    try {
      const res = await fetch('/api/faucet/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address, companion: selectedCompanion }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Claim failed');
      setClaimResult(data);
      setPageState('success');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Something went wrong');
      setPageState('error');
    }
  };

  const injBalance = balances.find((b) => b.isBase);
  const companionBalances = balances.filter((b) => !b.isBase);
  const loadingBals = pageState === 'loading-balances';

  if (isCheckingSession) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-white/20 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Full-width responsive wrapper */}
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10 md:py-16">

        {/* ── Header ── */}
        <div className="flex items-center gap-4 mb-8 md:mb-10">
          <button
            onClick={() => router.back()}
            className="p-2.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all flex-shrink-0"
            aria-label="Go back"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          <div className="flex items-center gap-3">
            <div className="w-10 h-10 md:w-12 md:h-12 rounded-2xl bg-gradient-to-br from-violet-600/40 to-blue-600/20 border border-violet-500/30 flex items-center justify-center flex-shrink-0">
              <TapIcon className="w-5 h-5 md:w-6 md:h-6 text-violet-300" />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-bold tracking-tight">Testnet Faucet</h1>
              <p className="text-xs md:text-sm text-gray-500 mt-0.5">Developer tools · 1 claim per account per day</p>
            </div>
          </div>
        </div>

        {/* ── Info banner ── */}
        <div className="rounded-2xl bg-violet-500/10 border border-violet-500/20 px-4 py-3 flex gap-3 items-start mb-6">
          <svg className="w-4 h-4 mt-0.5 flex-shrink-0 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <circle cx="12" cy="12" r="10" />
            <path strokeLinecap="round" d="M12 16v-4M12 8h.01" />
          </svg>
          <p className="text-xs md:text-sm text-violet-300 leading-relaxed">
            INJ is always included. Optionally pick one companion chain to also receive test ETH.
            The same wallet can claim again tomorrow.
          </p>
        </div>

        {/* ── Two-column layout on desktop ── */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-6">

          {/* Left column: INJ card */}
          <div className="md:col-span-2 flex flex-col gap-4">
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
              Always included
            </div>

            {/* INJ Card */}
            <div className="rounded-2xl bg-white/5 border border-white/10 p-5 flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <ChainLogo id="injective" color="#00B2FF" />
                <div>
                  <div className="text-base font-bold">0.1 INJ</div>
                  <div className="text-xs text-gray-500">Injective Testnet</div>
                </div>
                {/* Always-on checkmark */}
                <div className="ml-auto w-6 h-6 rounded-full bg-violet-600 border-2 border-violet-400 flex items-center justify-center flex-shrink-0">
                  <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              </div>

              <div className="h-px bg-white/5" />

              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">Faucet balance</span>
                {loadingBals ? (
                  <div className="h-4 w-20 bg-white/10 rounded animate-pulse" />
                ) : (
                  <span className="text-sm font-mono font-semibold">
                    {injBalance ? Number(injBalance.balance).toFixed(3) : '—'} INJ
                  </span>
                )}
              </div>
            </div>

            {/* Summary on desktop */}
            <div className="hidden md:block rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-sm text-gray-300">
              You will receive{' '}
              <span className="text-white font-semibold">0.1 INJ</span>
              {selectedCompanion && (
                <>
                  {' + '}
                  <span className="text-white font-semibold">0.02 ETH</span>
                  {' on '}
                  <span className="text-white font-semibold">
                    {COMPANION_NETWORKS.find((n) => n.id === selectedCompanion)?.name}
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Right column: Companion networks */}
          <div className="md:col-span-3 flex flex-col gap-4">
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
              Companion chain{' '}
              <span className="normal-case font-normal text-gray-500">(pick one, optional)</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-1 lg:grid-cols-2 gap-2">
              {COMPANION_NETWORKS.map((network) => {
                const bal = companionBalances.find((b) => b.id === network.id);
                const isSelected = selectedCompanion === network.id;

                return (
                  <button
                    key={network.id}
                    onClick={() => setSelectedCompanion(isSelected ? null : network.id)}
                    className={`rounded-2xl border p-4 flex items-center gap-3 transition-all duration-200 text-left w-full ${
                      isSelected
                        ? 'bg-violet-600/15 border-violet-500/50'
                        : 'bg-white/5 border-white/10 hover:bg-white/8 hover:border-white/20'
                    }`}
                  >
                    {/* Radio */}
                    <div
                      className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                        isSelected ? 'bg-violet-600 border-violet-400' : 'border-white/30'
                      }`}
                    >
                      {isSelected && (
                        <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>

                    <ChainLogo id={network.id} color={network.color} size="sm" />

                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-bold leading-tight">0.02 ETH</div>
                      <div className="text-xs text-gray-500 truncate">{network.chainName}</div>
                    </div>

                    <div className="text-right flex-shrink-0">
                      {loadingBals ? (
                        <div className="h-3.5 w-14 bg-white/10 rounded animate-pulse" />
                      ) : (
                        <div className="text-xs font-mono text-gray-400">
                          {bal ? Number(bal.balance).toFixed(3) : '—'}
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* ── Summary on mobile ── */}
        <div className="md:hidden mt-5 rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-sm text-gray-300">
          You will receive{' '}
          <span className="text-white font-semibold">0.1 INJ</span>
          {selectedCompanion && (
            <>
              {' + '}
              <span className="text-white font-semibold">0.02 ETH</span>
              {' on '}
              <span className="text-white font-semibold">
                {COMPANION_NETWORKS.find((n) => n.id === selectedCompanion)?.name}
              </span>
            </>
          )}
        </div>

        {/* ── Error ── */}
        {pageState === 'error' && (
          <div className="mt-5 rounded-xl bg-red-500/10 border border-red-500/30 px-4 py-3 flex gap-3 items-start">
            <svg className="w-4 h-4 mt-0.5 flex-shrink-0 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <circle cx="12" cy="12" r="10" />
              <path strokeLinecap="round" d="M12 8v4M12 16h.01" />
            </svg>
            <p className="text-sm text-red-300">{errorMsg}</p>
          </div>
        )}

        {/* ── Success ── */}
        {pageState === 'success' && claimResult && (
          <div className="mt-5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 p-5 space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-emerald-500/20 flex items-center justify-center">
                <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <span className="font-bold text-emerald-400">Tokens sent!</span>
            </div>
            <TxRow label="INJ Transaction" hash={claimResult.injTxHash} url={claimResult.injExplorerUrl} />
            {claimResult.ethTxHash && (
              <TxRow label="ETH Transaction" hash={claimResult.ethTxHash} url={claimResult.ethExplorerUrl!} />
            )}
            <p className="text-xs text-emerald-600/80">
              Tokens may take a few seconds to appear in your wallet.
            </p>
          </div>
        )}

        {/* ── CTA ── */}
        <div className="mt-6 max-w-sm">
          {pageState !== 'success' ? (
            <button
              onClick={handleClaim}
              disabled={pageState === 'claiming' || pageState === 'loading-balances'}
              className={`w-full py-4 rounded-2xl font-bold text-base transition-all duration-200 flex items-center justify-center gap-2.5 ${
                pageState === 'claiming' || pageState === 'loading-balances'
                  ? 'bg-white/10 text-gray-500 cursor-not-allowed'
                  : 'bg-white text-black hover:bg-gray-100 active:scale-98 shadow-lg shadow-white/5'
              }`}
            >
              {pageState === 'claiming' ? (
                <>
                  <div className="w-4 h-4 border-2 border-gray-600 border-t-gray-900 rounded-full animate-spin" />
                  Sending tokens…
                </>
              ) : (
                <>
                  <TapIcon className="w-5 h-5" />
                  Claim Tokens
                </>
              )}
            </button>
          ) : (
            <button
              onClick={() => router.back()}
              className="w-full py-4 rounded-2xl font-bold text-base bg-white/5 border border-white/10 hover:bg-white/10 transition-all"
            >
              Done
            </button>
          )}
        </div>

        {/* Footer */}
        <p className="mt-8 text-xs text-gray-600">
          INJ Pass Testnet Faucet · by Alex
        </p>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────── Sub-components ── */

function TxRow({ label, hash, url }: { label: string; hash: string; url: string }) {
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between group">
      <span className="text-xs text-gray-400">{label}</span>
      <span className="text-xs font-mono text-emerald-400 group-hover:text-emerald-300 underline underline-offset-2 flex items-center gap-1">
        {hash.slice(0, 8)}…{hash.slice(-6)}
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
        </svg>
      </span>
    </a>
  );
}

/* ── Faucet / Tap Icon ── */
function TapIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {/* Left inlet pipe */}
      <path d="M2 12h7" />
      {/* Valve body */}
      <path d="M9 9h5a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1H9V9z" />
      {/* T-handle on top of valve */}
      <path d="M10 9V7M13 9V7" />
      <path d="M10 7h3" />
      {/* Pressure side (right) */}
      <path d="M15 12h4" />
      <path d="M19 10v4" />
      {/* Spout going down */}
      <path d="M11.5 14v2" />
      {/* Nozzle ring */}
      <path d="M10 16h3" />
      {/* Water drop */}
      <path d="M11.5 16.5c0 0-2 2-2 3.5a2 2 0 0 0 4 0c0-1.5-2-3.5-2-3.5z" />
    </svg>
  );
}

/* ── Chain Logo ── */
function ChainLogo({
  id,
  color,
  size = 'md',
}: {
  id: string;
  color: string;
  size?: 'sm' | 'md';
}) {
  const dim = size === 'sm' ? 'w-7 h-7' : 'w-9 h-9';

  return (
    <div
      className={`${dim} rounded-full flex items-center justify-center flex-shrink-0`}
      style={{ backgroundColor: color }}
    >
      <ChainSymbol id={id} />
    </div>
  );
}

function ChainSymbol({ id }: { id: string }) {
  switch (id) {
    /* INJ — λ (lambda) lettermark matching Injective brand */
    case 'injective':
      return (
        <svg viewBox="0 0 24 24" className="w-[60%] h-[60%]" fill="none" stroke="white" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 19L12 5l8 14" />
          <path d="M8.5 13.5h7" />
        </svg>
      );

    /* ETH — classic diamond prism */
    case 'sepolia':
      return (
        <svg viewBox="0 0 24 24" className="w-[60%] h-[60%]" fill="none">
          <polygon points="12,3 19.5,12 12,15.5 4.5,12" fill="rgba(255,255,255,0.95)" />
          <polygon points="4.5,12 12,15.5 12,21" fill="rgba(255,255,255,0.55)" />
          <polygon points="19.5,12 12,15.5 12,21" fill="rgba(255,255,255,0.8)" />
        </svg>
      );

    /* ARB — stylised "A" */
    case 'arbitrum':
      return (
        <svg viewBox="0 0 24 24" className="w-[60%] h-[60%]" fill="none" stroke="white" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 4L18.5 19H5.5L12 4z" />
          <path d="M8.5 14h7" />
        </svg>
      );

    /* OP — red circle-in-circle lettermark */
    case 'optimism':
      return (
        <svg viewBox="0 0 24 24" className="w-[60%] h-[60%]" fill="none">
          <circle cx="12" cy="12" r="5.5" fill="white" />
          <circle cx="12" cy="12" r="2.5" fill="#FF0420" />
        </svg>
      );

    /* BASE — "B" letterform */
    case 'base':
      return (
        <svg viewBox="0 0 24 24" className="w-[65%] h-[65%]" fill="none" stroke="white" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <path d="M8 6h5a3 3 0 0 1 0 6H8" />
          <path d="M8 12h6a3 3 0 0 1 0 6H8" />
          <line x1="8" y1="6" x2="8" y2="18" />
        </svg>
      );

    /* Polygon zkEVM — hexagonal P */
    case 'polygonzkevm':
      return (
        <svg viewBox="0 0 24 24" className="w-[65%] h-[65%]" fill="none" stroke="white" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z" />
          <path d="M9 9.5h4a2.5 2.5 0 0 1 0 5H9" />
          <line x1="9" y1="9.5" x2="9" y2="16" />
        </svg>
      );

    default:
      return (
        <span className="text-white text-xs font-bold uppercase">{id[0]}</span>
      );
  }
}
