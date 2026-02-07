/**
 * Custom hook for session management
 * Handles automatic session token refresh and expiration
 */

'use client';

import { useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useWallet } from '@/contexts/WalletContext';
import { getSessionToken, clearSessionToken } from '@/services/session';

const SESSION_CHECK_INTERVAL = 60 * 1000; // Check every 1 minute

export function useSessionManager() {
  const router = useRouter();
  const { isUnlocked, lock } = useWallet();

  const checkSession = useCallback(() => {
    // Only check if user is unlocked
    if (!isUnlocked) {
      return;
    }

    const sessionData = getSessionToken();
    
    if (!sessionData) {
      // Session expired or doesn't exist
      console.log('Session expired, locking wallet');
      lock();
      router.push('/unlock');
    }
  }, [isUnlocked, lock, router]);

  useEffect(() => {
    // Check session immediately
    checkSession();

    // Set up periodic check
    const interval = setInterval(checkSession, SESSION_CHECK_INTERVAL);

    return () => {
      clearInterval(interval);
    };
  }, [checkSession]);

  return {
    checkSession,
  };
}
