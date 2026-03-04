'use client';

/**
 * Testnet Faucet Page
 *
 * Distributes 0.1 INJ (always) + optionally 0.02 ETH on one companion chain
 * to any injpass account, once per account per UTC day.
 *
 * @author 0xAlexWu <jsxj81@163.com>
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

type PageState = 'idle' | 'loading-balances' | 'claiming' | 'success' | 'error';

export default function FaucetPage() {
  const router = useRouter();
  const { isUnlocked, address, isCheckingSession } = useWallet();

  const [balances, setBalances] = useState<NetworkBalance[]>([]);
  const [selectedCompanion, setSelectedCompanion] = useState<string | null>(null);
  const [pageState, setPageState] = useState<PageState>('loading-balances');
  const [claimResult, setClaimResult] = useState<ClaimResult | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  // Redirect if not logged in
  useEffect(() => {
    if (isCheckingSession) return;
    if (!isUnlocked) router.push('/');
  }, [isUnlocked, isCheckingSession, router]);

  // Load faucet balances on mount
  useEffect(() => {
    if (isCheckingSession || !isUnlocked) return;
    fetchBalances();
  }, [isCheckingSession, isUnlocked]);

  const fetchBalances = async () => {
    setPageState('loading-balances');
    try {
      const res = await fetch('/api/faucet/balance');
      const data = await res.json();
      if (data.balances) {
        setBalances(data.balances);
      }
    } catch {
      // silently degrade — balances will show as 0
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

      if (!res.ok) {
        throw new Error(data.error || 'Claim failed');
      }

      setClaimResult(data);
      setPageState('success');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Something went wrong');
      setPageState('error');
    }
  };

  const injBalance = balances.find((b) => b.isBase);
  const companionBalances = balances.filter((b) => !b.isBase);

  if (isCheckingSession) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-white/20 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-md mx-auto min-h-screen flex flex-col">

        {/* ── Header ── */}
        <div className="flex items-center gap-3 px-5 pt-12 pb-5">
          <button
            onClick={() => router.back()}
            className="p-2.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all"
            aria-label="Go back"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          <div className="flex items-center gap-2.5">
            {/* Faucet icon — matching the header button */}
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-600/30 to-blue-500/20 border border-violet-500/30 flex items-center justify-center">
              <FaucetIcon className="w-5 h-5 text-violet-300" />
            </div>
            <div>
              <div className="text-base font-bold">Testnet Faucet</div>
              <div className="text-xs text-gray-500">Developer tools</div>
            </div>
          </div>
        </div>

        {/* ── Scrollable content ── */}
        <div className="flex-1 overflow-y-auto px-5 pb-8 space-y-4">

          {/* ── Info banner ── */}
          <div className="rounded-xl bg-violet-500/10 border border-violet-500/20 px-4 py-3 flex gap-3 items-start">
            <svg className="w-4 h-4 mt-0.5 flex-shrink-0 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <circle cx="12" cy="12" r="10" />
              <path d="M12 16v-4M12 8h.01" strokeLinecap="round" />
            </svg>
            <p className="text-xs text-violet-300 leading-relaxed">
              One claim per account per day. INJ is always included. Optionally pick one companion chain to also receive test ETH.
            </p>
          </div>

          {/* ── INJ — always selected ── */}
          <div>
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2.5">
              Always included
            </div>
            <div className="rounded-2xl bg-white/5 border border-white/10 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {/* Checkmark (always selected) */}
                  <div className="w-5 h-5 rounded-full bg-violet-600 border-2 border-violet-500 flex items-center justify-center flex-shrink-0">
                    <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ backgroundColor: '#00B2FF' }}
                    />
                    <div>
                      <div className="text-sm font-bold">0.1 INJ</div>
                      <div className="text-xs text-gray-500">Injective Testnet</div>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-gray-400">Inventory</div>
                  {pageState === 'loading-balances' ? (
                    <div className="h-4 w-16 bg-white/10 rounded animate-pulse mt-0.5" />
                  ) : (
                    <div className="text-sm font-mono font-semibold text-white">
                      {injBalance ? Number(injBalance.balance).toFixed(2) : '—'} INJ
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* ── Companion chains ── */}
          <div>
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2.5">
              Companion chain <span className="normal-case font-normal">(pick one, optional)</span>
            </div>
            <div className="space-y-2">
              {COMPANION_NETWORKS.map((network) => {
                const bal = companionBalances.find((b) => b.id === network.id);
                const isSelected = selectedCompanion === network.id;

                return (
                  <button
                    key={network.id}
                    onClick={() =>
                      setSelectedCompanion(isSelected ? null : network.id)
                    }
                    className={`w-full rounded-2xl border p-4 flex items-center justify-between transition-all duration-200 ${
                      isSelected
                        ? 'bg-violet-600/15 border-violet-500/50'
                        : 'bg-white/5 border-white/10 hover:bg-white/8 hover:border-white/20'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {/* Radio indicator */}
                      <div
                        className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                          isSelected
                            ? 'bg-violet-600 border-violet-500'
                            : 'border-white/30 bg-transparent'
                        }`}
                      >
                        {isSelected && (
                          <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-left">
                        <span
                          className="w-2 h-2 rounded-full flex-shrink-0"
                          style={{ backgroundColor: network.color }}
                        />
                        <div>
                          <div className="text-sm font-bold">0.02 ETH</div>
                          <div className="text-xs text-gray-500">{network.chainName}</div>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-gray-400">Inventory</div>
                      {pageState === 'loading-balances' ? (
                        <div className="h-4 w-16 bg-white/10 rounded animate-pulse mt-0.5" />
                      ) : (
                        <div className="text-sm font-mono font-semibold text-white">
                          {bal ? Number(bal.balance).toFixed(3) : '—'} ETH
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── Summary pill ── */}
          <div className="rounded-xl bg-white/5 border border-white/10 px-4 py-3 flex items-center gap-2 text-sm">
            <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
            <span className="text-gray-300">
              You will receive{' '}
              <span className="text-white font-semibold">0.1 INJ</span>
              {selectedCompanion && (
                <>
                  {' + '}
                  <span className="text-white font-semibold">
                    0.02 ETH
                  </span>
                  {' on '}
                  <span className="text-white font-semibold">
                    {COMPANION_NETWORKS.find((n) => n.id === selectedCompanion)?.name}
                  </span>
                </>
              )}
            </span>
          </div>

          {/* ── Error state ── */}
          {pageState === 'error' && (
            <div className="rounded-xl bg-red-500/10 border border-red-500/30 px-4 py-3 flex gap-3 items-start">
              <svg className="w-4 h-4 mt-0.5 flex-shrink-0 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <circle cx="12" cy="12" r="10" />
                <path d="M12 8v4M12 16h.01" strokeLinecap="round" />
              </svg>
              <p className="text-sm text-red-300">{errorMsg}</p>
            </div>
          )}

          {/* ── Success state ── */}
          {pageState === 'success' && claimResult && (
            <div className="rounded-2xl bg-emerald-500/10 border border-emerald-500/30 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-emerald-500/20 flex items-center justify-center">
                  <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <span className="font-bold text-emerald-400">Tokens sent!</span>
              </div>

              <TxRow
                label="INJ Transaction"
                hash={claimResult.injTxHash}
                url={claimResult.injExplorerUrl}
              />
              {claimResult.ethTxHash && (
                <TxRow
                  label="ETH Transaction"
                  hash={claimResult.ethTxHash}
                  url={claimResult.ethExplorerUrl!}
                />
              )}
              <p className="text-xs text-emerald-600">
                Tokens may take a few seconds to appear in your wallet.
              </p>
            </div>
          )}
        </div>

        {/* ── Sticky claim button ── */}
        {pageState !== 'success' && (
          <div className="px-5 pb-8 pt-4 border-t border-white/5">
            <button
              onClick={handleClaim}
              disabled={pageState === 'claiming' || pageState === 'loading-balances'}
              className={`w-full py-4 rounded-2xl font-bold text-base transition-all duration-200 flex items-center justify-center gap-2 ${
                pageState === 'claiming' || pageState === 'loading-balances'
                  ? 'bg-white/10 text-gray-500 cursor-not-allowed'
                  : 'bg-white text-black hover:bg-gray-100 active:scale-98 shadow-lg shadow-white/10'
              }`}
            >
              {pageState === 'claiming' ? (
                <>
                  <div className="w-4 h-4 border-2 border-gray-600 border-t-gray-900 rounded-full animate-spin" />
                  Sending tokens…
                </>
              ) : (
                <>
                  <FaucetIcon className="w-5 h-5" />
                  Claim Tokens
                </>
              )}
            </button>
          </div>
        )}

        {pageState === 'success' && (
          <div className="px-5 pb-8 pt-4 border-t border-white/5">
            <button
              onClick={() => router.back()}
              className="w-full py-4 rounded-2xl font-bold text-base bg-white/5 border border-white/10 hover:bg-white/10 transition-all"
            >
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Sub-components ── */

function TxRow({ label, hash, url }: { label: string; hash: string; url: string }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center justify-between group"
    >
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

function FaucetIcon({ className }: { className?: string }) {
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
      {/* Pipe body */}
      <path d="M5 8h7a2 2 0 0 1 2 2v1" />
      {/* Horizontal inlet */}
      <path d="M5 8V6" />
      {/* Spout */}
      <path d="M14 11h2a1 1 0 0 1 1 1v1a1 1 0 0 1-1 1h-2" />
      {/* Drip */}
      <path d="M14 17c0 1.1-.9 2-2 2s-2-.9-2-2c0-.8.5-1.5 1.2-1.8L12 14l.8 1.2c.7.3 1.2 1 1.2 1.8z" />
      {/* Handle */}
      <path d="M9 8V5h4v3" />
    </svg>
  );
}
