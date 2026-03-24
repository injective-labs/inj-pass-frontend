'use client';

import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import ThemeToggleButton from '@/components/ThemeToggleButton';
import { useTheme } from '@/contexts/ThemeContext';
import { useWallet } from '@/contexts/WalletContext';
import { encryptKey, hasWallet, saveWallet } from '@/wallet/keystore';
import { createByPasskey, importPrivateKey } from '@/wallet/key-management';

const heroMetrics = [
  {
    label: 'Access',
    value: 'Passkey Native',
    detail: 'Biometric-first entry without a seed phrase on the first screen.',
  },
  {
    label: 'Surface',
    value: 'Wallet + Pay',
    detail: 'Balances, cards, pay, and discovery enter through one account surface.',
  },
  {
    label: 'Time',
    value: '< 30 seconds',
    detail: 'Name the wallet, approve the passkey, and land straight in dashboard.',
  },
];

const surfaceNodes = [
  {
    key: 'wallet',
    label: 'Wallet',
    title: 'Asset control',
    copy: 'Balances, send, receive, swap, and history.',
  },
  {
    key: 'cards',
    label: 'Cards',
    title: 'NFC rail',
    copy: 'Card center, tap flow, and device-bound management.',
  },
  {
    key: 'pay',
    label: 'Pay',
    title: 'Checkout layer',
    copy: 'Merchant settlement and wallet authorization in one path.',
  },
  {
    key: 'discover',
    label: 'Discover',
    title: 'App surface',
    copy: 'Agents, dApps, and next actions inside the same shell.',
  },
];

