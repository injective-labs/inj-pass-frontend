'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useWallet } from '@/contexts/WalletContext';
import { getBalance } from '@/wallet/chain';
import { Balance, INJECTIVE_TESTNET } from '@/types/chain';
import { getInjPrice } from '@/services/price';
import { useSessionManager } from '@/services/useSessionManager';

export default function DashboardPage() {
  const router = useRouter();
  const { isUnlocked, address, lock } = useWallet();
  const [balance, setBalance] = useState<Balance | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [injPrice, setInjPrice] = useState<number>(25);
  const [balanceVisible, setBalanceVisible] = useState(true);
  const [activeTab, setActiveTab] = useState<'tokens' | 'nfts' | 'defi'>('tokens');
  const [copied, setCopied] = useState(false);

  // Use session manager to auto-lock on expiry
  useSessionManager();

  useEffect(() => {
    if (!isUnlocked || !address) {
      router.push('/welcome');
      return;
    }

    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isUnlocked, address]);

  const loadData = async () => {
    if (!address) return;

    try {
      setLoading(true);
      const [balanceData, priceData] = await Promise.all([
        getBalance(address, INJECTIVE_TESTNET),
        getInjPrice(),
      ]);
      
      setBalance(balanceData);
      setInjPrice(priceData);
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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  const formattedBalance = balance ? parseFloat(balance.formatted).toFixed(4) : '0.0000';
  const usdValue = balance ? (parseFloat(balance.formatted) * injPrice).toFixed(2) : '0.00';

  return (
    <div className="min-h-screen pb-24 md:pb-8">
      {/* Modern Dashboard Header */}
      <div className="bg-gradient-to-b from-white/5 to-transparent border-b border-white/5 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 py-6">
          {/* Header Top */}
          <div className="flex items-center justify-between mb-6">
            {/* Account Info */}
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-2xl shadow-lg">
                🥷
              </div>
              <div>
                <div className="text-sm font-bold text-white mb-1">Account 1</div>
                <button 
                  onClick={handleCopyAddress}
                  className="flex items-center gap-2 text-xs text-gray-400 hover:text-white transition-colors group"
                >
                  <span className="font-mono">
                    {address?.slice(0, 6)}...{address?.slice(-4)}
                  </span>
                  {copied ? (
                    <svg className="w-3.5 h-3.5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <svg className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 16 16">
                      <rect width="11" height="11" x="4" y="4" rx="1" ry="1" strokeWidth="1.5" />
                      <path d="M2 10c-0.8 0-1.5-0.7-1.5-1.5V2c0-0.8 0.7-1.5 1.5-1.5h8.5c0.8 0 1.5 0.7 1.5 1.5" strokeWidth="1.5" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Header Actions */}
            <button 
              onClick={() => router.push('/settings')}
              className="p-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 transition-all"
              title="Settings"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
          </div>

          {/* Total Balance Card */}
          <div className="bg-gradient-to-br from-blue-600 to-purple-600 rounded-3xl p-6 shadow-2xl shadow-blue-500/20 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full blur-3xl -mr-20 -mt-20"></div>
            <div className="relative">
              <div className="text-blue-100 text-sm font-bold mb-2 uppercase tracking-widest">Total Balance</div>
              <div className="flex items-center gap-4 mb-2">
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl md:text-5xl font-bold text-white font-mono">
                    {balanceVisible ? formattedBalance : '••••••'}
                  </span>
                  <span className="text-2xl font-bold text-blue-200">INJ</span>
                </div>
                <button 
                  onClick={() => setBalanceVisible(!balanceVisible)}
                  className="p-2 rounded-lg hover:bg-white/10 transition-colors"
                >
                  {balanceVisible ? (
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  )}
                </button>
              </div>
              <div className="text-lg text-blue-100 font-mono">
                ≈ ${balanceVisible ? usdValue : '••••••'} USD
              </div>
              <div className="flex items-center gap-3 text-blue-100 mt-3">
                <span className="text-green-300 text-sm font-bold">+$0.00 (0.00%)</span>
                <span className="text-xs opacity-75">24h</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid grid-cols-4 gap-3 mb-8">
          <button 
            onClick={() => router.push('/send')}
            className="flex flex-col items-center gap-2 p-4 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 transition-all group"
          >
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <line x1="12" y1="5" x2="12" y2="19" strokeWidth={2} strokeLinecap="round" />
                <polyline points="19 12 12 19 5 12" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <span className="text-sm font-bold">Send</span>
          </button>

          <button 
            onClick={() => router.push('/receive')}
            className="flex flex-col items-center gap-2 p-4 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 transition-all group"
          >
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <line x1="12" y1="19" x2="12" y2="5" strokeWidth={2} strokeLinecap="round" />
                <polyline points="5 12 12 5 19 12" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <span className="text-sm font-bold">Receive</span>
          </button>

          <button 
            className="flex flex-col items-center gap-2 p-4 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 transition-all group"
          >
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <polyline points="16 3 21 3 21 8" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                <line x1="4" y1="20" x2="21" y2="3" strokeWidth={2} strokeLinecap="round" />
                <polyline points="21 16 21 21 16 21" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                <line x1="15" y1="15" x2="21" y2="21" strokeWidth={2} strokeLinecap="round" />
                <line x1="4" y1="4" x2="9" y2="9" strokeWidth={2} strokeLinecap="round" />
              </svg>
            </div>
            <span className="text-sm font-bold">Swap</span>
          </button>

          <button 
            className="flex flex-col items-center gap-2 p-4 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 transition-all group"
          >
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-pink-500 to-rose-500 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <circle cx="9" cy="21" r="1" strokeWidth={2} />
                <circle cx="20" cy="21" r="1" strokeWidth={2} />
                <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <span className="text-sm font-bold">Buy</span>
          </button>
        </div>

        {/* Assets Section */}
        <div className="bg-white/5 border border-white/10 rounded-3xl p-6 backdrop-blur-sm">
          {/* Section Header */}
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold">Assets</h3>
            <button className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors">
              <span>Manage</span>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <polyline points="9 18 15 12 9 6" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>

          {/* Asset Tabs */}
          <div className="flex gap-2 mb-6 p-1 bg-white/5 rounded-xl">
            <button 
              onClick={() => setActiveTab('tokens')}
              className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-lg font-bold text-sm transition-all ${
                activeTab === 'tokens' 
                  ? 'bg-blue-600 text-white shadow-lg' 
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
              onClick={() => setActiveTab('nfts')}
              className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-lg font-bold text-sm transition-all ${
                activeTab === 'nfts' 
                  ? 'bg-blue-600 text-white shadow-lg' 
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
              onClick={() => setActiveTab('defi')}
              className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-lg font-bold text-sm transition-all ${
                activeTab === 'defi' 
                  ? 'bg-blue-600 text-white shadow-lg' 
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span>DeFi</span>
            </button>
          </div>

          {/* Asset List */}
          <div className="space-y-3">
            {activeTab === 'tokens' && (
              <>
                <div className="flex items-center gap-4 p-4 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 transition-all cursor-pointer">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center font-bold shadow-lg">
                    INJ
                  </div>
                  <div className="flex-1">
                    <div className="font-bold mb-1">Injective</div>
                    <div className="text-sm text-gray-400">{formattedBalance} INJ</div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold font-mono">${usdValue}</div>
                    <div className="text-sm text-gray-500">0.00%</div>
                  </div>
                </div>

                <div className="flex items-center gap-4 p-4 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 transition-all cursor-pointer">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center font-bold text-sm shadow-lg">
                    USDT
                  </div>
                  <div className="flex-1">
                    <div className="font-bold mb-1">Tether USD</div>
                    <div className="text-sm text-gray-400">0.00 USDT</div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold font-mono">$0.00</div>
                    <div className="text-sm text-gray-500">0.00%</div>
                  </div>
                </div>

                <div className="flex items-center gap-4 p-4 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 transition-all cursor-pointer">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-400 to-cyan-500 flex items-center justify-center font-bold text-sm shadow-lg">
                    USDC
                  </div>
                  <div className="flex-1">
                    <div className="font-bold mb-1">USD Coin</div>
                    <div className="text-sm text-gray-400">0.00 USDC</div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold font-mono">$0.00</div>
                    <div className="text-sm text-gray-500">0.00%</div>
                  </div>
                </div>
              </>
            )}

            {activeTab === 'nfts' && (
              <>
                <div className="flex items-center gap-4 p-4 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 transition-all cursor-pointer">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-pink-500 to-rose-600 flex items-center justify-center text-2xl shadow-lg">
                    🎨
                  </div>
                  <div className="flex-1">
                    <div className="font-bold mb-1">Injective Pass NFT</div>
                    <div className="text-sm text-gray-400">#0001</div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold">--</div>
                  </div>
                </div>

                <div className="flex items-center gap-4 p-4 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 transition-all cursor-pointer">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-yellow-500 to-orange-600 flex items-center justify-center text-2xl shadow-lg">
                    🖼️
                  </div>
                  <div className="flex-1">
                    <div className="font-bold mb-1">Collection Item</div>
                    <div className="text-sm text-gray-400">#0042</div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold">--</div>
                  </div>
                </div>
              </>
            )}

            {activeTab === 'defi' && (
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

        {/* Recent Activity */}
        <div className="mt-8 bg-white/5 border border-white/10 rounded-3xl p-6 backdrop-blur-sm">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold">Recent Activity</h3>
            <button className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors">
              <span>View All</span>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <polyline points="9 18 15 12 9 6" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>

          <div className="text-center py-12 text-gray-500">
            <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="font-bold">No recent activity</p>
            <p className="text-sm mt-1">Your transactions will appear here</p>
          </div>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {};
