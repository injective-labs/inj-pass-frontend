'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export interface WalletErrorToastState {
  id: number;
  message: string;
  isExiting: boolean;
}

const ERROR_TOAST_DURATION_MS = 4200;
const ERROR_TOAST_EXIT_MS = 320;

export function useWalletErrorToast() {
  const timeoutRef = useRef<number | null>(null);
  const exitTimeoutRef = useRef<number | null>(null);
  const [errorToast, setErrorToast] = useState<WalletErrorToastState | null>(null);

  const clearToastTimers = useCallback(() => {
    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    if (exitTimeoutRef.current) {
      window.clearTimeout(exitTimeoutRef.current);
      exitTimeoutRef.current = null;
    }
  }, []);

  const dismissErrorToast = useCallback(
    (immediate = false) => {
      clearToastTimers();

      if (immediate) {
        setErrorToast(null);
        return;
      }

      setErrorToast((currentToast) =>
        currentToast ? { ...currentToast, isExiting: true } : currentToast
      );

      exitTimeoutRef.current = window.setTimeout(() => {
        setErrorToast(null);
        exitTimeoutRef.current = null;
      }, ERROR_TOAST_EXIT_MS);
    },
    [clearToastTimers]
  );

  const showErrorToast = useCallback(
    (message: string) => {
      clearToastTimers();

      const nextToastId = Date.now();
      setErrorToast({
        id: nextToastId,
        message,
        isExiting: false,
      });

      timeoutRef.current = window.setTimeout(() => {
        setErrorToast((currentToast) =>
          currentToast && currentToast.id === nextToastId
            ? { ...currentToast, isExiting: true }
            : currentToast
        );

        exitTimeoutRef.current = window.setTimeout(() => {
          setErrorToast((currentToast) =>
            currentToast && currentToast.id === nextToastId ? null : currentToast
          );
          exitTimeoutRef.current = null;
        }, ERROR_TOAST_EXIT_MS);

        timeoutRef.current = null;
      }, ERROR_TOAST_DURATION_MS);
    },
    [clearToastTimers]
  );

  useEffect(() => {
    return () => {
      clearToastTimers();
    };
  }, [clearToastTimers]);

  return {
    errorToast,
    showErrorToast,
    dismissErrorToast,
  };
}
