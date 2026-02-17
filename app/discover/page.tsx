'use client';

import { useRouter } from 'next/navigation';
import { useWallet } from '@/contexts/WalletContext';
import { useState, useEffect } from 'react';
import Image from 'next/image';
import AccountHeader from '../components/AccountHeader';
import LoadingSpinner from '@/components/LoadingSpinner';
import DAppBrowser from '@/components/DAppBrowser';
import { getDAppIconUrl } from '@/services/dapp-icons';

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

export default function DiscoverPage() {
  const router = useRouter();
  const { isUnlocked, address, isCheckingSession } = useWallet();
  const [activeCategory, setActiveCategory] = useState<DAppCategory>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'settings' | 'wallet' | 'discover'>('discover');
  const [selectedDApp, setSelectedDApp] = useState<DApp | null>(null);
  const [dappIconUrls, setDappIconUrls] = useState<Map<string, string>>(new Map());

  // DApp data with real icons
  const dapps: DApp[] = [
    {
      id: '1',
      name: 'Helix',
      description: 'Decentralized Derivatives Trading',
      icon: 'https://helixapp.com/favicon.ico',
      category: 'defi',
      url: 'https://helixapp.com',
      featured: true
    },
    {
      id: '2',
      name: 'INJ Ecosystem',
      description: 'Explore the Injective Ecosystem',
      icon: 'https://injective.com/favicon.ico',
      category: 'defi',
      url: 'https://injective.com',
      featured: true
    },
    {
      id: '3',
      name: 'Astroport',
      description: 'AMM & DEX Protocol',
      icon: 'https://astroport.fi/favicon.ico',
      category: 'defi',
      url: 'https://astroport.fi'
    },
    {
      id: '4',
      name: 'Talis',
      description: 'NFT Marketplace',
      icon: 'https://talis.art/favicon.ico',
      category: 'nft',
      url: 'https://talis.art',
      featured: true
    },
    {
      id: '5',
      name: 'Injective Hub',
      description: 'Governance & Staking',
      icon: 'https://hub.injective.network/favicon.ico',
      category: 'dao',
      url: 'https://hub.injective.network'
    },
    {
      id: '6',
      name: 'DojoSwap',
      description: 'Swap & Earn Rewards',
      icon: 'https://dojoswap.xyz/favicon.ico',
      category: 'defi',
      url: 'https://dojoswap.xyz'
    }
  ];

  // Load DApp icons on mount
  useEffect(() => {
    const iconUrls = new Map<string, string>();
    dapps.forEach((dapp) => {
      iconUrls.set(dapp.id, getDAppIconUrl(dapp.url));
    });
    setDappIconUrls(iconUrls);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const categories = [
    { id: 'all', name: 'New', icon: '🌐' },
    { id: 'defi', name: 'DeFi', icon: '💰' },
    { id: 'nft', name: 'NFT', icon: '🎨' },
    { id: 'game', name: 'Game', icon: '🎮' },
    { id: 'social', name: 'Social', icon: '👥' }
  ];

  const filteredDapps = dapps.filter(dapp => {
    const matchesCategory = activeCategory === 'all' || dapp.category === activeCategory;
    const matchesSearch = dapp.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         dapp.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const featuredDapps = dapps.filter(dapp => dapp.featured);

  const handleDAppClick = (dapp: DApp) => {
    console.log('[Discover] Opening DApp:', dapp.name, dapp.url);
    setSelectedDApp(dapp);
  };

  if (isCheckingSession) {
    return <LoadingSpinner />;
  }

  if (!isUnlocked) {
    router.push('/');
    return null;
  }

  return (
    <div className="min-h-screen pb-24 md:pb-8 bg-black">
      <div>
        {/* Header - OKX Style */}
        <div className="bg-gradient-to-b from-white/5 to-transparent border-b border-white/5 backdrop-blur-sm">
          <div className="max-w-7xl mx-auto px-4 py-6">
            {/* Account Header with Scan Button */}
            <div className="mb-6">
              <AccountHeader 
                address={address || undefined}
                showScanButton={true}
                onScanClick={() => {/* TODO: Implement scan functionality */}}
              />
            </div>

            {/* Search Bar - OKX Style */}
            <div className="bg-black rounded-2xl p-4 border border-white/10">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search dApps..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full py-3 px-12 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-white/20 transition-all text-sm"
                />
                <svg className="w-4 h-4 absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <circle cx="11" cy="11" r="8" strokeWidth={2} />
                  <path d="m21 21-4.35-4.35" strokeWidth={2} strokeLinecap="round" />
                </svg>
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="max-w-7xl mx-auto px-4 py-6">
          {/* Featured Section - Horizontal 4 Cards (Above Categories) */}
          {!searchQuery && (
            <div className="mb-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider">Featured</h2>
              </div>
              <div className="grid grid-cols-4 gap-6">
                {featuredDapps.map((dapp) => (
                  <div
                    key={dapp.id}
                    onClick={() => handleDAppClick(dapp)}
                    className="flex flex-col items-center gap-2 cursor-pointer group"
                  >
                    <div className="w-16 h-16 rounded-full bg-white hover:bg-gray-100 flex items-center justify-center shadow-lg transition-all group-hover:scale-110 overflow-hidden">
                      <Image
                        src={dapp.icon}
                        alt={dapp.name}
                        width={48}
                        height={48}
                        className="w-12 h-12 object-contain"
                        onError={(e) => {
                          // Fallback to Google favicon service
                          const img = e.target as HTMLImageElement;
                          const domain = new URL(dapp.url).hostname;
                          img.src = `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;
                        }}
                      />
                    </div>
                    <div className="text-center w-full">
                      <h3 className="font-bold text-sm text-white truncate">{dapp.name}</h3>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Categories - Smooth Sliding Background */}
          <div className="relative mb-6 p-1 bg-white/5 rounded-xl">
            {/* Sliding Background */}
            <div 
              className="absolute top-1 bottom-1 bg-white rounded-lg transition-all duration-300 ease-out shadow-lg"
              style={{
                width: `calc(20% - 0.2rem)`,
                left: activeCategory === 'all' ? '0.25rem' : 
                      activeCategory === 'defi' ? 'calc(20% + 0.05rem)' : 
                      activeCategory === 'nft' ? 'calc(40% + 0.1rem)' :
                      activeCategory === 'game' ? 'calc(60% + 0.15rem)' :
                      'calc(80% + 0.2rem)'
              }}
            />
            
            {/* Tab Buttons */}
            <div className="relative flex gap-1 overflow-x-auto scrollbar-hide">
              {categories.map((category) => (
                <button
                  key={category.id}
                  onClick={() => setActiveCategory(category.id as DAppCategory)}
                  className={`flex items-center justify-center py-3 px-4 rounded-lg font-bold text-sm whitespace-nowrap transition-all duration-300 ease-out flex-1 min-w-0 transform ${
                    activeCategory === category.id
                      ? 'text-black scale-105'
                      : 'text-gray-400 hover:text-white hover:scale-102'
                  }`}
                >
                  {category.name}
                </button>
              ))}
            </div>
          </div>

          {/* dApp Grid - Horizontal 4 Columns */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider">
                {activeCategory === 'all' ? 'All dApps' : `${categories.find(c => c.id === activeCategory)?.name} dApps`}
              </h2>
            </div>
            
            {filteredDapps.length === 0 ? (
              <div className="text-center py-16 text-gray-500">
                <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4 border border-white/10">
                  <svg className="w-8 h-8 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <p className="text-lg font-bold mb-1">No dApps found</p>
                <p className="text-xs text-gray-500">Try adjusting your search or filters</p>
              </div>
            ) : (
              <div className="grid grid-cols-4 gap-6">
                {filteredDapps.map((dapp) => (
                  <div
                    key={dapp.id}
                    onClick={() => handleDAppClick(dapp)}
                    className="flex flex-col items-center gap-2 cursor-pointer group"
                  >
                    <div className="w-16 h-16 rounded-full bg-white hover:bg-gray-100 flex items-center justify-center shadow-lg transition-all group-hover:scale-110 overflow-hidden">
                      <Image
                        src={dapp.icon}
                        alt={dapp.name}
                        width={48}
                        height={48}
                        className="w-12 h-12 object-contain"
                        onError={(e) => {
                          // Fallback to Google favicon service
                          const img = e.target as HTMLImageElement;
                          const domain = new URL(dapp.url).hostname;
                          img.src = `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;
                        }}
                      />
                    </div>
                    <div className="text-center w-full">
                      <h3 className="font-bold text-sm text-white truncate">{dapp.name}</h3>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* DApp Browser Modal */}
      {selectedDApp && (
        <DAppBrowser
          url={selectedDApp.url}
          name={selectedDApp.name}
          onClose={() => setSelectedDApp(null)}
        />
      )}

      {/* Bottom Navigation - Same as Dashboard */}
      <div className="fixed bottom-0 left-0 right-0 bg-black/95 border-t border-white/10 backdrop-blur-lg">
        <div className="max-w-7xl mx-auto px-4">
          <div className="grid grid-cols-3 gap-4 py-3">
            {/* Settings */}
            <button
              onClick={() => {
                setActiveTab('settings');
                router.push('/settings');
              }}
              className={`flex flex-col items-center gap-1 py-2 rounded-xl transition-all duration-300 ease-in-out transform ${
                activeTab === 'settings' 
                  ? 'text-white scale-105' 
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              <div className={`p-2 rounded-xl transition-all duration-300 ease-in-out ${
                activeTab === 'settings' 
                  ? 'bg-white/10' 
                  : 'bg-transparent'
              }`}>
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <span className="text-xs font-semibold">Settings</span>
            </button>

            {/* Wallet */}
            <button
              onClick={() => {
                setActiveTab('wallet');
                router.push('/dashboard');
              }}
              className={`flex flex-col items-center gap-1 py-2 rounded-xl transition-all duration-300 ease-in-out transform ${
                activeTab === 'wallet' 
                  ? 'text-white scale-105' 
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              <div className={`p-2 rounded-xl transition-all duration-300 ease-in-out ${
                activeTab === 'wallet' 
                  ? 'bg-white/10' 
                  : 'bg-transparent'
              }`}>
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <rect x="2" y="6" width="20" height="14" rx="2" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M2 10h20" strokeWidth={2} strokeLinecap="round" />
                  <circle cx="18" cy="15" r="1.5" fill="currentColor" />
                </svg>
              </div>
              <span className="text-xs font-semibold">Wallet</span>
            </button>

            {/* Discover */}
            <button
              onClick={() => setActiveTab('discover')}
              className={`flex flex-col items-center gap-1 py-2 rounded-xl transition-all duration-300 ease-in-out transform ${
                activeTab === 'discover' 
                  ? 'text-white scale-105' 
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              <div className={`p-2 rounded-xl transition-all duration-300 ease-in-out ${
                activeTab === 'discover' 
                  ? 'bg-white/10' 
                  : 'bg-transparent'
              }`}>
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="10" strokeWidth={2} strokeLinecap="round" />
                  <path d="M8 12h8M12 8v8" strokeWidth={2} strokeLinecap="round" />
                  <path d="M15 9l-3 3 3 3" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <span className="text-xs font-semibold">Discover</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
