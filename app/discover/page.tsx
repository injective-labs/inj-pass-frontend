'use client';

import { useRouter } from 'next/navigation';
import { useWallet } from '@/contexts/WalletContext';
import { useEffect, useState } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import LoadingSpinner from '@/components/LoadingSpinner';
import AccountHeader from '../components/AccountHeader';
import { DAPPS, DApp, DAppCategory } from '@/config/dapps';
import { NETWORK_CONFIG } from '@/config/network';
import { startQRScanner, stopQRScanner, clearQRScanner, isCameraSupported, isValidAddress } from '@/services/qr-scanner';
import { QRCodeSVG } from 'qrcode.react';

type DiscoverCategory = DAppCategory | 'ai';

const AI_DAPP_MENTIONS: Record<string, string> = {
  Omisper: '@Omisper',
  'Hash Mahjong': '@HashMahjong',
};
const AI_DRIVEN_DAPP_NAMES = new Set<keyof typeof AI_DAPP_MENTIONS>(['Omisper', 'Hash Mahjong']);

const CATEGORIES = [
  { id: 'all', name: 'New' },
  { id: 'defi', name: 'DeFi' },
  { id: 'nft', name: 'NFT' },
  { id: 'game', name: 'Game' },
  { id: 'social', name: 'Social' },
] as const;

const AI_CATEGORY = [{ id: 'ai', name: 'AI-Driven' }] as const;

