'use client';

import { useRouter } from 'next/navigation';
import { useWallet } from '@/contexts/WalletContext';
import { useEffect, useState } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import LoadingSpinner from '@/components/LoadingSpinner';
import AccountHeader from '../components/AccountHeader';

type DAppCategory = 'all' | 'defi' | 'nft' | 'game' | 'social' | 'dao';
type DiscoverCategory = DAppCategory | 'ai';

interface DApp {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: DAppCategory;
  url: string;
  featured?: boolean;
  aiDriven?: boolean;
}

const AI_DAPP_MENTIONS: Record<string, string> = {
  Omisper: '@Omisper',
  'Hash Mahjong': '@HashMahjong',
};

const DAPPS: DApp[] = [
  {
    id: '9',
    name: 'Omisper',
    description: 'Decentralized Social Platform',
    icon: '/omisper.png',
    category: 'social',
    url: 'https://omisper-front.pages.dev/',
    featured: true,
    aiDriven: true,
  },
  {
    id: '10',
    name: 'Hash Mahjong',
    description: 'Injective EVM Mini Game',
    icon: '/hashmahjong.png',
    category: 'game',
    url: 'https://hash-mahjong-two.vercel.app/',
    featured: true,
    aiDriven: true,
  },
  {
    id: '1',
    name: 'Helix',
    description: 'Decentralized Derivatives Trading',
    icon: 'https://www.google.com/s2/favicons?domain=helixapp.com&sz=128',
    category: 'defi',
    url: 'https://helixapp.com',
    featured: true,
  },
  {
    id: '2',
    name: 'Name Service',
    description: '.inj Domain Names',
    icon: 'https://www.google.com/s2/favicons?domain=inj.space.id&sz=128',
    category: 'defi',
    url: 'https://www.inj.space.id/',
    featured: true,
  },
  {
    id: '3',
    name: 'Paradyze',
    description: 'Yield & Structured Products',
    icon: 'https://www.google.com/s2/favicons?domain=paradyze.io&sz=128',
    category: 'defi',
    url: 'https://www.paradyze.io/',
  },
  {
    id: '4',
    name: 'Talis',
    description: 'NFT Marketplace',
    icon: 'https://www.google.com/s2/favicons?domain=talis.art&sz=128',
    category: 'nft',
    url: 'https://talis.art',
  },
  {
    id: '5',
    name: 'Rarible',
    description: 'Multichain NFT Marketplace',
    icon: 'https://www.google.com/s2/favicons?domain=rarible.com&sz=128',
    category: 'nft',
    url: 'https://rarible.com',
  },
  {
    id: '8',
    name: 'n1nj4',
    description: 'NFT Marketplace',
    icon: 'https://www.google.com/s2/favicons?domain=n1nj4.fun&sz=128',
    category: 'nft',
    url: 'https://www.n1nj4.fun/',
  },
  {
    id: '6',
    name: 'Injective Hub',
    description: 'Governance & Staking',
    icon: 'https://www.google.com/s2/favicons?domain=hub.injective.network&sz=128',
    category: 'dao',
    url: 'https://hub.injective.network',
  },
  {
    id: '7',
    name: 'Choice',
    description: 'DEX Aggregator & Vaults',
    icon: 'https://www.google.com/s2/favicons?domain=choice.exchange&sz=128',
    category: 'defi',
    url: 'https://choice.exchange',
  },
];

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
  const visibleDapps = isAiMode ? DAPPS.filter((dapp) => dapp.aiDriven) : DAPPS;
  const filteredDapps = visibleDapps.filter((dapp) => {
    const matchesCategory = activeCategory === 'all' || activeCategory === 'ai' || dapp.category === activeCategory;
    const matchesSearch =
      dapp.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      dapp.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const featuredDapps = DAPPS.filter((dapp) => dapp.featured);
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
                onScanClick={() => {}}
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
    </div>
  );
}
