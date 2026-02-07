/**
 * Wallet context for global state management
 */

'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { LocalKeystore } from '@/types/wallet';
import { loadWallet, hasWallet, deleteWallet } from '@/wallet/keystore';
import { getSessionToken, unlockWithSessionToken, clearSessionToken } from '@/services/session';

interface WalletContextType {
  isUnlocked: boolean;
  address: string | null;
  keystore: LocalKeystore | null;
  privateKey: Uint8Array | null;
  unlock: (pk: Uint8Array, ks: LocalKeystore) => void;
  lock: () => void;
  checkExistingWallet: () => boolean;
  isInitializing: boolean; // Track initialization state
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export function WalletProvider({ children }: { children: ReactNode }) {
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [address, setAddress] = useState<string | null>(null);
  const [keystore, setKeystore] = useState<LocalKeystore | null>(null);
  const [privateKey, setPrivateKey] = useState<Uint8Array | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);

  // Check for existing wallet and session on mount
  useEffect(() => {
    const initWallet = async () => {
      try {
        const existing = loadWallet();
        if (existing) {
          setKeystore(existing);
          setAddress(existing.address);

          // Try to auto-unlock with session token
          const sessionData = await unlockWithSessionToken();
          if (sessionData) {
            setPrivateKey(sessionData.privateKey);
            setIsUnlocked(true);
            console.log('Auto-unlocked with session token');
          }
        }
      } catch (error) {
        console.error('Failed to initialize wallet:', error);
      } finally {
        setIsInitializing(false);
      }
    };

    initWallet();
  }, []);

  const unlock = (pk: Uint8Array, ks: LocalKeystore) => {
    setPrivateKey(pk);
    setKeystore(ks);
    setAddress(ks.address);
    setIsUnlocked(true);
  };

  const lock = () => {
    setPrivateKey(null);
    setIsUnlocked(false);
    clearSessionToken(); // Clear session when locking
  };

  const checkExistingWallet = () => {
    return hasWallet();
  };

  return (
    <WalletContext.Provider
      value={{
        isUnlocked,
        address,
        keystore,
        privateKey,
        unlock,
        lock,
        checkExistingWallet,
        isInitializing,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error('useWallet must be used within WalletProvider');
  }
  return context;
}
