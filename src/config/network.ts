/**
 * Global Network and API Configuration
 */

export const NETWORK_CONFIG = {
  // Chain Selection (can be switched via environment variable)
  isMainnet: process.env.NEXT_PUBLIC_NETWORK !== 'testnet',

  mainnet: {
    name: 'Injective EVM',
    chainId: 1776,
    cosmosChainId: 'injective-1',
    rpcUrl: 'https://sentry.evm-rpc.injective.network/',
    explorerUrl: 'https://blockscout.injective.network',
    explorerApiUrl: 'https://blockscout-api.injective.network',
    cosmosExplorerUrl: 'https://explorer.injective.network',
    lcdUrl: 'https://lcd.injective.network',
    bridgeUrl: 'https://bridge.injective.network/',
  },

  testnet: {
    name: 'Injective EVM Testnet',
    chainId: 1439,
    cosmosChainId: 'injective-888',
    rpcUrl: 'https://k8s.testnet.json-rpc.injective.network/',
    explorerUrl: 'https://testnet.blockscout.injective.network',
    explorerApiUrl: 'https://testnet.blockscout-api.injective.network',
    cosmosExplorerUrl: 'https://testnet.explorer.injective.network',
    lcdUrl: 'https://testnet.lcd.injective.network',
    bridgeUrl: 'https://bridge.injective.network/', // Testnet bridge might be different if needed
  },

  // Backend API
  backendUrl: process.env.NEXT_PUBLIC_BACKEND_URL,
  
  // External APIs
  coingeckoApi: 'https://api.coingecko.com/api/v3',
  ipfsGateway: 'https://ipfs.io/ipfs/',
  faviconService: 'https://www.google.com/s2/favicons?domain=',
};

// Current active configuration based on environment
export const ACTIVE_NETWORK = NETWORK_CONFIG.isMainnet 
  ? NETWORK_CONFIG.mainnet 
  : NETWORK_CONFIG.testnet;
