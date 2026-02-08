'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';

interface PinContextType {
  hasPin: boolean;
  isPinLocked: boolean;
  autoLockMinutes: number; // PIN-free time window (in minutes)
  setPin: (pin: string) => Promise<void>;
  verifyPin: (pin: string) => Promise<boolean>;
  changePin: (oldPin: string, newPin: string) => Promise<boolean>;
  lockWallet: () => void;
  unlockWallet: (pin: string) => Promise<boolean>;
  setAutoLockMinutes: (minutes: number) => void; // Sets PIN-free time window
  resetActivity: () => void;
}

const PinContext = createContext<PinContextType | undefined>(undefined);

const PIN_STORAGE_KEY = 'wallet_pin_hash';
const AUTO_LOCK_KEY = 'auto_lock_minutes';
const LAST_ACTIVITY_KEY = 'last_activity';

// Simple hash function for PIN (in production, use bcrypt or similar)
async function hashPin(pin: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(pin + 'injective_wallet_salt');
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export function PinProvider({ children }: { children: ReactNode }) {
  const [hasPin, setHasPin] = useState(false);
  const [isPinLocked, setIsPinLocked] = useState(false);
  const [autoLockMinutes, setAutoLockMinutesState] = useState(5); // Default: 5 minutes PIN-free window
  const [lastActivity, setLastActivity] = useState<number>(Date.now());

  // Initialize from localStorage
  useEffect(() => {
    const storedPin = localStorage.getItem(PIN_STORAGE_KEY);
    const storedAutoLock = localStorage.getItem(AUTO_LOCK_KEY);
    const storedLastActivity = localStorage.getItem(LAST_ACTIVITY_KEY);

    if (storedPin) {
      setHasPin(true);
      
      // Check if wallet should be locked based on auto-lock time
      if (storedLastActivity && storedAutoLock && parseInt(storedAutoLock, 10) > 0) {
        const lastActivityTime = parseInt(storedLastActivity, 10);
        const autoLockMs = parseInt(storedAutoLock, 10) * 60 * 1000;
        const timeSinceLastActivity = Date.now() - lastActivityTime;
        
        if (timeSinceLastActivity > autoLockMs) {
          setIsPinLocked(true);
        }
      } else if (!storedAutoLock || parseInt(storedAutoLock, 10) === 0) {
        // If no auto-lock or disabled, don't lock on startup
        setIsPinLocked(false);
      }
    }

    if (storedAutoLock) {
      setAutoLockMinutesState(parseInt(storedAutoLock, 10));
    }
  }, []);

  // Auto-lock timer
  useEffect(() => {
    if (!hasPin || isPinLocked || autoLockMinutes === 0) return;

    const checkInterval = setInterval(() => {
      const storedLastActivity = localStorage.getItem(LAST_ACTIVITY_KEY);
      if (storedLastActivity) {
        const lastActivityTime = parseInt(storedLastActivity, 10);
        const autoLockMs = autoLockMinutes * 60 * 1000;
        const timeSinceLastActivity = Date.now() - lastActivityTime;
        
        if (timeSinceLastActivity > autoLockMs) {
          setIsPinLocked(true);
        }
      }
    }, 10000); // Check every 10 seconds

    return () => clearInterval(checkInterval);
  }, [hasPin, isPinLocked, autoLockMinutes]);

  const resetActivity = useCallback(() => {
    const now = Date.now();
    setLastActivity(now);
    localStorage.setItem(LAST_ACTIVITY_KEY, now.toString());
  }, []);

  // Reset activity on user interaction
  useEffect(() => {
    if (!isPinLocked && hasPin) {
      const handleActivity = () => resetActivity();
      
      window.addEventListener('mousedown', handleActivity);
      window.addEventListener('keydown', handleActivity);
      window.addEventListener('touchstart', handleActivity);
      
      return () => {
        window.removeEventListener('mousedown', handleActivity);
        window.removeEventListener('keydown', handleActivity);
        window.removeEventListener('touchstart', handleActivity);
      };
    }
  }, [isPinLocked, hasPin, resetActivity]);

  const setPin = async (pin: string): Promise<void> => {
    if (pin.length !== 6 || !/^\d{6}$/.test(pin)) {
      throw new Error('PIN must be exactly 6 digits');
    }

    const hash = await hashPin(pin);
    localStorage.setItem(PIN_STORAGE_KEY, hash);
    setHasPin(true);
    setIsPinLocked(false);
    resetActivity();
  };

  const verifyPin = async (pin: string): Promise<boolean> => {
    const storedHash = localStorage.getItem(PIN_STORAGE_KEY);
    if (!storedHash) return false;

    const hash = await hashPin(pin);
    return hash === storedHash;
  };

  const changePin = async (oldPin: string, newPin: string): Promise<boolean> => {
    const isValid = await verifyPin(oldPin);
    if (!isValid) return false;

    await setPin(newPin);
    return true;
  };

  const lockWallet = () => {
    setIsPinLocked(true);
  };

  const unlockWallet = async (pin: string): Promise<boolean> => {
    const isValid = await verifyPin(pin);
    if (isValid) {
      setIsPinLocked(false);
      resetActivity();
      return true;
    }
    return false;
  };

  const setAutoLockMinutes = (minutes: number) => {
    setAutoLockMinutesState(minutes);
    localStorage.setItem(AUTO_LOCK_KEY, minutes.toString());
    resetActivity();
  };

  return (
    <PinContext.Provider
      value={{
        hasPin,
        isPinLocked,
        autoLockMinutes,
        setPin,
        verifyPin,
        changePin,
        lockWallet,
        unlockWallet,
        setAutoLockMinutes,
        resetActivity,
      }}
    >
      {children}
    </PinContext.Provider>
  );
}

export function usePin() {
  const context = useContext(PinContext);
  if (context === undefined) {
    throw new Error('usePin must be used within a PinProvider');
  }
  return context;
}
