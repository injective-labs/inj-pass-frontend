/**
 * Faucet network configurations
 *
 * INJ  : 0.1 per account per day (Injective Testnet)
 * ETH  : 0.02 per account per day — user picks exactly ONE companion chain
 *
 * @author Alex <jsxj81@163.com>
 */

export interface FaucetNetwork {
  id: string;
  name: string;
  chainName: string;
  rpcUrl: string;
  chainId: number;
  /** Human-readable amount to distribute (e.g. "0.02") */
  amount: string;
  symbol: string;
  /** Hex color for UI badges */
  color: string;
  /** Whether this is the always-included INJ chain */
  isBase: boolean;
  explorerUrl: string;
}

export const FAUCET_NETWORKS: FaucetNetwork[] = [
  {
    id: 'injective',
    name: 'INJ',
    chainName: 'Injective Testnet',
    rpcUrl: 'https://k8s.testnet.json-rpc.injective.network/',
    chainId: 1439,
    amount: '0.1',
    symbol: 'INJ',
    color: '#00B2FF',
    isBase: true,
    explorerUrl: 'https://testnet.blockscout.injective.network/tx/',
  },
  {
    id: 'sepolia',
    name: 'Sepolia',
    chainName: 'Ethereum Sepolia',
    rpcUrl: 'https://rpc.sepolia.org',
    chainId: 11155111,
    amount: '0.02',
    symbol: 'ETH',
    color: '#627EEA',
    isBase: false,
    explorerUrl: 'https://sepolia.etherscan.io/tx/',
  },
  {
    id: 'arbitrum',
    name: 'Arbitrum',
    chainName: 'Arbitrum Sepolia',
    rpcUrl: 'https://sepolia-rollup.arbitrum.io/rpc',
    chainId: 421614,
    amount: '0.02',
    symbol: 'ETH',
    color: '#28A0F0',
    isBase: false,
    explorerUrl: 'https://sepolia.arbiscan.io/tx/',
  },
  {
    id: 'optimism',
    name: 'Optimism',
    chainName: 'Optimism Sepolia',
    rpcUrl: 'https://sepolia.optimism.io',
    chainId: 11155420,
    amount: '0.02',
    symbol: 'ETH',
    color: '#FF0420',
    isBase: false,
    explorerUrl: 'https://sepolia-optimism.etherscan.io/tx/',
  },
  {
    id: 'base',
    name: 'Base',
    chainName: 'Base Sepolia',
    rpcUrl: 'https://sepolia.base.org',
    chainId: 84532,
    amount: '0.02',
    symbol: 'ETH',
    color: '#0052FF',
    isBase: false,
    explorerUrl: 'https://sepolia.basescan.org/tx/',
  },
  {
    id: 'polygonzkevm',
    name: 'Polygon zkEVM',
    chainName: 'Polygon zkEVM Testnet',
    rpcUrl: 'https://rpc.cardona.zkevm-rpc.com',
    chainId: 2442,
    amount: '0.02',
    symbol: 'ETH',
    color: '#8247E5',
    isBase: false,
    explorerUrl: 'https://cardona-zkevm.polygonscan.com/tx/',
  },
];

export const INJ_NETWORK = FAUCET_NETWORKS.find((n) => n.isBase)!;
export const COMPANION_NETWORKS = FAUCET_NETWORKS.filter((n) => !n.isBase);
