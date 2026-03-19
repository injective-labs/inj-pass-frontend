'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import TunnelBackground from '@/components/TunnelBackground';
import ThemeToggleButton from '@/components/ThemeToggleButton';
import { useTheme } from '@/contexts/ThemeContext';
import { useWallet } from '@/contexts/WalletContext';
import { encryptKey, hasWallet, saveWallet } from '@/wallet/keystore';
import { createByPasskey, importPrivateKey } from '@/wallet/key-management';

const portalSurfaces = [
  {
    label: 'Wallet Layer',
    title: 'Asset Control',
    description: 'Balances, transfers, swap, and history live behind the same passkey surface.',
  },
  {
    label: 'Card Layer',
    title: 'NFC Pay',
    description: 'Bind physical cards and bring in-store interactions into the same account model.',
  },
  {
    label: 'Discovery Layer',
    title: 'Product Feed',
    description: 'Move from onboarding directly into apps, agents, and ecosystem actions.',
  },
];

const routeOverview = [
  {
    label: 'Route 01',
    title: 'Set Up',
    detail: 'Create a new passkey-bound wallet identity.',
  },
  {
    label: 'Route 02',
    title: 'Sign In',
    detail: 'Recover the wallet associated with your passkey.',
  },
  {
    label: 'Route 03',
    title: 'Import',
    detail: 'Encrypt an external private key locally on this device.',
  },
];

const heroSignals = [
  {
    label: 'Entry Time',
    value: '< 30 sec',
    description: 'Name the account and bind passkey directly in-browser.',
  },
  {
    label: 'Access Model',
    value: 'Passkey Native',
    description: 'Biometric-first access without a seed-phrase-first landing.',
  },
  {
    label: 'Surface Span',
    value: 'Wallet + Pay',
    description: 'Identity, cards, discovery, and wallet actions share one entry.',
  },
];

