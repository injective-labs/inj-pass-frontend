'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { usePin } from '@/contexts/PinContext';
import { useWallet } from '@/contexts/WalletContext';
import { estimateGas, getBalance, getCosmosTxHistory, getTxHistory, sendTransaction } from '@/wallet/chain';
import { Balance, GasEstimate, INJECTIVE_MAINNET } from '@/types/chain';
import { getTokenPrice } from '@/services/price';
import { executeSwap, getSwapQuote, getTokenBalances, ROUTER_ADDRESS } from '@/services/dex-swap';
import { startQRScanner, stopQRScanner, clearQRScanner, isCameraSupported, isValidAddress } from '@/services/qr-scanner';
import { getN1NJ4NFTs, type NFT } from '@/services/nft';
import { getUserStakingInfo, type StakingInfo } from '@/services/staking';
import { QRCodeSVG } from 'qrcode.react';
import { formatEther, type Address } from 'viem';
import Image from 'next/image';
import LoadingSpinner from '@/components/LoadingSpinner';
import NFTDetailModal from '@/components/NFTDetailModal';
import TransactionAuthModal from '@/components/TransactionAuthModal';
import ThemeToggleButton from '@/components/ThemeToggleButton';
import CardCenterModal from '@/components/CardCenterModal';
import NinjaMinerGame from '@/components/NinjaMinerGame';
import { formatAddress, privateKeyToHex } from '@/utils/wallet';
import { getInjectiveAddress, getEthereumAddress } from '@injectivelabs/sdk-ts';

type AssetTab = 'tokens' | 'nfts' | 'defi' | 'earn';
type WalletPanel = 'overview' | 'send' | 'receive' | 'swap' | 'history';
type AddressType = 'evm' | 'cosmos';
type DashboardTransactionType = 'send' | 'receive' | 'swap';
type DashboardTransactionStatus = 'completed' | 'pending' | 'failed';
type DashboardHistoryFilter = 'all' | DashboardTransactionType;
type DashboardChainType = 'EVM' | 'Cosmos';

interface DashboardTransaction {
  id: string;
  type: DashboardTransactionType;
  amount: string;
  token: string;
  address: string;
  timestamp: Date;
  status: DashboardTransactionStatus;
  txHash?: string;
  chainType: DashboardChainType;
}

function truncateMiddle(value: string, start = 6, end = 4) {
  if (!value) return '';
  if (value.length <= start + end + 3) return value;
  return `${value.slice(0, start)}...${value.slice(-end)}`;
}

