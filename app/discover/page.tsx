'use client';

import { useRouter } from 'next/navigation';
import { useWallet } from '@/contexts/WalletContext';
import { useState } from 'react';
import AccountHeader from '../components/AccountHeader';

type DAppCategory = 'all' | 'defi' | 'nft' | 'game' | 'social' | 'dao';

interface DApp {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: DAppCategory;
  url: string;
  featured?: boolean;
}

const DAPPS: DApp[] = [
  {
    id: '9',
    name: 'Omisper',
    description: 'Decentralized Social Platform',
    icon: '/omisper.png',
    category: 'social',
    url: 'https://omisper-front.pages.dev/',
    featured: true,
  },
  {
    id: '10',
    name: 'Hash Mahjong',
    description: 'Injective EVM Mini Game',
    icon: '/hashmahjong.png',
    category: 'game',
    url: 'https://hash-mahjong-two.vercel.app/',
    featured: true,
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

function SearchBox({
  value,
  onChange,
  onClear,
}: {
  value: string;
  onChange: (next: string) => void;
  onClear: () => void;
}) {
  return (
    <div className="relative">
      <input
        type="text"
        placeholder="Search dApps..."
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-xl border border-white/10 bg-white/5 py-3 pl-11 pr-11 text-sm text-white placeholder-gray-500 outline-none transition-all focus:border-white/20"
      />
      <svg className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <circle cx="11" cy="11" r="8" strokeWidth={2} />
        <path d="m21 21-4.35-4.35" strokeWidth={2} strokeLinecap="round" />
      </svg>
      {value && (
        <button
          onClick={onClear}
          className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 transition-colors hover:text-white"
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
  const [activeCategory, setActiveCategory] = useState<DAppCategory>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isEmbedded] = useState(() => {
    if (typeof window === 'undefined') return false;
    return new URLSearchParams(window.location.search).get('embed') === '1';
  });

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

  if (isCheckingSession) {
    return (
      <div className={`flex items-center justify-center ${isEmbedded ? 'h-full bg-black' : 'min-h-screen bg-black'}`}>
        <div className="h-8 w-8 rounded-full border-2 border-white/15 border-t-white animate-spin" />
      </div>
    );
  }

  if (!isUnlocked) {
    navigateApp('/');
    return null;
  }

  const filteredDapps = DAPPS.filter((dapp) => {
    const matchesCategory = activeCategory === 'all' || dapp.category === activeCategory;
    const matchesSearch =
      dapp.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      dapp.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const featuredDapps = DAPPS.filter((dapp) => dapp.featured);

  return (
    <div className={isEmbedded ? 'h-full bg-black' : 'min-h-screen bg-black'}>
      {!isEmbedded && (
        <div className="bg-gradient-to-b from-white/5 to-transparent border-b border-white/5 backdrop-blur-sm">
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
            <div className="rounded-2xl border border-white/10 bg-black p-4">
              <SearchBox value={searchQuery} onChange={setSearchQuery} onClear={() => setSearchQuery('')} />
            </div>
          </div>
        </div>
      )}

      {isEmbedded ? (
        <div className="grid h-full gap-4 p-4 lg:grid-cols-[260px_minmax(0,1fr)]">
          <div className="flex min-h-0 flex-col rounded-[1.5rem] border border-white/10 bg-white/[0.03] p-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-gray-500">Discover</div>
            <div className="mt-1 text-base font-bold text-white">Browse apps</div>
            <div className="mt-1 text-sm text-gray-400">Filter apps on the left and launch them from the right stage.</div>

            <div className="mt-4">
              <SearchBox value={searchQuery} onChange={setSearchQuery} onClear={() => setSearchQuery('')} />
            </div>

            <div className="mt-4 min-h-0 flex-1 overflow-y-auto pr-1">
              <div className="space-y-2">
                {CATEGORIES.map((category) => (
                  <button
                    key={category.id}
                    onClick={() => setActiveCategory(category.id as DAppCategory)}
                    className={`flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left text-sm font-semibold transition-all ${
                      activeCategory === category.id
                        ? 'border-white bg-white text-black'
                        : 'border-white/10 bg-white/[0.03] text-gray-300 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    <span>{category.name}</span>
                    <span className={`text-[11px] ${activeCategory === category.id ? 'text-black/70' : 'text-gray-500'}`}>
                      {category.id === 'all' ? DAPPS.length : DAPPS.filter((dapp) => dapp.category === category.id).length}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex min-h-0 flex-col rounded-[1.5rem] border border-white/10 bg-white/[0.03] p-4">
            {!searchQuery && (
              <div className="mb-5">
                <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-gray-500">Featured</div>
                <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
                  {featuredDapps.map((dapp) => (
                    <button
                      key={dapp.id}
                      onClick={() => handleDAppClick(dapp)}
                      className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-left transition-all hover:bg-white/10"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-white p-2 shadow-lg">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={dapp.icon} alt={dapp.name} className="h-full w-full object-contain" />
                        </div>
                        <div className="min-w-0">
                          <div className="truncate text-sm font-bold text-white">{dapp.name}</div>
                          <div className="mt-1 line-clamp-2 text-xs text-gray-400">{dapp.description}</div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="mb-3 flex items-center justify-between">
              <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-gray-500">
                {activeCategory === 'all' ? 'All dApps' : `${CATEGORIES.find((item) => item.id === activeCategory)?.name} dApps`}
              </div>
              <div className="text-xs text-gray-500">{filteredDapps.length} results</div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto pr-1">
              {filteredDapps.length === 0 ? (
                <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-6 text-center text-sm text-gray-400">
                  Try adjusting your search or filters.
                </div>
              ) : (
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {filteredDapps.map((dapp) => (
                    <button
                      key={dapp.id}
                      onClick={() => handleDAppClick(dapp)}
                      className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-left transition-all hover:bg-white/10"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-white p-2 shadow-lg">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={dapp.icon} alt={dapp.name} className="h-full w-full object-contain" />
                        </div>
                        <div className="min-w-0">
                          <div className="truncate text-sm font-bold text-white">{dapp.name}</div>
                          <div className="mt-1 line-clamp-2 text-xs text-gray-400">{dapp.description}</div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
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
                    <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-white p-2 shadow-lg transition-all group-hover:scale-110 hover:bg-gray-100">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={dapp.icon} alt={dapp.name} className="h-full w-full object-contain" />
                    </div>
                    <div className="w-full text-center">
                      <h3 className="truncate text-sm font-bold text-white">{dapp.name}</h3>
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
                    <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-white p-2 shadow-lg transition-all group-hover:scale-110 hover:bg-gray-100">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={dapp.icon} alt={dapp.name} className="h-full w-full object-contain" />
                    </div>
                    <div className="w-full text-center">
                      <h3 className="truncate text-sm font-bold text-white">{dapp.name}</h3>
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