export default function WelcomePage() {
  const router = useRouter();
  const { theme } = useTheme();
  const { unlock } = useWallet();
  const [busyRoute, setBusyRoute] = useState<'create' | 'recover' | null>(null);
  const [error, setError] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
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
  const isLight = theme === 'light';

  const isBusy = busyRoute !== null;

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

  useEffect(() => {
    setWalletExists(hasWallet());
  }, []);

  useEffect(() => {
    if (showCreateModal) {
      const timeout = setTimeout(() => inputRef.current?.focus(), 60);
      return () => clearTimeout(timeout);
    }
  }, [showCreateModal]);

  const closeCreatePanel = () => {
    setShowCreateModal(false);
    setWalletNameInput('');
    setError('');
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
      router.push('/dashboard');
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
      router.push('/dashboard');
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
      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to recover wallet');
    } finally {
      setBusyRoute(null);
    }
  };

  return (
    <div className={`relative min-h-screen overflow-hidden text-white ${isLight ? 'bg-[#eef4fb]' : 'bg-[#03060d]'}`}>
      <TunnelBackground />
      <div
        className={`absolute inset-0 ${
          isLight
            ? 'bg-[radial-gradient(circle_at_12%_18%,rgba(59,130,246,0.12),transparent_24%),radial-gradient(circle_at_84%_16%,rgba(245,158,11,0.10),transparent_26%),radial-gradient(circle_at_50%_100%,rgba(148,163,184,0.10),transparent_45%),linear-gradient(180deg,rgba(255,255,255,0.18),rgba(238,244,251,0.94))]'
            : 'bg-[radial-gradient(circle_at_12%_18%,rgba(57,92,255,0.22),transparent_24%),radial-gradient(circle_at_84%_16%,rgba(90,214,255,0.16),transparent_26%),radial-gradient(circle_at_50%_100%,rgba(72,53,235,0.12),transparent_45%),linear-gradient(180deg,rgba(3,6,13,0.18),rgba(3,6,13,0.92))]'
        }`}
      />
      <div
        className="absolute inset-0 opacity-30"
        style={{
          backgroundImage:
            isLight
              ? 'linear-gradient(rgba(71,85,105,0.065) 1px, transparent 1px), linear-gradient(90deg, rgba(71,85,105,0.065) 1px, transparent 1px)'
              : 'linear-gradient(rgba(255,255,255,0.045) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.045) 1px, transparent 1px)',
          backgroundSize: '42px 42px',
          maskImage: 'linear-gradient(180deg, rgba(0,0,0,0.92), transparent)',
        }}
      />
      <div
        className={`absolute inset-0 opacity-60 ${
          isLight
            ? 'bg-[linear-gradient(110deg,rgba(255,255,255,0.3),transparent_18%,transparent_82%,rgba(255,255,255,0.18))]'
            : 'bg-[linear-gradient(110deg,rgba(255,255,255,0.035),transparent_18%,transparent_82%,rgba(255,255,255,0.02))]'
        }`}
      />

      <div className="relative z-10 mx-auto flex min-h-screen max-w-[1480px] flex-col px-4 pb-6 pt-4 md:px-8 md:pb-8 md:pt-6">
        <header
          className={`rounded-[1.75rem] border px-4 py-4 backdrop-blur-2xl md:px-6 ${
            isLight
              ? 'border-slate-200/80 bg-white/72 shadow-[0_18px_50px_rgba(148,163,184,0.18)]'
              : 'border-white/10 bg-black/30'
          }`}
        >
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-[1.2rem] border border-white/10 bg-white/[0.05] p-2">
                <Image src="/lambdalogo.png" alt="INJ Pass" width={36} height={36} className="h-9 w-9 object-contain" />
              </div>
              <div>
                <div className="text-base font-semibold tracking-[-0.02em] text-white">INJ Pass</div>
                <div className="mt-1 text-[11px] uppercase tracking-[0.28em] text-slate-500">Injective Identity Surface</div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <ThemeToggleButton compact />
              <div className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-100">
                Passkey Native
              </div>
              <div className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-300">
                Wallet + Card + Discover
              </div>
              <a
                href="https://x.com/INJ_Pass"
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-300 transition-colors hover:text-white"
              >
                Preview Release
              </a>
            </div>
          </div>
        </header>

        <main className="mt-6 grid flex-1 gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(390px,0.85fr)]">
          <section
            className={`relative overflow-hidden rounded-[2.25rem] border p-6 backdrop-blur-2xl md:p-8 xl:min-h-[820px] ${
              isLight
                ? 'border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.9),rgba(241,245,249,0.94))] shadow-[0_24px_80px_rgba(148,163,184,0.18)]'
                : 'border-white/10 bg-[linear-gradient(180deg,rgba(11,16,27,0.88),rgba(7,10,18,0.92))] shadow-[0_20px_80px_rgba(0,0,0,0.34)]'
            }`}
          >
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_16%,rgba(255,255,255,0.07),transparent_18%),radial-gradient(circle_at_82%_12%,rgba(68,90,255,0.18),transparent_28%),linear-gradient(180deg,rgba(255,255,255,0.03),transparent_62%)]" />
            <div className="relative z-10 flex h-full flex-col">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-300">
                  Wallet Access
                </span>
                <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-300">
                  Payment Layer
                </span>
                <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-300">
                  Discover Feed
                </span>
              </div>

              <div className="mt-8 grid gap-8 xl:grid-cols-[minmax(0,1.02fr)_minmax(320px,0.98fr)] xl:items-start">
                <div>
                  <div className="max-w-4xl">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-500">Onchain Entry Portal</div>
                    <h1 className="mt-5 text-4xl font-semibold leading-[0.92] tracking-[-0.05em] text-white md:text-6xl xl:text-[78px]">
                      One pass into
                      <span className="block text-white/72">wallet, pay, cards, and discovery.</span>
                    </h1>
                    <p className="mt-6 max-w-2xl text-base leading-7 text-slate-300 md:text-lg md:leading-8">
                      INJ Pass should feel like entering a product surface, not filling a form. This welcome screen now frames the whole software around one identity relay: set up fast, recover fast, or import an external wallet without leaving the same stage.
                    </p>
                  </div>

                  <div className="mt-8 grid gap-4 md:grid-cols-3">
                    {heroSignals.map((signal) => (
                      <div key={signal.label} className="rounded-[1.6rem] border border-white/10 bg-white/[0.04] px-5 py-4">
                        <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-500">{signal.label}</div>
                        <div className="mt-3 text-xl font-semibold tracking-[-0.03em] text-white">{signal.value}</div>
                        <div className="mt-2 text-sm leading-6 text-slate-400">{signal.description}</div>
                      </div>
                    ))}
                  </div>

                  <div
                    className={`mt-6 rounded-[1.9rem] border p-5 md:p-6 ${
                      isLight
                        ? 'border-slate-200/80 bg-white/78 shadow-[inset_0_1px_0_rgba(255,255,255,0.75)]'
                        : 'border-white/10 bg-[#0b111e]/90 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]'
                    }`}
                  >
                    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                      <div>
                        <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">Device Condition</div>
                        <div className="mt-3 flex items-center gap-3">
                          <span className={`h-2.5 w-2.5 rounded-full ${walletExists ? 'bg-emerald-400 shadow-[0_0_18px_rgba(52,211,153,0.7)]' : 'bg-amber-300 shadow-[0_0_18px_rgba(252,211,77,0.55)]'}`} />
                          <span className="text-lg font-semibold tracking-[-0.02em] text-white">
                            {walletExists ? 'Local wallet relay detected on this device' : 'Fresh device, ready for first-time setup'}
                          </span>
                        </div>
                        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">
                          {walletExists
                            ? 'Use Sign In with Passkey to re-open the same wallet identity, or import a separate private key if this device needs another entry path.'
                            : 'Create a new INJ Pass account if this is your first setup, or import an external private key if you are migrating from another wallet.'}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-slate-300">
                        <Image src="/injlogo.png" alt="Injective" width={18} height={18} className="h-[18px] w-[18px]" />
                        <span>Powered by Injective</span>
                      </div>
                    </div>

                    <div className="mt-6 grid gap-3 sm:grid-cols-3">
                      {routeOverview.map((route) => (
                        <div key={route.label} className="rounded-[1.35rem] border border-white/10 bg-white/[0.03] px-4 py-4">
                          <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-500">{route.label}</div>
                          <div className="mt-2 text-base font-semibold text-white">{route.title}</div>
                          <div className="mt-2 text-sm leading-6 text-slate-400">{route.detail}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="grid gap-4">
                  <div
                    className={`welcome-stage rounded-[2rem] border p-5 ${
                      isLight
                        ? 'border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.95),rgba(241,245,249,0.96))]'
                        : 'border-white/10 bg-[linear-gradient(180deg,rgba(10,15,25,0.96),rgba(7,11,20,0.98))]'
                    }`}
                  >
                    <div className="welcome-stage__grid" />
                    <div className="welcome-stage__glow welcome-stage__glow--one" />
                    <div className="welcome-stage__glow welcome-stage__glow--two" />
                    <div className="welcome-stage__glow welcome-stage__glow--three" />
                    <div className="welcome-stage__beam welcome-stage__beam--one" />
                    <div className="welcome-stage__beam welcome-stage__beam--two" />
                    <div className="welcome-stage__beam welcome-stage__beam--three" />
                    <div className="welcome-stage__beam welcome-stage__beam--four" />

                    <div className="welcome-stage__core">
                      <div className="welcome-stage__core-label">INJ PASS</div>
                      <div className="welcome-stage__core-mark">λ</div>
                      <div className="welcome-stage__core-copy">identity relay</div>
                    </div>

                    <div className="welcome-stage__panel welcome-stage__panel--wallet">
                      <div className="welcome-stage__panel-label">Wallet</div>
                      <div className="welcome-stage__panel-title">Asset access</div>
                      <div className="welcome-stage__panel-copy">Balances, send, swap, and history.</div>
                    </div>

                    <div className="welcome-stage__panel welcome-stage__panel--cards">
                      <div className="welcome-stage__panel-label">Cards</div>
                      <div className="welcome-stage__panel-title">NFC management</div>
                      <div className="welcome-stage__panel-copy">Card bind, pay flow, and card center.</div>
                    </div>

                    <div className="welcome-stage__panel welcome-stage__panel--pay">
                      <div className="welcome-stage__panel-label">Pay</div>
                      <div className="welcome-stage__panel-title">Merchant rail</div>
                      <div className="welcome-stage__panel-copy">From card tap to wallet settlement.</div>
                    </div>

                    <div className="welcome-stage__panel welcome-stage__panel--discover">
                      <div className="welcome-stage__panel-label">Discover</div>
                      <div className="welcome-stage__panel-title">Ecosystem view</div>
                      <div className="welcome-stage__panel-copy">Products, routes, and next actions.</div>
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-1">
                    {portalSurfaces.map((surface) => (
                      <div key={surface.label} className="rounded-[1.6rem] border border-white/10 bg-white/[0.04] px-5 py-4">
                        <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-500">{surface.label}</div>
                        <div className="mt-2 text-lg font-semibold tracking-[-0.03em] text-white">{surface.title}</div>
                        <div className="mt-2 text-sm leading-6 text-slate-400">{surface.description}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section
            className={`relative overflow-hidden rounded-[2.25rem] border p-6 backdrop-blur-2xl md:p-8 xl:min-h-[820px] ${
              isLight
                ? 'border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.94),rgba(247,250,255,0.98))] shadow-[0_24px_80px_rgba(148,163,184,0.18)]'
                : 'border-white/10 bg-[linear-gradient(180deg,rgba(8,11,18,0.94),rgba(5,8,14,0.98))] shadow-[0_20px_80px_rgba(0,0,0,0.34)]'
            }`}
          >
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.06),transparent_18%),linear-gradient(180deg,rgba(255,255,255,0.025),transparent_56%)]" />
            <div className="relative z-10 flex h-full flex-col">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">Entry Console</div>
                  <h2 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-white md:text-[36px]">Choose how this device enters.</h2>
                  <p className="mt-3 text-sm leading-6 text-slate-400">
                    Set up a new passkey account, sign back into an existing wallet, or migrate an external key into local encrypted storage.
                  </p>
                </div>

                <div className={`rounded-full border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.22em] ${walletExists ? 'border-emerald-400/20 bg-emerald-400/10 text-emerald-200' : 'border-white/10 bg-white/[0.04] text-slate-300'}`}>
                  {walletExists ? 'Device Ready' : 'New Device'}
                </div>
              </div>

              {error && (
                <div className="mt-5 rounded-[1.4rem] border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm leading-6 text-red-300">
                  {error}
                </div>
              )}

              <div className="mt-6 rounded-[1.85rem] border border-white/10 bg-white/[0.04] p-5 md:p-6">
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[1rem] border border-white/10 bg-white/[0.06] text-sm font-semibold text-white">
                    01
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">Passkey Setup</div>
                    <div className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-white">Set Up INJ Pass</div>
                    <div className="mt-2 text-sm leading-6 text-slate-400">
                      Create a new device-bound wallet identity and bind it to your passkey in one flow.
                    </div>
                  </div>
                </div>

                <div className="mt-5 grid">
                  <div
                    style={{ gridArea: '1 / 1' }}
                    className={`transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                      showCreateModal ? 'pointer-events-none translate-y-3 opacity-0' : 'translate-y-0 opacity-100'
                    }`}
                  >
                    <button
                      onClick={() => {
                        setShowCreateModal(true);
                        setError('');
                      }}
                      disabled={isBusy}
                      className="w-full rounded-[1.4rem] bg-white px-5 py-4 text-left text-black transition-all hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <div className="text-base font-semibold tracking-[-0.02em]">Create with Passkey</div>
                          <div className="mt-1 text-sm text-black/65">Name the account, approve the passkey request, then enter dashboard.</div>
                        </div>
                        <svg className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    </button>
                  </div>

                  <div
                    style={{ gridArea: '1 / 1' }}
                    className={`transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                      showCreateModal ? 'translate-y-0 opacity-100' : 'pointer-events-none -translate-y-3 opacity-0'
                    }`}
                  >
                    <div
                      className={`rounded-[1.5rem] border p-4 ${
                        isLight
                          ? 'border-slate-200/80 bg-slate-50/92 shadow-[inset_0_1px_0_rgba(255,255,255,0.92)]'
                          : 'border-white/10 bg-[#0c1321] shadow-[inset_0_1px_0_rgba(255,255,255,0.025)]'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <label className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">Account Name</label>
                        <button
                          onClick={closeCreatePanel}
                          className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400 transition-colors hover:text-white"
                        >
                          Close
                        </button>
                      </div>

                      <div className="mt-3 rounded-[1.25rem] border border-white/10 bg-black/25 px-4 py-3.5">
                        <input
                          ref={inputRef}
                          type="text"
                          value={walletNameInput}
                          onChange={(e) => setWalletNameInput(e.target.value)}
                          placeholder="Name this account"
                          className="w-full bg-transparent text-sm font-semibold text-white placeholder:text-slate-600 focus:outline-none"
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
                          className="rounded-[1.15rem] border border-white/10 px-4 py-3 text-sm font-semibold text-slate-300 transition-all hover:bg-white/[0.04] disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={handleCreateWallet}
                          disabled={busyRoute === 'recover' || !walletNameInput.trim() || busyRoute === 'create'}
                          className="flex-1 rounded-[1.15rem] bg-white px-4 py-3 text-sm font-semibold text-black transition-all hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          {busyRoute === 'create' ? 'Creating...' : 'Bind Passkey and Continue'}
                        </button>
                      </div>

                      <div className="mt-3 text-xs leading-5 text-slate-500">
                        The wallet name is only used for the local account label on this device.
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-4 rounded-[1.85rem] border border-white/10 bg-white/[0.04] p-5 md:p-6">
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[1rem] border border-white/10 bg-white/[0.06] text-sm font-semibold text-white">
                    02
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">Recovery Route</div>
                    <div className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-white">Sign In with Passkey</div>
                    <div className="mt-2 text-sm leading-6 text-slate-400">
                      Re-open the wallet already associated with your passkey and bring this device back into the same account state.
                    </div>
                  </div>
                </div>

                <div
                  className={`mt-5 rounded-[1.45rem] border p-4 ${
                    isLight
                      ? 'border-slate-200/80 bg-slate-50/92'
                      : 'border-white/10 bg-[#0b1220]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">Local Status</div>
                      <div className="mt-2 text-base font-semibold text-white">
                        {walletExists ? 'Local wallet record found' : 'No local wallet yet'}
                      </div>
                      <div className="mt-1 text-sm leading-6 text-slate-400">
                        {walletExists
                          ? 'Use your passkey to unlock the account already paired with this device.'
                          : 'Use your passkey to recover the account that was previously bound elsewhere.'}
                      </div>
                    </div>
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 shrink-0 text-slate-400">
                      <path d="M21 2v6h-6" />
                      <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
                      <path d="M3 22v-6h6" />
                      <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
                    </svg>
                  </div>

                  <button
                    onClick={handleRecoverWallet}
                    disabled={isBusy}
                    className="mt-4 w-full rounded-[1.25rem] border border-white/10 bg-white/[0.06] px-4 py-3.5 text-left text-white transition-all hover:bg-white/[0.1] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <div className="text-base font-semibold tracking-[-0.02em]">Continue with existing passkey</div>
                        <div className="mt-1 text-sm text-slate-400">Authentication will restore the paired wallet into the current session.</div>
                      </div>
                      {busyRoute === 'recover' ? (
                        <svg className="h-5 w-5 shrink-0 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                      ) : (
                        <svg className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                        </svg>
                      )}
                    </div>
                  </button>
                </div>
              </div>

              <div className="mt-4 rounded-[1.85rem] border border-dashed border-white/10 bg-white/[0.025] p-5 md:p-6">
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[1rem] border border-white/10 bg-white/[0.06] text-sm font-semibold text-white">
                    03
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">Migration Route</div>
                    <div className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-white">Import Private Key</div>
                    <div className="mt-2 text-sm leading-6 text-slate-400">
                      Bring an external wallet into this device and encrypt the imported key locally before entering dashboard.
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => setShowImportModal(true)}
                  disabled={isBusy}
                  className="mt-5 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-4 py-2.5 text-sm font-semibold text-white transition-all hover:bg-white/[0.1] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M15 7h3a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h3m6 0V5a3 3 0 1 0-6 0v2m6 0H9" />
                  </svg>
                  Import Existing Key
                </button>
              </div>

              <div className="mt-auto pt-6">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-[1.45rem] border border-white/10 bg-white/[0.04] px-4 py-4">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">Security Model</div>
                    <div className="mt-2 text-sm font-semibold text-white">WebAuthn for entry, local encryption for imported keys.</div>
                  </div>
                  <div className="rounded-[1.45rem] border border-white/10 bg-white/[0.04] px-4 py-4">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">Environment</div>
                    <div className="mt-2 text-sm font-semibold text-white">Preview release. Use only accounts and funds appropriate for testing.</div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </main>
      </div>

      {showImportModal && (
        <div
          className={`fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-xl ${
            isLight ? 'bg-[rgba(236,244,251,0.82)]' : 'bg-[rgba(3,6,13,0.82)]'
          }`}
        >
          <div
            className={`relative w-full max-w-4xl overflow-hidden rounded-[2.2rem] border shadow-[0_28px_90px_rgba(0,0,0,0.55)] ${
              isLight
                ? 'border-slate-200/80 bg-[rgba(255,255,255,0.96)] shadow-[0_28px_90px_rgba(148,163,184,0.26)]'
                : 'border-white/10 bg-[#060a12]/95'
            }`}
          >
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_18%,rgba(77,101,255,0.18),transparent_24%),radial-gradient(circle_at_84%_12%,rgba(61,215,255,0.12),transparent_20%),linear-gradient(180deg,rgba(255,255,255,0.03),transparent_60%)]" />
            <button
              onClick={handleCloseImport}
              className="absolute right-5 top-5 z-20 flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.05] text-slate-300 transition-all hover:bg-white/[0.1] hover:text-white"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <div className="relative z-10 grid md:grid-cols-[320px_minmax(0,1fr)]">
              <div
                className={`border-b p-6 md:border-b-0 md:border-r md:p-7 ${
                  isLight ? 'border-slate-200/80 bg-slate-50/80' : 'border-white/10 bg-white/[0.03]'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-[1rem] border border-white/10 bg-white/[0.06] p-2">
                    <Image src="/lambdalogo.png" alt="INJ Pass" width={28} height={28} className="h-7 w-7 object-contain" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-white">Import Flow</div>
                    <div className="mt-1 text-[11px] uppercase tracking-[0.24em] text-slate-500">External Wallet Migration</div>
                  </div>
                </div>

                <h2 className="mt-8 text-3xl font-semibold tracking-[-0.04em] text-white">Bring an external wallet in.</h2>
                <p className="mt-4 text-sm leading-7 text-slate-400">
                  Paste the private key, verify it locally, then protect it with a password used only on this device.
                </p>

                <div className="mt-8 flex items-center gap-2">
                  <div className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] ${importStep === 'key' ? 'bg-white text-black' : 'border border-white/10 bg-white/[0.04] text-slate-400'}`}>
                    Step 1 Key
                  </div>
                  <div className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] ${importStep === 'password' ? 'bg-white text-black' : 'border border-white/10 bg-white/[0.04] text-slate-400'}`}>
                    Step 2 Encrypt
                  </div>
                </div>

                <div className="mt-8 space-y-3">
                  <div className="rounded-[1.3rem] border border-white/10 bg-white/[0.04] px-4 py-4">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">Private Handling</div>
                    <div className="mt-2 text-sm leading-6 text-slate-300">The raw key stays in-browser during validation and local keystore creation.</div>
                  </div>
                  <div className="rounded-[1.3rem] border border-white/10 bg-white/[0.04] px-4 py-4">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">Password Scope</div>
                    <div className="mt-2 text-sm leading-6 text-slate-300">This password is separate from passkey access and only secures the imported key locally.</div>
                  </div>
                </div>
              </div>

              <div className="p-6 md:p-7">
                {importStep === 'key' ? (
                  <>
                    <div className="rounded-[1.55rem] border border-white/10 bg-white/[0.04] p-4">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">Private Key</div>
                      <p className="mt-2 text-sm leading-6 text-slate-400">
                        Use this route only when migrating an existing external wallet into the current device.
                      </p>
                    </div>

                    <div className="relative mt-5">
                      <input
                        ref={privateKeyRef}
                        type={showPrivateKey ? 'text' : 'password'}
                        value={privateKeyInput}
                        onChange={(e) => setPrivateKeyInput(e.target.value)}
                        placeholder="Private key (hex)"
                        className="w-full rounded-[1.3rem] border border-white/10 bg-white/[0.05] px-4 py-4 pr-12 font-mono text-sm text-white placeholder:text-slate-600 focus:border-white/30 focus:outline-none"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            handleImportNextStep();
                          }
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPrivateKey(!showPrivateKey)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 rounded-xl p-1 text-slate-500 transition-colors hover:text-slate-300"
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

                    {importError && <p className="mt-3 text-sm text-red-400">{importError}</p>}

                    <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                      <button
                        onClick={handleCloseImport}
                        className="rounded-[1.2rem] border border-white/10 px-4 py-3 text-sm font-semibold text-slate-300 transition-colors hover:bg-white/[0.04]"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleImportNextStep}
                        className="flex-1 rounded-[1.2rem] bg-white px-4 py-3 text-sm font-semibold text-black transition-colors hover:bg-slate-100"
                      >
                        Continue
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="rounded-[1.55rem] border border-white/10 bg-white/[0.04] p-4">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">Local Encryption</div>
                      <p className="mt-2 text-sm leading-6 text-slate-400">
                        Set a device-specific password to encrypt the imported key before the wallet is stored locally.
                      </p>
                    </div>

                    <input
                      ref={importPasswordRef}
                      type="password"
                      value={importPassword}
                      onChange={(e) => setImportPassword(e.target.value)}
                      placeholder="Password (min 8 characters)"
                      className="mt-5 w-full rounded-[1.3rem] border border-white/10 bg-white/[0.05] px-4 py-4 text-sm text-white placeholder:text-slate-600 focus:border-white/30 focus:outline-none"
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
                      className="mt-3 w-full rounded-[1.3rem] border border-white/10 bg-white/[0.05] px-4 py-4 text-sm text-white placeholder:text-slate-600 focus:border-white/30 focus:outline-none"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleImportWallet();
                        }
                      }}
                    />

                    {importError && <p className="mt-3 text-sm text-red-400">{importError}</p>}

                    <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                      <button
                        onClick={() => {
                          setImportStep('key');
                          setImportError('');
                        }}
                        className="rounded-[1.2rem] border border-white/10 px-4 py-3 text-sm font-semibold text-slate-300 transition-colors hover:bg-white/[0.04]"
                      >
                        Back
                      </button>
                      <button
                        onClick={handleImportWallet}
                        disabled={importLoading}
                        className="flex-1 rounded-[1.2rem] bg-white px-4 py-3 text-sm font-semibold text-black transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
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
        .welcome-stage {
          position: relative;
          min-height: 530px;
          overflow: hidden;
          isolation: isolate;
        }

        .welcome-stage__grid {
          position: absolute;
          inset: 0;
          background-image:
            linear-gradient(rgba(255, 255, 255, 0.06) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255, 255, 255, 0.06) 1px, transparent 1px);
          background-size: 26px 26px;
          opacity: 0.18;
          mask-image: radial-gradient(circle at center, rgba(0, 0, 0, 1), transparent 78%);
        }

        .welcome-stage__glow {
          position: absolute;
          border-radius: 999px;
          filter: blur(16px);
          opacity: 0.8;
          animation: stageGlow 8s ease-in-out infinite;
        }

        .welcome-stage__glow--one {
          top: 10%;
          left: 18%;
          width: 110px;
          height: 110px;
          background: rgba(65, 106, 255, 0.28);
        }

        .welcome-stage__glow--two {
          right: 10%;
          top: 18%;
          width: 140px;
          height: 140px;
          background: rgba(68, 216, 255, 0.18);
          animation-delay: -2.4s;
        }

        .welcome-stage__glow--three {
          bottom: 8%;
          left: 40%;
          width: 180px;
          height: 180px;
          background: rgba(93, 67, 255, 0.15);
          animation-delay: -4.6s;
        }

        .welcome-stage__beam {
          position: absolute;
          height: 1px;
          background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.28), transparent);
          opacity: 0.7;
          transform-origin: left center;
          animation: stageBeam 5.5s ease-in-out infinite;
        }

        .welcome-stage__beam--one {
          top: 31%;
          left: 25%;
          width: 30%;
          transform: rotate(14deg);
        }

        .welcome-stage__beam--two {
          top: 37%;
          right: 19%;
          width: 26%;
          transform: rotate(-23deg);
          animation-delay: -1.2s;
        }

        .welcome-stage__beam--three {
          bottom: 33%;
          left: 22%;
          width: 32%;
          transform: rotate(-22deg);
          animation-delay: -2.3s;
        }

        .welcome-stage__beam--four {
          bottom: 26%;
          right: 18%;
          width: 29%;
          transform: rotate(18deg);
          animation-delay: -3.1s;
        }

        .welcome-stage__core {
          position: absolute;
          left: 50%;
          top: 50%;
          z-index: 2;
          display: flex;
          width: 170px;
          height: 170px;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 8px;
          border-radius: 32px;
          border: 1px solid rgba(255, 255, 255, 0.12);
          background: linear-gradient(180deg, rgba(15, 22, 37, 0.92), rgba(8, 12, 21, 0.98));
          box-shadow:
            0 30px 60px rgba(0, 0, 0, 0.38),
            0 0 40px rgba(70, 91, 255, 0.14),
            inset 0 1px 0 rgba(255, 255, 255, 0.06);
          transform: translate(-50%, -50%);
          animation: stageCoreFloat 6.2s ease-in-out infinite;
        }

        .welcome-stage__core-label {
          border-radius: 999px;
          border: 1px solid rgba(255, 255, 255, 0.08);
          background: rgba(255, 255, 255, 0.04);
          padding: 4px 10px;
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.24em;
          text-transform: uppercase;
          color: rgba(226, 232, 240, 0.74);
        }

        .welcome-stage__core-mark {
          font-size: 52px;
          font-weight: 700;
          line-height: 1;
          color: #ffffff;
          text-shadow: 0 0 20px rgba(89, 102, 255, 0.35);
        }

        .welcome-stage__core-copy {
          font-size: 12px;
          font-weight: 600;
          letter-spacing: 0.2em;
          text-transform: uppercase;
          color: rgba(148, 163, 184, 0.88);
        }

        .welcome-stage__panel {
          position: absolute;
          z-index: 1;
          width: 190px;
          border-radius: 24px;
          border: 1px solid rgba(255, 255, 255, 0.1);
          background: linear-gradient(180deg, rgba(15, 21, 34, 0.94), rgba(8, 12, 20, 0.98));
          padding: 16px 18px;
          box-shadow: 0 18px 44px rgba(0, 0, 0, 0.28);
          backdrop-filter: blur(18px);
          animation: stagePanelFloat 7.4s ease-in-out infinite;
        }

        .welcome-stage__panel-label {
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.22em;
          text-transform: uppercase;
          color: rgba(148, 163, 184, 0.7);
        }

        .welcome-stage__panel-title {
          margin-top: 10px;
          font-size: 18px;
          font-weight: 700;
          line-height: 1.15;
          color: #ffffff;
        }

        .welcome-stage__panel-copy {
          margin-top: 8px;
          font-size: 13px;
          line-height: 1.6;
          color: rgba(148, 163, 184, 0.92);
        }

        .welcome-stage__panel--wallet {
          left: 18px;
          top: 28px;
        }

        .welcome-stage__panel--cards {
          right: 20px;
          top: 74px;
          animation-delay: -1.4s;
        }

        .welcome-stage__panel--pay {
          left: 32px;
          bottom: 52px;
          animation-delay: -2.8s;
        }

        .welcome-stage__panel--discover {
          right: 18px;
          bottom: 26px;
          animation-delay: -4s;
        }

        @keyframes stageGlow {
          0%,
          100% {
            transform: scale(0.94);
            opacity: 0.45;
          }
          50% {
            transform: scale(1.08);
            opacity: 0.9;
          }
        }

        @keyframes stageBeam {
          0%,
          100% {
            opacity: 0.18;
            transform-origin: left center;
          }
          50% {
            opacity: 0.85;
          }
        }

        @keyframes stageCoreFloat {
          0%,
          100% {
            transform: translate(-50%, -50%) translateY(0px);
          }
          50% {
            transform: translate(-50%, -50%) translateY(-10px);
          }
        }

        @keyframes stagePanelFloat {
          0%,
          100% {
            transform: translateY(0px);
          }
          50% {
            transform: translateY(-8px);
          }
        }

        @media (max-width: 640px) {
          .welcome-stage {
            min-height: 480px;
          }

          .welcome-stage__core {
            width: 144px;
            height: 144px;
            border-radius: 28px;
          }

          .welcome-stage__core-mark {
            font-size: 44px;
          }

          .welcome-stage__panel {
            width: 160px;
            padding: 14px 15px;
            border-radius: 20px;
          }

          .welcome-stage__panel-title {
            font-size: 16px;
          }

          .welcome-stage__panel-copy {
            font-size: 12px;
            line-height: 1.5;
          }

          .welcome-stage__panel--wallet {
            left: 12px;
            top: 20px;
          }

          .welcome-stage__panel--cards {
            right: 12px;
            top: 72px;
          }

          .welcome-stage__panel--pay {
            left: 12px;
            bottom: 64px;
          }

          .welcome-stage__panel--discover {
            right: 12px;
            bottom: 16px;
          }
        }
      `}</style>
      <style jsx global>{`
        html[data-theme='light'] .welcome-stage__grid {
          background-image:
            linear-gradient(rgba(71, 85, 105, 0.08) 1px, transparent 1px),
            linear-gradient(90deg, rgba(71, 85, 105, 0.08) 1px, transparent 1px);
          opacity: 0.34;
        }

        html[data-theme='light'] .welcome-stage__beam {
          background: linear-gradient(90deg, transparent, rgba(148, 163, 184, 0.55), transparent);
          opacity: 0.48;
        }

        html[data-theme='light'] .welcome-stage__core {
          border-color: rgba(148, 163, 184, 0.24);
          background: linear-gradient(180deg, rgba(255, 255, 255, 0.96), rgba(241, 245, 249, 0.98));
          box-shadow:
            0 24px 60px rgba(148, 163, 184, 0.26),
            0 0 36px rgba(59, 130, 246, 0.08),
            inset 0 1px 0 rgba(255, 255, 255, 0.92);
        }

        html[data-theme='light'] .welcome-stage__core-label {
          border-color: rgba(148, 163, 184, 0.2);
          background: rgba(148, 163, 184, 0.08);
          color: rgba(71, 85, 105, 0.92);
        }

        html[data-theme='light'] .welcome-stage__core-mark {
          color: #0f172a;
          text-shadow: 0 0 18px rgba(59, 130, 246, 0.14);
        }

        html[data-theme='light'] .welcome-stage__core-copy {
          color: rgba(100, 116, 139, 0.92);
        }

        html[data-theme='light'] .welcome-stage__panel {
          border-color: rgba(148, 163, 184, 0.22);
          background: linear-gradient(180deg, rgba(255, 255, 255, 0.95), rgba(241, 245, 249, 0.95));
          box-shadow: 0 18px 44px rgba(148, 163, 184, 0.16);
        }

        html[data-theme='light'] .welcome-stage__panel-label {
          color: rgba(100, 116, 139, 0.84);
        }

        html[data-theme='light'] .welcome-stage__panel-title {
          color: #0f172a;
        }

        html[data-theme='light'] .welcome-stage__panel-copy {
          color: rgba(71, 85, 105, 0.88);
        }
      `}</style>
    </div>
  );
}
