'use client';

import type { ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';

/**
 * Reusable loading spinner component
 * Used for page transitions and loading states
 */
function getDestinationLabel(pathname: string | null) {
  if (!pathname || pathname === '/') return 'INJ Pass';

  const routeLabels: Record<string, string> = {
    '/dashboard': 'Wallet',
    '/discover': 'Discover',
    '/settings': 'Settings',
    '/agents': 'Agents',
    '/history': 'History',
    '/send': 'Send',
    '/receive': 'Receive',
    '/swap': 'Swap',
    '/cards': 'Cards',
    '/welcome': 'INJ Pass',
    '/unlock': 'INJ Pass',
  };

  if (routeLabels[pathname]) {
    return routeLabels[pathname];
  }

  const fallback = pathname.split('/').filter(Boolean).pop();
  if (!fallback) return 'INJ Pass';

  return fallback
    .split('-')
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ');
}

interface LoadingSpinnerProps {
  ready?: boolean;
  children?: ReactNode;
}

export default function LoadingSpinner({ ready = false, children }: LoadingSpinnerProps) {
  const pathname = usePathname();
  const destinationLabel = useMemo(() => getDestinationLabel(pathname), [pathname]);
  const [overlayVisible, setOverlayVisible] = useState(true);
  const [isLeaving, setIsLeaving] = useState(false);
  const isWrapped = children !== undefined;

  useEffect(() => {
    if (!isWrapped || !ready) {
      return;
    }

    const startExit = window.setTimeout(() => {
      setIsLeaving(true);
    }, 0);
    const timeout = window.setTimeout(() => {
      setOverlayVisible(false);
    }, 320);

    return () => {
      window.clearTimeout(startExit);
      window.clearTimeout(timeout);
    };
  }, [isWrapped, ready]);

  return (
    <div className="relative min-h-screen bg-black overflow-hidden">
      {children ? <>{children}</> : null}

      {overlayVisible && (
        <div
          className={`fixed inset-0 z-[140] flex items-center justify-center bg-black transition-opacity duration-300 ${
            isLeaving ? 'opacity-0' : 'opacity-100'
          }`}
        >
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(94,234,212,0.08),transparent_38%),radial-gradient(circle_at_top,rgba(139,123,255,0.16),transparent_44%),linear-gradient(180deg,#040404_0%,#000000_100%)]" />

          <div
            className={`relative px-6 text-center transition-all duration-500 ${
              isLeaving ? 'translate-y-2 scale-[0.985] opacity-0 blur-[3px]' : 'translate-y-0 scale-100 opacity-100'
            }`}
          >
            <div className="text-[11px] font-semibold uppercase tracking-[0.32em] text-gray-500">
              INJ Pass
            </div>
            <div className="mt-4 text-3xl font-semibold tracking-tight md:text-5xl">
              <span className="bg-gradient-to-r from-white via-cyan-200 to-[#8b7bff] bg-clip-text text-transparent animate-pulse">
                Welcome to {destinationLabel}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
