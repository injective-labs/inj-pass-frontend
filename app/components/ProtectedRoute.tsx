'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useWallet } from '@/contexts/WalletContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
  loadingComponent?: React.ReactNode;
}

export default function ProtectedRoute({ children, loadingComponent }: ProtectedRouteProps) {
  const router = useRouter();
  const { isUnlocked, address, isCheckingSession } = useWallet();

  useEffect(() => {
    if (isCheckingSession) {
      return;
    }

    if (!isUnlocked || !address) {
      router.push('/welcome');
    }
  }, [isUnlocked, address, isCheckingSession, router]);

  if (isCheckingSession) {
    return loadingComponent || (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-white">Loading...</p>
      </div>
    );
  }

  if (!isUnlocked || !address) {
    return null;
  }

  return <>{children}</>;
}
