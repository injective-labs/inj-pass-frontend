import { LocalKeystore } from '@/types/wallet';

const STORAGE_KEY = 'injective-pass-wallet';

/**
 * Save wallet to localStorage
 */
export function saveWallet(keystore: LocalKeystore): void {
  try {
    const data = JSON.stringify(keystore);
    localStorage.setItem(STORAGE_KEY, data);
  } catch (error) {
    throw new Error(`Failed to save wallet: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Load wallet from localStorage
 */
export function loadWallet(): LocalKeystore | null {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) {
      return null;
    }
    return JSON.parse(data) as LocalKeystore;
  } catch (error) {
    console.error('Failed to load wallet:', error);
    return null;
  }
}

/**
 * Check if wallet exists in localStorage
 */
export function hasWallet(): boolean {
  return localStorage.getItem(STORAGE_KEY) !== null;
}

/**
 * Delete wallet from localStorage
 */
export function deleteWallet(): void {
  localStorage.removeItem(STORAGE_KEY);
}

/**
 * Get wallet address without loading full keystore
 */
export function getWalletAddress(): string | null {
  const wallet = loadWallet();
  return wallet?.address || null;
}

/**
 * Get wallet source without loading full keystore
 */
export function getWalletSource(): LocalKeystore['source'] | null {
  const wallet = loadWallet();
  return wallet?.source || null;
}
