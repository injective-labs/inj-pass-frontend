/**
 * Wallet context for global state management
 */

'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { LocalKeystore } from '@/types/wallet';
import { loadWallet, hasWallet, deleteWallet } from '@/wallet/keystore';
import { hasValidSession, autoRefreshToken, logout as logoutService } from '@/services/passkey';

interface WalletContextType {
  isUnlocked: boolean;
  address: string | null;
  keystore: LocalKeystore | null;
  privateKey: Uint8Array | null;
  isCheckingSession: boolean;
  unlock: (pk: Uint8Array, ks: LocalKeystore) => void;
  lock: () => void;
  logout: () => Promise<void>;
  checkExistingWallet: () => boolean;
  hasValidToken: () => Promise<boolean>;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export function WalletProvider({ children }: { children: ReactNode }) {
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [address, setAddress] = useState<string | null>(null);
  const [keystore, setKeystore] = useState<LocalKeystore | null>(null);
  const [privateKey, setPrivateKey] = useState<Uint8Array | null>(null);
  const [isCheckingSession, setIsCheckingSession] = useState(true);

  // Check for existing wallet and valid session on mount
  useEffect(() => {
    const checkSession = async () => {
      try {
        console.log('[WalletContext] Checking session on mount...');
        // First, check if there's a wallet keystore
        const existing = loadWallet();
        console.log('[WalletContext] Existing wallet:', existing ? 'Found' : 'Not found');
        if (existing) {
          setKeystore(existing);
          setAddress(existing.address);

          // Check if there's a valid session token
          console.log('[WalletContext] Checking for valid session token...');
          const hasValidToken = await hasValidSession();
          console.log('[WalletContext] Has valid token:', hasValidToken);
          if (hasValidToken) {
            console.log('[WalletContext] Token is valid, setting isUnlocked to true');
            setIsUnlocked(true);
            // Auto-refresh token if needed
            await autoRefreshToken();
          } else {
            console.log('[WalletContext] No valid token found');
          }
        }
      } catch (error) {
        console.error('[WalletContext] Error checking session:', error);
      } finally {
        setIsCheckingSession(false);
        console.log('[WalletContext] Session check complete');
      }
    };

    checkSession();
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
  };

  const logout = async () => {
    await logoutService();
    setPrivateKey(null);
    setIsUnlocked(false);
  };

  const checkExistingWallet = () => {
    return hasWallet();
  };

  const hasValidToken = async () => {
    return await hasValidSession();
  };

  return (
    <WalletContext.Provider
      value={{
        isUnlocked,
        address,
        keystore,
        privateKey,
        isCheckingSession,
        unlock,
        lock,
        logout,
        checkExistingWallet,
        hasValidToken,
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