export default function WelcomePage() {
  const router = useRouter();
  const { theme } = useTheme();
  const { unlock } = useWallet();
  const isLight = theme === 'light';

  const [busyRoute, setBusyRoute] = useState<'create' | 'recover' | null>(null);
  const [error, setError] = useState('');
  const [showCreatePanel, setShowCreatePanel] = useState(false);
  const [walletNameInput, setWalletNameInput] = useState('');
  const [walletExists, setWalletExists] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const [showImportModal, setShowImportModal] = useState(false);
  const [importStep, setImportStep] = useState<'key' | 'password'>('key');
  const [privateKeyInput, setPrivateKeyInput] = useState('');
  const [showPrivateKey, setShowPrivateKey] = useState(false);
  const [importPassword, setImportPassword] = useState('');
  const [importPasswordConfirm, setImportPasswordConfirm] = useState('');
  const [importError, setImportError] = useState('');
  const [importLoading, setImportLoading] = useState(false);
  const privateKeyRef = useRef<HTMLInputElement>(null);
  const importPasswordRef = useRef<HTMLInputElement>(null);

  const isBusy = busyRoute !== null;

  useEffect(() => {
    setWalletExists(hasWallet());
  }, []);

  useEffect(() => {
    if (!showCreatePanel) {
      return;
    }
    const timeout = setTimeout(() => inputRef.current?.focus(), 60);
    return () => clearTimeout(timeout);
  }, [showCreatePanel]);

  useEffect(() => {
    if (showImportModal && importStep === 'key') {
      const timeout = setTimeout(() => privateKeyRef.current?.focus(), 60);
      return () => clearTimeout(timeout);
    }
  }, [showImportModal, importStep]);

  useEffect(() => {
    if (importStep === 'password') {
      const timeout = setTimeout(() => importPasswordRef.current?.focus(), 60);
      return () => clearTimeout(timeout);
    }
  }, [importStep]);

  const closeCreatePanel = () => {
    setShowCreatePanel(false);
    setWalletNameInput('');
    setError('');
  };

  const handleCreateWallet = async () => {
    if (!walletNameInput.trim()) {
      setError('Please enter an account name');
      return;
    }

    setBusyRoute('create');
    setError('');

    try {
      const result = await createByPasskey(walletNameInput.trim());
      const { loadWallet } = await import('@/wallet/keystore');
      const keystore = loadWallet();

      if (!keystore) {
        throw new Error('Failed to load created wallet');
      }

      const { unlockByPasskey } = await import('@/wallet/key-management/createByPasskey');
      const { decryptKey } = await import('@/wallet/keystore');
      const entropy = await unlockByPasskey(result.credentialId);
      const privateKey = await decryptKey(keystore.encryptedPrivateKey, entropy);

      setWalletExists(true);
      closeCreatePanel();
      unlock(privateKey, keystore);
      router.replace('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create wallet');
    } finally {
      setBusyRoute(null);
    }
  };

  const handleRecoverWallet = async () => {
    setBusyRoute('recover');
    setError('');

    try {
      const { recoverFullWallet } = await import('@/wallet/key-management/recoverByPasskey');
      const result = await recoverFullWallet();
      const { loadWallet } = await import('@/wallet/keystore');
      const keystore = loadWallet();

      if (!keystore) {
        throw new Error('Failed to load recovered wallet');
      }

      const { unlockByPasskey } = await import('@/wallet/key-management/createByPasskey');
      const { decryptKey } = await import('@/wallet/keystore');
      const entropy = await unlockByPasskey(result.credentialId);
      const privateKey = await decryptKey(keystore.encryptedPrivateKey, entropy);

      setWalletExists(true);
      unlock(privateKey, keystore);
      router.replace('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to recover wallet');
    } finally {
      setBusyRoute(null);
    }
  };

  const handleImportNextStep = () => {
    setImportError('');

    if (!privateKeyInput.trim()) {
      setImportError('Please enter your private key');
      return;
    }

    try {
      importPrivateKey(privateKeyInput.trim());
      setImportStep('password');
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Invalid private key');
    }
  };

  const handleImportWallet = async () => {
    setImportError('');

    if (!importPassword) {
      setImportError('Please enter a password');
      return;
    }

    if (importPassword.length < 8) {
      setImportError('Password must be at least 8 characters');
      return;
    }

    if (importPassword !== importPasswordConfirm) {
      setImportError('Passwords do not match');
      return;
    }

    setImportLoading(true);

    try {
      const { privateKey, address } = importPrivateKey(privateKeyInput.trim());
      const encoder = new TextEncoder();
      const rawEntropy = encoder.encode(importPassword);
      const entropy = new Uint8Array(Math.max(rawEntropy.length, 32));
      entropy.set(rawEntropy);

      const encryptedPrivateKey = await encryptKey(privateKey, entropy);
      const keystore = {
        address,
        encryptedPrivateKey,
        source: 'import' as const,
        createdAt: Date.now(),
        walletName: 'Imported Wallet',
      };

      saveWallet(keystore);
      setWalletExists(true);
      unlock(privateKey, keystore);
      router.replace('/dashboard');
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Failed to import wallet');
    } finally {
      setImportLoading(false);
    }
  };

  const handleCloseImport = () => {
    setShowImportModal(false);
    setImportStep('key');
    setPrivateKeyInput('');
    setImportPassword('');
    setImportPasswordConfirm('');
    setImportError('');
    setShowPrivateKey(false);
  };

  return (
    <div className={`relative min-h-screen overflow-hidden ${isLight ? 'bg-[#f1f4f7] text-slate-900' : 'bg-[#060606] text-white'}`}>
      <div
        className={`absolute inset-0 ${
          isLight
            ? 'bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.85),transparent_36%),radial-gradient(circle_at_18%_20%,rgba(59,130,246,0.09),transparent_26%),radial-gradient(circle_at_84%_12%,rgba(148,163,184,0.12),transparent_24%),linear-gradient(180deg,#f6f7f9_0%,#eef2f5_48%,#edf1f4_100%)]'
            : 'bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.08),transparent_34%),radial-gradient(circle_at_18%_20%,rgba(115,115,115,0.14),transparent_24%),radial-gradient(circle_at_84%_12%,rgba(255,255,255,0.06),transparent_22%),linear-gradient(180deg,#050505_0%,#090909_52%,#030303_100%)]'
        }`}
      />
      <div
        className="absolute inset-0 opacity-40"
        style={{
          backgroundImage: isLight
            ? 'linear-gradient(rgba(15,23,42,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(15,23,42,0.05) 1px, transparent 1px)'
            : 'linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)',
          backgroundSize: '34px 34px',
          maskImage: 'linear-gradient(180deg, rgba(0,0,0,0.72), transparent)',
        }}
      />

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-[1480px] flex-col px-4 pb-6 pt-4 md:px-8 md:pb-8 md:pt-6">
        <header
          className={`rounded-[1.65rem] border px-4 py-4 md:px-6 ${
            isLight
              ? 'border-black/10 bg-white/78 shadow-[0_18px_60px_rgba(15,23,42,0.06)] backdrop-blur-xl'
              : 'border-white/10 bg-white/[0.03] backdrop-blur-2xl'
          }`}
        >
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-4">
              <div
                className={`flex h-12 w-12 items-center justify-center rounded-[1rem] border ${
                  isLight ? 'border-black/10 bg-black/[0.03]' : 'border-white/10 bg-white/[0.04]'
                }`}
              >
                <Image src="/lambdalogo.png" alt="INJ Pass" width={30} height={30} className="h-[30px] w-[30px] object-contain" />
              </div>
              <div>
                <div className={`text-base font-semibold tracking-[-0.03em] ${isLight ? 'text-slate-900' : 'text-white'}`}>INJ Pass</div>
                <div className={`mt-1 text-[11px] uppercase tracking-[0.28em] ${isLight ? 'text-slate-500' : 'text-white/42'}`}>
                  Injective Identity Relay
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <ThemeToggleButton compact />
              <div
                className={`rounded-full border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.22em] ${
                  isLight ? 'border-black/10 bg-black/[0.03] text-slate-700' : 'border-white/10 bg-white/[0.04] text-white/70'
                }`}
              >
                Passkey Native
              </div>
              <div
                className={`rounded-full border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.22em] ${
                  isLight ? 'border-black/10 bg-black/[0.03] text-slate-700' : 'border-white/10 bg-white/[0.04] text-white/70'
                }`}
              >
                Wallet + Cards + Apps
              </div>
            </div>
          </div>
        </header>

        <main className="mt-6 grid flex-1 gap-5 xl:grid-cols-[minmax(0,1.08fr)_minmax(360px,430px)]">
          <section
            className={`relative overflow-hidden rounded-[2.1rem] border p-6 md:p-8 ${
              isLight
                ? 'border-black/10 bg-white/84 shadow-[0_28px_90px_rgba(15,23,42,0.08)]'
                : 'border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0.015))]'
            }`}
          >
            <div
              className={`absolute inset-0 ${
                isLight
                  ? 'bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.9),transparent_32%),radial-gradient(circle_at_18%_18%,rgba(15,23,42,0.05),transparent_26%)]'
                  : 'bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.1),transparent_30%),radial-gradient(circle_at_18%_18%,rgba(255,255,255,0.04),transparent_26%)]'
              }`}
            />
            <div className="relative z-10 flex h-full flex-col">
              <div className="max-w-4xl">
                <div className={`text-[11px] font-semibold uppercase tracking-[0.28em] ${isLight ? 'text-slate-500' : 'text-white/38'}`}>
                  One passkey. One product surface.
                </div>
                <h1 className={`mt-5 text-4xl font-semibold leading-[0.9] tracking-[-0.06em] md:text-6xl xl:text-[78px] ${isLight ? 'text-slate-950' : 'text-white'}`}>
                  Wallet access should feel like entering software,
                  <span className={`${isLight ? 'text-slate-500' : 'text-white/55'} block`}>not filling a setup form.</span>
                </h1>
                <p className={`mt-6 max-w-2xl text-base leading-7 md:text-lg md:leading-8 ${isLight ? 'text-slate-600' : 'text-white/64'}`}>
                  INJ Pass is the entry layer for wallet, pay, cards, and discovery. Set up a fresh device with passkey, sign back into the same identity, or migrate an external key without leaving the same stage.
                </p>
              </div>

              <div className="mt-8 grid gap-4 md:grid-cols-3">
                {heroMetrics.map((metric) => (
                  <div
                    key={metric.label}
                    className={`rounded-[1.45rem] border px-4 py-4 ${
                      isLight ? 'border-black/10 bg-black/[0.02]' : 'border-white/10 bg-white/[0.03]'
                    }`}
                  >
                    <div className={`text-[10px] font-semibold uppercase tracking-[0.24em] ${isLight ? 'text-slate-500' : 'text-white/36'}`}>
                      {metric.label}
                    </div>
                    <div className={`mt-3 text-xl font-semibold tracking-[-0.03em] ${isLight ? 'text-slate-950' : 'text-white'}`}>
                      {metric.value}
                    </div>
                    <div className={`mt-2 text-sm leading-6 ${isLight ? 'text-slate-600' : 'text-white/58'}`}>{metric.detail}</div>
                  </div>
                ))}
              </div>

              <div className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,1.08fr)_280px] xl:items-center">
                <div className={`welcome-hero-stage ${isLight ? 'welcome-hero-stage--light' : ''}`}>
                  <div className="welcome-hero-stage__ring welcome-hero-stage__ring--outer" />
                  <div className="welcome-hero-stage__ring welcome-hero-stage__ring--mid" />
                  <div className="welcome-hero-stage__ring welcome-hero-stage__ring--inner" />
                  <div className="welcome-hero-stage__shine" />
                  <div className="welcome-hero-stage__core">
                    <div className="welcome-hero-stage__core-logo">
                      <Image src="/lambdalogo.png" alt="INJ Pass" width={62} height={62} className="h-[62px] w-[62px] object-contain" />
                    </div>
                    <div className="welcome-hero-stage__core-title">INJ PASS</div>
                    <div className="welcome-hero-stage__core-copy">wallet / pay / cards / apps</div>
                  </div>

                  {surfaceNodes.map((node) => (
                    <div key={node.key} className={`welcome-hero-stage__node welcome-hero-stage__node--${node.key}`}>
                      <div className="welcome-hero-stage__node-label">{node.label}</div>
                      <div className="welcome-hero-stage__node-title">{node.title}</div>
                      <div className="welcome-hero-stage__node-copy">{node.copy}</div>
                    </div>
                  ))}
                </div>

                <div className="grid gap-3">
                  <div className={`rounded-[1.5rem] border px-5 py-5 ${isLight ? 'border-black/10 bg-black/[0.02]' : 'border-white/10 bg-white/[0.03]'}`}>
                    <div className={`text-[10px] font-semibold uppercase tracking-[0.24em] ${isLight ? 'text-slate-500' : 'text-white/36'}`}>
                      Device State
                    </div>
                    <div className={`mt-3 text-lg font-semibold tracking-[-0.03em] ${isLight ? 'text-slate-950' : 'text-white'}`}>
                      {walletExists ? 'Local wallet found on this device' : 'Fresh device, ready for first entry'}
                    </div>
                    <div className={`mt-2 text-sm leading-6 ${isLight ? 'text-slate-600' : 'text-white/58'}`}>
                      {walletExists
                        ? 'Use Sign In with Passkey to re-open the same local identity, or import another private key if this device needs a separate route.'
                        : 'Create a passkey wallet for first-time setup, or import an external private key into local encrypted storage.'}
                    </div>
                  </div>

                  <div className={`rounded-[1.5rem] border px-5 py-5 ${isLight ? 'border-black/10 bg-black/[0.02]' : 'border-white/10 bg-white/[0.03]'}`}>
                    <div className={`text-[10px] font-semibold uppercase tracking-[0.24em] ${isLight ? 'text-slate-500' : 'text-white/36'}`}>
                      Environment
                    </div>
                    <div className={`mt-3 text-lg font-semibold tracking-[-0.03em] ${isLight ? 'text-slate-950' : 'text-white'}`}>
                      Powered by Injective
                    </div>
                    <div className={`mt-2 text-sm leading-6 ${isLight ? 'text-slate-600' : 'text-white/58'}`}>
                      Welcome stays minimal, but the same account carries into dashboard, cards, faucet, agents, and discovery.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section
            className={`relative overflow-hidden rounded-[2.1rem] border p-6 md:p-7 ${
              isLight
                ? 'border-black/10 bg-white/88 shadow-[0_28px_90px_rgba(15,23,42,0.08)]'
                : 'border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0.015))]'
            }`}
          >
            <div className="relative z-10 flex h-full flex-col">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className={`text-[11px] font-semibold uppercase tracking-[0.24em] ${isLight ? 'text-slate-500' : 'text-white/36'}`}>
                    Entry Console
                  </div>
                  <h2 className={`mt-3 text-3xl font-semibold tracking-[-0.05em] ${isLight ? 'text-slate-950' : 'text-white'}`}>
                    Choose this device route.
                  </h2>
                  <p className={`mt-3 max-w-md text-sm leading-6 ${isLight ? 'text-slate-600' : 'text-white/58'}`}>
                    Start fresh with passkey, re-open an existing wallet, or import an external key into local encrypted storage.
                  </p>
                </div>

                <div
                  className={`rounded-full border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.22em] ${
                    walletExists
                      ? isLight
                        ? 'border-emerald-600/15 bg-emerald-600/8 text-emerald-700'
                        : 'border-emerald-400/20 bg-emerald-400/10 text-emerald-200'
                      : isLight
                        ? 'border-black/10 bg-black/[0.03] text-slate-700'
                        : 'border-white/10 bg-white/[0.04] text-white/70'
                  }`}
                >
                  {walletExists ? 'Wallet Found' : 'New Device'}
                </div>
              </div>

              {error && (
                <div className={`mt-5 rounded-[1.3rem] border px-4 py-3 text-sm leading-6 ${isLight ? 'border-red-500/20 bg-red-500/8 text-red-700' : 'border-red-500/20 bg-red-500/10 text-red-300'}`}>
                  {error}
                </div>
              )}

              <div className="mt-6 grid gap-4">
                <div className={`rounded-[1.65rem] border p-5 ${isLight ? 'border-black/10 bg-black/[0.02]' : 'border-white/10 bg-white/[0.03]'}`}>
                  <div className="flex items-start gap-4">
                    <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-[1rem] border text-sm font-semibold ${isLight ? 'border-black/10 bg-black/[0.04] text-slate-900' : 'border-white/10 bg-white/[0.05] text-white'}`}>
                      01
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className={`text-[10px] font-semibold uppercase tracking-[0.22em] ${isLight ? 'text-slate-500' : 'text-white/36'}`}>
                        Set Up
                      </div>
                      <div className={`mt-2 text-[28px] font-semibold tracking-[-0.05em] ${isLight ? 'text-slate-950' : 'text-white'}`}>
                        Create with Passkey
                      </div>
                      <div className={`mt-2 text-sm leading-6 ${isLight ? 'text-slate-600' : 'text-white/58'}`}>
                        Create a new local wallet identity and bind it directly to your device passkey.
                      </div>
                    </div>
                  </div>

                  <div className="mt-5 grid">
                    <div
                      style={{ gridArea: '1 / 1' }}
                      className={`transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${showCreatePanel ? 'pointer-events-none translate-y-3 opacity-0' : 'translate-y-0 opacity-100'}`}
                    >
                      <button
                        onClick={() => {
                          setShowCreatePanel(true);
                          setError('');
                        }}
                        disabled={isBusy}
                        className={`w-full rounded-[1.35rem] px-4 py-4 text-left transition-all disabled:cursor-not-allowed disabled:opacity-50 ${
                          isLight ? 'bg-slate-950 text-white hover:bg-slate-800' : 'bg-white text-black hover:bg-slate-100'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <div className="text-base font-semibold tracking-[-0.02em]">Start a new INJ Pass wallet</div>
                            <div className={`mt-1 text-sm ${isLight ? 'text-white/70' : 'text-black/65'}`}>
                              Name the wallet, approve the passkey request, and continue into dashboard.
                            </div>
                          </div>
                          <svg className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.4} d="M9 5l7 7-7 7" />
                          </svg>
                        </div>
                      </button>
                    </div>

                    <div
                      style={{ gridArea: '1 / 1' }}
                      className={`transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${showCreatePanel ? 'translate-y-0 opacity-100' : 'pointer-events-none -translate-y-3 opacity-0'}`}
                    >
                      <div className={`rounded-[1.4rem] border p-4 ${isLight ? 'border-black/10 bg-white' : 'border-white/10 bg-black/25'}`}>
                        <div className="flex items-center justify-between gap-3">
                          <div className={`text-[11px] font-semibold uppercase tracking-[0.24em] ${isLight ? 'text-slate-500' : 'text-white/36'}`}>
                            Local wallet label
                          </div>
                          <button
                            onClick={closeCreatePanel}
                            className={`text-xs font-semibold uppercase tracking-[0.2em] ${isLight ? 'text-slate-500 hover:text-slate-900' : 'text-white/40 hover:text-white'} transition-colors`}
                          >
                            Close
                          </button>
                        </div>

                        <div className={`mt-3 rounded-[1.2rem] border px-4 py-3.5 ${isLight ? 'border-black/10 bg-black/[0.03]' : 'border-white/10 bg-white/[0.03]'}`}>
                          <input
                            ref={inputRef}
                            type="text"
                            value={walletNameInput}
                            onChange={(e) => setWalletNameInput(e.target.value)}
                            placeholder="Name this account"
                            className={`w-full bg-transparent text-sm font-semibold ${isLight ? 'text-slate-950 placeholder:text-slate-400' : 'text-white placeholder:text-white/30'} focus:outline-none`}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && walletNameInput.trim()) {
                                handleCreateWallet();
                              }
                              if (e.key === 'Escape') {
                                closeCreatePanel();
                              }
                            }}
                          />
                        </div>

                        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                          <button
                            onClick={closeCreatePanel}
                            disabled={isBusy}
                            className={`rounded-[1.1rem] border px-4 py-3 text-sm font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-50 ${isLight ? 'border-black/10 text-slate-700 hover:bg-black/[0.03]' : 'border-white/10 text-white/72 hover:bg-white/[0.04]'}`}
                          >
                            Cancel
                          </button>
                          <button
                            onClick={handleCreateWallet}
                            disabled={busyRoute === 'recover' || !walletNameInput.trim() || busyRoute === 'create'}
                            className={`flex-1 rounded-[1.1rem] px-4 py-3 text-sm font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-40 ${
                              isLight ? 'bg-slate-950 text-white hover:bg-slate-800' : 'bg-white text-black hover:bg-slate-100'
                            }`}
                          >
                            {busyRoute === 'create' ? 'Creating...' : 'Bind Passkey and Continue'}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className={`rounded-[1.65rem] border p-5 ${isLight ? 'border-black/10 bg-black/[0.02]' : 'border-white/10 bg-white/[0.03]'}`}>
                  <div className="flex items-start gap-4">
                    <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-[1rem] border text-sm font-semibold ${isLight ? 'border-black/10 bg-black/[0.04] text-slate-900' : 'border-white/10 bg-white/[0.05] text-white'}`}>
                      02
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className={`text-[10px] font-semibold uppercase tracking-[0.22em] ${isLight ? 'text-slate-500' : 'text-white/36'}`}>
                        Sign In
                      </div>
                      <div className={`mt-2 text-[28px] font-semibold tracking-[-0.05em] ${isLight ? 'text-slate-950' : 'text-white'}`}>
                        Re-open with Passkey
                      </div>
                      <div className={`mt-2 text-sm leading-6 ${isLight ? 'text-slate-600' : 'text-white/58'}`}>
                        Restore the wallet already associated with your passkey and continue from the same identity.
                      </div>
                    </div>
                  </div>

                  <div className={`mt-5 rounded-[1.35rem] border px-4 py-4 ${isLight ? 'border-black/10 bg-white' : 'border-white/10 bg-black/25'}`}>
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className={`text-[10px] font-semibold uppercase tracking-[0.22em] ${isLight ? 'text-slate-500' : 'text-white/36'}`}>
                          Local status
                        </div>
                        <div className={`mt-2 text-base font-semibold ${isLight ? 'text-slate-950' : 'text-white'}`}>
                          {walletExists ? 'This device already knows a wallet' : 'No local wallet saved yet'}
                        </div>
                        <div className={`mt-1 text-sm leading-6 ${isLight ? 'text-slate-600' : 'text-white/58'}`}>
                          {walletExists
                            ? 'Use the same passkey to restore the paired wallet into the current session.'
                            : 'Use passkey recovery if this wallet was created on another device.'}
                        </div>
                      </div>
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`h-5 w-5 shrink-0 ${isLight ? 'text-slate-400' : 'text-white/46'}`}>
                        <path d="M21 2v6h-6" />
                        <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
                        <path d="M3 22v-6h6" />
                        <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
                      </svg>
                    </div>

                    <button
                      onClick={handleRecoverWallet}
                      disabled={isBusy}
                      className={`mt-4 w-full rounded-[1.2rem] border px-4 py-3.5 text-left transition-all disabled:cursor-not-allowed disabled:opacity-50 ${isLight ? 'border-black/10 bg-black/[0.03] text-slate-950 hover:bg-black/[0.05]' : 'border-white/10 bg-white/[0.05] text-white hover:bg-white/[0.08]'}`}
                    >
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <div className="text-base font-semibold tracking-[-0.02em]">Continue with existing passkey</div>
                          <div className={`mt-1 text-sm ${isLight ? 'text-slate-600' : 'text-white/52'}`}>
                            Authenticate and re-open the paired wallet in the current session.
                          </div>
                        </div>
                        {busyRoute === 'recover' ? (
                          <svg className="h-5 w-5 shrink-0 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                          </svg>
                        ) : (
                          <svg className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.4} d="M9 5l7 7-7 7" />
                          </svg>
                        )}
                      </div>
                    </button>
                  </div>
                </div>

                <div className={`rounded-[1.65rem] border p-5 ${isLight ? 'border-black/10 bg-black/[0.02]' : 'border-white/10 bg-white/[0.03]'}`}>
                  <div className="flex items-start gap-4">
                    <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-[1rem] border text-sm font-semibold ${isLight ? 'border-black/10 bg-black/[0.04] text-slate-900' : 'border-white/10 bg-white/[0.05] text-white'}`}>
                      03
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className={`text-[10px] font-semibold uppercase tracking-[0.22em] ${isLight ? 'text-slate-500' : 'text-white/36'}`}>
                        Import
                      </div>
                      <div className={`mt-2 text-[28px] font-semibold tracking-[-0.05em] ${isLight ? 'text-slate-950' : 'text-white'}`}>
                        Bring in a private key
                      </div>
                      <div className={`mt-2 text-sm leading-6 ${isLight ? 'text-slate-600' : 'text-white/58'}`}>
                        Migrate an external wallet and encrypt it locally before dashboard entry.
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => setShowImportModal(true)}
                    disabled={isBusy}
                    className={`mt-5 inline-flex items-center gap-2 rounded-full border px-4 py-2.5 text-sm font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-50 ${isLight ? 'border-black/10 bg-black/[0.03] text-slate-900 hover:bg-black/[0.05]' : 'border-white/10 bg-white/[0.05] text-white hover:bg-white/[0.08]'}`}
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.1} d="M15 7h3a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h3m6 0V5a3 3 0 1 0-6 0v2m6 0H9" />
                    </svg>
                    Import Existing Key
                  </button>
                </div>
              </div>

              <div className="mt-auto pt-5">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className={`rounded-[1.3rem] border px-4 py-4 ${isLight ? 'border-black/10 bg-black/[0.02]' : 'border-white/10 bg-white/[0.03]'}`}>
                    <div className={`text-[10px] font-semibold uppercase tracking-[0.22em] ${isLight ? 'text-slate-500' : 'text-white/36'}`}>
                      Security
                    </div>
                    <div className={`mt-2 text-sm font-semibold leading-6 ${isLight ? 'text-slate-950' : 'text-white'}`}>
                      WebAuthn for passkey entry. Local encryption for imported keys.
                    </div>
                  </div>
                  <div className={`rounded-[1.3rem] border px-4 py-4 ${isLight ? 'border-black/10 bg-black/[0.02]' : 'border-white/10 bg-white/[0.03]'}`}>
                    <div className={`text-[10px] font-semibold uppercase tracking-[0.22em] ${isLight ? 'text-slate-500' : 'text-white/36'}`}>
                      Release
                    </div>
                    <div className={`mt-2 text-sm font-semibold leading-6 ${isLight ? 'text-slate-950' : 'text-white'}`}>
                      Preview surface. Use accounts and funds appropriate for staged rollout.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </main>
      </div>

      {showImportModal && (
        <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-xl ${isLight ? 'bg-[rgba(241,244,247,0.76)]' : 'bg-[rgba(5,5,5,0.78)]'}`}>
          <div className={`relative w-full max-w-4xl overflow-hidden rounded-[2rem] border ${isLight ? 'border-black/10 bg-white shadow-[0_28px_90px_rgba(15,23,42,0.12)]' : 'border-white/10 bg-[#0a0a0a] shadow-[0_28px_90px_rgba(0,0,0,0.58)]'}`}>
            <button
              onClick={handleCloseImport}
              className={`absolute right-5 top-5 z-20 flex h-11 w-11 items-center justify-center rounded-2xl border transition-all ${isLight ? 'border-black/10 bg-black/[0.03] text-slate-600 hover:bg-black/[0.05] hover:text-slate-900' : 'border-white/10 bg-white/[0.05] text-white/60 hover:bg-white/[0.1] hover:text-white'}`}
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <div className="grid md:grid-cols-[320px_minmax(0,1fr)]">
              <div className={`border-b p-6 md:border-b-0 md:border-r md:p-7 ${isLight ? 'border-black/10 bg-black/[0.02]' : 'border-white/10 bg-white/[0.02]'}`}>
                <div className="flex items-center gap-3">
                  <div className={`flex h-11 w-11 items-center justify-center rounded-[1rem] border ${isLight ? 'border-black/10 bg-black/[0.03]' : 'border-white/10 bg-white/[0.05]'}`}>
                    <Image src="/lambdalogo.png" alt="INJ Pass" width={28} height={28} className="h-7 w-7 object-contain" />
                  </div>
                  <div>
                    <div className={`text-sm font-semibold ${isLight ? 'text-slate-950' : 'text-white'}`}>Import Private Key</div>
                    <div className={`mt-1 text-[11px] uppercase tracking-[0.24em] ${isLight ? 'text-slate-500' : 'text-white/36'}`}>
                      Local Migration Flow
                    </div>
                  </div>
                </div>

                <h2 className={`mt-8 text-3xl font-semibold tracking-[-0.05em] ${isLight ? 'text-slate-950' : 'text-white'}`}>
                  Bring an external wallet in cleanly.
                </h2>
                <p className={`mt-4 text-sm leading-7 ${isLight ? 'text-slate-600' : 'text-white/58'}`}>
                  Validate the key locally, then protect it with a device password used only for encrypted storage on this machine.
                </p>

                <div className="mt-8 flex items-center gap-2">
                  <div className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] ${importStep === 'key' ? (isLight ? 'bg-slate-950 text-white' : 'bg-white text-black') : isLight ? 'border border-black/10 bg-black/[0.03] text-slate-500' : 'border border-white/10 bg-white/[0.04] text-white/42'}`}>
                    Step 1 Key
                  </div>
                  <div className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] ${importStep === 'password' ? (isLight ? 'bg-slate-950 text-white' : 'bg-white text-black') : isLight ? 'border border-black/10 bg-black/[0.03] text-slate-500' : 'border border-white/10 bg-white/[0.04] text-white/42'}`}>
                    Step 2 Encrypt
                  </div>
                </div>

                <div className="mt-8 space-y-3">
                  <div className={`rounded-[1.2rem] border px-4 py-4 ${isLight ? 'border-black/10 bg-white' : 'border-white/10 bg-black/25'}`}>
                    <div className={`text-[10px] font-semibold uppercase tracking-[0.22em] ${isLight ? 'text-slate-500' : 'text-white/36'}`}>
                      Private Handling
                    </div>
                    <div className={`mt-2 text-sm leading-6 ${isLight ? 'text-slate-600' : 'text-white/58'}`}>
                      The raw key stays in-browser during validation and local keystore creation.
                    </div>
                  </div>
                  <div className={`rounded-[1.2rem] border px-4 py-4 ${isLight ? 'border-black/10 bg-white' : 'border-white/10 bg-black/25'}`}>
                    <div className={`text-[10px] font-semibold uppercase tracking-[0.22em] ${isLight ? 'text-slate-500' : 'text-white/36'}`}>
                      Password Scope
                    </div>
                    <div className={`mt-2 text-sm leading-6 ${isLight ? 'text-slate-600' : 'text-white/58'}`}>
                      This password is local only. It does not replace or alter passkey-based entry.
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-6 md:p-7">
                {importStep === 'key' ? (
                  <>
                    <div className={`rounded-[1.3rem] border px-4 py-4 ${isLight ? 'border-black/10 bg-black/[0.02]' : 'border-white/10 bg-white/[0.03]'}`}>
                      <div className={`text-[11px] font-semibold uppercase tracking-[0.24em] ${isLight ? 'text-slate-500' : 'text-white/36'}`}>
                        Private Key
                      </div>
                      <p className={`mt-2 text-sm leading-6 ${isLight ? 'text-slate-600' : 'text-white/58'}`}>
                        Use this only when migrating an existing external wallet into the current device.
                      </p>
                    </div>

                    <div className="relative mt-5">
                      <input
                        ref={privateKeyRef}
                        type={showPrivateKey ? 'text' : 'password'}
                        value={privateKeyInput}
                        onChange={(e) => setPrivateKeyInput(e.target.value)}
                        placeholder="Private key (hex)"
                        className={`w-full rounded-[1.2rem] border px-4 py-4 pr-12 font-mono text-sm focus:outline-none ${isLight ? 'border-black/10 bg-black/[0.03] text-slate-950 placeholder:text-slate-400 focus:border-black/20' : 'border-white/10 bg-white/[0.03] text-white placeholder:text-white/28 focus:border-white/24'}`}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            handleImportNextStep();
                          }
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPrivateKey(!showPrivateKey)}
                        className={`absolute right-3 top-1/2 -translate-y-1/2 rounded-xl p-1 transition-colors ${isLight ? 'text-slate-500 hover:text-slate-900' : 'text-white/42 hover:text-white/78'}`}
                      >
                        {showPrivateKey ? (
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                            <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" />
                            <line x1="1" y1="1" x2="23" y2="23" />
                          </svg>
                        ) : (
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                            <circle cx="12" cy="12" r="3" />
                          </svg>
                        )}
                      </button>
                    </div>

                    {importError && <p className={`mt-3 text-sm ${isLight ? 'text-red-700' : 'text-red-300'}`}>{importError}</p>}

                    <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                      <button
                        onClick={handleCloseImport}
                        className={`rounded-[1.1rem] border px-4 py-3 text-sm font-semibold transition-colors ${isLight ? 'border-black/10 text-slate-700 hover:bg-black/[0.03]' : 'border-white/10 text-white/72 hover:bg-white/[0.04]'}`}
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleImportNextStep}
                        className={`flex-1 rounded-[1.1rem] px-4 py-3 text-sm font-semibold transition-colors ${isLight ? 'bg-slate-950 text-white hover:bg-slate-800' : 'bg-white text-black hover:bg-slate-100'}`}
                      >
                        Continue
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className={`rounded-[1.3rem] border px-4 py-4 ${isLight ? 'border-black/10 bg-black/[0.02]' : 'border-white/10 bg-white/[0.03]'}`}>
                      <div className={`text-[11px] font-semibold uppercase tracking-[0.24em] ${isLight ? 'text-slate-500' : 'text-white/36'}`}>
                        Local Encryption
                      </div>
                      <p className={`mt-2 text-sm leading-6 ${isLight ? 'text-slate-600' : 'text-white/58'}`}>
                        Set a device-specific password to encrypt the imported key before it is saved locally.
                      </p>
                    </div>

                    <input
                      ref={importPasswordRef}
                      type="password"
                      value={importPassword}
                      onChange={(e) => setImportPassword(e.target.value)}
                      placeholder="Password (min 8 characters)"
                      className={`mt-5 w-full rounded-[1.2rem] border px-4 py-4 text-sm focus:outline-none ${isLight ? 'border-black/10 bg-black/[0.03] text-slate-950 placeholder:text-slate-400 focus:border-black/20' : 'border-white/10 bg-white/[0.03] text-white placeholder:text-white/28 focus:border-white/24'}`}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleImportWallet();
                        }
                      }}
                    />
                    <input
                      type="password"
                      value={importPasswordConfirm}
                      onChange={(e) => setImportPasswordConfirm(e.target.value)}
                      placeholder="Confirm password"
                      className={`mt-3 w-full rounded-[1.2rem] border px-4 py-4 text-sm focus:outline-none ${isLight ? 'border-black/10 bg-black/[0.03] text-slate-950 placeholder:text-slate-400 focus:border-black/20' : 'border-white/10 bg-white/[0.03] text-white placeholder:text-white/28 focus:border-white/24'}`}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleImportWallet();
                        }
                      }}
                    />

                    {importError && <p className={`mt-3 text-sm ${isLight ? 'text-red-700' : 'text-red-300'}`}>{importError}</p>}

                    <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                      <button
                        onClick={() => {
                          setImportStep('key');
                          setImportError('');
                        }}
                        className={`rounded-[1.1rem] border px-4 py-3 text-sm font-semibold transition-colors ${isLight ? 'border-black/10 text-slate-700 hover:bg-black/[0.03]' : 'border-white/10 text-white/72 hover:bg-white/[0.04]'}`}
                      >
                        Back
                      </button>
                      <button
                        onClick={handleImportWallet}
                        disabled={importLoading}
                        className={`flex-1 rounded-[1.1rem] px-4 py-3 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${isLight ? 'bg-slate-950 text-white hover:bg-slate-800' : 'bg-white text-black hover:bg-slate-100'}`}
                      >
                        {importLoading ? 'Importing...' : 'Import Wallet'}
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .welcome-hero-stage {
          position: relative;
          min-height: 520px;
          overflow: hidden;
          border-radius: 34px;
          border: 1px solid rgba(255, 255, 255, 0.08);
          background:
            radial-gradient(circle at top, rgba(255, 255, 255, 0.08), transparent 34%),
            linear-gradient(180deg, rgba(255, 255, 255, 0.035), rgba(255, 255, 255, 0.012));
          isolation: isolate;
        }

        .welcome-hero-stage--light {
          border-color: rgba(15, 23, 42, 0.08);
          background:
            radial-gradient(circle at top, rgba(255, 255, 255, 0.92), transparent 34%),
            linear-gradient(180deg, rgba(15, 23, 42, 0.03), rgba(15, 23, 42, 0.015));
        }

        .welcome-hero-stage__ring,
        .welcome-hero-stage__shine,
        .welcome-hero-stage__core,
        .welcome-hero-stage__node {
          position: absolute;
        }

        .welcome-hero-stage__ring {
          left: 50%;
          top: 50%;
          border-radius: 999px;
          transform: translate(-50%, -50%);
        }

        .welcome-hero-stage__ring--outer {
          width: 390px;
          height: 390px;
          border: 1px solid rgba(255, 255, 255, 0.1);
          animation: welcomeRotate 26s linear infinite;
        }

        .welcome-hero-stage--light .welcome-hero-stage__ring--outer {
          border-color: rgba(15, 23, 42, 0.1);
        }

        .welcome-hero-stage__ring--mid {
          width: 286px;
          height: 286px;
          border: 1px solid rgba(255, 255, 255, 0.08);
          animation: welcomeRotateReverse 20s linear infinite;
        }

        .welcome-hero-stage--light .welcome-hero-stage__ring--mid {
          border-color: rgba(15, 23, 42, 0.08);
        }

        .welcome-hero-stage__ring--inner {
          width: 214px;
          height: 214px;
          border: 1px solid rgba(255, 255, 255, 0.06);
        }

        .welcome-hero-stage--light .welcome-hero-stage__ring--inner {
          border-color: rgba(15, 23, 42, 0.08);
        }

        .welcome-hero-stage__shine {
          left: 50%;
          top: 50%;
          width: 420px;
          height: 420px;
          border-radius: 999px;
          background: radial-gradient(circle, rgba(255, 255, 255, 0.08), transparent 62%);
          filter: blur(14px);
          transform: translate(-50%, -50%);
        }

        .welcome-hero-stage--light .welcome-hero-stage__shine {
          background: radial-gradient(circle, rgba(15, 23, 42, 0.06), transparent 62%);
        }

        .welcome-hero-stage__core {
          left: 50%;
          top: 50%;
          z-index: 2;
          display: flex;
          width: 196px;
          height: 196px;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 10px;
          border-radius: 999px;
          border: 1px solid rgba(255, 255, 255, 0.12);
          background: rgba(0, 0, 0, 0.7);
          box-shadow:
            0 28px 80px rgba(0, 0, 0, 0.42),
            inset 0 1px 0 rgba(255, 255, 255, 0.08);
          transform: translate(-50%, -50%);
          backdrop-filter: blur(22px);
        }

        .welcome-hero-stage--light .welcome-hero-stage__core {
          border-color: rgba(15, 23, 42, 0.08);
          background: rgba(255, 255, 255, 0.82);
          box-shadow:
            0 28px 80px rgba(15, 23, 42, 0.08),
            inset 0 1px 0 rgba(255, 255, 255, 0.8);
        }

        .welcome-hero-stage__core-logo {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 82px;
          height: 82px;
          border-radius: 999px;
          border: 1px solid rgba(255, 255, 255, 0.1);
          background: rgba(255, 255, 255, 0.04);
        }

        .welcome-hero-stage--light .welcome-hero-stage__core-logo {
          border-color: rgba(15, 23, 42, 0.08);
          background: rgba(15, 23, 42, 0.04);
        }

        .welcome-hero-stage__core-title {
          font-size: 14px;
          font-weight: 700;
          letter-spacing: 0.24em;
          text-transform: uppercase;
          color: rgba(255, 255, 255, 0.92);
        }

        .welcome-hero-stage--light .welcome-hero-stage__core-title {
          color: rgba(15, 23, 42, 0.9);
        }

        .welcome-hero-stage__core-copy {
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.2em;
          text-transform: uppercase;
          color: rgba(255, 255, 255, 0.46);
          text-align: center;
        }

        .welcome-hero-stage--light .welcome-hero-stage__core-copy {
          color: rgba(71, 85, 105, 0.8);
        }

        .welcome-hero-stage__node {
          z-index: 1;
          width: 182px;
          border-radius: 24px;
          border: 1px solid rgba(255, 255, 255, 0.1);
          background: rgba(255, 255, 255, 0.03);
          padding: 16px 16px 15px;
          backdrop-filter: blur(18px);
          box-shadow: 0 18px 44px rgba(0, 0, 0, 0.2);
          animation: welcomeFloat 8s ease-in-out infinite;
        }

        .welcome-hero-stage--light .welcome-hero-stage__node {
          border-color: rgba(15, 23, 42, 0.08);
          background: rgba(255, 255, 255, 0.84);
          box-shadow: 0 18px 44px rgba(15, 23, 42, 0.08);
        }

        .welcome-hero-stage__node-label {
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.22em;
          text-transform: uppercase;
          color: rgba(255, 255, 255, 0.42);
        }

        .welcome-hero-stage--light .welcome-hero-stage__node-label {
          color: rgba(71, 85, 105, 0.72);
        }

        .welcome-hero-stage__node-title {
          margin-top: 10px;
          font-size: 18px;
          font-weight: 700;
          line-height: 1.12;
          color: rgba(255, 255, 255, 0.95);
        }

        .welcome-hero-stage--light .welcome-hero-stage__node-title {
          color: rgba(15, 23, 42, 0.95);
        }

        .welcome-hero-stage__node-copy {
          margin-top: 8px;
          font-size: 13px;
          line-height: 1.55;
          color: rgba(255, 255, 255, 0.56);
        }

        .welcome-hero-stage--light .welcome-hero-stage__node-copy {
          color: rgba(71, 85, 105, 0.82);
        }

        .welcome-hero-stage__node--wallet {
          left: 22px;
          top: 24px;
        }

        .welcome-hero-stage__node--cards {
          right: 22px;
          top: 66px;
          animation-delay: -1.8s;
        }

        .welcome-hero-stage__node--pay {
          left: 36px;
          bottom: 48px;
          animation-delay: -3.4s;
        }

        .welcome-hero-stage__node--discover {
          right: 22px;
          bottom: 20px;
          animation-delay: -5.1s;
        }

        @keyframes welcomeRotate {
          from {
            transform: translate(-50%, -50%) rotate(0deg);
          }
          to {
            transform: translate(-50%, -50%) rotate(360deg);
          }
        }

        @keyframes welcomeRotateReverse {
          from {
            transform: translate(-50%, -50%) rotate(360deg);
          }
          to {
            transform: translate(-50%, -50%) rotate(0deg);
          }
        }

        @keyframes welcomeFloat {
          0%,
          100% {
            transform: translateY(0px);
          }
          50% {
            transform: translateY(-8px);
          }
        }

        @media (max-width: 768px) {
          .welcome-hero-stage {
            min-height: 460px;
          }

          .welcome-hero-stage__ring--outer {
            width: 316px;
            height: 316px;
          }

          .welcome-hero-stage__ring--mid {
            width: 236px;
            height: 236px;
          }

          .welcome-hero-stage__ring--inner {
            width: 180px;
            height: 180px;
          }

          .welcome-hero-stage__core {
            width: 166px;
            height: 166px;
          }

          .welcome-hero-stage__core-logo {
            width: 72px;
            height: 72px;
          }

          .welcome-hero-stage__node {
            width: 148px;
            border-radius: 20px;
            padding: 14px 14px 13px;
          }

          .welcome-hero-stage__node-title {
            font-size: 16px;
          }

          .welcome-hero-stage__node-copy {
            font-size: 12px;
          }

          .welcome-hero-stage__node--wallet {
            left: 12px;
            top: 18px;
          }

          .welcome-hero-stage__node--cards {
            right: 12px;
            top: 58px;
          }

          .welcome-hero-stage__node--pay {
            left: 12px;
            bottom: 62px;
          }

          .welcome-hero-stage__node--discover {
            right: 12px;
            bottom: 14px;
          }
        }
      `}</style>
    </div>
  );
}
