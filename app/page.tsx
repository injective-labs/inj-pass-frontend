'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useWallet } from '@/contexts/WalletContext';
import LoadingSpinner from '@/components/LoadingSpinner';

export default function HomePage() {
  const router = useRouter();
  const { checkExistingWallet, isUnlocked, isCheckingSession, keystore } = useWallet();

  useEffect(() => {
    if (isCheckingSession) {
      return;
    }

    const hasWallet = checkExistingWallet();

    if (hasWallet && isUnlocked) {
      router.replace('/dashboard');
    } else if (hasWallet && !isUnlocked) {
      router.replace('/unlock');
    } else {
      router.replace('/welcome');
    }
  }, [checkExistingWallet, isUnlocked, isCheckingSession, keystore, router]);

  return (
    <LoadingSpinner
      progress={isCheckingSession ? 42 : 100}
      statusLabel={
        isCheckingSession
          ? 'Checking local session'
          : isUnlocked
            ? 'Opening wallet surface'
            : 'Preparing route'
      }
    />
  );
}
