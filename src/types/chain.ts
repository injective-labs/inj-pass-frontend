/**
 * Chain configuration types
 */

import type { Chain } from 'viem';

import { NETWORK_CONFIG } from '@/config/network';

export interface ChainConfig {
  id: number;
  name: string;
  rpcUrl: string;
  explorerUrl: string;
  explorerApiUrl: string; // Blockscout API base URL (separate from frontend)
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
}

export interface TransactionRequest {
  to: string;
  value?: bigint;
  data?: `0x${string}`;
  gasLimit?: bigint;
  maxFeePerGas?: bigint;
  maxPriorityFeePerGas?: bigint;
}

export interface TransactionReceipt {
  hash: string;
  from: string;
  to: string | null;
  value: bigint;
  gasUsed: bigint;
  effectiveGasPrice: bigint;
  blockNumber: bigint;
  blockHash: string;
  status: 'success' | 'reverted';
  timestamp?: number;
}

export interface TransactionHistory {
  hash: string;
  from: string;
  to: string | null;
  value: string; // Wei as string
  timestamp: number;
  blockNumber: number;
  status: 'pending' | 'success' | 'failed';
  gasUsed?: string;
  gasPrice?: string;
}

export interface Balance {
  value: bigint;
  formatted: string;
  decimals: number;
  symbol: string;
}

export interface GasEstimate {
  gasLimit: bigint;
  maxFeePerGas: bigint;
  maxPriorityFeePerGas: bigint;
  totalCost: bigint; // in wei
}

// Injective EVM Testnet
export const INJECTIVE_TESTNET: ChainConfig = {
  id: NETWORK_CONFIG.testnet.chainId,
  name: NETWORK_CONFIG.testnet.name,
  rpcUrl: NETWORK_CONFIG.testnet.rpcUrl,
  explorerUrl: NETWORK_CONFIG.testnet.explorerUrl,
  explorerApiUrl: NETWORK_CONFIG.testnet.explorerApiUrl,
  nativeCurrency: {
    name: 'Injective',
    symbol: 'INJ',
    decimals: 18,
  },
};

// Injective EVM Mainnet - CORRECT Configuration
export const INJECTIVE_MAINNET: ChainConfig = {
  id: NETWORK_CONFIG.mainnet.chainId,
  name: NETWORK_CONFIG.mainnet.name,
  rpcUrl: NETWORK_CONFIG.mainnet.rpcUrl,
  explorerUrl: NETWORK_CONFIG.mainnet.explorerUrl,
  explorerApiUrl: NETWORK_CONFIG.mainnet.explorerApiUrl,
  nativeCurrency: {
    name: 'Injective',
    symbol: 'INJ',
    decimals: 18,
  },
};

// Viem-compatible Chain configs for DEX swap - MAINNET (CORRECT)
export const INJECTIVE_MAINNET_CHAIN: Chain = {
  id: NETWORK_CONFIG.mainnet.chainId,
  name: NETWORK_CONFIG.mainnet.name,
  nativeCurrency: {
    name: 'Injective',
    symbol: 'INJ',
    decimals: 18,
  },
  rpcUrls: {
    default: { 
      http: [NETWORK_CONFIG.mainnet.rpcUrl]
    },
  },
  blockExplorers: {
    default: { 
      name: 'Blockscout', 
      url: NETWORK_CONFIG.mainnet.explorerUrl 
    },
  },
};

export const INJECTIVE_TESTNET_CHAIN: Chain = {
  id: NETWORK_CONFIG.testnet.chainId,
  name: NETWORK_CONFIG.testnet.name,
  nativeCurrency: {
    name: 'Injective',
    symbol: 'INJ',
    decimals: 18,
  },
  rpcUrls: {
    default: { 
      http: [NETWORK_CONFIG.testnet.rpcUrl]
    },
  },
  blockExplorers: {
    default: { 
      name: 'Blockscout', 
      url: NETWORK_CONFIG.testnet.explorerUrl 
    },
  },
};

// Default chain - USE MAINNET
export const DEFAULT_CHAIN = INJECTIVE_MAINNET;
