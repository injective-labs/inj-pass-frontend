'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useWallet } from '@/contexts/WalletContext';

export default function HomePage() {
  const router = useRouter();
  const { checkExistingWallet, isUnlocked, isInitializing } = useWallet();

  useEffect(() => {
    // Wait for initialization to complete before routing
    if (isInitializing) {
      return;
    }

    const hasWallet = checkExistingWallet();
    
    if (hasWallet && !isUnlocked) {
      router.push('/unlock');
    } else if (hasWallet && isUnlocked) {
      router.push('/dashboard');
    } else {
      router.push('/welcome');
    }
  }, [checkExistingWallet, isUnlocked, isInitializing, router]);

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      backgroundColor: 'var(--bg-color)',
    }}>
      <div style={{ textAlign: 'center' }}>
        <h1 style={{ fontSize: '2rem', marginBottom: '1rem', color: 'var(--primary-text)' }}>
          Injective Pass
        </h1>
        <p style={{ color: 'var(--secondary-text)' }}>Loading...</p>
      </div>
    </div>
  );
}
