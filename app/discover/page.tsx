'use client';

import { useRouter } from 'next/navigation';
import { useWallet } from '@/contexts/WalletContext';
import { useState, useEffect } from 'react';
import AccountHeader from '../components/AccountHeader';
import LoadingSpinner from '@/components/LoadingSpinner';
import { DAPPS, DApp, DAppCategory } from '@/config/dapps';
import { NETWORK_CONFIG } from '@/config/network';
import { startQRScanner, stopQRScanner, clearQRScanner, isCameraSupported, isValidAddress } from '@/services/qr-scanner';
import { QRCodeSVG } from 'qrcode.react';

export default function DiscoverPage() {
  const router = useRouter();
  const { isUnlocked, address, isCheckingSession } = useWallet();
  const [activeCategory, setActiveCategory] = useState<DAppCategory>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'settings' | 'wallet' | 'discover'>('discover');

  // QR Scanner states
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [qrScanning, setQrScanning] = useState(false);
  const [qrError, setQrError] = useState('');
  const [qrSuccess, setQrSuccess] = useState(false);
  const [scannedAddress, setScannedAddress] = useState('');
  const [closingQRScanner, setClosingQRScanner] = useState(false);
  const [showMyQR, setShowMyQR] = useState(false);
  const [copied, setCopied] = useState(false);

  // Process dApps to include full icon URL
  const dapps: DApp[] = DAPPS.map(dapp => ({
    ...dapp,
    icon: dapp.icon.startsWith('http') 
      ? dapp.icon 
      : `${NETWORK_CONFIG.faviconService}${dapp.icon}&sz=128`
  }));

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
    window.open(dapp.url, '_blank', 'noopener,noreferrer');
  };

  // QR Scanner handlers (same as Dashboard)
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

      setTimeout(async () => {
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
                setTimeout(() => {
                  closeQRScanner();
                  router.push(`/send?address=${decodedText}`);
                }, 1000);
              } else {
                setQrError('Invalid address format');
                setQrScanning(false);
                stopQRScanner();
              }
            },
            (error) => {
              setQrError(error);
              setQrScanning(false);
            }
          );
        } catch (error) {
          setQrError(error instanceof Error ? error.message : 'Failed to start camera');
          setQrScanning(false);
        }
      }, 300);
    } catch (error) {
      alert('Error: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  };

  const closeQRScanner = () => {
    setClosingQRScanner(true);
    if (!showMyQR) {
      stopQRScanner();
    }
    setTimeout(() => {
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
            {/* Account Header with Faucet + Scan Buttons */}
            <div className="mb-6">
              <AccountHeader 
                address={address || undefined}
                showFaucetButton={true}
                onFaucetClick={() => router.push('/faucet')}
                showScanButton={true}
                onScanClick={openQRScanner}
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
                    <div className="w-16 h-16 rounded-full bg-white hover:bg-gray-100 flex items-center justify-center shadow-lg transition-all group-hover:scale-110 overflow-hidden p-2">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={dapp.icon}
                        alt={dapp.name}
                        className="w-full h-full object-contain"
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
                    <div className="w-16 h-16 rounded-full bg-white hover:bg-gray-100 flex items-center justify-center shadow-lg transition-all group-hover:scale-110 overflow-hidden p-2">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={dapp.icon}
                        alt={dapp.name}
                        className="w-full h-full object-contain"
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

      {/* QR Scanner Modal */}
      {showQRScanner && (
        <div 
          className={`fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 transition-opacity duration-200 px-4 ${closingQRScanner ? 'opacity-0' : 'opacity-100'}`}
          onClick={closeQRScanner}
        >
          <div 
            className={`bg-black border border-white/10 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden ${
              closingQRScanner ? 'slide-down' : 'slide-up'
            }`}
            onClick={(e) => e.stopPropagation()}
            style={{ maxHeight: '85vh' }}
          >
            <div className="p-4 border-b border-white/5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-white">Scan QR Code</h3>
                  <p className="text-gray-400 text-xs">Point camera at wallet address</p>
                </div>
                <button
                  onClick={closeQRScanner}
                  className="p-2 rounded-xl hover:bg-white/10 transition-all"
                >
                  <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            
            <div className="p-4 flex flex-col items-center justify-center" style={{ minHeight: '320px' }}>
              {showMyQR ? (
                <>
                  <div className="text-center mb-3">
                    <h4 className="text-sm font-bold text-white mb-1">My Wallet Address</h4>
                    <p className="text-gray-400 text-xs">Let others scan this code</p>
                  </div>
                  <div className="bg-white p-4 rounded-xl mb-3">
                    <QRCodeSVG 
                      value={address || ''} 
                      size={200}
                      level="H"
                      includeMargin={true}
                    />
                  </div>
                  <div className="w-full">
                    <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/10">
                      <span className="text-xs font-mono text-white truncate mr-2">
                        {address?.slice(0, 10)}...{address?.slice(-8)}
                      </span>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(address || '');
                          setCopied(true);
                          setTimeout(() => setCopied(false), 2000);
                        }}
                        className="p-1.5 rounded-lg hover:bg-white/10 transition-all flex-shrink-0"
                      >
                        {copied ? (
                          <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        ) : (
                          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 16 16">
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
                  <div className="relative w-full mb-4">
                    <div 
                      id="qr-reader-discover" 
                      className="rounded-xl overflow-hidden border-2 border-white/20"
                      style={{ width: '100%' }}
                    />
                    {qrScanning && (
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className="w-48 h-48 border-2 border-white/50 rounded-xl animate-pulse" />
                      </div>
                    )}
                  </div>
                  <h4 className="text-sm font-bold text-white mb-1">
                    {qrScanning ? 'Scanning...' : 'Initializing Camera...'}
                  </h4>
                  <p className="text-gray-400 text-xs text-center">
                    {qrScanning ? 'Point camera at QR code' : 'Please allow camera access'}
                  </p>
                </>
              ) : qrSuccess ? (
                <>
                  <div className="relative mb-4 flex items-center justify-center w-32 h-32">
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-32 h-32 rounded-full border-2 border-white/30 animate-ping"></div>
                    </div>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-28 h-28 rounded-full border-2 border-white/40 animate-ping" style={{ animationDelay: '0.15s' }}></div>
                    </div>
                    <div className="relative w-20 h-20 rounded-full bg-white flex items-center justify-center success-bounce shadow-2xl">
                      <svg className="w-10 h-10 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  </div>
                  <h4 className="text-sm font-bold text-white mb-1">QR Code Scanned!</h4>
                  <p className="text-gray-400 text-xs text-center mb-3">Redirecting to send page...</p>
                  <div className="text-xs font-mono text-gray-500 bg-white/5 px-3 py-2 rounded-lg">
                    {scannedAddress.slice(0, 8)}...{scannedAddress.slice(-6)}
                  </div>
                </>
              ) : (
                <>
                  <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center mb-3">
                    <svg className="w-6 h-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  </div>
                  <h4 className="text-sm font-bold text-white mb-1">Scan Failed</h4>
                  <p className="text-red-400 text-xs text-center mb-4">{qrError}</p>
                  <button
                    onClick={() => {
                      setQrError('');
                      openQRScanner();
                    }}
                    className="px-6 py-2.5 rounded-xl bg-white text-black font-bold hover:bg-gray-100 transition-all shadow-lg text-sm"
                  >
                    Try Again
                  </button>
                </>
              )}
            </div>

            <div className="p-3 border-t border-white/5">
              <button
                onClick={() => {
                  if (showMyQR) {
                    setShowMyQR(false);
                    setTimeout(() => {
                      openQRScanner();
                    }, 100);
                  } else {
                    setShowMyQR(true);
                    stopQRScanner();
                    setQrScanning(false);
                  }
                }}
                className="w-full py-2.5 rounded-xl bg-white/5 border border-white/10 text-white font-bold hover:bg-white/10 transition-all flex items-center justify-center gap-2 text-sm"
              >
                {showMyQR ? (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    Scan QR Code
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
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
