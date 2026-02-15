'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useWallet } from '@/contexts/WalletContext';
import LoadingSpinner from '@/components/LoadingSpinner';

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
    return loadingComponent || <LoadingSpinner />;
  }

  if (!isUnlocked || !address) {
    return null;
  }

  return <>{children}</>;
}