function SearchBox({
  value,
  onChange,
  onClear,
  isLight,
}: {
  value: string;
  onChange: (next: string) => void;
  onClear: () => void;
  isLight: boolean;
}) {
  return (
    <div className="relative">
      <input
        type="text"
        placeholder="Search dApps..."
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={`w-full rounded-xl border py-3 pl-11 pr-11 text-sm outline-none transition-all ${
          isLight
            ? 'border-slate-200/80 bg-white/90 text-slate-900 placeholder:text-slate-400 focus:border-slate-300'
            : 'border-white/10 bg-white/5 text-white placeholder-gray-500 focus:border-white/20'
        }`}
      />
      <svg className={`absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 ${isLight ? 'text-slate-400' : 'text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <circle cx="11" cy="11" r="8" strokeWidth={2} />
        <path d="m21 21-4.35-4.35" strokeWidth={2} strokeLinecap="round" />
      </svg>
      {value && (
        <button
          onClick={onClear}
          className={`absolute right-4 top-1/2 -translate-y-1/2 transition-colors ${isLight ? 'text-slate-400 hover:text-slate-900' : 'text-gray-400 hover:text-white'}`}
          title="Clear search"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  );
}

export default function DiscoverPage() {
  const router = useRouter();
  const { isUnlocked, address, isCheckingSession } = useWallet();
  const { theme } = useTheme();
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [qrScanning, setQrScanning] = useState(false);
  const [qrError, setQrError] = useState('');
  const [qrSuccess, setQrSuccess] = useState(false);
  const [scannedAddress, setScannedAddress] = useState('');
  const [closingQRScanner, setClosingQRScanner] = useState(false);
  const [showMyQR, setShowMyQR] = useState(false);
  const [copied, setCopied] = useState(false);
  const [routeContext] = useState(() => {
    if (typeof window === 'undefined') {
      return { embedded: false, aiMode: false };
    }

    const params = new URLSearchParams(window.location.search);
    return {
      embedded: params.get('embed') === '1',
      aiMode: params.get('mode') === 'ai',
    };
  });
  const isEmbedded = routeContext.embedded;
  const isAiMode = routeContext.aiMode;
  const isLight = theme === 'light';
  const useWalletSurfaceTheme = isEmbedded;
  const [activeCategory, setActiveCategory] = useState<DiscoverCategory>(isAiMode ? 'ai' : 'all');
  const [searchQuery, setSearchQuery] = useState('');
  const [surfaceReady, setSurfaceReady] = useState(false);
  const dapps: (DApp & { aiDriven?: boolean })[] = DAPPS.map((dapp) => ({
    ...dapp,
    icon:
      dapp.icon.startsWith('http') || dapp.icon.startsWith('/')
        ? dapp.icon
        : `${NETWORK_CONFIG.faviconService}${dapp.icon}&sz=128`,
    aiDriven: AI_DRIVEN_DAPP_NAMES.has(dapp.name as keyof typeof AI_DAPP_MENTIONS),
  }));

  useEffect(() => {
    let frame = 0;
    frame = window.requestAnimationFrame(() => setSurfaceReady(true));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  const navigateApp = (path: string) => {
    if (typeof window !== 'undefined' && isEmbedded && window.top) {
      window.top.location.assign(path);
      return;
    }
    router.push(path);
  };

  const handleDAppClick = (dapp: DApp) => {
    window.open(dapp.url, '_blank', 'noopener,noreferrer');
  };

  const handleDAppDragStart = (event: React.DragEvent<HTMLButtonElement>, dapp: DApp) => {
    const mention = AI_DAPP_MENTIONS[dapp.name];
    if (!mention) return;
    event.dataTransfer.effectAllowed = 'copy';
    event.dataTransfer.setData('application/x-injpass-dapp', dapp.name);
    event.dataTransfer.setData('text/plain', mention);
  };

  const openQRScanner = async () => {
    try {
      if (!isCameraSupported()) {
        alert('Camera is not supported on this device. Please use a device with a camera and grant permission.');
        return;
      }

      setShowQRScanner(true);
      setQrScanning(false);
      setQrSuccess(false);
      setQrError('');
      setScannedAddress('');
      setClosingQRScanner(false);
      setShowMyQR(false);

      window.setTimeout(async () => {
        setQrScanning(true);
        try {
          await startQRScanner(
            'qr-reader-discover',
            (decodedText) => {
              if (isValidAddress(decodedText)) {
                setScannedAddress(decodedText);
                setQrSuccess(true);
                setQrScanning(false);
                stopQRScanner();
                window.setTimeout(() => {
                  closeQRScanner();
                  navigateApp(`/send?address=${decodedText}`);
                }, 1000);
              } else {
                setQrError('Invalid address format');
                setQrScanning(false);
                stopQRScanner();
              }
            },
            (nextError) => {
              setQrError(nextError);
              setQrScanning(false);
            }
          );
        } catch (nextError) {
          setQrError(nextError instanceof Error ? nextError.message : 'Failed to start camera');
          setQrScanning(false);
        }
      }, 300);
    } catch (nextError) {
      alert(`Error: ${nextError instanceof Error ? nextError.message : 'Unknown error'}`);
    }
  };

  const closeQRScanner = () => {
    setClosingQRScanner(true);
    if (!showMyQR) {
      stopQRScanner();
    }
    window.setTimeout(() => {
      setShowQRScanner(false);
      setQrScanning(false);
      setQrSuccess(false);
      setQrError('');
      setScannedAddress('');
      setClosingQRScanner(false);
      setShowMyQR(false);
      clearQRScanner();
    }, 350);
  };

  if (isCheckingSession) {
    return (
      <LoadingSpinner
        progress={isAiMode ? 58 : 44}
        statusLabel={isAiMode ? 'Loading AI-driven dApps' : 'Loading discovery workspace'}
      />
    );
  }

  if (!isUnlocked && !isEmbedded) {
    navigateApp('/');
    return null;
  }

  const categoryTabs = isAiMode ? AI_CATEGORY : CATEGORIES;
  const visibleDapps = isAiMode ? dapps.filter((dapp) => dapp.aiDriven) : dapps;
  const filteredDapps = visibleDapps.filter((dapp) => {
    const matchesCategory = activeCategory === 'all' || activeCategory === 'ai' || dapp.category === activeCategory;
    const matchesSearch =
      dapp.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      dapp.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const featuredDapps = dapps.filter((dapp) => dapp.featured);
  const activeCategoryIndex = Math.max(
    categoryTabs.findIndex((category) => category.id === activeCategory),
    0
  );

  return (
    <div className={`${isEmbedded ? 'h-full bg-black text-white' : `min-h-screen ${isLight ? 'bg-[#eef4fb] text-slate-900' : 'bg-black text-white'}`}`}>
      {!isEmbedded && (
        <div className={isLight ? 'border-b border-slate-200/80 bg-gradient-to-b from-white/90 to-transparent backdrop-blur-sm' : 'bg-gradient-to-b from-white/5 to-transparent border-b border-white/5 backdrop-blur-sm'}>
          <div className="max-w-7xl mx-auto px-4 py-6">
            <div className="mb-6">
              <AccountHeader
                address={address || undefined}
                showFaucetButton={true}
                onFaucetClick={() => navigateApp('/faucet')}
                showScanButton={true}
                onScanClick={openQRScanner}
              />
            </div>
            <div className={`rounded-2xl border p-4 ${isLight ? 'border-slate-200/80 bg-white/78' : 'border-white/10 bg-black'}`}>
              <SearchBox value={searchQuery} onChange={setSearchQuery} onClear={() => setSearchQuery('')} isLight={isLight} />
            </div>
          </div>
        </div>
      )}

      {isEmbedded ? (
        <div className="flex h-full flex-col gap-4 px-4 py-3">
          <div
            className={`flex items-center gap-3 transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
              surfaceReady ? 'translate-y-0 opacity-100' : 'translate-y-3 opacity-0'
            }`}
          >
            <div className={`relative rounded-xl p-1 ${isAiMode ? 'w-[118px] flex-none' : 'min-w-0 flex-1 max-w-[560px]'} ${
              useWalletSurfaceTheme
                ? 'border border-white/10 bg-black'
                : isLight
                  ? 'border border-slate-200/80 bg-slate-100/80 shadow-[0_10px_32px_rgba(148,163,184,0.10)]'
                  : 'bg-white/5'
            }`}>
              <div
                className={`pointer-events-none absolute bottom-1 top-1 rounded-lg transition-all duration-300 ease-out ${
                  useWalletSurfaceTheme
                    ? 'bg-white shadow-lg'
                    : isLight
                      ? 'border border-slate-200/80 bg-white shadow-[0_10px_24px_rgba(148,163,184,0.18)]'
                      : 'bg-white shadow-lg'
                }`}
                style={{
                  width: `calc((100% - ${(categoryTabs.length - 1) * 0.5}rem) / ${categoryTabs.length})`,
                  left: `calc(0.25rem + ${activeCategoryIndex} * ((100% - ${(categoryTabs.length - 1) * 0.5}rem) / ${categoryTabs.length} + 0.5rem))`,
                }}
              />
              <div className="relative flex gap-2">
                {categoryTabs.map((category) => (
                  <button
                    key={category.id}
                    onClick={() => setActiveCategory(category.id as DiscoverCategory)}
                    className={`flex-1 whitespace-nowrap rounded-lg px-3 py-2.5 text-xs font-bold transition-all duration-300 ${
                      activeCategory === category.id
                        ? useWalletSurfaceTheme ? 'text-black' : isLight ? 'text-slate-900' : 'text-black'
                        : useWalletSurfaceTheme ? 'text-gray-400 hover:text-white' : isLight ? 'text-slate-500 hover:text-slate-900' : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    {category.name}
                  </button>
                ))}
              </div>
            </div>
            <div className="ml-auto w-[168px] flex-shrink-0 sm:w-[196px] md:w-[220px]">
              <SearchBox value={searchQuery} onChange={setSearchQuery} onClear={() => setSearchQuery('')} isLight={useWalletSurfaceTheme ? false : isLight} />
            </div>
          </div>

          {filteredDapps.length === 0 ? (
            <div className={`flex min-h-0 flex-1 items-center justify-center px-6 text-center text-sm ${useWalletSurfaceTheme ? 'text-gray-400' : isLight ? 'text-slate-400' : 'text-gray-400'}`}>
              Try adjusting your search or filters.
            </div>
          ) : (
            <div
              className={`flex min-h-0 flex-1 gap-4 overflow-x-auto scrollbar-hide transition-all duration-500 delay-75 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                surfaceReady ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'
              }`}
            >
              {filteredDapps.map((dapp) => (
                <button
                  key={dapp.id}
                  draggable={isAiMode && !!AI_DAPP_MENTIONS[dapp.name]}
                  onDragStart={(event) => handleDAppDragStart(event, dapp)}
                  onClick={() => handleDAppClick(dapp)}
                  className={`flex min-w-[112px] flex-col items-center justify-center gap-2 rounded-[1.45rem] border px-3 py-4 text-center transition-all hover:-translate-y-[1px] ${
                    useWalletSurfaceTheme
                      ? 'border-white/10 bg-black hover:bg-white/[0.05]'
                      : isLight
                        ? 'border-slate-200/80 bg-transparent hover:bg-slate-50/55 shadow-[0_8px_24px_rgba(148,163,184,0.08)]'
                        : 'border-white/10 bg-transparent hover:bg-white/[0.06]'
                  } ${isAiMode && AI_DAPP_MENTIONS[dapp.name] ? 'cursor-grab active:cursor-grabbing' : ''}`}
                >
                  <div className={`flex h-11 w-11 items-center justify-center overflow-hidden rounded-full p-2 ${
                    useWalletSurfaceTheme
                      ? 'border border-white/10 bg-black shadow-[0_8px_18px_rgba(0,0,0,0.18)]'
                      : isLight
                        ? 'border border-slate-200/80 bg-transparent shadow-[0_8px_18px_rgba(148,163,184,0.10)]'
                        : 'border border-white/10 bg-transparent shadow-[0_8px_18px_rgba(0,0,0,0.18)]'
                  }`}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={dapp.icon} alt={dapp.name} className="h-full w-full object-contain" />
                  </div>
                  <div className={`w-full truncate text-xs font-bold ${useWalletSurfaceTheme ? 'text-white' : isLight ? 'text-slate-900' : 'text-white'}`}>{dapp.name}</div>
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="max-w-7xl mx-auto px-4 py-6">
          {!searchQuery && (
            <div className="mb-6">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-sm font-bold uppercase tracking-wider text-gray-400">Featured</h2>
              </div>
              <div className="grid grid-cols-2 gap-4 md:grid-cols-4 md:gap-6">
                {featuredDapps.map((dapp) => (
                  <div key={dapp.id} onClick={() => handleDAppClick(dapp)} className="group flex cursor-pointer flex-col items-center gap-2">
                    <div className={`flex h-16 w-16 items-center justify-center overflow-hidden rounded-full border p-2 shadow-lg transition-all group-hover:scale-110 ${
                      isLight
                        ? 'border-slate-200/80 bg-transparent shadow-[0_10px_24px_rgba(148,163,184,0.10)]'
                        : 'border-white/10 bg-transparent shadow-[0_10px_24px_rgba(0,0,0,0.22)]'
                    }`}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={dapp.icon} alt={dapp.name} className="h-full w-full object-contain" />
                    </div>
                    <div className="w-full text-center">
                      <h3 className={`truncate text-sm font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>{dapp.name}</h3>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="relative mb-6 rounded-xl bg-white/5 p-1">
            <div
              className="absolute top-1 bottom-1 bg-white rounded-lg transition-all duration-300 ease-out shadow-lg"
              style={{
                width: 'calc(20% - 0.2rem)',
                left:
                  activeCategory === 'all'
                    ? '0.25rem'
                    : activeCategory === 'defi'
                      ? 'calc(20% + 0.05rem)'
                      : activeCategory === 'nft'
                        ? 'calc(40% + 0.1rem)'
                        : activeCategory === 'game'
                          ? 'calc(60% + 0.15rem)'
                          : 'calc(80% + 0.2rem)',
              }}
            />

            <div className="relative flex gap-1 overflow-x-auto scrollbar-hide">
              {CATEGORIES.map((category) => (
                <button
                  key={category.id}
                  onClick={() => setActiveCategory(category.id as DAppCategory)}
                  className={`flex min-w-0 flex-1 items-center justify-center whitespace-nowrap rounded-lg px-4 py-3 text-sm font-bold transition-all duration-300 ease-out ${
                    activeCategory === category.id ? 'text-black scale-105' : 'text-gray-400 hover:text-white'
                  }`}
                >
                  {category.name}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-bold uppercase tracking-wider text-gray-400">
                {activeCategory === 'all' ? 'All dApps' : `${CATEGORIES.find((item) => item.id === activeCategory)?.name} dApps`}
              </h2>
            </div>

            {filteredDapps.length === 0 ? (
              <div className="py-16 text-center text-gray-500">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-white/10 bg-white/5">
                  <svg className="h-8 w-8 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <p className="mb-1 text-lg font-bold">No dApps found</p>
                <p className="text-xs text-gray-500">Try adjusting your search or filters</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4 md:grid-cols-4 md:gap-6">
                {filteredDapps.map((dapp) => (
                  <div key={dapp.id} onClick={() => handleDAppClick(dapp)} className="group flex cursor-pointer flex-col items-center gap-2">
                    <div className={`flex h-16 w-16 items-center justify-center overflow-hidden rounded-full border p-2 shadow-lg transition-all group-hover:scale-110 ${
                      isLight
                        ? 'border-slate-200/80 bg-transparent shadow-[0_10px_24px_rgba(148,163,184,0.10)]'
                        : 'border-white/10 bg-transparent shadow-[0_10px_24px_rgba(0,0,0,0.22)]'
                    }`}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={dapp.icon} alt={dapp.name} className="h-full w-full object-contain" />
                    </div>
                    <div className="w-full text-center">
                      <h3 className={`truncate text-sm font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>{dapp.name}</h3>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {showQRScanner && !isEmbedded && (
        <div
          className={`fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4 backdrop-blur-sm transition-opacity duration-200 ${
            closingQRScanner ? 'opacity-0' : 'opacity-100'
          }`}
          onClick={closeQRScanner}
        >
          <div
            className={`w-full max-w-md overflow-hidden rounded-2xl border border-white/10 bg-black shadow-2xl ${
              closingQRScanner ? 'slide-down' : 'slide-up'
            }`}
            onClick={(event) => event.stopPropagation()}
            style={{ maxHeight: '85vh' }}
          >
            <div className="border-b border-white/5 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-white">Scan QR Code</h3>
                  <p className="text-xs text-gray-400">Point camera at wallet address</p>
                </div>
                <button onClick={closeQRScanner} className="rounded-xl p-2 transition-all hover:bg-white/10">
                  <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="flex min-h-[320px] flex-col items-center justify-center p-4">
              {showMyQR ? (
                <>
                  <div className="mb-3 text-center">
                    <h4 className="mb-1 text-sm font-bold text-white">My Wallet Address</h4>
                    <p className="text-xs text-gray-400">Let others scan this code</p>
                  </div>
                  <div className="mb-3 rounded-xl bg-white p-4">
                    <QRCodeSVG value={address || ''} size={200} level="H" includeMargin={true} />
                  </div>
                  <div className="w-full">
                    <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 p-3">
                      <span className="mr-2 truncate text-xs font-mono text-white">
                        {address?.slice(0, 10)}...{address?.slice(-8)}
                      </span>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(address || '');
                          setCopied(true);
                          window.setTimeout(() => setCopied(false), 2000);
                        }}
                        className="flex-shrink-0 rounded-lg p-1.5 transition-all hover:bg-white/10"
                      >
                        {copied ? (
                          <svg className="h-4 w-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        ) : (
                          <svg className="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 16 16">
                            <rect width="11" height="11" x="4" y="4" rx="1" ry="1" strokeWidth="1.5" />
                            <path d="M2 10c-0.8 0-1.5-0.7-1.5-1.5V2c0-0.8 0.7-1.5 1.5-1.5h8.5c0.8 0 1.5 0.7 1.5 1.5" strokeWidth="1.5" />
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>
                </>
              ) : !qrSuccess && !qrError ? (
                <>
                  <div className="relative mb-4 w-full">
                    <div id="qr-reader-discover" className="overflow-hidden rounded-xl border-2 border-white/20" style={{ width: '100%' }} />
                    {qrScanning && (
                      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                        <div className="h-48 w-48 animate-pulse rounded-xl border-2 border-white/50" />
                      </div>
                    )}
                  </div>
                  <h4 className="mb-1 text-sm font-bold text-white">
                    {qrScanning ? 'Scanning...' : 'Initializing Camera...'}
                  </h4>
                  <p className="text-center text-xs text-gray-400">
                    {qrScanning ? 'Point camera at QR code' : 'Please allow camera access'}
                  </p>
                </>
              ) : qrSuccess ? (
                <>
                  <div className="relative mb-4 flex h-32 w-32 items-center justify-center">
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="h-32 w-32 animate-ping rounded-full border-2 border-white/30" />
                    </div>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="h-28 w-28 animate-ping rounded-full border-2 border-white/40" style={{ animationDelay: '0.15s' }} />
                    </div>
                    <div className="success-bounce relative flex h-20 w-20 items-center justify-center rounded-full bg-white shadow-2xl">
                      <svg className="h-10 w-10 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  </div>
                  <h4 className="mb-1 text-sm font-bold text-white">QR Code Scanned!</h4>
                  <p className="mb-3 text-center text-xs text-gray-400">Redirecting to send page...</p>
                  <div className="rounded-lg bg-white/5 px-3 py-2 text-xs font-mono text-gray-500">
                    {scannedAddress.slice(0, 8)}...{scannedAddress.slice(-6)}
                  </div>
                </>
              ) : (
                <>
                  <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-red-500/20">
                    <svg className="h-6 w-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  </div>
                  <h4 className="mb-1 text-sm font-bold text-white">Scan Failed</h4>
                  <p className="mb-4 text-center text-xs text-red-400">{qrError}</p>
                  <button
                    onClick={() => {
                      setQrError('');
                      openQRScanner();
                    }}
                    className="rounded-xl bg-white px-6 py-2.5 text-sm font-bold text-black transition-all hover:bg-gray-100"
                  >
                    Try Again
                  </button>
                </>
              )}
            </div>

            <div className="border-t border-white/5 p-3">
              <button
                onClick={() => {
                  if (showMyQR) {
                    setShowMyQR(false);
                    window.setTimeout(() => {
                      openQRScanner();
                    }, 100);
                  } else {
                    setShowMyQR(true);
                    stopQRScanner();
                    setQrScanning(false);
                  }
                }}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 py-2.5 text-sm font-bold text-white transition-all hover:bg-white/10"
              >
                {showMyQR ? (
                  <>
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    Scan QR Code
                  </>
                ) : (
                  <>
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                      <path d="M3 9V5a2 2 0 0 1 2-2h4" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M21 9V5a2 2 0 0 0-2-2h-4" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M3 15v4a2 2 0 0 0 2 2h4" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M21 15v4a2 2 0 0 1-2 2h-4" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    Show My QR Code
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
