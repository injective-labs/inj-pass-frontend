'use client';

import { useState } from 'react';
import Image from 'next/image';

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
    <div className="flex items-center justify-between">
      {/* Account Info */}
      <div className="flex items-center gap-3">
        {/* Brand Logo */}
        <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center p-1.5">
          <Image 
            src="/lambdalogo.png" 
            alt="Logo" 
            width={32} 
            height={32}
            className="w-full h-full object-contain"
          />
        </div>
        
        <div>
          <div className="text-sm font-bold text-white mb-1">{accountName}</div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs text-gray-400">
              {address?.slice(0, 6)}...{address?.slice(-4)}
            </span>
            <button 
              onClick={handleCopyAddress}
              className="p-1 rounded hover:bg-white/10 transition-all group"
              title="Copy address"
            >
              {copied ? (
                <svg className="w-3.5 h-3.5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <svg className="w-3.5 h-3.5 text-gray-400 group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 16 16">
                  <rect width="11" height="11" x="4" y="4" rx="1" ry="1" strokeWidth="1.5" />
                  <path d="M2 10c-0.8 0-1.5-0.7-1.5-1.5V2c0-0.8 0.7-1.5 1.5-1.5h8.5c0.8 0 1.5 0.7 1.5 1.5" strokeWidth="1.5" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Action buttons — faucet (left) then scan (right) */}
      <div className="flex items-center gap-2">
        {showFaucetButton && (
          <button
            onClick={onFaucetClick}
            className="p-3 rounded-xl bg-white/5 hover:bg-violet-600/20 border border-white/10 hover:border-violet-500/40 transition-all group"
            title="Testnet Faucet"
          >
            <svg
              className="w-5 h-5 text-gray-400 group-hover:text-violet-300 transition-colors"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M5 8h7a2 2 0 0 1 2 2v1" />
              <path d="M5 8V6" />
              <path d="M14 11h2a1 1 0 0 1 1 1v1a1 1 0 0 1-1 1h-2" />
              <path d="M14 17c0 1.1-.9 2-2 2s-2-.9-2-2c0-.8.5-1.5 1.2-1.8L12 14l.8 1.2c.7.3 1.2 1 1.2 1.8z" />
              <path d="M9 8V5h4v3" />
            </svg>
          </button>
        )}

        {showScanButton && (
          <button 
            onClick={onScanClick}
            className="p-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 transition-all"
            title="Scan QR Code"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
              <path d="M3 9V5a2 2 0 0 1 2-2h4" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M21 9V5a2 2 0 0 0-2-2h-4" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M3 15v4a2 2 0 0 0 2 2h4" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M21 15v4a2 2 0 0 1-2 2h-4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}
