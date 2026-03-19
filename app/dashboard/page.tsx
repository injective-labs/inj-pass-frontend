'use client';

import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
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
import { TOKENS_MAINNET } from '@/services/tokens';
import SettingsPage from '../settings/page';
import { formatAddress, privateKeyToHex } from '@/utils/wallet';
import { getInjectiveAddress, getEthereumAddress } from '@injectivelabs/sdk-ts';

type AssetTab = 'tokens' | 'nfts' | 'defi' | 'earn';
type WalletPanel = 'overview' | 'send' | 'receive' | 'swap' | 'history' | 'settings';
type AddressType = 'evm' | 'cosmos';
type DashboardTransactionType = 'send' | 'receive' | 'swap';
type DashboardTransactionStatus = 'completed' | 'pending' | 'failed';
type DashboardHistoryFilter = 'all' | DashboardTransactionType;
type DashboardChainType = 'EVM' | 'Cosmos';
type SwapToken = 'INJ' | 'USDT' | 'USDC' | 'NINJA';
type DashboardWorkspaceTab = 'discover' | 'agent';
type AssetSurfaceMode = 'assets' | 'ai';

const NINJA_STORAGE_PREFIX = 'inj-pass:ninja-miner:';
const DEFAULT_NINJA_BALANCE = 22;

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

function getNinjaStorageKey(walletAddress?: string) {
  return `${NINJA_STORAGE_PREFIX}${walletAddress || 'guest'}`;
}

