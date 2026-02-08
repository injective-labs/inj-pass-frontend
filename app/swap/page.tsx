'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useWallet } from '@/contexts/WalletContext';
import Image from 'next/image';

interface Token {
  symbol: string;
  name: string;
  icon: string;
  balance: string;
}

export default function SwapPage() {
  const router = useRouter();
  const { isUnlocked, isCheckingSession } = useWallet();
  const [fromToken, setFromToken] = useState<Token>({ symbol: 'INJ', name: 'Injective', icon: '/injswap.png', balance: '0.0000' });
  const [toToken, setToToken] = useState<Token>({ symbol: 'USDT', name: 'Tether USD', icon: '/USDT_Logo.png', balance: '0.00' });
  const [fromAmount, setFromAmount] = useState('');
  const [toAmount, setToAmount] = useState('');
  const [slippage, setSlippage] = useState('0.5');
  const [showFromTokens, setShowFromTokens] = useState(false);
  const [showToTokens, setShowToTokens] = useState(false);
  const [closingFromTokens, setClosingFromTokens] = useState(false);
  const [closingToTokens, setClosingToTokens] = useState(false);
  const [aiMode, setAiMode] = useState(false);
  const [aiIntent, setAiIntent] = useState('');
  const [loading, setLoading] = useState(false);
  const [priceImpact, setPriceImpact] = useState('0.00');
  const [gasEstimate, setGasEstimate] = useState('0.00025');

  // Mock token list
  const tokens: Token[] = [
    { symbol: 'INJ', name: 'Injective', icon: '/injswap.png', balance: '0.0000' },
    { symbol: 'USDT', name: 'Tether USD', icon: '/USDT_Logo.png', balance: '0.00' },
    { symbol: 'USDC', name: 'USD Coin', icon: '/USDC_Logo.png', balance: '0.00' },
  ];

  // Mock exchange rate calculation
  const calculateToAmount = useCallback((amount: string) => {
    if (!amount || isNaN(parseFloat(amount))) {
      setToAmount('');
      return;
    }
    // Mock rate: 1 INJ = 25 USDT
    const rate = fromToken.symbol === 'INJ' && toToken.symbol === 'USDT' ? 25 :
                 fromToken.symbol === 'USDT' && toToken.symbol === 'INJ' ? 0.04 : 1;
    const result = (parseFloat(amount) * rate).toFixed(6);
    setToAmount(result);
    setPriceImpact((Math.random() * 0.5).toFixed(2));
  }, [fromToken, toToken]);

  // Calculate from amount based on to amount (reverse calculation)
  const calculateFromAmount = useCallback((amount: string) => {
    if (!amount || isNaN(parseFloat(amount))) {
      setFromAmount('');
      return;
    }
    // Reverse rate calculation
    const rate = fromToken.symbol === 'INJ' && toToken.symbol === 'USDT' ? 0.04 :
                 fromToken.symbol === 'USDT' && toToken.symbol === 'INJ' ? 25 : 1;
    const result = (parseFloat(amount) * rate).toFixed(6);
    setFromAmount(result);
    setPriceImpact((Math.random() * 0.5).toFixed(2));
  }, [fromToken, toToken]);

  useEffect(() => {
    calculateToAmount(fromAmount);
  }, [fromAmount, fromToken, toToken, calculateToAmount]);

  // Parse AI intent
  const parseAiIntent = () => {
    setLoading(true);
    // Mock AI parsing
    setTimeout(() => {
      const intent = aiIntent.toLowerCase();
      
      // Extract amount
      const amountMatch = intent.match(/(\d+\.?\d*)/);
      if (amountMatch) {
        setFromAmount(amountMatch[1]);
      }
      
      // Extract tokens
      if (intent.includes('inj') && intent.includes('usdt')) {
        if (intent.indexOf('inj') < intent.indexOf('usdt')) {
          setFromToken(tokens[0]);
          setToToken(tokens[1]);
        } else {
          setFromToken(tokens[1]);
          setToToken(tokens[0]);
        }
      }
      
      setLoading(false);
      setAiMode(false);
    }, 1000);
  };

  const switchTokens = () => {
    const temp = fromToken;
    setFromToken(toToken);
    setToToken(temp);
    setFromAmount(toAmount);
  };

  const closeFromTokensDropdown = () => {
    setClosingFromTokens(true);
    setTimeout(() => {
      setShowFromTokens(false);
      setClosingFromTokens(false);
    }, 150);
  };

  const closeToTokensDropdown = () => {
    setClosingToTokens(true);
    setTimeout(() => {
      setShowToTokens(false);
      setClosingToTokens(false);
    }, 150);
  };

  const handleSwap = () => {
    // Mock swap execution
    alert('Swap functionality will be implemented with actual DEX integration');
  };

  if (isCheckingSession) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-white">Loading...</p>
      </div>
    );
  }

  if (!isUnlocked) {
    router.push('/');
    return null;
  }

  return (
    <div className="min-h-screen pb-24 md:pb-8 bg-black">
      {/* Header - OKX Style */}
      <div className="bg-gradient-to-b from-white/5 to-transparent border-b border-white/5 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <button
                onClick={() => router.back()}
                className="w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center transition-all"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <polyline points="15 18 9 12 15 6" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              <div>
                <h1 className="text-xl font-bold text-white">Swap</h1>
                <p className="text-gray-400 text-xs">Exchange tokens</p>
              </div>
            </div>

            {/* AI Mode Toggle */}
            <button 
              onClick={() => setAiMode(!aiMode)}
              className={`p-2.5 rounded-xl font-bold transition-all ${
                aiMode 
                  ? 'bg-white text-black' 
                  : 'bg-white/5 text-gray-400 hover:bg-white/10 border border-white/10'
              }`}
              title={aiMode ? "AI Mode Active" : "Enable AI Mode"}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-2xl mx-auto px-4 py-6">
        {aiMode ? (
          /* AI Intent Mode */
          <div className="space-y-6">
            <div className="p-6 rounded-2xl bg-white/5 border border-white/10">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center">
                  <svg className="w-6 h-6 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">AI Swap Assistant</h3>
                  <p className="text-xs text-gray-400">Describe what you want to swap</p>
                </div>
              </div>

              <textarea
                value={aiIntent}
                onChange={(e) => setAiIntent(e.target.value)}
                placeholder="e.g., Swap 10 INJ to USDT"
                className="w-full h-32 py-4 px-4 rounded-xl bg-black border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-white/30 transition-all text-sm resize-none"
              />

              <button
                onClick={parseAiIntent}
                disabled={!aiIntent.trim() || loading}
                className="w-full mt-4 py-3 rounded-xl bg-white text-black font-bold hover:bg-gray-100 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
              >
                {loading ? 'Processing...' : 'Parse Intent'}
              </button>
            </div>

            {/* Gas Estimate - Always Display in AI Mode */}
            <div className="p-5 rounded-2xl bg-black border border-white/10 space-y-3">
              <div className="flex items-center gap-2 mb-4">
                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Gas Estimate</span>
              </div>
              
              <div className="flex justify-between items-center py-2">
                <span className="text-sm text-gray-400">Gas Limit:</span>
                <span className="text-sm font-mono text-white">150000</span>
              </div>
              
              <div className="flex justify-between items-center py-2">
                <span className="text-sm text-gray-400">Max Fee:</span>
                <span className="text-sm font-mono text-white">2.50 Gwei</span>
              </div>
              
              <div className="flex justify-between items-center py-2 border-t border-white/10 pt-3">
                <span className="text-sm font-bold text-gray-300">Est. Cost:</span>
                <span className="text-sm font-mono font-bold text-white">{gasEstimate} INJ</span>
              </div>
            </div>
          </div>
        ) : (
          /* Manual Swap Mode */
          <div className="space-y-4">
            {/* From Token */}
            <div className="p-5 rounded-2xl bg-black border border-white/10">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">From</span>
                <span className="text-xs text-gray-500">Balance: {fromToken.balance}</span>
              </div>
              
              <div className="flex items-center gap-4">
                <button
                  onClick={() => setShowFromTokens(!showFromTokens)}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 transition-all relative"
                >
                  <div className="w-6 h-6 rounded-full overflow-hidden bg-white flex items-center justify-center">
                    <Image src={fromToken.icon} alt={fromToken.symbol} width={24} height={24} className="w-full h-full object-contain" />
                  </div>
                  <span className="font-bold text-sm">{fromToken.symbol}</span>
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <polyline points="6 9 12 15 18 9" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                  </svg>

                  {/* Token Dropdown */}
                  {showFromTokens && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={closeFromTokensDropdown} />
                      <div className={`dropdown-menu absolute top-full left-0 mt-2 w-64 bg-black border border-white/10 rounded-xl shadow-2xl z-50 p-2 ${closingFromTokens ? 'closing' : ''}`}>
                        {tokens.map((token) => (
                          <button
                            key={token.symbol}
                            onClick={() => {
                              setFromToken(token);
                              closeFromTokensDropdown();
                            }}
                            className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-white/5 transition-all"
                          >
                            <div className="w-8 h-8 rounded-full overflow-hidden bg-white">
                              <Image src={token.icon} alt={token.symbol} width={32} height={32} className="w-full h-full object-contain" />
                            </div>
                            <div className="flex-1 text-left">
                              <div className="text-sm font-bold">{token.symbol}</div>
                              <div className="text-xs text-gray-500">{token.name}</div>
                            </div>
                            <div className="text-xs text-gray-400">{token.balance}</div>
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </button>

                <input
                  type="text"
                  inputMode="decimal"
                  value={fromAmount}
                  onChange={(e) => setFromAmount(e.target.value)}
                  placeholder="0.0"
                  className="flex-1 bg-transparent text-2xl font-bold text-white placeholder-gray-600 focus:outline-none font-mono text-right"
                  style={{ 
                    WebkitUserSelect: 'text', 
                    userSelect: 'text',
                    WebkitTapHighlightColor: 'transparent',
                    pointerEvents: 'auto',
                    touchAction: 'manipulation'
                  }}
                />
              </div>
            </div>

            {/* Switch Button */}
            <div className="flex justify-center -my-2 relative z-10">
              <button
                onClick={switchTokens}
                className="w-10 h-10 rounded-full bg-white hover:bg-gray-100 flex items-center justify-center shadow-lg transition-all hover:scale-110"
              >
                <svg className="w-5 h-5 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                </svg>
              </button>
            </div>

            {/* To Token */}
            <div className="p-5 rounded-2xl bg-black border border-white/10">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">To</span>
                <span className="text-xs text-gray-500">Balance: {toToken.balance}</span>
              </div>
              
              <div className="flex items-center gap-4">
                <button
                  onClick={() => setShowToTokens(!showToTokens)}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 transition-all relative"
                >
                  <div className="w-6 h-6 rounded-full overflow-hidden bg-white flex items-center justify-center">
                    <Image src={toToken.icon} alt={toToken.symbol} width={24} height={24} className="w-full h-full object-contain" />
                  </div>
                  <span className="font-bold text-sm">{toToken.symbol}</span>
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <polyline points="6 9 12 15 18 9" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                  </svg>

                  {/* Token Dropdown */}
                  {showToTokens && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={closeToTokensDropdown} />
                      <div className={`dropdown-menu absolute top-full left-0 mt-2 w-64 bg-black border border-white/10 rounded-xl shadow-2xl z-50 p-2 ${closingToTokens ? 'closing' : ''}`}>
                        {tokens.map((token) => (
                          <button
                            key={token.symbol}
                            onClick={() => {
                              setToToken(token);
                              closeToTokensDropdown();
                            }}
                            className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-white/5 transition-all"
                          >
                            <div className="w-8 h-8 rounded-full overflow-hidden bg-white">
                              <Image src={token.icon} alt={token.symbol} width={32} height={32} className="w-full h-full object-contain" />
                            </div>
                            <div className="flex-1 text-left">
                              <div className="text-sm font-bold">{token.symbol}</div>
                              <div className="text-xs text-gray-500">{token.name}</div>
                            </div>
                            <div className="text-xs text-gray-400">{token.balance}</div>
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </button>

                <input
                  type="text"
                  inputMode="decimal"
                  value={toAmount}
                  onChange={(e) => {
                    setToAmount(e.target.value);
                    calculateFromAmount(e.target.value);
                  }}
                  placeholder="0.0"
                  className="flex-1 bg-transparent text-2xl font-bold text-white placeholder-gray-600 focus:outline-none font-mono text-right"
                  style={{ 
                    WebkitUserSelect: 'text', 
                    userSelect: 'text',
                    WebkitTapHighlightColor: 'transparent',
                    pointerEvents: 'auto',
                    touchAction: 'manipulation'
                  }}
                />
              </div>
            </div>

            {/* Swap Details */}
            {fromAmount && toAmount && (
              <div className="p-5 rounded-2xl bg-black border border-white/10 space-y-3">
                <div className="flex items-center gap-2 mb-4">
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Swap Details</span>
                </div>
                
                <div className="flex justify-between items-center py-2">
                  <span className="text-sm text-gray-400">Rate:</span>
                  <span className="text-sm font-mono text-white">
                    1 {fromToken.symbol} ≈ {toAmount && fromAmount ? (parseFloat(toAmount) / parseFloat(fromAmount)).toFixed(4) : '0'} {toToken.symbol}
                  </span>
                </div>
                
                <div className="flex justify-between items-center py-2">
                  <span className="text-sm text-gray-400">Price Impact:</span>
                  <span className="text-sm font-mono text-green-400">&lt;{priceImpact}%</span>
                </div>
                
                <div className="flex justify-between items-center py-2">
                  <span className="text-sm text-gray-400">Slippage:</span>
                  <span className="text-sm font-mono text-white">{slippage}%</span>
                </div>
              </div>
            )}

            {/* Gas Estimate - Always Display */}
            <div className="p-5 rounded-2xl bg-black border border-white/10 space-y-3">
              <div className="flex items-center gap-2 mb-4">
                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Gas Estimate</span>
              </div>
              
              <div className="flex justify-between items-center py-2">
                <span className="text-sm text-gray-400">Gas Limit:</span>
                <span className="text-sm font-mono text-white">150000</span>
              </div>
              
              <div className="flex justify-between items-center py-2">
                <span className="text-sm text-gray-400">Max Fee:</span>
                <span className="text-sm font-mono text-white">2.50 Gwei</span>
              </div>
              
              <div className="flex justify-between items-center py-2 border-t border-white/10 pt-3">
                <span className="text-sm font-bold text-gray-300">Est. Cost:</span>
                <span className="text-sm font-mono font-bold text-white">{gasEstimate} INJ</span>
              </div>
            </div>

            {/* Swap Button */}
            <button
              onClick={handleSwap}
              disabled={!fromAmount || !toAmount || loading}
              className="w-full py-4 rounded-2xl bg-white text-black font-bold hover:bg-gray-100 transition-all disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <polyline points="16 3 21 3 21 8" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
                <line x1="4" y1="20" x2="21" y2="3" strokeWidth={2.5} strokeLinecap="round" />
                <polyline points="21 16 21 21 16 21" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
                <line x1="15" y1="15" x2="21" y2="21" strokeWidth={2.5} strokeLinecap="round" />
                <line x1="4" y1="4" x2="9" y2="9" strokeWidth={2.5} strokeLinecap="round" />
              </svg>
              Swap Tokens
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
