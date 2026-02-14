'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useWallet } from '@/contexts/WalletContext';
import { getBalance } from '@/wallet/chain';
import { Balance, INJECTIVE_MAINNET } from '@/types/chain';
import { getInjPrice } from '@/services/price';
import { getTokenBalances } from '@/services/dex-swap';
import { startQRScanner, stopQRScanner, clearQRScanner, isCameraSupported, isValidAddress } from '@/services/qr-scanner';
import { QRCodeSVG } from 'qrcode.react';
import type { Address } from 'viem';
import Image from 'next/image';

export default function DashboardPage() {
  const router = useRouter();
  const { isUnlocked, address, lock, isCheckingSession } = useWallet();
  const [balance, setBalance] = useState<Balance | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [injPrice, setInjPrice] = useState<number>(25);
  const [balanceVisible, setBalanceVisible] = useState(true);
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'settings' | 'wallet' | 'discover'>('wallet');
  const [assetTab, setAssetTab] = useState<'tokens' | 'nfts' | 'defi'>('tokens');
  const [tokenBalances, setTokenBalances] = useState<Record<string, string>>({
    INJ: '0.0000',
    USDT: '0.00',
    USDC: '0.00',
  });
  
  // QR Scanner states
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [qrScanning, setQrScanning] = useState(false);
  const [qrError, setQrError] = useState('');
  const [qrSuccess, setQrSuccess] = useState(false);
  const [scannedAddress, setScannedAddress] = useState('');
  const [closingQRScanner, setClosingQRScanner] = useState(false);
  const [showMyQR, setShowMyQR] = useState(false);

  useEffect(() => {
    // Wait for session check to complete
    if (isCheckingSession) {
      console.log('[Dashboard] Still checking session, waiting...');
      return;
    }

    console.log('[Dashboard] isUnlocked:', isUnlocked, 'address:', address);
    if (!isUnlocked || !address) {
      console.log('[Dashboard] Not unlocked, redirecting to /welcome');
      router.push('/welcome');
      return;
    }

    console.log('[Dashboard] Unlocked, loading data...');
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isUnlocked, address, isCheckingSession]);

  const loadData = async () => {
    if (!address) return;

    try {
      setLoading(true);
      const [balanceData, priceData, tokenBalData] = await Promise.all([
        getBalance(address, INJECTIVE_MAINNET),
        getInjPrice(),
        getTokenBalances(['INJ', 'USDT', 'USDC'], address as Address),
      ]);
      
      setBalance(balanceData);
      setInjPrice(priceData);
      setTokenBalances({
        INJ: parseFloat(tokenBalData.INJ).toFixed(4),
        USDT: parseFloat(tokenBalData.USDT).toFixed(2),
        USDC: parseFloat(tokenBalData.USDC).toFixed(2),
      });
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const handleCopyAddress = () => {
    if (address) {
      navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // QR Scanner handlers
  const openQRScanner = async () => {
    console.log('[Dashboard] openQRScanner called');
    
    // Check camera support
    if (!isCameraSupported()) {
      console.error('[Dashboard] Camera not supported');
      alert('Camera is not supported on this device. Please use a device with a camera and grant permission.');
      return;
    }

    console.log('[Dashboard] Opening QR scanner modal');
    setShowQRScanner(true);
    setQrScanning(false);
    setQrSuccess(false);
    setQrError('');
    setScannedAddress('');
    setClosingQRScanner(false);
    setShowMyQR(false);

    // Start scanning after modal opens
    setTimeout(async () => {
      console.log('[Dashboard] Starting scanner...');
      setQrScanning(true);
      try {
        await startQRScanner(
          'qr-reader',
          (decodedText) => {
            console.log('[Dashboard] QR decoded:', decodedText);
            
            // Validate address
            if (isValidAddress(decodedText)) {
              setScannedAddress(decodedText);
              setQrSuccess(true);
              setQrScanning(false);
              
              // Stop scanner
              stopQRScanner();
              
              // Redirect to send page after 1 second
              setTimeout(() => {
                closeQRScanner();
                router.push(`/send?address=${decodedText}`);
              }, 1000);
            } else {
              setQrError('Invalid address format. Please scan a valid wallet address.');
              setQrScanning(false);
              stopQRScanner();
            }
          },
          (error) => {
            console.error('[Dashboard] Scanner error:', error);
            setQrError(error);
            setQrScanning(false);
          }
        );
      } catch (error) {
        console.error('[Dashboard] Failed to start QR scanner:', error);
        setQrError(error instanceof Error ? error.message : 'Failed to start camera');
        setQrScanning(false);
      }
    }, 300);
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

  if (loading) {
    return (
      <div className="min-h-screen pb-24 md:pb-8 animate-fade-in">
        <div className="max-w-7xl mx-auto px-4 py-6">
          {/* Loading Skeleton */}
          <div className="space-y-6">
            <div className="h-12 bg-white/5 rounded-2xl animate-pulse"></div>
            <div className="h-48 bg-white/5 rounded-3xl animate-pulse"></div>
            <div className="grid grid-cols-4 gap-3">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="h-24 bg-white/5 rounded-2xl animate-pulse"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  const formattedBalance = balance ? parseFloat(balance.formatted).toFixed(4) : '0.0000';
  const injUsdValue = balance ? (parseFloat(balance.formatted) * injPrice) : 0;
  const usdtValue = parseFloat(tokenBalances.USDT);
  const usdcValue = parseFloat(tokenBalances.USDC);
  const totalUsdValue = (injUsdValue + usdtValue + usdcValue).toFixed(2);

  return (
    <div className="min-h-screen pb-24 md:pb-8 bg-black">
      <div>
        {/* Modern Dashboard Header */}
        <div className="bg-gradient-to-b from-white/5 to-transparent border-b border-white/5 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 py-6">
          {/* Header Top */}
          <div className="flex items-center justify-between mb-6">
            {/* Account Info */}
            <div className="flex items-center gap-3">
              {/* Brand Logo */}
              <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center p-1.5">
                <Image 
                  src="/lambdalogo.png" 
                  alt="Logo" 
                  width={32} 
                  height={32}
                  className="w-full h-full object-contain"
                />
              </div>
              
              <div>
                <div className="text-sm font-bold text-white mb-1">Account 1</div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs text-gray-400">
                    {address?.slice(0, 6)}...{address?.slice(-4)}
                  </span>
                  <button 
                    onClick={handleCopyAddress}
                    className="p-1 rounded hover:bg-white/10 transition-all group"
                    title="Copy address"
                  >
                    {copied ? (
                      <svg className="w-3.5 h-3.5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <svg className="w-3.5 h-3.5 text-gray-400 group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 16 16">
                        <rect width="11" height="11" x="4" y="4" rx="1" ry="1" strokeWidth="1.5" />
                        <path d="M2 10c-0.8 0-1.5-0.7-1.5-1.5V2c0-0.8 0.7-1.5 1.5-1.5h8.5c0.8 0 1.5 0.7 1.5 1.5" strokeWidth="1.5" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* Scan QR Code Button */}
            <button 
              onClick={openQRScanner}
              className="p-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 transition-all"
              title="Scan QR Code"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                {/* Top-left corner */}
                <path d="M3 9V5a2 2 0 0 1 2-2h4" strokeLinecap="round" strokeLinejoin="round" />
                {/* Top-right corner */}
                <path d="M21 9V5a2 2 0 0 0-2-2h-4" strokeLinecap="round" strokeLinejoin="round" />
                {/* Bottom-left corner */}
                <path d="M3 15v4a2 2 0 0 0 2 2h4" strokeLinecap="round" strokeLinejoin="round" />
                {/* Bottom-right corner */}
                <path d="M21 15v4a2 2 0 0 1-2 2h-4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>

          {/* Total Balance Card - OKX Style */}
          <div className="bg-black rounded-2xl p-6 border border-white/10 relative overflow-hidden">
            {/* Subtle gradient accent */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-green-500/5 to-transparent rounded-full blur-2xl"></div>
            
            <div className="relative">
              {/* Header with Balance Label */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <span className="text-gray-400 text-xs font-semibold uppercase tracking-wider">Total Balance</span>
                  <button 
                    onClick={() => setBalanceVisible(!balanceVisible)}
                    className="p-1 rounded hover:bg-white/5 transition-colors"
                  >
                    {balanceVisible ? (
                      <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                      </svg>
                    )}
                  </button>
                </div>
                <button 
                  onClick={handleRefresh}
                  disabled={refreshing}
                  className="p-1 rounded hover:bg-white/5 transition-colors disabled:opacity-50"
                >
                  <svg className={`w-4 h-4 text-gray-400 ${refreshing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </button>
              </div>

              {/* Main Balance Display */}
              <div className="mb-5">
                <div className="flex items-baseline gap-3">
                  <span className="text-4xl md:text-5xl font-bold text-white font-mono tracking-tight">
                    {balanceVisible ? formattedBalance : '••••••'}
                  </span>
                  <span className="text-xl font-semibold text-gray-400">INJ</span>
                </div>
                <div className="flex items-center gap-4 mt-2">
                  <div className="text-base text-gray-400 font-mono">
                    ≈ ${balanceVisible ? totalUsdValue : '••••••'} USD
                  </div>
                  {/* 24h Change */}
                  <div className="flex items-center gap-2">
                    <span className="text-green-400 text-sm font-semibold">+$0.00</span>
                    <span className="text-green-400 text-sm">+0.00%</span>
                    <span className="text-gray-500 text-xs">24h</span>
                  </div>
                </div>
              </div>

              {/* Action Buttons - Circular White Style */}
              <div className="grid grid-cols-4 gap-4">
                {/* Send Button */}
                <button 
                  onClick={() => router.push('/send')}
                  className="flex flex-col items-center gap-2 group"
                >
                  <div className="w-14 h-14 rounded-full bg-white hover:bg-gray-100 flex items-center justify-center shadow-lg transition-all group-hover:scale-105">
                    <svg className="w-5 h-5 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <line x1="12" y1="19" x2="12" y2="5" strokeWidth={2.5} strokeLinecap="round" />
                      <polyline points="5 12 12 5 19 12" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                  <span className="text-xs font-semibold text-gray-300">Send</span>
                </button>

                {/* Receive Button */}
                <button 
                  onClick={() => router.push('/receive')}
                  className="flex flex-col items-center gap-2 group"
                >
                  <div className="w-14 h-14 rounded-full bg-white hover:bg-gray-100 flex items-center justify-center shadow-lg transition-all group-hover:scale-105">
                    <svg className="w-5 h-5 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <line x1="12" y1="5" x2="12" y2="19" strokeWidth={2.5} strokeLinecap="round" />
                      <polyline points="19 12 12 19 5 12" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                  <span className="text-xs font-semibold text-gray-300">Receive</span>
                </button>

                {/* Swap Button */}
                <button 
                  onClick={() => router.push('/swap')}
                  className="flex flex-col items-center gap-2 group"
                >
                  <div className="w-14 h-14 rounded-full bg-white hover:bg-gray-100 flex items-center justify-center shadow-lg transition-all group-hover:scale-105">
                    <svg className="w-5 h-5 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <polyline points="16 3 21 3 21 8" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
                      <line x1="4" y1="20" x2="21" y2="3" strokeWidth={2.5} strokeLinecap="round" />
                      <polyline points="21 16 21 21 16 21" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
                      <line x1="15" y1="15" x2="21" y2="21" strokeWidth={2.5} strokeLinecap="round" />
                      <line x1="4" y1="4" x2="9" y2="9" strokeWidth={2.5} strokeLinecap="round" />
                    </svg>
                  </div>
                  <span className="text-xs font-semibold text-gray-300">Swap</span>
                </button>

                {/* History Button */}
                <button 
                  onClick={() => router.push('/history')}
                  className="flex flex-col items-center gap-2 group"
                >
                  <div className="w-14 h-14 rounded-full bg-white hover:bg-gray-100 flex items-center justify-center shadow-lg transition-all group-hover:scale-105">
                    <svg className="w-5 h-5 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <circle cx="12" cy="12" r="10" strokeWidth={2.5} strokeLinecap="round" />
                      <polyline points="12 6 12 12 16 14" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                  <span className="text-xs font-semibold text-gray-300">History</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Assets Section - No Container */}
      <div className="max-w-7xl mx-auto px-4 pt-3 pb-6">
        {/* Asset Tabs - Smooth Sliding Background */}
        <div className="relative mb-6 p-1 bg-white/5 rounded-xl">
          {/* Sliding Background */}
          <div 
            className={`absolute top-1 bottom-1 w-[calc(33.333%-0.333rem)] bg-white rounded-lg transition-all duration-300 ease-out shadow-lg ${
              assetTab === 'tokens' ? 'left-1' : 
              assetTab === 'nfts' ? 'left-[calc(33.333%+0.166rem)]' : 
              'left-[calc(66.666%+0.333rem)]'
            }`}
          />
          
          {/* Tab Buttons */}
          <div className="relative flex gap-2">
            <button 
              onClick={() => setAssetTab('tokens')}
              className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-lg font-bold text-sm transition-all duration-300 ${
                assetTab === 'tokens' 
                  ? 'text-black' 
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10" strokeWidth={2} />
                <path d="M12 6v12M6 12h12" strokeWidth={2} strokeLinecap="round" />
              </svg>
              <span>Tokens</span>
            </button>
            <button 
              onClick={() => setAssetTab('nfts')}
              className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-lg font-bold text-sm transition-all duration-300 ${
                assetTab === 'nfts' 
                  ? 'text-black' 
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <rect width="18" height="18" x="3" y="3" rx="2" ry="2" strokeWidth={2} />
                <path d="M9 3v18M3 9h18" strokeWidth={2} strokeLinecap="round" />
              </svg>
              <span>NFTs</span>
            </button>
            <button 
              onClick={() => setAssetTab('defi')}
              className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-lg font-bold text-sm transition-all duration-300 ${
                assetTab === 'defi' 
                  ? 'text-black' 
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span>DeFi</span>
            </button>
          </div>
        </div>

        {/* Asset List */}
        <div className="space-y-3">
          {assetTab === 'tokens' && (
            <>
              <div className="flex items-center gap-4 p-4 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 transition-all cursor-pointer">
                <div className="w-12 h-12 rounded-full flex items-center justify-center overflow-hidden">
                  <Image 
                    src="/injswap.png" 
                    alt="INJ" 
                    width={48} 
                    height={48}
                    className="w-full h-full object-contain"
                  />
                </div>
                <div className="flex-1">
                  <div className="font-bold mb-1">INJ</div>
                  <div className="text-sm text-gray-400">{tokenBalances.INJ} INJ</div>
                </div>
                <div className="text-right">
                  <div className="font-bold font-mono">${(parseFloat(tokenBalances.INJ) * injPrice).toFixed(2)}</div>
                  <div className="text-sm text-gray-500">0.00%</div>
                </div>
              </div>

              <div className="flex items-center gap-4 p-4 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 transition-all cursor-pointer">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center overflow-hidden">
                  <Image 
                    src="/USDT_Logo.png" 
                    alt="USDT" 
                    width={48} 
                    height={48}
                    className="w-full h-full object-contain"
                  />
                </div>
                <div className="flex-1">
                  <div className="font-bold mb-1">USDT</div>
                  <div className="text-sm text-gray-400">{tokenBalances.USDT} USDT</div>
                </div>
                <div className="text-right">
                  <div className="font-bold font-mono">${tokenBalances.USDT}</div>
                  <div className="text-sm text-gray-500">0.00%</div>
                </div>
              </div>

              <div className="flex items-center gap-4 p-4 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 transition-all cursor-pointer">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center overflow-hidden">
                  <Image 
                    src="/USDC_Logo.png" 
                    alt="USDC" 
                    width={48} 
                    height={48}
                    className="w-full h-full object-contain"
                  />
                </div>
                <div className="flex-1">
                  <div className="font-bold mb-1">USDC</div>
                  <div className="text-sm text-gray-400">{tokenBalances.USDC} USDC</div>
                </div>
                <div className="text-right">
                  <div className="font-bold font-mono">${tokenBalances.USDC}</div>
                  <div className="text-sm text-gray-500">0.00%</div>
                </div>
              </div>
            </>
          )}

          {assetTab === 'nfts' && (
            <>
              <div className="flex items-center gap-4 p-4 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 transition-all cursor-pointer">
                <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center overflow-hidden shadow-lg">
                  <Image 
                    src="/N1NJ4.png" 
                    alt="N1NJ4" 
                    width={48} 
                    height={48}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex-1">
                  <div className="font-bold mb-1">N1NJ4</div>
                  <div className="text-sm text-gray-400">#0001</div>
                </div>
                <div className="text-right">
                  <div className="font-bold">--</div>
                </div>
              </div>
            </>
          )}

          {assetTab === 'defi' && (
            <>
              <div className="flex items-center gap-4 p-4 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 transition-all cursor-pointer">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center font-bold text-sm shadow-lg">
                  LP
                </div>
                <div className="flex-1">
                  <div className="font-bold mb-1">INJ/USDT Pool</div>
                  <div className="text-sm text-gray-400">0.00 LP</div>
                </div>
                <div className="text-right">
                  <div className="font-bold font-mono">$0.00</div>
                  <div className="text-sm text-gray-500">0.00%</div>
                </div>
              </div>

              <div className="flex items-center gap-4 p-4 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 transition-all cursor-pointer">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-yellow-600 flex items-center justify-center text-2xl shadow-lg">
                  💰
                </div>
                <div className="flex-1">
                  <div className="font-bold mb-1">Staking Rewards</div>
                  <div className="text-sm text-gray-400">0.00 INJ</div>
                </div>
                <div className="text-right">
                  <div className="font-bold font-mono">$0.00</div>
                  <div className="text-sm text-green-400">+0.00%</div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* QR Scanner Modal */}
      {showQRScanner && (
        <div 
          className={`fixed inset-0 bg-black/80 backdrop-blur-sm flex items-end justify-center z-50 transition-opacity duration-200 ${closingQRScanner ? 'opacity-0' : 'opacity-100'}`}
          onClick={closeQRScanner}
        >
          <div 
            className={`bg-black border-t border-white/10 rounded-t-3xl w-full max-w-2xl shadow-2xl ${
              closingQRScanner ? 'slide-down' : 'slide-up'
            }`}
            onClick={(e) => e.stopPropagation()}
            style={{ maxHeight: '80vh' }}
          >
            {/* Header */}
            <div className="p-5 border-b border-white/5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-white mb-1">Scan QR Code</h3>
                  <p className="text-gray-400 text-xs">Point camera at wallet address QR code</p>
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
            
            {/* Scanner Body */}
            <div className="p-8 flex flex-col items-center justify-center min-h-[400px]">
              {showMyQR ? (
                <>
                  {/* Show My QR Code */}
                  <div className="text-center mb-6">
                    <h4 className="text-base font-bold text-white mb-2">My Wallet Address</h4>
                    <p className="text-gray-400 text-xs">Let others scan this QR code</p>
                  </div>

                  {/* QR Code */}
                  <div className="bg-white p-6 rounded-2xl mb-6">
                    <QRCodeSVG 
                      value={address || ''} 
                      size={220}
                      level="H"
                      includeMargin={true}
                    />
                  </div>

                  {/* Address Display */}
                  <div className="w-full max-w-sm">
                    <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl border border-white/10">
                      <span className="text-sm font-mono text-white truncate mr-2">
                        {address}
                      </span>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(address || '');
                          setCopied(true);
                          setTimeout(() => setCopied(false), 2000);
                        }}
                        className="p-2 rounded-lg hover:bg-white/10 transition-all flex-shrink-0"
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
                  {/* QR Scanner Video */}
                  <div className="relative w-full max-w-sm mb-6">
                    <div 
                      id="qr-reader" 
                      className="rounded-2xl overflow-hidden border-4 border-white/20"
                      style={{ width: '100%' }}
                    />
                    
                    {/* Scanning overlay */}
                    {qrScanning && (
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className="w-64 h-64 border-2 border-white/50 rounded-2xl animate-pulse" />
                      </div>
                    )}
                  </div>
                  
                  <h4 className="text-base font-bold text-white mb-1">
                    {qrScanning ? 'Scanning...' : 'Initializing Camera...'}
                  </h4>
                  <p className="text-gray-400 text-sm text-center">
                    {qrScanning ? 'Point your camera at a QR code' : 'Please allow camera access'}
                  </p>
                </>
              ) : qrSuccess ? (
                <>
                  {/* Success Animation */}
                  <div className="relative mb-6 flex items-center justify-center w-40 h-40">
                    {/* Glow rings */}
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-40 h-40 rounded-full border-2 border-white/30 animate-ping"></div>
                    </div>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-32 h-32 rounded-full border-2 border-white/40 animate-ping" style={{ animationDelay: '0.15s' }}></div>
                    </div>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-28 h-28 rounded-full border-2 border-white/50 animate-ping" style={{ animationDelay: '0.3s' }}></div>
                    </div>
                    
                    {/* Success circle */}
                    <div className="relative w-24 h-24 rounded-full bg-white flex items-center justify-center success-bounce shadow-2xl">
                      <svg className="w-12 h-12 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  </div>
                  
                  <h4 className="text-base font-bold text-white mb-1">QR Code Scanned!</h4>
                  <p className="text-gray-400 text-sm text-center mb-4">Redirecting to send page...</p>
                  <div className="text-xs font-mono text-gray-500 bg-white/5 px-3 py-2 rounded-lg">
                    {scannedAddress.slice(0, 8)}...{scannedAddress.slice(-6)}
                  </div>
                </>
              ) : (
                <>
                  {/* Error State */}
                  <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mb-4">
                    <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  </div>
                  <h4 className="text-base font-bold text-white mb-1">Scan Failed</h4>
                  <p className="text-red-400 text-sm text-center mb-6">{qrError}</p>
                  <button
                    onClick={() => {
                      setQrError('');
                      openQRScanner();
                    }}
                    className="px-8 py-3 rounded-xl bg-white text-black font-bold hover:bg-gray-100 transition-all shadow-lg"
                  >
                    Try Again
                  </button>
                </>
              )}
            </div>

            {/* Bottom Action - Toggle to My QR */}
            <div className="p-5 border-t border-white/5">
              <button
                onClick={() => {
                  if (showMyQR) {
                    // Switch back to scanner
                    setShowMyQR(false);
                    // Restart scanner
                    setTimeout(() => {
                      openQRScanner();
                    }, 100);
                  } else {
                    // Switch to my QR
                    setShowMyQR(true);
                    // Stop scanner
                    stopQRScanner();
                    setQrScanning(false);
                  }
                }}
                className="w-full py-3 rounded-xl bg-white/5 border border-white/10 text-white font-bold hover:bg-white/10 transition-all flex items-center justify-center gap-2"
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

      {/* Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-black/95 border-t border-white/10 backdrop-blur-lg">
        <div className="max-w-7xl mx-auto px-4">
          <div className="grid grid-cols-3 gap-4 py-3">
            {/* Settings */}
            <button
              onClick={() => {
                setActiveTab('settings');
                router.push('/settings');
              }}
              className={`flex flex-col items-center gap-1 py-2 rounded-xl transition-all ${
                activeTab === 'settings' 
                  ? 'text-white' 
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              <div className={`p-2 rounded-xl transition-all ${
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

            {/* Wallet (Default) */}
            <button
              onClick={() => setActiveTab('wallet')}
              className={`flex flex-col items-center gap-1 py-2 rounded-xl transition-all ${
                activeTab === 'wallet' 
                  ? 'text-white' 
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              <div className={`p-2 rounded-xl transition-all ${
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
              onClick={() => {
                setActiveTab('discover');
                router.push('/discover');
              }}
              className={`flex flex-col items-center gap-1 py-2 rounded-xl transition-all ${
                activeTab === 'discover' 
                  ? 'text-white' 
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              <div className={`p-2 rounded-xl transition-all ${
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
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {};