function readStoredNinjaBalance(walletAddress?: string) {
  if (typeof window === 'undefined') {
    return DEFAULT_NINJA_BALANCE;
  }

  try {
    const rawState = window.localStorage.getItem(getNinjaStorageKey(walletAddress));
    if (!rawState) {
      return DEFAULT_NINJA_BALANCE;
    }

    const parsed = JSON.parse(rawState) as { ninjaBalance?: number };
    return typeof parsed.ninjaBalance === 'number' ? parsed.ninjaBalance : DEFAULT_NINJA_BALANCE;
  } catch (error) {
    console.error('Failed to restore ninja balance:', error);
    return DEFAULT_NINJA_BALANCE;
  }
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

function DashboardSurfaceFrame({
  src,
  title,
}: {
  src: string;
  title: string;
}) {
  return (
    <iframe
      src={src}
      title={title}
      className="h-full w-full border-0 bg-black"
      loading="lazy"
    />
  );
}

function getFaucetPopoverStyle(button: HTMLButtonElement | null): CSSProperties {
  const defaultWidth = 384;
  const defaultHeight = 540;

  if (typeof window === 'undefined' || !button) {
    return {
      width: defaultWidth,
      height: defaultHeight,
      top: 88,
      left: '50%',
      transform: 'translateX(-50%)',
    };
  }

  const rect = button.getBoundingClientRect();
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const width = Math.min(defaultWidth, viewportWidth - 32);
  const centeredLeft = rect.left + rect.width / 2 - width / 2;
  const left = Math.max(16, Math.min(centeredLeft, viewportWidth - width - 16));
  const top = Math.max(20, rect.top + rect.height / 2 - 18);
  const height = Math.min(defaultHeight, viewportHeight - top - 24);

  return {
    width,
    height,
    top,
    left,
  };
}

export default function DashboardPage() {
  const router = useRouter();
  const { isUnlocked, address, privateKey, resetTxAuth, isCheckingSession } = useWallet();
  const { autoLockMinutes, isPinLocked } = usePin();
  const faucetButtonRef = useRef<HTMLButtonElement | null>(null);
  const [balance, setBalance] = useState<Balance | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [injPrice, setInjPrice] = useState<number>(25);
  const [injPriceChange24h, setInjPriceChange24h] = useState<number>(0);
  const [usdtPriceChange24h, setUsdtPriceChange24h] = useState<number>(0);
  const [usdcPriceChange24h, setUsdcPriceChange24h] = useState<number>(0);
  const [balanceVisible, setBalanceVisible] = useState(true);
  const [copied, setCopied] = useState(false);
  const [ninjaBalance, setNinjaBalance] = useState(DEFAULT_NINJA_BALANCE);
  const [assetTab, setAssetTab] = useState<AssetTab>('tokens');
  const [assetSurfaceMode, setAssetSurfaceMode] = useState<AssetSurfaceMode>('assets');
  const [workspaceTab, setWorkspaceTab] = useState<DashboardWorkspaceTab>('discover');
  const [tokenBalances, setTokenBalances] = useState<Record<string, string>>({
    INJ: '0.0000',
    USDC: '0.00',
    NINJA: '0.00',
    USDT: '0.00',
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
  const [swapFromToken, setSwapFromToken] = useState<SwapToken>('INJ');
  const [swapToToken, setSwapToToken] = useState<SwapToken>('USDT');
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
  const [cardCenterActive, setCardCenterActive] = useState(false);
  const [showFaucetSheet, setShowFaucetSheet] = useState(false);
  const [faucetSheetActive, setFaucetSheetActive] = useState(false);
  const [flippedTokenCard, setFlippedTokenCard] = useState<string | null>(null);
  const [copiedTokenInfo, setCopiedTokenInfo] = useState<string | null>(null);
  const tokenFlipTimerRef = useRef<number | null>(null);
  const cardCenterTimerRef = useRef<number | null>(null);
  const faucetSheetTimerRef = useRef<number | null>(null);

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

  useEffect(() => {
    const walletAddress = address || undefined;
    const syncNinjaBalance = () => {
      setNinjaBalance(readStoredNinjaBalance(walletAddress));
    };

    syncNinjaBalance();

    const interval = window.setInterval(syncNinjaBalance, 1500);
    const handleStorage = (event: StorageEvent) => {
      if (!event.key || event.key === getNinjaStorageKey(walletAddress)) {
        syncNinjaBalance();
      }
    };

    window.addEventListener('storage', handleStorage);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener('storage', handleStorage);
    };
  }, [address]);

  useEffect(() => {
    if (tokenFlipTimerRef.current) {
      window.clearTimeout(tokenFlipTimerRef.current);
      tokenFlipTimerRef.current = null;
    }

    if (!flippedTokenCard) {
      return;
    }

    tokenFlipTimerRef.current = window.setTimeout(() => {
      setFlippedTokenCard((current) => (current === flippedTokenCard ? null : current));
      tokenFlipTimerRef.current = null;
    }, 5000);

    return () => {
      if (tokenFlipTimerRef.current) {
        window.clearTimeout(tokenFlipTimerRef.current);
        tokenFlipTimerRef.current = null;
      }
    };
  }, [flippedTokenCard]);

  useEffect(() => {
    return () => {
      if (cardCenterTimerRef.current) {
        window.clearTimeout(cardCenterTimerRef.current);
        cardCenterTimerRef.current = null;
      }
      if (faucetSheetTimerRef.current) {
        window.clearTimeout(faucetSheetTimerRef.current);
        faucetSheetTimerRef.current = null;
      }
    };
  }, []);

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
        USDC: parseFloat(tokenBalData.USDC).toFixed(2),
        NINJA: '0.00',
        USDT: parseFloat(tokenBalData.USDT).toFixed(2),
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
    { symbol: 'INJ' as const, name: 'Injective', icon: '/injswap.png', balance: tokenBalances.INJ, enabled: true },
    { symbol: 'USDT' as const, name: 'Tether', icon: '/USDT_Logo.png', balance: tokenBalances.USDT, enabled: true },
    { symbol: 'USDC' as const, name: 'USD Coin', icon: '/USDC_Logo.png', balance: tokenBalances.USDC, enabled: true },
    { symbol: 'NINJA' as const, name: 'Ninja', icon: '/NIJIA.png', balance: ninjaBalance.toFixed(2), enabled: false },
  ];
  const swapFromMeta = swapTokenOptions.find((token) => token.symbol === swapFromToken) || swapTokenOptions[0];
  const swapToMeta = swapTokenOptions.find((token) => token.symbol === swapToToken) || swapTokenOptions[1];
  const getAlternateSwapToken = (current: SwapToken) => (
    swapTokenOptions.find((token) => token.symbol !== current)?.symbol || 'INJ'
  );
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
    settings: {
      title: 'Wallet Settings',
      subtitle: 'Manage security, PIN, keys, and wallet preferences without leaving this card.',
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

    if (!swapFromMeta.enabled || !swapToMeta.enabled) {
      setSwapError('NINJA swap is coming soon.');
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
  }, [address, loadData, loadHistory, privateKey, resetTxAuth, swapAmount, swapFromMeta.balance, swapFromMeta.enabled, swapFromToken, swapSlippage, swapToMeta.enabled, swapToToken]);

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

    if (!swapFromMeta.enabled || !swapToMeta.enabled) {
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
  }, [swapAmount, swapFromMeta.enabled, swapFromToken, swapSlippage, swapToMeta.enabled, swapToToken, walletPanel]);

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

  const openCardCenter = () => {
    if (cardCenterTimerRef.current) {
      window.clearTimeout(cardCenterTimerRef.current);
      cardCenterTimerRef.current = null;
    }

    setShowCardCenter(true);
    setCardCenterActive(false);

    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        setCardCenterActive(true);
      });
    });
  };

  const closeCardCenter = () => {
    if (cardCenterTimerRef.current) {
      window.clearTimeout(cardCenterTimerRef.current);
      cardCenterTimerRef.current = null;
    }

    setCardCenterActive(false);
    cardCenterTimerRef.current = window.setTimeout(() => {
      setShowCardCenter(false);
      cardCenterTimerRef.current = null;
    }, 280);
  };

  const openFaucetSheet = () => {
    if (faucetSheetTimerRef.current) {
      window.clearTimeout(faucetSheetTimerRef.current);
      faucetSheetTimerRef.current = null;
    }

    setShowFaucetSheet(true);
    setFaucetSheetActive(false);

    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        setFaucetSheetActive(true);
      });
    });
  };

  const closeFaucetSheet = () => {
    if (faucetSheetTimerRef.current) {
      window.clearTimeout(faucetSheetTimerRef.current);
      faucetSheetTimerRef.current = null;
    }

    setFaucetSheetActive(false);
    faucetSheetTimerRef.current = window.setTimeout(() => {
      setShowFaucetSheet(false);
      faucetSheetTimerRef.current = null;
    }, 260);
  };

  const openAiAssetSurface = () => {
    setFlippedTokenCard(null);
    setAssetSurfaceMode((current) => (current === 'ai' ? 'assets' : 'ai'));
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
  const isAiStage = assetSurfaceMode === 'ai';
  const activeWalletPanelMeta = walletPanel !== 'overview' ? walletPanelMeta[walletPanel] : null;
  const formattedNinjaBalance = ninjaBalance.toFixed(2);
  const walletStageClassName = 'h-[540px] md:h-[520px]';
  const dashboardTokenCards = [
    {
      symbol: 'INJ',
      icon: '/injswap.png',
      balance: `${tokenBalances.INJ} INJ`,
      usdValue: `$${(parseFloat(tokenBalances.INJ) * injPrice).toFixed(2)}`,
      change: `${injPriceChange24h >= 0 ? '+' : ''}${injPriceChange24h.toFixed(2)}%`,
      changeClass: injPriceChange24h >= 0 ? 'text-green-400' : 'text-red-400',
      copyValue: TOKENS_MAINNET.WINJ.address,
      contractValue: truncateMiddle(TOKENS_MAINNET.WINJ.address, 8, 6),
    },
    {
      symbol: 'USDC',
      icon: '/USDC_Logo.png',
      balance: `${tokenBalances.USDC} USDC`,
      usdValue: `$${tokenBalances.USDC}`,
      change: `${usdcPriceChange24h >= 0 ? '+' : ''}${usdcPriceChange24h.toFixed(2)}%`,
      changeClass: usdcPriceChange24h >= 0 ? 'text-green-400' : 'text-red-400',
      copyValue: TOKENS_MAINNET.USDC.address,
      contractValue: truncateMiddle(TOKENS_MAINNET.USDC.address, 8, 6),
    },
    {
      symbol: 'NINJA',
      icon: '/NIJIA.png',
      balance: `${formattedNinjaBalance} NINJA`,
      usdValue: '$0.00',
      change: '+0.00%',
      changeClass: 'text-gray-500',
      copyValue: null,
      contractValue: 'No contract yet',
    },
    {
      symbol: 'USDT',
      icon: '/USDT_Logo.png',
      balance: `${tokenBalances.USDT} USDT`,
      usdValue: `$${tokenBalances.USDT}`,
      change: `${usdtPriceChange24h >= 0 ? '+' : ''}${usdtPriceChange24h.toFixed(2)}%`,
      changeClass: usdtPriceChange24h >= 0 ? 'text-green-400' : 'text-red-400',
      copyValue: TOKENS_MAINNET.USDT.address,
      contractValue: truncateMiddle(TOKENS_MAINNET.USDT.address, 8, 6),
    },
  ] as const;

  return (
    <LoadingSpinner ready={isDashboardReady}>
      {isDashboardReady ? (
        <>
        <div className="min-h-screen bg-black">
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
                <div className="text-sm font-bold text-white">Account 1</div>
                <div className="mt-1.5 flex items-center gap-1.5 whitespace-nowrap">
                  {address && (
                    <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 font-mono text-[10px] text-gray-400">
                      {formatAddress(address)}
                    </span>
                  )}
                  <button 
                    onClick={handleCopyAddress}
                    className="group flex h-6 w-6 items-center justify-center rounded-md border border-white/10 bg-white/[0.04] transition-all hover:bg-white/10"
                    title="Copy address"
                  >
                    {copied ? (
                      <svg className="h-3 w-3 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <svg className="h-3 w-3 text-gray-400 transition-colors group-hover:text-white" fill="none" stroke="currentColor" viewBox="0 0 16 16">
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
                onClick={openAiAssetSurface}
                className={`rounded-lg border px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.22em] transition-all ${
                  assetSurfaceMode === 'assets'
                    ? 'border-white/10 bg-white/5 text-gray-300 hover:border-violet-500/40 hover:bg-violet-600/15 hover:text-white'
                    : 'border-fuchsia-400/35 bg-[linear-gradient(135deg,rgba(139,92,246,0.24),rgba(59,130,246,0.14))] text-white shadow-[0_10px_30px_rgba(99,102,241,0.22)]'
                }`}
                title="Open AI workspace"
              >
                AI
              </button>
              <button
                ref={faucetButtonRef}
                onClick={openFaucetSheet}
                className="rounded-lg border border-white/10 bg-white/5 p-2.5 transition-all group hover:border-violet-500/40 hover:bg-violet-600/20"
                title="Testnet Faucet"
              >
                <svg
                  className="h-[18px] w-[18px] text-gray-400 transition-colors group-hover:text-violet-300"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M2 12h7" />
                  <path d="M9 9h5a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1H9V9z" />
                  <path d="M10 9V7M13 9V7" />
                  <path d="M15 10h2.5a3.5 3.5 0 1 1 0 7H15" />
                  <path d="M18 17.5a2.5 2.5 0 1 1-5 0c0-1.1 1.2-2.4 2.1-3.4.5-.5.8-.9.9-1.1.1.2.5.6.9 1.1.9 1 2.1 2.3 2.1 3.4Z" />
                </svg>
              </button>
              <button
                onClick={openCardCenter}
                className="rounded-lg border border-white/10 bg-white/5 p-2.5 transition-all hover:bg-white/10"
                title="Open Card Pay"
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

          <div
            className="grid gap-5 transition-[grid-template-columns] duration-500 xl:[grid-template-columns:var(--dashboard-columns)]"
            style={{
              ['--dashboard-columns' as string]: isAiStage
                ? 'minmax(232px,0.38fr) minmax(0,1.62fr)'
                : 'minmax(0,1.18fr) minmax(360px,0.82fr)',
            }}
          >
            <div className={`relative ${walletStageClassName}`}>
              <div
                className={`absolute inset-0 transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                  isAiStage
                    ? 'pointer-events-none -translate-x-6 scale-[0.96] opacity-0'
                    : 'translate-x-0 scale-100 opacity-100'
                }`}
              >
            {/* Total Balance Card - OKX Style */}
            <div className="bg-black rounded-2xl p-6 border border-white/10 relative overflow-hidden flex h-full flex-col">
              {/* Subtle gradient accent */}
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-green-500/5 to-transparent rounded-full blur-2xl"></div>
              
              <div className="relative flex flex-1 flex-col">
                {/* Header with Balance Label */}
                {isWalletOverview && (
                  <div className="mb-4 flex items-center justify-between">
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
                    <div className="flex items-center gap-1.5">
                      <button 
                        onClick={handleRefresh}
                        disabled={refreshing}
                        className="p-1 rounded hover:bg-white/5 transition-colors disabled:opacity-50"
                      >
                        <svg className={`w-4 h-4 text-gray-400 ${refreshing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                      </button>
                      <button
                        onClick={() => toggleWalletPanel('settings')}
                        className="rounded p-1 transition-colors hover:bg-white/5"
                        title="Open settings"
                      >
                        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                      </button>
                    </div>
                  </div>
                )}

                <div className="relative flex-1 min-h-0">
                  <div
                    className={`absolute inset-0 transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                      isWalletOverview
                        ? 'opacity-100 translate-y-0'
                        : 'opacity-0 translate-y-5 pointer-events-none'
                    }`}
                  >
                    <div className="flex h-full flex-col">
                      <div className="flex flex-col gap-6 xl:flex-row xl:items-end">
                        <div className="min-w-0 flex-1">
                          <div className="mb-5">
                            <div className="flex items-end gap-3 md:gap-4 flex-wrap">
                              <span className="text-4xl md:text-5xl font-bold text-white font-mono tracking-tight">
                                {balanceVisible ? <RollingBalanceNumber value={formattedBalance} /> : '••••••'}
                              </span>
                              <span className="text-xl font-semibold text-gray-400">INJ</span>
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

                      <div className="pointer-events-none relative flex flex-1 items-center justify-center">
                        <div className="absolute inset-x-12 top-1/2 h-40 -translate-y-1/2 rounded-full bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.07),transparent_70%)] blur-3xl" />
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
                    <div className="h-full flex flex-col overflow-hidden">
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

                      <div className={`min-h-0 flex-1 ${
                        walletPanel === 'settings'
                          ? 'overflow-hidden pr-0 pt-3'
                          : walletPanel === 'send' || walletPanel === 'swap' || walletPanel === 'history'
                            ? 'overflow-hidden pt-4'
                            : 'overflow-y-auto pt-4 pr-1'
                      }`}>
                        {walletPanel === 'send' && (
                          <div className="grid h-full gap-4 md:grid-cols-[minmax(0,1.12fr)_280px]">
                            <div className="flex min-h-0 flex-col gap-4">
                              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                                <div className="mb-2 flex items-center justify-between">
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
                                    className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400 transition-colors hover:text-white"
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

                              <div className="flex-1 rounded-2xl border border-white/10 bg-black/20 p-4">
                                <div className="mb-3 flex items-center justify-between">
                                  <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-500">Amount</span>
                                  <button
                                    onClick={() => {
                                      setSendAmount(tokenBalances.INJ);
                                      setSendError('');
                                    }}
                                    className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400 transition-colors hover:text-white"
                                  >
                                    Max
                                  </button>
                                </div>
                                <div className="flex h-full flex-col justify-between">
                                  <div className="flex items-end gap-3">
                                    <input
                                      value={sendAmount}
                                      onChange={(event) => {
                                        setSendAmount(event.target.value);
                                        setSendError('');
                                      }}
                                      inputMode="decimal"
                                      placeholder="0.0000"
                                      className="w-full bg-transparent text-3xl font-mono text-white placeholder:text-gray-600 outline-none md:text-[2.35rem]"
                                    />
                                    <span className="pb-1.5 text-sm font-semibold text-gray-400">INJ</span>
                                  </div>

                                  <div className="grid gap-3 pt-4 sm:grid-cols-2">
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
                                </div>
                              </div>

                              <div className="min-h-[56px]">
                                {sendError ? (
                                  <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                                    {sendError}
                                  </div>
                                ) : sendTxHash ? (
                                  <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3">
                                    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-200">Latest Transfer</div>
                                    <div className="mt-2 text-sm font-mono text-white">{truncateMiddle(sendTxHash, 10, 8)}</div>
                                  </div>
                                ) : (
                                  <div className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3 text-sm text-gray-500">
                                    Review the destination and amount, then confirm the transfer from this card.
                                  </div>
                                )}
                              </div>
                            </div>

                            <div className="flex min-h-0 flex-col rounded-2xl border border-white/10 bg-black/25 p-4">
                              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-500">Summary</div>
                              <div className="mt-4 space-y-3">
                                <div className="flex items-center justify-between gap-3 text-sm">
                                  <span className="text-gray-400">To</span>
                                  <span className="font-mono text-right text-white">{sendRecipient ? truncateMiddle(sendRecipient, 8, 6) : 'Not set'}</span>
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

                              <div className="mt-5 rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3">
                                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-500">Flow</div>
                                <div className="mt-3 space-y-2 text-sm text-gray-300">
                                  <p>1. Enter the recipient address.</p>
                                  <p>2. Set the amount you want to transfer.</p>
                                  <p>3. Confirm the transaction after review.</p>
                                </div>
                              </div>

                              <div className="mt-auto pt-4">
                                <button
                                  onClick={handleSendAction}
                                  disabled={sendSubmitting || !sendRecipient || !sendAmount}
                                  className="w-full rounded-2xl bg-white py-3.5 font-bold text-black transition-all hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40"
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
                          <div className="grid h-full min-h-0 gap-4 md:grid-cols-[minmax(0,1fr)_260px]">
                            <div className="grid h-full min-h-0 gap-4 md:grid-rows-[minmax(0,1.02fr)_minmax(0,0.98fr)]">
                              <div className="h-full rounded-2xl border border-white/10 bg-black/20 p-4">
                                <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-500">Pair</div>
                                <div className="grid h-[calc(100%-1.75rem)] gap-3 lg:grid-cols-[minmax(0,1fr)_52px_minmax(0,1fr)] lg:items-center">
                                  <div className="flex h-full flex-col justify-between rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                                    <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-500">From</div>
                                    <select
                                      value={swapFromToken}
                                      onChange={(event) => {
                                        const nextToken = event.target.value as SwapToken;
                                        setSwapFromToken(nextToken);
                                        if (nextToken === swapToToken) {
                                          setSwapToToken(getAlternateSwapToken(nextToken));
                                        }
                                        setSwapError('');
                                      }}
                                      className="w-full bg-transparent text-sm font-semibold text-white outline-none"
                                    >
                                      {swapTokenOptions.map((token) => (
                                        <option key={`from-${token.symbol}`} value={token.symbol} className="bg-[#0b0b0f] text-white">
                                          {token.symbol} · {token.name}
                                        </option>
                                      ))}
                                    </select>
                                    <div className="mt-3 flex items-center justify-between gap-3">
                                      <div className="flex items-center gap-2.5">
                                        <div className="relative h-9 w-9 overflow-hidden rounded-full border border-white/10 bg-white/5">
                                          <Image src={swapFromMeta.icon} alt={swapFromMeta.symbol} fill className="object-cover" />
                                        </div>
                                        <div>
                                          <div className="text-sm font-semibold text-white">{swapFromMeta.symbol}</div>
                                          <div className="text-xs text-gray-400">{swapFromMeta.name}</div>
                                        </div>
                                      </div>
                                      <div className="text-right">
                                        <div className="text-sm font-mono text-white">{swapFromMeta.balance}</div>
                                        <div className="text-[11px] text-gray-500">Available</div>
                                      </div>
                                    </div>
                                  </div>

                                  <div className="flex items-center justify-center">
                                    <div className="flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-white/[0.04]">
                                      <svg className="h-5 w-5 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h11m0 0-3-3m3 3-3 3M17 17H6m0 0 3 3m-3-3 3-3" />
                                      </svg>
                                    </div>
                                  </div>

                                  <div className="flex h-full flex-col justify-between rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                                    <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-500">To</div>
                                    <select
                                      value={swapToToken}
                                      onChange={(event) => {
                                        const nextToken = event.target.value as SwapToken;
                                        setSwapToToken(nextToken);
                                        if (nextToken === swapFromToken) {
                                          setSwapFromToken(getAlternateSwapToken(nextToken));
                                        }
                                        setSwapError('');
                                      }}
                                      className="w-full bg-transparent text-sm font-semibold text-white outline-none"
                                    >
                                      {swapTokenOptions.map((token) => (
                                        <option key={`to-${token.symbol}`} value={token.symbol} className="bg-[#0b0b0f] text-white">
                                          {token.symbol} · {token.name}
                                        </option>
                                      ))}
                                    </select>
                                    <div className="mt-3 flex items-center justify-between gap-3">
                                      <div className="flex items-center gap-2.5">
                                        <div className="relative h-9 w-9 overflow-hidden rounded-full border border-white/10 bg-white/5">
                                          <Image src={swapToMeta.icon} alt={swapToMeta.symbol} fill className="object-cover" />
                                        </div>
                                        <div>
                                          <div className="text-sm font-semibold text-white">{swapToMeta.symbol}</div>
                                          <div className="text-xs text-gray-400">{swapToMeta.name}</div>
                                        </div>
                                      </div>
                                      <div className="text-right">
                                        <div className="text-sm font-mono text-white">{swapToMeta.balance}</div>
                                        <div className="text-[11px] text-gray-500">Wallet</div>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>

                              <div className="flex h-full min-h-0 flex-col rounded-2xl border border-white/10 bg-black/20 p-4">
                                <div className="mb-3 flex items-center justify-between">
                                  <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-500">Swap Amount</span>
                                  <button
                                    onClick={() => {
                                      setSwapAmount(swapFromMeta.balance);
                                      setSwapError('');
                                    }}
                                    className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400 transition-colors hover:text-white"
                                  >
                                    Max
                                  </button>
                                </div>
                                <div className="flex h-full flex-1 flex-col justify-between">
                                  <div className="flex items-end gap-3">
                                    <input
                                      value={swapAmount}
                                      onChange={(event) => {
                                        setSwapAmount(event.target.value);
                                        setSwapError('');
                                      }}
                                      inputMode="decimal"
                                      placeholder="0.0000"
                                      className="w-full bg-transparent text-4xl font-mono text-white placeholder:text-gray-600 outline-none md:text-[2.7rem]"
                                    />
                                    <span className="pb-1.5 text-sm font-semibold text-gray-400">{swapFromToken}</span>
                                  </div>

                                  <div className="pt-4">
                                    <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-500">Slippage</div>
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
                                  </div>
                                </div>
                              </div>
                            </div>

                            <div className="flex h-full min-h-0 flex-col rounded-2xl border border-white/10 bg-black/25 p-4">
                              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-500">Quote</div>
                              <div className="mt-4 flex h-full flex-1 flex-col">
                                <div className="space-y-3">
                                  <div className="flex items-center justify-between gap-3 text-sm">
                                    <span className="text-gray-400">From</span>
                                    <span className="font-mono text-white">{swapAmount || '0.0000'} {swapFromToken}</span>
                                  </div>
                                  <div className="flex items-center justify-between gap-3 text-sm">
                                    <span className="text-gray-400">Expected Out</span>
                                    <span className="font-mono text-white">
                                      {!swapFromMeta.enabled || !swapToMeta.enabled
                                        ? 'Coming soon'
                                        : swapQuoteLoading
                                          ? 'Quoting...'
                                          : swapQuoteAmount
                                            ? `${Number(swapQuoteAmount).toFixed(4)} ${swapToToken}`
                                            : 'Awaiting input'}
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

                                <div className="mt-5 rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3">
                                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-500">Route</div>
                                  <div className="mt-3 space-y-2 text-sm text-gray-300">
                                    <p>Pair: {swapFromToken} → {swapToToken}</p>
                                    <p>Slippage: {swapSlippage}%</p>
                                    <p>Network: Injective EVM</p>
                                  </div>
                                </div>

                                <div className="mt-auto min-h-[88px]">
                                  {swapError ? (
                                    <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                                      {swapError}
                                    </div>
                                  ) : swapTxHash ? (
                                    <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3">
                                      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-200">Latest Swap</div>
                                      <div className="mt-2 text-sm font-mono text-white">{truncateMiddle(swapTxHash, 10, 8)}</div>
                                    </div>
                                  ) : (
                                    <div className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3 text-sm text-gray-500">
                                      Set the pair and amount, then review the quote before confirming the swap.
                                    </div>
                                  )}
                                </div>
                              </div>

                              <div className="mt-auto pt-4">
                                <button
                                  onClick={handleSwapAction}
                                  disabled={swapSubmitting || !swapAmount || swapFromToken === swapToToken || !swapFromMeta.enabled || !swapToMeta.enabled}
                                  className="w-full rounded-2xl bg-white py-3.5 font-bold text-black transition-all hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40"
                                >
                                  {swapSubmitting ? 'Swapping...' : !swapFromMeta.enabled || !swapToMeta.enabled ? 'NINJA Swap Coming Soon' : `Swap to ${swapToMeta.symbol}`}
                                </button>
                              </div>
                            </div>
                          </div>
                        )}

                        {walletPanel === 'history' && (
                          <div className="flex h-full min-h-0 flex-col">
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

                            <div className="mt-5 flex min-h-0 flex-1 flex-col">
                              {historyLoading ? (
                                <div className="flex flex-1 items-center justify-center">
                                  <div className="w-10 h-10 rounded-full border-4 border-white/10 border-t-white animate-spin" />
                                </div>
                              ) : filteredHistoryItems.length === 0 ? (
                                <div className="flex flex-1 items-center justify-center text-center text-sm text-gray-400">
                                  No transactions yet. Your recent wallet activity will appear here.
                                </div>
                              ) : (
                                <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1 scrollbar-hide">
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
                          </div>
                        )}

                        {walletPanel === 'settings' && (
                          <div className="h-full overflow-hidden rounded-[1.35rem] border border-white/10 bg-black/30">
                            <SettingsPage embeddedOverride />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {isWalletOverview && (
                <div className="mt-auto grid grid-cols-4 gap-4 pt-5">
                  {/* Send Button */}
                  <button 
                    onClick={() => toggleWalletPanel('send')}
                    className="flex flex-col items-center gap-2 group"
                  >
                    <div className="w-14 h-14 rounded-full flex items-center justify-center bg-white shadow-lg transition-all hover:bg-gray-100 group-hover:scale-105">
                      <svg className="w-5 h-5 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <line x1="12" y1="19" x2="12" y2="5" strokeWidth={2.5} strokeLinecap="round" />
                        <polyline points="5 12 12 5 19 12" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                    <span className="text-xs font-semibold text-gray-300 transition-colors group-hover:text-white">Send</span>
                  </button>

                  {/* Receive Button */}
                  <button 
                    onClick={() => toggleWalletPanel('receive')}
                    className="flex flex-col items-center gap-2 group"
                  >
                    <div className="w-14 h-14 rounded-full flex items-center justify-center bg-white shadow-lg transition-all hover:bg-gray-100 group-hover:scale-105">
                      <svg className="w-5 h-5 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <line x1="12" y1="5" x2="12" y2="19" strokeWidth={2.5} strokeLinecap="round" />
                        <polyline points="19 12 12 19 5 12" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                    <span className="text-xs font-semibold text-gray-300 transition-colors group-hover:text-white">Receive</span>
                  </button>

                  {/* Swap Button */}
                  <button 
                    onClick={() => toggleWalletPanel('swap')}
                    className="flex flex-col items-center gap-2 group"
                  >
                    <div className="w-14 h-14 rounded-full flex items-center justify-center bg-white shadow-lg transition-all hover:bg-gray-100 group-hover:scale-105">
                      <svg className="w-5 h-5 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <polyline points="16 3 21 3 21 8" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
                        <line x1="4" y1="20" x2="21" y2="3" strokeWidth={2.5} strokeLinecap="round" />
                        <polyline points="21 16 21 21 16 21" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
                        <line x1="15" y1="15" x2="21" y2="21" strokeWidth={2.5} strokeLinecap="round" />
                        <line x1="4" y1="4" x2="9" y2="9" strokeWidth={2.5} strokeLinecap="round" />
                      </svg>
                    </div>
                    <span className="text-xs font-semibold text-gray-300 transition-colors group-hover:text-white">Swap</span>
                  </button>

                  {/* History Button */}
                  <button 
                    onClick={() => toggleWalletPanel('history')}
                    className="flex flex-col items-center gap-2 group"
                  >
                    <div className="w-14 h-14 rounded-full flex items-center justify-center bg-white shadow-lg transition-all hover:bg-gray-100 group-hover:scale-105">
                      <svg className="w-5 h-5 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <circle cx="12" cy="12" r="10" strokeWidth={2.5} strokeLinecap="round" />
                        <polyline points="12 6 12 12 16 14" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                    <span className="text-xs font-semibold text-gray-300 transition-colors group-hover:text-white">History</span>
                  </button>
                </div>
                )}
              </div>
            </div>
              </div>

              <div
                className={`absolute inset-0 transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                  isAiStage
                    ? 'translate-x-0 scale-100 opacity-100'
                    : 'pointer-events-none translate-x-[calc(100%+1.25rem)] scale-[0.94] opacity-0'
                }`}
              >
                <div className="bg-black rounded-2xl border border-white/10 relative overflow-hidden p-4 sm:p-5 h-full flex flex-col">
                  <div className="absolute bottom-0 left-0 w-32 h-32 rounded-full bg-gradient-to-tr from-cyan-500/5 to-transparent blur-2xl" />
                  <div className="relative flex min-h-0 flex-1 flex-col">
                    <div className="mb-4">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-gray-500">Assets</div>
                    </div>

                    <div className="space-y-3">
                      {dashboardTokenCards.map((token) => (
                        <div
                          key={`compact-${token.symbol}`}
                          className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3"
                          >
                          <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-white/[0.04]">
                            <Image
                              src={token.icon}
                              alt={token.symbol}
                              width={40}
                              height={40}
                              className="h-full w-full object-contain"
                            />
                          </div>
                          <div className="min-w-0 flex-1 text-[13px] font-mono text-gray-300">{token.balance}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className={`relative ${walletStageClassName}`}>
              <div
                className={`absolute inset-0 transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                  isAiStage
                    ? 'pointer-events-none translate-x-10 scale-[0.96] opacity-0'
                    : 'translate-x-0 scale-100 opacity-100'
                }`}
              >
            <div className="bg-black rounded-2xl border border-white/10 relative overflow-hidden p-4 sm:p-5 h-full flex flex-col">
              <div className="absolute bottom-0 left-0 w-32 h-32 bg-gradient-to-tr from-cyan-500/5 to-transparent rounded-full blur-2xl"></div>
              <div className="relative flex flex-1 flex-col">
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
        <div className="min-h-0 flex-1 overflow-y-auto pr-1">
          {assetTab === 'tokens' && (
            <div className="space-y-3">
              {dashboardTokenCards.map((token) => (
                <div key={token.symbol} className="relative" style={{ perspective: '1400px' }}>
                  <div
                    onClick={() => setFlippedTokenCard((current) => (current === token.symbol ? null : token.symbol))}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        setFlippedTokenCard((current) => (current === token.symbol ? null : token.symbol));
                      }
                    }}
                    className="relative h-[84px] w-full cursor-pointer text-left"
                    role="button"
                    tabIndex={0}
                    style={{ transformStyle: 'preserve-3d' }}
                  >
                    <div
                      className={`absolute inset-0 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 transition-all duration-500 [backface-visibility:hidden] ${
                        flippedTokenCard === token.symbol ? 'pointer-events-none invisible z-0 opacity-0' : 'visible z-10 opacity-100'
                      }`}
                      style={{
                        transform: flippedTokenCard === token.symbol ? 'rotateY(180deg)' : 'rotateY(0deg)',
                        backfaceVisibility: 'hidden',
                        WebkitBackfaceVisibility: 'hidden',
                      }}
                    >
                      <div className="flex h-full items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full">
                          <Image
                            src={token.icon}
                            alt={token.symbol}
                            width={40}
                            height={40}
                            className="h-full w-full object-contain"
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="mb-0.5 flex items-center gap-1.5">
                            <div className="font-bold">{token.symbol}</div>
                            <span className="text-[9px] uppercase tracking-[0.16em] text-gray-500">Tap for info</span>
                          </div>
                          <div className="text-[13px] text-gray-400">{token.balance}</div>
                        </div>
                        <div className="text-right">
                          <div className="font-bold font-mono text-[13px]">{token.usdValue}</div>
                          <div className={`text-[13px] ${token.changeClass}`}>{token.change}</div>
                        </div>
                      </div>
                    </div>

                    <div
                      className={`absolute inset-0 rounded-2xl border border-white/10 bg-[linear-gradient(180deg,rgba(8,10,18,0.98),rgba(10,13,20,0.96))] px-4 py-3 transition-all duration-500 ${
                        flippedTokenCard === token.symbol ? 'visible z-20 opacity-100' : 'pointer-events-none invisible z-0 opacity-0'
                      }`}
                      style={{
                        transform: flippedTokenCard === token.symbol ? 'rotateY(0deg)' : 'rotateY(-180deg)',
                        transformStyle: 'preserve-3d',
                        backfaceVisibility: 'hidden',
                        WebkitBackfaceVisibility: 'hidden',
                      }}
                    >
                      <div className="flex h-full items-center gap-3">
                        <div className="rounded-full border border-white/10 bg-white/[0.05] px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-white">
                            {token.symbol}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="mb-0.5 uppercase tracking-[0.14em] text-[9px] text-gray-500">Contract</div>
                          <div className="truncate font-mono text-[13px] text-white">
                            {token.contractValue}
                          </div>
                        </div>
                          {token.copyValue && (
                            <button
                              onClick={(event) => {
                                event.stopPropagation();
                                navigator.clipboard.writeText(token.copyValue);
                                setCopiedTokenInfo(token.symbol);
                                setTimeout(() => {
                                  setCopiedTokenInfo((current) => (current === token.symbol ? null : current));
                                }, 1600);
                              }}
                              className={`rounded-lg border px-2 py-1 text-[10px] font-semibold transition-all ${
                                copiedTokenInfo === token.symbol
                                  ? 'border-emerald-400/30 bg-emerald-500/10 text-emerald-300'
                                  : 'border-white/10 bg-white/5 text-white hover:bg-white/10'
                              }`}
                            >
                              {copiedTokenInfo === token.symbol ? 'Copied' : 'Copy'}
                            </button>
                          )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {assetTab === 'nfts' && (
            <div className="space-y-3">
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
            </div>
          )}

          {assetTab === 'defi' && (
            <div className="space-y-3">
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
            </div>
          )}

          {assetTab === 'earn' && (
            <div className="flex h-full items-start justify-center">
              <div className="h-full w-full max-w-[760px] overflow-hidden rounded-[30px] border border-white/8 bg-black/20 p-2">
                <div className="h-full overflow-y-auto rounded-[26px]">
                <NinjaMinerGame walletAddress={address} />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
            </div>
              </div>

              <div
                className={`absolute inset-0 transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                  isAiStage
                    ? 'translate-x-0 scale-100 opacity-100'
                    : 'pointer-events-none translate-x-10 scale-[0.98] opacity-0'
                }`}
              >
                <div className="bg-black rounded-2xl relative overflow-hidden h-full">
                  <div className="absolute bottom-0 right-0 h-32 w-32 rounded-full bg-gradient-to-tl from-fuchsia-500/10 to-transparent blur-2xl" />
                  <div className="absolute top-0 left-0 h-32 w-32 rounded-full bg-gradient-to-br from-cyan-500/8 to-transparent blur-2xl" />
                  <div className="relative h-full overflow-hidden">
                    <DashboardSurfaceFrame
                      src="/agents?embed=1&compact=1"
                      title="Embedded asset agent"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="mt-6">
            <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-black p-4 sm:p-5">
              <div className="absolute bottom-0 left-0 h-32 w-32 rounded-full bg-gradient-to-tr from-cyan-500/5 to-transparent blur-2xl" />
              <div className="absolute top-0 right-0 h-32 w-32 rounded-full bg-gradient-to-bl from-violet-500/5 to-transparent blur-2xl" />

              <div className="relative">
                <div className="mb-5 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div className="min-w-0">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-gray-500">Workspace</div>
                    <div className="mt-1 text-lg font-bold text-white">
                      {workspaceTab === 'discover' ? 'Explore dApps' : 'Wallet copilots'}
                    </div>
                    <div className="mt-1 text-sm text-gray-400">
                      {workspaceTab === 'discover'
                        ? 'Browse Injective apps in a horizontal rail without leaving this workspace.'
                        : 'Conversations, invite flows, and agent controls stay in this same dashboard stage.'}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-start rounded-full border border-white/10 bg-white/[0.03] p-1">
                    {([
                      { id: 'discover', label: 'Discover' },
                      { id: 'agent', label: 'Agent' },
                    ] as const).map((tab) => (
                      <button
                        key={tab.id}
                        onClick={() => setWorkspaceTab(tab.id)}
                        className={`rounded-full px-4 py-2 text-xs font-semibold transition-all ${
                          workspaceTab === tab.id
                            ? 'bg-white text-black shadow-[0_10px_24px_rgba(255,255,255,0.18)]'
                            : 'text-gray-400 hover:bg-white/10 hover:text-white'
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="overflow-hidden rounded-[1.5rem] border border-white/10 bg-black/30">
                  <div className="h-[760px] overflow-hidden rounded-[1.35rem] bg-black">
                    <DashboardSurfaceFrame
                      src={workspaceTab === 'discover' ? '/discover?embed=1' : '/agents?embed=1'}
                      title={workspaceTab === 'discover' ? 'Embedded discover' : 'Embedded agents'}
                    />
                  </div>
                </div>
              </div>
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
        isActive={cardCenterActive}
        onClose={closeCardCenter}
        onUseCardAddress={(nextAddress) => {
          closeCardCenter();
          setWalletPanel('send');
          setSendRecipient(nextAddress);
          setSendError('');
        }}
      />

      {showFaucetSheet && (
        <div
          className={`fixed inset-0 z-[120] bg-black/18 backdrop-blur-[2px] transition-opacity duration-200 ${
            faucetSheetActive ? 'opacity-100' : 'opacity-0'
          }`}
          onClick={closeFaucetSheet}
        >
          <div
            className={`absolute flex flex-col overflow-hidden rounded-[2rem] border border-white/10 bg-black/95 shadow-[0_26px_90px_rgba(0,0,0,0.42)] transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] origin-top ${
              faucetSheetActive
                ? 'translate-y-0 scale-100 opacity-100'
                : '-translate-y-3 scale-[0.96] opacity-0'
            }`}
            style={getFaucetPopoverStyle(faucetButtonRef.current)}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 px-4 py-4">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-gray-500">Faucet</div>
                <div className="mt-1 text-base font-bold text-white">Testnet faucet</div>
              </div>
              <button
                onClick={closeFaucetSheet}
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 transition-all hover:bg-white/10"
                title="Close faucet"
              >
                <svg className="h-4 w-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="min-h-0 flex-1 px-4 pb-4">
              <div className="h-full overflow-hidden rounded-[1.75rem] border border-white/10 bg-black/70">
                <div className="h-full overflow-hidden rounded-[1.55rem] bg-black">
                  <DashboardSurfaceFrame src="/faucet?embed=1" title="Embedded faucet" />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

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

        </>
      ) : null}
    </LoadingSpinner>
  );
}