function formatDashboardTimestamp(date: Date) {
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const ROLLING_DIGIT_STACK = Array.from({ length: 20 }, (_, index) => String(index % 10));

function RollingDigit({ digit, delayMs = 0 }: { digit: string; delayMs?: number }) {
  const isNumeric = /^\d$/.test(digit);
  const hasAnimatedRef = useRef(false);
  const [position, setPosition] = useState(0);

  useEffect(() => {
    if (!isNumeric) return;

    const nextDigit = Number(digit);

    setPosition((current) => {
      if (!hasAnimatedRef.current) {
        hasAnimatedRef.current = true;
        return nextDigit;
      }

      const currentDigit = ((current % 10) + 10) % 10;
      let nextPosition = current - currentDigit + nextDigit;

      if (nextPosition <= current) {
        nextPosition += 10;
      }

      return nextPosition;
    });
  }, [digit, isNumeric]);

  if (!isNumeric) {
    return (
      <span className="inline-flex h-[1em] items-center justify-center leading-none text-white/70">
        {digit}
      </span>
    );
  }

  return (
    <span className="relative inline-flex h-[1em] min-w-[0.62em] overflow-hidden leading-none tabular-nums">
      <span
        className="flex flex-col will-change-transform transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)]"
        style={{
          transform: `translateY(-${position}em)`,
          transitionDelay: `${delayMs}ms`,
        }}
      >
        {ROLLING_DIGIT_STACK.map((value, index) => (
          <span
            key={`${value}-${index}`}
            className="flex h-[1em] items-center justify-center leading-none"
          >
            {value}
          </span>
        ))}
      </span>
    </span>
  );
}

function RollingBalanceNumber({ value }: { value: string }) {
  return (
    <span className="inline-flex items-end" aria-label={value}>
      <span className="sr-only">{value}</span>
      <span className="inline-flex items-end" aria-hidden="true">
        {value.split('').map((character, index) => (
          <RollingDigit
            key={`${character}-${index}`}
            digit={character}
            delayMs={index * 45}
          />
        ))}
      </span>
    </span>
  );
}

function buildPixelTrendSeries(currentValue: number, changePct: number) {
  const pointCount = 18;

  if (!Number.isFinite(currentValue) || currentValue <= 0) {
    return Array.from({ length: pointCount }, () => 0);
  }

  const safeFactor = Math.max(0.15, 1 + changePct / 100);
  const startValue = currentValue / safeFactor;
  const drift = currentValue - startValue;
  const waveBase = Math.max(Math.abs(drift) * 0.16, currentValue * 0.018);
  const rippleBase = Math.max(Math.abs(drift) * 0.05, currentValue * 0.008);

  const series = Array.from({ length: pointCount }, (_, index) => {
    const t = index / (pointCount - 1);
    const eased = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    const wave = Math.sin((t * 3.2 + 0.15) * Math.PI) * waveBase * (1 - t * 0.15);
    const ripple = Math.cos((t * 6.4 + 0.2) * Math.PI) * rippleBase;

    return Math.max(0, startValue + drift * eased + wave + ripple);
  });

  series[pointCount - 1] = currentValue;

  return series;
}

function PixelTrendChart({
  values,
  hidden,
  changePct,
  currentValueLabel,
}: {
  values: number[];
  hidden: boolean;
  changePct: number;
  currentValueLabel: string;
}) {
  const width = 320;
  const height = 184;
  const paddingLeft = 20;
  const paddingRight = 18;
  const paddingTop = 18;
  const paddingBottom = 30;
  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;
  const minValue = values.length > 0 ? Math.min(...values) : 0;
  const maxValue = values.length > 0 ? Math.max(...values) : 0;
  const range = maxValue - minValue;
  const accentClass = changePct >= 0 ? 'text-emerald-300' : 'text-orange-300';
  const accentColor = changePct >= 0 ? '#6ee7b7' : '#fb923c';
  const accentFill = changePct >= 0 ? 'rgba(110,231,183,0.16)' : 'rgba(251,146,60,0.16)';
  const chartAnimationKey = `${hidden ? 'hidden' : 'visible'}-${currentValueLabel}-${changePct.toFixed(2)}`;
  const gridDots = Array.from({ length: 11 }, (_, column) =>
    Array.from({ length: 6 }, (_, row) => ({
      x: paddingLeft + column * (chartWidth / 10),
      y: paddingTop + row * (chartHeight / 5),
      key: `${column}-${row}`,
    }))
  ).flat();

  const points = values.map((value, index) => {
    const x = paddingLeft + (index / Math.max(values.length - 1, 1)) * chartWidth;
    const normalized = range < 0.0001 ? 0.55 : 1 - (value - minValue) / range;
    const y = paddingTop + normalized * chartHeight;

    return { x, y };
  });

  const stepPath = points
    .map((point, index) => {
      if (index === 0) {
        return `M ${point.x} ${point.y}`;
      }

      return `H ${point.x} V ${point.y}`;
    })
    .join(' ');

  const areaPath =
    points.length > 0
      ? `${stepPath} V ${paddingTop + chartHeight} H ${points[0].x} Z`
      : '';

  return (
    <div className="relative h-full min-h-[220px] px-1 py-2 xl:pl-4">
      <div className="relative flex items-start justify-between gap-3">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.28em] text-gray-500">24H Trend</div>
          <div className="mt-1 text-xs text-gray-400">Pixel asset movement</div>
        </div>
        <div className={`text-sm font-semibold ${accentClass}`}>
          {changePct >= 0 ? '+' : ''}
          {changePct.toFixed(2)}%
        </div>
      </div>

      {hidden ? (
        <div className="relative mt-4 flex h-[184px] items-center justify-center">
          <div className="text-center">
            <div className="text-[10px] font-semibold uppercase tracking-[0.3em] text-gray-500">Trend Hidden</div>
            <div className="mt-2 text-sm text-gray-400">Unhide balance to view</div>
          </div>
        </div>
      ) : (
        <svg
          key={chartAnimationKey}
          className="relative mt-4 h-[184px] w-full"
          viewBox={`0 0 ${width} ${height}`}
          fill="none"
          aria-label="24 hour asset movement chart"
        >
          {gridDots.map((dot) => (
            <rect
              key={dot.key}
              x={dot.x - 1.5}
              y={dot.y - 1.5}
              width="3"
              height="3"
              rx="0.5"
              fill="rgba(255,255,255,0.10)"
              shapeRendering="crispEdges"
            />
          ))}
          <path
            d={areaPath}
            fill={accentFill}
            shapeRendering="crispEdges"
            style={{
              opacity: 0,
              animation: 'pixelTrendAreaFade 700ms cubic-bezier(0.22,1,0.36,1) 220ms forwards',
            }}
          />
          <path
            d={stepPath}
            pathLength={1}
            stroke={accentColor}
            strokeWidth="3"
            strokeLinejoin="miter"
            strokeLinecap="square"
            shapeRendering="crispEdges"
            style={{
              strokeDasharray: 1,
              strokeDashoffset: 1,
              animation: 'pixelTrendDraw 1100ms cubic-bezier(0.22,1,0.36,1) forwards',
            }}
          />
          {points.map((point, index) => (
            <rect
              key={`point-${index}`}
              x={point.x - 3}
              y={point.y - 3}
              width="6"
              height="6"
              fill={accentColor}
              shapeRendering="crispEdges"
              style={{
                opacity: 0,
                animation: `pixelTrendPointIn 240ms cubic-bezier(0.22,1,0.36,1) ${320 + index * 28}ms forwards`,
              }}
            />
          ))}
        </svg>
      )}

      <div className="relative mt-3 flex items-center justify-between text-[11px] uppercase tracking-[0.2em] text-gray-500">
        <span>Now</span>
        <span className="font-mono text-gray-300">${hidden ? '••••' : currentValueLabel}</span>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const { isUnlocked, address, privateKey, resetTxAuth, isCheckingSession } = useWallet();
  const { autoLockMinutes, isPinLocked } = usePin();
  const [balance, setBalance] = useState<Balance | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [injPrice, setInjPrice] = useState<number>(25);
  const [injPriceChange24h, setInjPriceChange24h] = useState<number>(0);
  const [usdtPriceChange24h, setUsdtPriceChange24h] = useState<number>(0);
  const [usdcPriceChange24h, setUsdcPriceChange24h] = useState<number>(0);
  const [balanceVisible, setBalanceVisible] = useState(true);
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'settings' | 'wallet' | 'discover' | 'agents'>('wallet');
  const [assetTab, setAssetTab] = useState<AssetTab>('tokens');
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
  
  // NFT states
  const [nfts, setNfts] = useState<NFT[]>([]);
  const [nftsLoading, setNftsLoading] = useState(false);
  const [selectedNFT, setSelectedNFT] = useState<NFT | null>(null);
  
  // Staking states
  const [stakingInfo, setStakingInfo] = useState<StakingInfo | null>(null);
  const [stakingLoading, setStakingLoading] = useState(false);
  
  // Wallet action states
  const [walletPanel, setWalletPanel] = useState<WalletPanel>('overview');
  const [receiveAddressType, setReceiveAddressType] = useState<AddressType>('evm');
  const [receiveCopied, setReceiveCopied] = useState(false);
  const [sendRecipient, setSendRecipient] = useState('');
  const [sendAmount, setSendAmount] = useState('');
  const [sendGasEstimate, setSendGasEstimate] = useState<GasEstimate | null>(null);
  const [sendEstimating, setSendEstimating] = useState(false);
  const [sendSubmitting, setSendSubmitting] = useState(false);
  const [sendError, setSendError] = useState('');
  const [sendTxHash, setSendTxHash] = useState('');
  const [swapFromToken, setSwapFromToken] = useState<'INJ' | 'USDT' | 'USDC'>('INJ');
  const [swapToToken, setSwapToToken] = useState<'INJ' | 'USDT' | 'USDC'>('USDT');
  const [swapAmount, setSwapAmount] = useState('');
  const [swapQuoteAmount, setSwapQuoteAmount] = useState('');
  const [swapSlippage, setSwapSlippage] = useState('0.5');
  const [swapQuoteLoading, setSwapQuoteLoading] = useState(false);
  const [swapSubmitting, setSwapSubmitting] = useState(false);
  const [swapPriceImpact, setSwapPriceImpact] = useState('0.00');
  const [swapError, setSwapError] = useState('');
  const [swapTxHash, setSwapTxHash] = useState('');
  const [historyFilter, setHistoryFilter] = useState<DashboardHistoryFilter>('all');
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState('');
  const [historyItems, setHistoryItems] = useState<DashboardTransaction[]>([]);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [pendingAuthAction, setPendingAuthAction] = useState<'send' | 'swap' | null>(null);
  const [postAuthAction, setPostAuthAction] = useState<'send' | 'swap' | null>(null);
  const [showCardCenter, setShowCardCenter] = useState(false);

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

  const loadData = useCallback(async () => {
    if (!address) return;

    try {
      setLoading(true);
      const [balanceData, injPriceData, usdtPriceData, usdcPriceData, tokenBalData] = await Promise.all([
        getBalance(address, INJECTIVE_MAINNET),
        getTokenPrice('injective-protocol'),
        getTokenPrice('tether'),
        getTokenPrice('usd-coin'),
        getTokenBalances(['INJ', 'USDT', 'USDC'], address as Address),
      ]);
      
      setBalance(balanceData);
      setInjPrice(injPriceData.usd);
      setInjPriceChange24h(injPriceData.usd24hChange || 0);
      setUsdtPriceChange24h(usdtPriceData.usd24hChange || 0);
      setUsdcPriceChange24h(usdcPriceData.usd24hChange || 0);
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
  }, [address]);

  // Load NFTs when switching to NFTs tab
  const loadNFTs = async () => {
    if (!address || nftsLoading) return;

    try {
      setNftsLoading(true);
      console.log('[Dashboard] Loading NFTs for address:', address);
      const userNFTs = await getN1NJ4NFTs(address as Address);
      console.log('[Dashboard] Loaded NFTs:', userNFTs);
      setNfts(userNFTs);
    } catch (error) {
      console.error('Failed to load NFTs:', error);
    } finally {
      setNftsLoading(false);
    }
  };

  // Load staking info when switching to DeFi tab
  const loadStakingInfo = async () => {
    if (!address || stakingLoading) return;

    try {
      setStakingLoading(true);
      console.log('[Dashboard] Loading staking info for address:', address);
      const info = await getUserStakingInfo(address as Address);
      console.log('[Dashboard] Loaded staking info:', info);
      setStakingInfo(info);
    } catch (error) {
      console.error('Failed to load staking info:', error);
    } finally {
      setStakingLoading(false);
    }
  };

  // Load NFTs when NFT tab is selected
  useEffect(() => {
    if (assetTab === 'nfts' && address && nfts.length === 0) {
      loadNFTs();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assetTab, address]);

  // Load staking info when DeFi tab is selected
  useEffect(() => {
    if (assetTab === 'defi' && address && !stakingInfo) {
      loadStakingInfo();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assetTab, address]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadData();
    
    // Also refresh staking info if on DeFi tab
    if (assetTab === 'defi') {
      loadStakingInfo();
    }
    
    // Also refresh NFTs if on NFTs tab
    if (assetTab === 'nfts') {
      loadNFTs();
    }
  };

  const handleCopyAddress = () => {
    if (address) {
      navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const toggleWalletPanel = (panel: Exclude<WalletPanel, 'overview'>) => {
    setWalletPanel((current) => (current === panel ? 'overview' : panel));
  };

  const getCosmosAddress = useCallback((evmAddress: string) => {
    if (!evmAddress) return '';
    try {
      return getInjectiveAddress(evmAddress);
    } catch (error) {
      console.error('Failed to convert address to cosmos format:', error);
      return '';
    }
  }, []);

  const getEvmAddress = useCallback((value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return '';
    if (trimmed.startsWith('0x')) return trimmed;
    if (trimmed.startsWith('inj1')) {
      return getEthereumAddress(trimmed);
    }
    return trimmed;
  }, []);

  const receiveDisplayAddress = receiveAddressType === 'evm' ? (address || '') : getCosmosAddress(address || '');
  const sendGasCost = sendGasEstimate ? formatEther(sendGasEstimate.totalCost) : '';
  const sendBalanceValue = parseFloat(tokenBalances.INJ || '0');
  const swapTokenOptions = [
    { symbol: 'INJ' as const, name: 'Injective', icon: '/injswap.png', balance: tokenBalances.INJ },
    { symbol: 'USDT' as const, name: 'Tether', icon: '/USDT_Logo.png', balance: tokenBalances.USDT },
    { symbol: 'USDC' as const, name: 'USD Coin', icon: '/USDC_Logo.png', balance: tokenBalances.USDC },
  ];
  const swapFromMeta = swapTokenOptions.find((token) => token.symbol === swapFromToken) || swapTokenOptions[0];
  const swapToMeta = swapTokenOptions.find((token) => token.symbol === swapToToken) || swapTokenOptions[1];
  const filteredHistoryItems = historyFilter === 'all'
    ? historyItems
    : historyItems.filter((item) => item.type === historyFilter);
  const walletPanelMeta: Record<Exclude<WalletPanel, 'overview'>, { title: string; subtitle: string }> = {
    send: {
      title: 'Send INJ',
      subtitle: 'Transfer directly from this wallet card without leaving the dashboard.',
    },
    receive: {
      title: 'Receive Assets',
      subtitle: 'Show your address and QR code inline for quick inbound transfers.',
    },
    swap: {
      title: 'Swap Assets',
      subtitle: 'Run a quick Injective swap inside your main wallet surface.',
    },
    history: {
      title: 'Recent Activity',
      subtitle: 'Review your latest on-chain transfers and swaps right here.',
    },
  };

  const loadHistory = useCallback(async () => {
    if (!address || !isUnlocked) {
      setHistoryItems([]);
      return;
    }

    setHistoryLoading(true);
    setHistoryError('');

    try {
      const [evmTxHistory, cosmosTxHistory] = await Promise.all([
        getTxHistory(address, 20).catch((error) => {
          console.error('Failed to fetch EVM transactions:', error);
          return [];
        }),
        (async () => {
          try {
            const cosmosAddress = getInjectiveAddress(address);
            return await getCosmosTxHistory(cosmosAddress, 20);
          } catch (error) {
            console.error('Failed to fetch Cosmos transactions:', error);
            return [];
          }
        })(),
      ]);

      const routerAddress = ROUTER_ADDRESS.toLowerCase();

      const evmTransactions: DashboardTransaction[] = evmTxHistory.map((tx) => {
        const isSwapTx = tx.to?.toLowerCase() === routerAddress;
        const isSent = tx.from.toLowerCase() === address.toLowerCase();
        const type: DashboardTransactionType = isSwapTx ? 'swap' : isSent ? 'send' : 'receive';
        const targetAddress = type === 'send' || type === 'swap' ? (tx.to || 'Contract Creation') : tx.from;

        return {
          id: `evm-${tx.hash}`,
          type,
          amount: (Number(tx.value) / 10 ** 18).toFixed(3),
          token: 'INJ',
          address: targetAddress.startsWith('0x') ? truncateMiddle(targetAddress) : targetAddress,
          timestamp: new Date(tx.timestamp * 1000),
          status: tx.status === 'success' ? 'completed' : tx.status === 'failed' ? 'failed' : 'pending',
          txHash: tx.hash,
          chainType: 'EVM',
        };
      });

      const cosmosAddress = getInjectiveAddress(address);
      const cosmosTransactions: DashboardTransaction[] = cosmosTxHistory.map((tx) => {
        const isSwapTx = (tx as { isSwap?: boolean }).isSwap === true;
        const isSent = tx.from.toLowerCase() === cosmosAddress.toLowerCase();
        const type: DashboardTransactionType = isSwapTx ? 'swap' : isSent ? 'send' : 'receive';
        const targetAddress = type === 'send' || type === 'swap' ? (tx.to || '') : tx.from;

        return {
          id: `cosmos-${tx.hash}`,
          type,
          amount: (Number(tx.value) / 10 ** 18).toFixed(3),
          token: 'INJ',
          address: targetAddress.startsWith('inj') ? truncateMiddle(targetAddress, 8, 6) : targetAddress,
          timestamp: new Date(tx.timestamp * 1000),
          status: tx.status === 'success' ? 'completed' : tx.status === 'failed' ? 'failed' : 'pending',
          txHash: tx.hash,
          chainType: 'Cosmos',
        };
      });

      const allTransactions = [...evmTransactions, ...cosmosTransactions].sort(
        (left, right) => right.timestamp.getTime() - left.timestamp.getTime()
      );

      setHistoryItems(allTransactions);
    } catch (error) {
      console.error('Failed to load history:', error);
      setHistoryError('Unable to load recent activity right now.');
      setHistoryItems([]);
    } finally {
      setHistoryLoading(false);
    }
  }, [address, isUnlocked]);

  const executeInlineSend = useCallback(async () => {
    const trimmedRecipient = sendRecipient.trim();
    const trimmedAmount = sendAmount.trim();
    const numericAmount = Number(trimmedAmount);
    const gasCost = sendGasEstimate ? Number(formatEther(sendGasEstimate.totalCost)) : 0;

    if (!trimmedRecipient || !trimmedAmount) {
      setSendError('Enter a recipient and amount.');
      return;
    }

    if (!isValidAddress(trimmedRecipient)) {
      setSendError('Enter a valid EVM or Injective address.');
      return;
    }

    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      setSendError('Enter a valid transfer amount.');
      return;
    }

    if (numericAmount + gasCost > sendBalanceValue) {
      setSendError('Amount plus gas exceeds your INJ balance.');
      return;
    }

    if (!privateKey) {
      setSendError('Signing key is not loaded. Verify with Passkey and try again.');
      return;
    }

    setSendSubmitting(true);
    setSendError('');

    try {
      const recipientAddress = getEvmAddress(trimmedRecipient);
      const hash = await sendTransaction(
        privateKey,
        recipientAddress,
        trimmedAmount,
        undefined,
        INJECTIVE_MAINNET
      );

      setSendTxHash(hash);
      resetTxAuth();
      await loadData();
      await loadHistory();
    } catch (error) {
      setSendError(error instanceof Error ? error.message : 'Failed to send transaction');
    } finally {
      setSendSubmitting(false);
    }
  }, [getEvmAddress, loadData, loadHistory, privateKey, resetTxAuth, sendAmount, sendBalanceValue, sendGasEstimate, sendRecipient]);

  const executeInlineSwap = useCallback(async () => {
    const numericAmount = Number(swapAmount);
    const availableBalance = Number(swapFromMeta.balance || '0');

    if (swapFromToken === swapToToken) {
      setSwapError('Choose two different assets.');
      return;
    }

    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      setSwapError('Enter a valid amount to swap.');
      return;
    }

    if (numericAmount > availableBalance) {
      setSwapError(`Insufficient ${swapFromToken} balance.`);
      return;
    }

    if (!privateKey || !address) {
      setSwapError('Signing key is not loaded. Verify with Passkey and try again.');
      return;
    }

    setSwapSubmitting(true);
    setSwapError('');

    try {
      const hash = await executeSwap({
        fromToken: swapFromToken,
        toToken: swapToToken,
        amountIn: swapAmount,
        slippage: Number(swapSlippage),
        userAddress: address as Address,
        privateKey: privateKeyToHex(privateKey),
      });

      setSwapTxHash(hash);
      resetTxAuth();
      await loadData();
      await loadHistory();
    } catch (error) {
      setSwapError(error instanceof Error ? error.message : 'Swap failed');
    } finally {
      setSwapSubmitting(false);
    }
  }, [address, loadData, loadHistory, privateKey, resetTxAuth, swapAmount, swapFromMeta.balance, swapFromToken, swapSlippage, swapToToken]);

  const handleSendAction = () => {
    if (isPinLocked || autoLockMinutes === 0 || !privateKey) {
      setPendingAuthAction('send');
      setShowAuthModal(true);
      return;
    }

    void executeInlineSend();
  };

  const handleSwapAction = () => {
    if (isPinLocked || autoLockMinutes === 0 || !privateKey) {
      setPendingAuthAction('swap');
      setShowAuthModal(true);
      return;
    }

    void executeInlineSwap();
  };

  const handleTransactionAuthSuccess = () => {
    setShowAuthModal(false);
    if (pendingAuthAction) {
      setPostAuthAction(pendingAuthAction);
      setPendingAuthAction(null);
    }
  };

  useEffect(() => {
    if (!postAuthAction || !privateKey) return;

    if (postAuthAction === 'send') {
      void executeInlineSend();
    } else {
      void executeInlineSwap();
    }

    setPostAuthAction(null);
  }, [executeInlineSend, executeInlineSwap, postAuthAction, privateKey]);

  useEffect(() => {
    if (walletPanel !== 'history') return;
    void loadHistory();
  }, [loadHistory, walletPanel]);

  useEffect(() => {
    if (walletPanel !== 'send') return;

    const trimmedRecipient = sendRecipient.trim();
    const trimmedAmount = sendAmount.trim();

    if (!address || !trimmedRecipient || !trimmedAmount || !isValidAddress(trimmedRecipient) || Number(trimmedAmount) <= 0) {
      setSendGasEstimate(null);
      setSendEstimating(false);
      return;
    }

    let ignore = false;
    const timer = window.setTimeout(async () => {
      try {
        setSendEstimating(true);
        const estimate = await estimateGas(
          address,
          getEvmAddress(trimmedRecipient),
          trimmedAmount,
          undefined,
          INJECTIVE_MAINNET
        );

        if (!ignore) {
          setSendGasEstimate(estimate);
        }
      } catch (error) {
        if (!ignore) {
          console.error('Failed to estimate gas:', error);
          setSendGasEstimate(null);
        }
      } finally {
        if (!ignore) {
          setSendEstimating(false);
        }
      }
    }, 350);

    return () => {
      ignore = true;
      window.clearTimeout(timer);
    };
  }, [address, getEvmAddress, sendAmount, sendRecipient, walletPanel]);

  useEffect(() => {
    if (walletPanel !== 'swap') return;

    if (!swapAmount || Number(swapAmount) <= 0 || swapFromToken === swapToToken) {
      setSwapQuoteAmount('');
      setSwapQuoteLoading(false);
      setSwapPriceImpact('0.00');
      return;
    }

    let ignore = false;
    const timer = window.setTimeout(async () => {
      try {
        setSwapQuoteLoading(true);
        const quote = await getSwapQuote(
          swapFromToken,
          swapToToken,
          swapAmount,
          Number(swapSlippage)
        );

        if (!ignore) {
          setSwapQuoteAmount(quote.expectedOutput);
          setSwapPriceImpact(quote.priceImpact);
        }
      } catch (error) {
        if (!ignore) {
          console.error('Failed to get swap quote:', error);
          setSwapQuoteAmount('');
        }
      } finally {
        if (!ignore) {
          setSwapQuoteLoading(false);
        }
      }
    }, 400);

    return () => {
      ignore = true;
      window.clearTimeout(timer);
    };
  }, [swapAmount, swapFromToken, swapSlippage, swapToToken, walletPanel]);

  const assetTabOrder: AssetTab[] = ['tokens', 'nfts', 'defi', 'earn'];
  const assetTabIndex = assetTabOrder.indexOf(assetTab);

  // QR Scanner handlers
  const openQRScanner = async () => {
    try {
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

      // Start scanning after modal opens - directly request camera
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
    } catch (error) {
      alert('Error: ' + (error instanceof Error ? error.message : 'Unknown error'));
      console.error('[Dashboard] Error in openQRScanner:', error);
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

  const isDashboardReady = !isCheckingSession && !loading && isUnlocked && !!address;
  const formattedBalance = balance ? parseFloat(balance.formatted).toFixed(4) : '0.0000';
  const injUsdValue = balance ? (parseFloat(balance.formatted) * injPrice) : 0;
  const usdtValue = parseFloat(tokenBalances.USDT);
  const usdcValue = parseFloat(tokenBalances.USDC);
  const totalUsdNumeric = injUsdValue + usdtValue + usdcValue;
  const totalUsdValue = totalUsdNumeric.toFixed(2);
  const assetTrendSeries = buildPixelTrendSeries(totalUsdNumeric, injPriceChange24h);
  const isWalletOverview = walletPanel === 'overview';
  const activeWalletPanelMeta = walletPanel !== 'overview' ? walletPanelMeta[walletPanel] : null;

  return (
    <LoadingSpinner ready={isDashboardReady}>
      {isDashboardReady ? (
        <div className="min-h-screen pb-24 md:pb-8 bg-black">
          <div>
            {/* Modern Dashboard Header */}
            <div className="bg-gradient-to-b from-white/5 to-transparent border-b border-white/5 backdrop-blur-sm">
            <div className="max-w-7xl mx-auto px-4 py-6">
          {/* Header Top */}
          <div className="mb-6 flex items-center justify-between">
            {/* Account Info */}
            <div className="flex min-w-0 items-center gap-2.5">
              {/* Brand Logo */}
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[0.95rem] border border-white/10 bg-white/5 p-1.5">
                <Image 
                  src="/lambdalogo.png" 
                  alt="Logo" 
                  width={24} 
                  height={24}
                  className="h-6 w-6 object-contain"
                />
              </div>
              
              <div className="min-w-0">
                <div className="flex items-center gap-2.5 whitespace-nowrap">
                  <div className="text-sm font-bold text-white">Account 1</div>
                  {address && (
                    <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 font-mono text-[11px] text-gray-400">
                      {formatAddress(address)}
                    </span>
                  )}
                  <button 
                    onClick={handleCopyAddress}
                    className="group flex h-7 w-7 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] transition-all hover:bg-white/10"
                    title="Copy address"
                  >
                    {copied ? (
                      <svg className="h-3.5 w-3.5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <svg className="h-3.5 w-3.5 text-gray-400 transition-colors group-hover:text-white" fill="none" stroke="currentColor" viewBox="0 0 16 16">
                        <rect width="11" height="11" x="4" y="4" rx="1" ry="1" strokeWidth="1.5" />
                        <path d="M2 10c-0.8 0-1.5-0.7-1.5-1.5V2c0-0.8 0.7-1.5 1.5-1.5h8.5c0.8 0 1.5 0.7 1.5 1.5" strokeWidth="1.5" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* Scan QR Code Button */}
            <div className="flex items-center gap-2">
              <ThemeToggleButton compact />
              <button
                onClick={() => setShowCardCenter(true)}
                className="rounded-lg border border-white/10 bg-white/5 p-2.5 transition-all hover:bg-white/10"
                title="Open Card Center"
              >
                <svg className="h-[18px] w-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h5M5 6h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2Z" />
                </svg>
              </button>
              <button 
                onClick={openQRScanner}
                className="rounded-lg border border-white/10 bg-white/5 p-2.5 transition-all hover:bg-white/10"
                title="Scan QR Code"
              >
                <svg className="h-[18px] w-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
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
          </div>

          <div className="grid gap-5 xl:grid-cols-[minmax(0,1.18fr)_minmax(360px,0.82fr)] xl:items-start">
            {/* Total Balance Card - OKX Style */}
            <div className="bg-black rounded-2xl p-6 border border-white/10 relative overflow-hidden flex flex-col h-[760px] md:h-[720px]">
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

                <div className="relative flex-1 min-h-0">
                  <div
                    className={`absolute inset-0 transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                      isWalletOverview
                        ? 'opacity-100 translate-y-0'
                        : 'opacity-0 translate-y-5 pointer-events-none'
                    }`}
                  >
                    <div className="flex h-full flex-col justify-center">
                      <div className="flex flex-col gap-6 xl:flex-row xl:items-end">
                        <div className="min-w-0 flex-1">
                          <div className="mb-5">
                            <div className="flex items-end gap-3 md:gap-4 flex-wrap">
                              <span className="text-4xl md:text-5xl font-bold text-white font-mono tracking-tight">
                                {balanceVisible ? <RollingBalanceNumber value={formattedBalance} /> : '••••••'}
                              </span>
                              <span className="text-xl font-semibold text-gray-400">INJ</span>
                              <div className="flex items-baseline gap-2 pb-1 md:pb-1.5">
                                <span className="text-sm md:text-base font-semibold text-white/90 font-mono tracking-tight">
                                  {balanceVisible ? AGENT_CREDITS_STATS.available.toLocaleString() : '••••'}
                                </span>
                                <span className="text-[11px] md:text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">
                                  Passbits
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center gap-4 mt-2">
                              <div className="text-base text-gray-400 font-mono">
                                ≈ ${balanceVisible ? totalUsdValue : '••••••'} USD
                              </div>
                              {balanceVisible && balance && (
                                <div className="flex items-center gap-2">
                                  <span className={`text-sm font-semibold ${injPriceChange24h >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                    {injPriceChange24h >= 0 ? '+' : ''}${(parseFloat(balance.formatted) * injPrice * injPriceChange24h / 100).toFixed(2)}
                                  </span>
                                  <span className={`text-sm ${injPriceChange24h >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                    {injPriceChange24h >= 0 ? '+' : ''}{injPriceChange24h.toFixed(2)}%
                                  </span>
                                  <span className="text-gray-500 text-xs">24h</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="xl:w-[320px] xl:flex-shrink-0">
                          <PixelTrendChart
                            values={assetTrendSeries}
                            hidden={!balanceVisible}
                            changePct={injPriceChange24h}
                            currentValueLabel={totalUsdValue}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div
                    className={`absolute inset-0 transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                      isWalletOverview
                        ? 'opacity-0 translate-y-5 pointer-events-none'
                        : 'opacity-100 translate-y-0'
                    }`}
                  >
                    <div className="h-full rounded-[1.5rem] border border-white/10 bg-white/[0.03] px-4 py-4 sm:px-5 sm:py-5 flex flex-col overflow-hidden">
                      <div className="flex items-start justify-between gap-4 border-b border-white/6 pb-4">
                        <div>
                          <div className="text-sm font-bold text-white">{activeWalletPanelMeta?.title}</div>
                          <div className="mt-1 text-xs text-gray-400">{activeWalletPanelMeta?.subtitle}</div>
                        </div>
                        <button
                          onClick={() => setWalletPanel('overview')}
                          className="w-9 h-9 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 flex items-center justify-center transition-all"
                          title="Close panel"
                        >
                          <svg className="w-4 h-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>

                      <div className="min-h-0 flex-1 overflow-y-auto pr-1">
                        {walletPanel === 'send' && (
                          <div className="grid gap-4 pt-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(260px,0.8fr)]">
                            <div className="space-y-4">
                              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                                <div className="flex items-center justify-between mb-2">
                                  <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-500">Recipient</span>
                                  <button
                                    onClick={async () => {
                                      try {
                                        const text = await navigator.clipboard.readText();
                                        setSendRecipient(text);
                                        setSendError('');
                                      } catch (error) {
                                        console.error('Failed to read clipboard:', error);
                                      }
                                    }}
                                    className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400 hover:text-white transition-colors"
                                  >
                                    Paste
                                  </button>
                                </div>
                                <input
                                  value={sendRecipient}
                                  onChange={(event) => {
                                    setSendRecipient(event.target.value);
                                    setSendError('');
                                  }}
                                  placeholder="0x... or inj1..."
                                  className="w-full bg-transparent text-sm text-white placeholder:text-gray-600 outline-none font-mono"
                                />
                              </div>

                              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                                <div className="flex items-center justify-between mb-2">
                                  <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-500">Amount</span>
                                  <button
                                    onClick={() => {
                                      setSendAmount(tokenBalances.INJ);
                                      setSendError('');
                                    }}
                                    className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400 hover:text-white transition-colors"
                                  >
                                    Max
                                  </button>
                                </div>
                                <div className="flex items-end gap-3">
                                  <input
                                    value={sendAmount}
                                    onChange={(event) => {
                                      setSendAmount(event.target.value);
                                      setSendError('');
                                    }}
                                    inputMode="decimal"
                                    placeholder="0.0000"
                                    className="w-full bg-transparent text-2xl font-mono text-white placeholder:text-gray-600 outline-none"
                                  />
                                  <span className="pb-1 text-sm font-semibold text-gray-400">INJ</span>
                                </div>
                              </div>

                              <div className="grid gap-3 sm:grid-cols-2">
                                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-500">Estimated Gas</div>
                                  <div className="mt-2 text-sm font-mono text-white">
                                    {sendEstimating ? 'Estimating...' : sendGasEstimate ? `${Number(sendGasCost).toFixed(6)} INJ` : 'Awaiting input'}
                                  </div>
                                </div>
                                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-500">Available</div>
                                  <div className="mt-2 text-sm font-mono text-white">{tokenBalances.INJ} INJ</div>
                                </div>
                              </div>

                              {sendError && (
                                <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                                  {sendError}
                                </div>
                              )}

                              {sendTxHash && (
                                <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3">
                                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-200">Latest Transfer</div>
                                  <div className="mt-2 text-sm font-mono text-white">{truncateMiddle(sendTxHash, 10, 8)}</div>
                                </div>
                              )}
                            </div>

                            <div className="rounded-2xl border border-white/10 bg-black/25 p-4 flex flex-col">
                              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-500">Summary</div>
                              <div className="mt-4 space-y-3">
                                <div className="flex items-center justify-between gap-3 text-sm">
                                  <span className="text-gray-400">To</span>
                                  <span className="font-mono text-white text-right">{sendRecipient ? truncateMiddle(sendRecipient, 8, 6) : 'Not set'}</span>
                                </div>
                                <div className="flex items-center justify-between gap-3 text-sm">
                                  <span className="text-gray-400">Amount</span>
                                  <span className="font-mono text-white">{sendAmount || '0.0000'} INJ</span>
                                </div>
                                <div className="flex items-center justify-between gap-3 text-sm">
                                  <span className="text-gray-400">Network</span>
                                  <span className="text-white">Injective EVM</span>
                                </div>
                              </div>

                              <div className="mt-auto pt-5">
                                <button
                                  onClick={handleSendAction}
                                  disabled={sendSubmitting || !sendRecipient || !sendAmount}
                                  className="w-full rounded-2xl bg-white text-black font-bold py-3.5 hover:bg-gray-100 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                  {sendSubmitting ? 'Sending...' : 'Send INJ'}
                                </button>
                              </div>
                            </div>
                          </div>
                        )}

                        {walletPanel === 'receive' && (
                          <div className="grid gap-5 pt-5 lg:grid-cols-[220px_minmax(0,1fr)] lg:items-center">
                            <div className="flex justify-center">
                              <div className="rounded-[2rem] bg-white p-4 shadow-2xl">
                                <QRCodeSVG
                                  value={receiveDisplayAddress || address || ''}
                                  size={180}
                                  level="H"
                                  bgColor="#FFFFFF"
                                  fgColor="#000000"
                                  includeMargin={false}
                                />
                              </div>
                            </div>

                            <div className="space-y-4">
                              <div className="relative p-1 bg-white/5 rounded-2xl border border-white/10">
                                <div
                                  className={`absolute top-1 bottom-1 w-[calc(50%-0.25rem)] rounded-[0.85rem] bg-white transition-all duration-300 ${
                                    receiveAddressType === 'evm' ? 'left-1' : 'left-[calc(50%+0rem)]'
                                  }`}
                                />
                                <div className="relative grid grid-cols-2 gap-2">
                                  <button
                                    onClick={() => setReceiveAddressType('evm')}
                                    className={`rounded-[0.85rem] px-3 py-2.5 text-sm font-bold transition-all ${receiveAddressType === 'evm' ? 'text-black' : 'text-gray-400 hover:text-white'}`}
                                  >
                                    EVM
                                  </button>
                                  <button
                                    onClick={() => setReceiveAddressType('cosmos')}
                                    className={`rounded-[0.85rem] px-3 py-2.5 text-sm font-bold transition-all ${receiveAddressType === 'cosmos' ? 'text-black' : 'text-gray-400 hover:text-white'}`}
                                  >
                                    Cosmos
                                  </button>
                                </div>
                              </div>

                              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-500">Wallet Address</div>
                                <div className="mt-3 flex items-center gap-3">
                                  <div className="flex-1 overflow-x-auto scrollbar-hide font-mono text-sm text-white whitespace-nowrap">
                                    {receiveDisplayAddress}
                                  </div>
                                  <button
                                    onClick={() => {
                                      if (!receiveDisplayAddress) return;
                                      navigator.clipboard.writeText(receiveDisplayAddress);
                                      setReceiveCopied(true);
                                      setTimeout(() => setReceiveCopied(false), 2000);
                                    }}
                                    className={`flex-shrink-0 rounded-xl border px-3 py-2 text-xs font-bold transition-all ${
                                      receiveCopied
                                        ? 'border-emerald-400/30 bg-emerald-500/10 text-emerald-300'
                                        : 'border-white/10 bg-white/5 text-white hover:bg-white/10'
                                    }`}
                                  >
                                    {receiveCopied ? 'Copied' : 'Copy'}
                                  </button>
                                </div>
                              </div>

                              <div className="grid gap-3 sm:grid-cols-2">
                                <div className="rounded-2xl border border-emerald-500/15 bg-emerald-500/5 px-4 py-3 text-sm text-gray-300">
                                  Use <span className="text-white">{receiveAddressType === 'evm' ? 'EVM' : 'Cosmos'}</span> format depending on the sender you are receiving from.
                                </div>
                                <div className="rounded-2xl border border-yellow-500/15 bg-yellow-500/5 px-4 py-3 text-sm text-gray-300">
                                  Double-check the network before sending assets in. Wrong network deposits may not be recoverable.
                                </div>
                              </div>
                            </div>
                          </div>
                        )}

                        {walletPanel === 'swap' && (
                          <div className="grid gap-4 pt-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(260px,0.85fr)]">
                            <div className="space-y-4">
                              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-500">From</div>
                                <div className="mt-3 grid grid-cols-3 gap-2">
                                  {swapTokenOptions.map((token) => (
                                    <button
                                      key={`from-${token.symbol}`}
                                      onClick={() => {
                                        setSwapFromToken(token.symbol);
                                        if (token.symbol === swapToToken) {
                                          setSwapToToken(token.symbol === 'INJ' ? 'USDT' : 'INJ');
                                        }
                                        setSwapError('');
                                      }}
                                      className={`rounded-2xl border px-3 py-3 text-left transition-all ${
                                        swapFromToken === token.symbol
                                          ? 'border-white/20 bg-white text-black'
                                          : 'border-white/10 bg-white/5 hover:bg-white/10'
                                      }`}
                                    >
                                      <div className="font-bold text-sm">{token.symbol}</div>
                                      <div className={`mt-1 text-xs ${swapFromToken === token.symbol ? 'text-black/70' : 'text-gray-400'}`}>{token.balance}</div>
                                    </button>
                                  ))}
                                </div>
                              </div>

                              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-500">To</div>
                                <div className="mt-3 grid grid-cols-3 gap-2">
                                  {swapTokenOptions.map((token) => (
                                    <button
                                      key={`to-${token.symbol}`}
                                      onClick={() => {
                                        setSwapToToken(token.symbol);
                                        if (token.symbol === swapFromToken) {
                                          setSwapFromToken(token.symbol === 'INJ' ? 'USDT' : 'INJ');
                                        }
                                        setSwapError('');
                                      }}
                                      className={`rounded-2xl border px-3 py-3 text-left transition-all ${
                                        swapToToken === token.symbol
                                          ? 'border-white/20 bg-white text-black'
                                          : 'border-white/10 bg-white/5 hover:bg-white/10'
                                      }`}
                                    >
                                      <div className="font-bold text-sm">{token.symbol}</div>
                                      <div className={`mt-1 text-xs ${swapToToken === token.symbol ? 'text-black/70' : 'text-gray-400'}`}>{token.balance}</div>
                                    </button>
                                  ))}
                                </div>
                              </div>

                              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                                <div className="flex items-center justify-between mb-2">
                                  <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-500">Swap Amount</span>
                                  <button
                                    onClick={() => {
                                      setSwapAmount(swapFromMeta.balance);
                                      setSwapError('');
                                    }}
                                    className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400 hover:text-white transition-colors"
                                  >
                                    Max
                                  </button>
                                </div>
                                <div className="flex items-end gap-3">
                                  <input
                                    value={swapAmount}
                                    onChange={(event) => {
                                      setSwapAmount(event.target.value);
                                      setSwapError('');
                                    }}
                                    inputMode="decimal"
                                    placeholder="0.0000"
                                    className="w-full bg-transparent text-2xl font-mono text-white placeholder:text-gray-600 outline-none"
                                  />
                                  <span className="pb-1 text-sm font-semibold text-gray-400">{swapFromToken}</span>
                                </div>
                              </div>

                              <div className="flex flex-wrap gap-2">
                                {['0.5', '1.0', '2.0'].map((value) => (
                                  <button
                                    key={value}
                                    onClick={() => setSwapSlippage(value)}
                                    className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-all ${
                                      swapSlippage === value
                                        ? 'bg-white text-black'
                                        : 'bg-white/5 text-gray-300 hover:bg-white/10'
                                    }`}
                                  >
                                    {value}% Slippage
                                  </button>
                                ))}
                              </div>

                              {swapError && (
                                <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                                  {swapError}
                                </div>
                              )}

                              {swapTxHash && (
                                <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3">
                                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-200">Latest Swap</div>
                                  <div className="mt-2 text-sm font-mono text-white">{truncateMiddle(swapTxHash, 10, 8)}</div>
                                </div>
                              )}
                            </div>

                            <div className="rounded-2xl border border-white/10 bg-black/25 p-4 flex flex-col">
                              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-500">Quote</div>
                              <div className="mt-4 space-y-3">
                                <div className="flex items-center justify-between gap-3 text-sm">
                                  <span className="text-gray-400">From</span>
                                  <span className="font-mono text-white">{swapAmount || '0.0000'} {swapFromToken}</span>
                                </div>
                                <div className="flex items-center justify-between gap-3 text-sm">
                                  <span className="text-gray-400">Expected Out</span>
                                  <span className="font-mono text-white">
                                    {swapQuoteLoading ? 'Quoting...' : swapQuoteAmount ? `${Number(swapQuoteAmount).toFixed(4)} ${swapToToken}` : 'Awaiting input'}
                                  </span>
                                </div>
                                <div className="flex items-center justify-between gap-3 text-sm">
                                  <span className="text-gray-400">Price Impact</span>
                                  <span className="text-white">{swapPriceImpact}%</span>
                                </div>
                                <div className="flex items-center justify-between gap-3 text-sm">
                                  <span className="text-gray-400">Available</span>
                                  <span className="font-mono text-white">{swapFromMeta.balance} {swapFromToken}</span>
                                </div>
                              </div>

                              <div className="mt-auto pt-5">
                                <button
                                  onClick={handleSwapAction}
                                  disabled={swapSubmitting || !swapAmount || swapFromToken === swapToToken}
                                  className="w-full rounded-2xl bg-white text-black font-bold py-3.5 hover:bg-gray-100 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                  {swapSubmitting ? 'Swapping...' : `Swap to ${swapToMeta.symbol}`}
                                </button>
                              </div>
                            </div>
                          </div>
                        )}

                        {walletPanel === 'history' && (
                          <div className="pt-5">
                            <div className="flex flex-wrap gap-2">
                              {(['all', 'send', 'receive', 'swap'] as DashboardHistoryFilter[]).map((filter) => (
                                <button
                                  key={filter}
                                  onClick={() => setHistoryFilter(filter)}
                                  className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-all ${
                                    historyFilter === filter
                                      ? 'bg-white text-black'
                                      : 'bg-white/5 text-gray-300 hover:bg-white/10'
                                  }`}
                                >
                                  {filter === 'all' ? 'All' : filter.charAt(0).toUpperCase() + filter.slice(1)}
                                </button>
                              ))}
                            </div>

                            {historyError && (
                              <div className="mt-4 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                                {historyError}
                              </div>
                            )}

                            {historyLoading ? (
                              <div className="mt-5 flex items-center justify-center py-14">
                                <div className="w-10 h-10 rounded-full border-4 border-white/10 border-t-white animate-spin" />
                              </div>
                            ) : filteredHistoryItems.length === 0 ? (
                              <div className="mt-5 rounded-2xl border border-white/10 bg-white/5 px-4 py-10 text-center text-sm text-gray-400">
                                No transactions yet. Your recent wallet activity will appear here.
                              </div>
                            ) : (
                              <div className="mt-5 space-y-3">
                                {filteredHistoryItems.map((item) => (
                                  <div
                                    key={item.id}
                                    className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4"
                                  >
                                    <div className="flex items-start justify-between gap-4">
                                      <div className="min-w-0">
                                        <div className="flex items-center gap-2">
                                          <span className="text-sm font-bold text-white capitalize">{item.type}</span>
                                          <span className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-gray-400">
                                            {item.chainType}
                                          </span>
                                        </div>
                                        <div className="mt-1 text-sm text-gray-400">{item.address}</div>
                                        <div className="mt-2 text-xs text-gray-500">{formatDashboardTimestamp(item.timestamp)}</div>
                                      </div>
                                      <div className="text-right">
                                        <div className="text-sm font-mono text-white">{item.amount} {item.token}</div>
                                        <div className={`mt-1 text-xs font-semibold ${
                                          item.status === 'completed'
                                            ? 'text-emerald-300'
                                            : item.status === 'failed'
                                              ? 'text-red-300'
                                              : 'text-amber-300'
                                        }`}>
                                          {item.status}
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-4 pt-5">
                  {/* Send Button */}
                  <button 
                    onClick={() => toggleWalletPanel('send')}
                    className="flex flex-col items-center gap-2 group"
                  >
                    <div className={`w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-all ${
                      walletPanel === 'send'
                        ? 'bg-white scale-105 ring-4 ring-white/10'
                        : 'bg-white hover:bg-gray-100 group-hover:scale-105'
                    }`}>
                      <svg className="w-5 h-5 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <line x1="12" y1="19" x2="12" y2="5" strokeWidth={2.5} strokeLinecap="round" />
                        <polyline points="5 12 12 5 19 12" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                    <span className={`text-xs font-semibold transition-colors ${walletPanel === 'send' ? 'text-white' : 'text-gray-300'}`}>Send</span>
                  </button>

                  {/* Receive Button */}
                  <button 
                    onClick={() => toggleWalletPanel('receive')}
                    className="flex flex-col items-center gap-2 group"
                  >
                    <div className={`w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-all ${
                      walletPanel === 'receive'
                        ? 'bg-white scale-105 ring-4 ring-white/10'
                        : 'bg-white hover:bg-gray-100 group-hover:scale-105'
                    }`}>
                      <svg className="w-5 h-5 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <line x1="12" y1="5" x2="12" y2="19" strokeWidth={2.5} strokeLinecap="round" />
                        <polyline points="19 12 12 19 5 12" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                    <span className={`text-xs font-semibold transition-colors ${walletPanel === 'receive' ? 'text-white' : 'text-gray-300'}`}>Receive</span>
                  </button>

                  {/* Swap Button */}
                  <button 
                    onClick={() => toggleWalletPanel('swap')}
                    className="flex flex-col items-center gap-2 group"
                  >
                    <div className={`w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-all ${
                      walletPanel === 'swap'
                        ? 'bg-white scale-105 ring-4 ring-white/10'
                        : 'bg-white hover:bg-gray-100 group-hover:scale-105'
                    }`}>
                      <svg className="w-5 h-5 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <polyline points="16 3 21 3 21 8" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
                        <line x1="4" y1="20" x2="21" y2="3" strokeWidth={2.5} strokeLinecap="round" />
                        <polyline points="21 16 21 21 16 21" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
                        <line x1="15" y1="15" x2="21" y2="21" strokeWidth={2.5} strokeLinecap="round" />
                        <line x1="4" y1="4" x2="9" y2="9" strokeWidth={2.5} strokeLinecap="round" />
                      </svg>
                    </div>
                    <span className={`text-xs font-semibold transition-colors ${walletPanel === 'swap' ? 'text-white' : 'text-gray-300'}`}>Swap</span>
                  </button>

                  {/* History Button */}
                  <button 
                    onClick={() => toggleWalletPanel('history')}
                    className="flex flex-col items-center gap-2 group"
                  >
                    <div className={`w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-all ${
                      walletPanel === 'history'
                        ? 'bg-white scale-105 ring-4 ring-white/10'
                        : 'bg-white hover:bg-gray-100 group-hover:scale-105'
                    }`}>
                      <svg className="w-5 h-5 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <circle cx="12" cy="12" r="10" strokeWidth={2.5} strokeLinecap="round" />
                        <polyline points="12 6 12 12 16 14" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                    <span className={`text-xs font-semibold transition-colors ${walletPanel === 'history' ? 'text-white' : 'text-gray-300'}`}>History</span>
                  </button>
                </div>
              </div>
            </div>

            <div className="bg-black rounded-2xl border border-white/10 relative overflow-hidden p-4 sm:p-5 xl:min-h-[100%]">
              <div className="absolute bottom-0 left-0 w-32 h-32 bg-gradient-to-tr from-cyan-500/5 to-transparent rounded-full blur-2xl"></div>
              <div className="relative">
        {/* Asset Tabs - Smooth Sliding Background */}
        <div className="relative mb-6 p-1 bg-white/5 rounded-xl">
          {/* Sliding Background */}
          <div 
            className="absolute top-1 bottom-1 bg-white rounded-lg transition-all duration-300 ease-out shadow-lg"
            style={{
              width: 'calc((100% - 1.5rem) / 4)',
              left: `calc(0.25rem + ${assetTabIndex} * ((100% - 1.5rem) / 4 + 0.5rem))`,
            }}
          />
          
          {/* Tab Buttons */}
          <div className="relative flex gap-2">
            <button 
              onClick={() => setAssetTab('tokens')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-3 px-2 sm:px-4 rounded-lg font-bold text-xs sm:text-sm transition-all duration-300 ${
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
              className={`flex-1 flex items-center justify-center gap-1.5 py-3 px-2 sm:px-4 rounded-lg font-bold text-xs sm:text-sm transition-all duration-300 ${
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
              className={`flex-1 flex items-center justify-center gap-1.5 py-3 px-2 sm:px-4 rounded-lg font-bold text-xs sm:text-sm transition-all duration-300 ${
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
            <button 
              onClick={() => setAssetTab('earn')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-3 px-2 sm:px-4 rounded-lg font-bold text-xs sm:text-sm transition-all duration-300 ${
                assetTab === 'earn' 
                  ? 'text-black' 
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v18M7.5 7.5h5.25a2.75 2.75 0 010 5.5h-1.5a2.75 2.75 0 000 5.5H17" />
              </svg>
              <span>Earn</span>
            </button>
          </div>
        </div>

        {/* Asset List */}
        <div className="space-y-3 xl:max-h-[540px] xl:overflow-y-auto xl:pr-1">
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
                  <div className={`text-sm ${injPriceChange24h >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {injPriceChange24h >= 0 ? '+' : ''}{injPriceChange24h.toFixed(2)}%
                  </div>
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
                  <div className={`text-sm ${usdtPriceChange24h >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {usdtPriceChange24h >= 0 ? '+' : ''}{usdtPriceChange24h.toFixed(2)}%
                  </div>
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
                  <div className={`text-sm ${usdcPriceChange24h >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {usdcPriceChange24h >= 0 ? '+' : ''}{usdcPriceChange24h.toFixed(2)}%
                  </div>
                </div>
              </div>
            </>
          )}

          {assetTab === 'nfts' && (
            <>
              {nftsLoading ? (
                <div className="flex items-center justify-center py-16">
                  <div className="w-12 h-12 border-4 border-white/20 border-t-white rounded-full animate-spin"></div>
                </div>
              ) : nfts.length === 0 ? (
                <div className="text-center py-16 text-gray-500">
                  <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4 border border-white/10">
                    <svg className="w-8 h-8 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <rect width="18" height="18" x="3" y="3" rx="2" ry="2" strokeWidth={2} />
                      <path d="M9 3v18M3 9h18" strokeWidth={2} strokeLinecap="round" />
                    </svg>
                  </div>
                  <p className="text-lg font-bold mb-1">No NFTs found</p>
                  <p className="text-xs text-gray-500">You don&apos;t own any N1NJ4 NFTs yet</p>
                </div>
              ) : (
                <>
                  {nfts.map((nft) => (
                    <div 
                      key={`${nft.contractAddress}-${nft.tokenId}`}
                      onClick={() => setSelectedNFT(nft)}
                      className="flex items-center gap-4 p-4 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 transition-all cursor-pointer"
                    >
                      <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center overflow-hidden shadow-lg">
                        {nft.image ? (
                          <Image 
                            src={nft.image} 
                            alt={nft.name} 
                            width={48} 
                            height={48}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <rect width="18" height="18" x="3" y="3" rx="2" ry="2" strokeWidth={2} />
                            <path d="M9 3v18M3 9h18" strokeWidth={2} strokeLinecap="round" />
                          </svg>
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="font-bold mb-1">{nft.name}</div>
                        <div className="text-sm text-gray-400">#{nft.tokenId}</div>
                      </div>
                      <div className="text-right">
                        <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </>
          )}

          {assetTab === 'defi' && (
            <>
              {stakingLoading ? (
                <div className="flex items-center justify-center py-16">
                  <div className="w-12 h-12 border-4 border-white/20 border-t-white rounded-full animate-spin"></div>
                </div>
              ) : stakingInfo && parseFloat(stakingInfo.totalStaked) > 0 ? (
                <>
                  {/* Staking Position */}
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
                      <div className="font-bold mb-1">Staking</div>
                      <div className="text-sm text-gray-400">{stakingInfo.totalStaked} INJ</div>
                      <div className="text-xs text-gray-500 mt-1">APR: {stakingInfo.stakingApr}%</div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold font-mono">${stakingInfo.totalStakedUsd}</div>
                      <div className={`text-sm ${injPriceChange24h >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {injPriceChange24h >= 0 ? '+' : ''}{injPriceChange24h.toFixed(2)}%
                      </div>
                    </div>
                  </div>

                  {/* Staking Rewards */}
                  {parseFloat(stakingInfo.rewards) > 0 && (
                    <div className="flex items-center gap-4 p-4 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 transition-all cursor-pointer">
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-yellow-600 flex items-center justify-center text-2xl shadow-lg">
                        💰
                      </div>
                      <div className="flex-1">
                        <div className="font-bold mb-1">Staking Rewards</div>
                        <div className="text-sm text-gray-400">{stakingInfo.rewards} INJ</div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold font-mono">${stakingInfo.rewardsUsd}</div>
                        <div className="text-sm text-green-400">Claimable</div>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-16 text-gray-500">
                  <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4 border border-white/10">
                    <svg className="w-8 h-8 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                    </svg>
                  </div>
                  <p className="text-lg font-bold mb-1">No DeFi Positions</p>
                  <p className="text-xs text-gray-500">Your DeFi positions and activities will appear here</p>
                </div>
              )}
            </>
          )}

          {assetTab === 'earn' && (
            <NinjaMinerGame walletAddress={address} />
          )}
        </div>
      </div>
            </div>
          </div>
        </div>
      </div>

      <TransactionAuthModal
        isOpen={showAuthModal}
        onClose={() => {
          setShowAuthModal(false);
          setPendingAuthAction(null);
          setPostAuthAction(null);
        }}
        onSuccess={handleTransactionAuthSuccess}
        transactionType={pendingAuthAction ?? 'send'}
      />

      <CardCenterModal
        isOpen={showCardCenter}
        onClose={() => setShowCardCenter(false)}
      />

      {/* NFT Detail Modal */}
      {selectedNFT && (
        <NFTDetailModal 
          nft={selectedNFT} 
          onClose={() => setSelectedNFT(null)} 
        />
      )}

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
            {/* Header - Compact */}
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
            
            {/* Scanner Body - Compact */}
            <div className="p-4 flex flex-col items-center justify-center" style={{ minHeight: '320px' }}>
              {showMyQR ? (
                <>
                  {/* Show My QR Code - Compact */}
                  <div className="text-center mb-3">
                    <h4 className="text-sm font-bold text-white mb-1">My Wallet Address</h4>
                    <p className="text-gray-400 text-xs">Let others scan this code</p>
                  </div>

                  {/* QR Code - Smaller */}
                  <div className="bg-white p-4 rounded-xl mb-3">
                    <QRCodeSVG 
                      value={address || ''} 
                      size={200}
                      level="H"
                      includeMargin={true}
                    />
                  </div>

                  {/* Address Display - Compact */}
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
                  {/* QR Scanner Video - Compact */}
                  <div className="relative w-full mb-4">
                    <div 
                      id="qr-reader" 
                      className="rounded-xl overflow-hidden border-2 border-white/20"
                      style={{ width: '100%' }}
                    />
                    
                    {/* Scanning overlay */}
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
                  {/* Success Animation - Compact */}
                  <div className="relative mb-4 flex items-center justify-center w-32 h-32">
                    {/* Glow rings - Smaller */}
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-32 h-32 rounded-full border-2 border-white/30 animate-ping"></div>
                    </div>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-28 h-28 rounded-full border-2 border-white/40 animate-ping" style={{ animationDelay: '0.15s' }}></div>
                    </div>
                    
                    {/* Success circle - Smaller */}
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
                  {/* Error State - Compact */}
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

            {/* Bottom Action - Toggle to My QR - Compact */}
            <div className="p-3 border-t border-white/5">
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

      {/* Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-black/95 border-t border-white/10 backdrop-blur-lg">
        <div className="max-w-7xl mx-auto px-4">
          <div className="grid grid-cols-4 gap-2 py-3">
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

            {/* Agents */}
            <button
              onClick={() => {
                setActiveTab('agents');
                router.push('/agents');
              }}
              className={`flex flex-col items-center gap-1 py-2 rounded-xl transition-all ${
                activeTab === 'agents' 
                  ? 'text-white' 
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              <div className={`p-2 rounded-xl transition-all ${
                activeTab === 'agents' 
                  ? 'bg-white/10' 
                  : 'bg-transparent'
              }`}>
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17H3a2 2 0 01-2-2V5a2 2 0 012-2h14a2 2 0 012 2v10a2 2 0 01-2 2h-2" />
                </svg>
              </div>
              <span className="text-xs font-semibold">Agents</span>
            </button>
          </div>
        </div>
          </div>
          </div>
        </div>
      ) : null}
    </LoadingSpinner>
  );
}
