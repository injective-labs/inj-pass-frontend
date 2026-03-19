'use client';

import { useState } from 'react';
import Image from 'next/image';
import ThemeToggleButton from '@/components/ThemeToggleButton';
import { formatAddress } from '@/utils/wallet';

interface AccountHeaderProps {
  address?: string;
  accountName?: string;
  showScanButton?: boolean;
  onScanClick?: () => void;
  showFaucetButton?: boolean;
  onFaucetClick?: () => void;
}

export default function AccountHeader({ 
  address, 
  accountName = 'Account 1',
  showScanButton = false,
  onScanClick,
  showFaucetButton = false,
  onFaucetClick,
}: AccountHeaderProps) {
  const [copied, setCopied] = useState(false);

  const handleCopyAddress = () => {
    if (address) {
      navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="flex items-center justify-between gap-4">
      {/* Account Info */}
      <div className="flex min-w-0 items-center gap-2.5">
        {/* Brand Logo */}
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[0.95rem] border border-white/10 bg-white/5 p-1.5">
          <Image 
            src="/lambdalogo.png" 
            alt="Logo" 
            width={24} 
            height={24}
            className="h-6 w-6 object-contain"
          />
        </div>
        
        <div className="min-w-0">
          <div className="text-sm font-bold text-white">{accountName}</div>
          <div className="mt-1.5 flex items-center gap-1.5 whitespace-nowrap">
            {address && (
              <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 font-mono text-[10px] text-gray-400">
                {formatAddress(address)}
              </span>
            )}
            <button 
              onClick={handleCopyAddress}
              className="flex h-6 w-6 items-center justify-center rounded-md border border-white/10 bg-white/[0.04] transition-all hover:bg-white/10 group"
              title="Copy address"
            >
              {copied ? (
                <svg className="h-3 w-3 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <svg className="h-3 w-3 text-gray-400 transition-colors group-hover:text-white" fill="none" stroke="currentColor" viewBox="0 0 16 16">
                  <rect width="11" height="11" x="4" y="4" rx="1" ry="1" strokeWidth="1.5" />
                  <path d="M2 10c-0.8 0-1.5-0.7-1.5-1.5V2c0-0.8 0.7-1.5 1.5-1.5h8.5c0.8 0 1.5 0.7 1.5 1.5" strokeWidth="1.5" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <ThemeToggleButton compact />

        {showFaucetButton && (
          <button
            onClick={onFaucetClick}
            className="rounded-lg border border-white/10 bg-white/5 p-2.5 transition-all group hover:border-violet-500/40 hover:bg-violet-600/20"
            title="Testnet Faucet"
          >
            <svg
              className="h-[18px] w-[18px] text-gray-400 transition-colors group-hover:text-violet-300"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M2 12h7" />
              <path d="M9 9h5a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1H9V9z" />
              <path d="M10 9V7M13 9V7" />
              <path d="M10 7h3" />
              <path d="M15 12h4" />
              <path d="M19 10v4" />
              <path d="M11.5 14v2" />
              <path d="M10 16h3" />
              <path d="M11.5 16.5c0 0-2 2-2 3.5a2 2 0 0 0 4 0c0-1.5-2-3.5-2-3.5z" />
            </svg>
          </button>
        )}

        {/* Scan QR Code Button */}
        {showScanButton && (
          <button 
            onClick={onScanClick}
            className="rounded-lg border border-white/10 bg-white/5 p-2.5 transition-all hover:bg-white/10"
            title="Scan QR Code"
          >
            <svg className="h-[18px] w-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
              {/* Top-left corner */}
              <path d="M3 9V5a2 2 0 0 1 2-2h4" strokeLinecap="round" strokeLinejoin="round" />
              {/* Top-right corner */}
              <path d="M21 9V5a2 2 0 0 0-2-2h-4" strokeLinecap="round" strokeLinejoin="round" />
              {/* Bottom-left corner */}
              <path d="M3 15v4a2 2 0 0 0 2 2h4" strokeLinecap="round" strokeLinejoin="round" />
              {/* Bottom-right corner */}
              <path d="M21 15v4a2 2 0 0 1-2 2h-4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}
