'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useWallet } from '@/contexts/WalletContext';
import LoadingSpinner from '@/components/LoadingSpinner';

export default function HomePage() {
  const router = useRouter();
  const { checkExistingWallet, isUnlocked, isCheckingSession, keystore } = useWallet();

  useEffect(() => {
    // Wait for session checking to complete
    if (isCheckingSession) {
      console.log('[HomePage] Still checking session, waiting...');
      return;
    }

    const hasWallet = checkExistingWallet();
    console.log('[HomePage] Has wallet:', hasWallet, 'isUnlocked:', isUnlocked, 'keystore:', !!keystore);
    
    if (hasWallet && isUnlocked) {
      console.log('[HomePage] Redirecting to /dashboard');
      router.push('/dashboard');
    } else if (hasWallet && !isUnlocked) {
      console.log('[HomePage] Redirecting to /unlock');
      router.push('/unlock');
    } else {
      console.log('[HomePage] Redirecting to /welcome');
      router.push('/welcome');
    }
  }, [isUnlocked, isCheckingSession, keystore, router]);

  return <LoadingSpinner />;
}
