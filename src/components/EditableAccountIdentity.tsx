'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { formatAddress } from '@/utils/wallet';
import { DEFAULT_ACCOUNT_NAME, loadAccountName, saveAccountName } from '@/lib/account-profile';
import { useTheme } from '@/contexts/ThemeContext';
import NFTDetailModal from '@/components/NFTDetailModal';
import { getN1NJ4NFTs, hasN1NJ4NFT, type NFT } from '@/services/nft';
import type { Address } from 'viem';

interface EditableAccountIdentityProps {
  address?: string;
  className?: string;
  defaultName?: string;
}

export default function EditableAccountIdentity({ address, className = '', defaultName = DEFAULT_ACCOUNT_NAME }: EditableAccountIdentityProps) {
  const { theme } = useTheme();
  const isLight = theme === 'light';
  const [copied, setCopied] = useState(false);
  const [accountName, setAccountName] = useState(() => loadAccountName(address, defaultName));
  const [draftName, setDraftName] = useState(() => loadAccountName(address, defaultName));
  const [isHovered, setIsHovered] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [hasN1NJ4, setHasN1NJ4] = useState(false);
  const [n1nj4Loading, setN1NJ4Loading] = useState(false);
  const [selectedN1NJ4, setSelectedN1NJ4] = useState<NFT | null>(null);

  const trimmedDraftName = useMemo(() => draftName.trim() || defaultName, [defaultName, draftName]);

  const handleCopyAddress = () => {
    if (!address) return;
    navigator.clipboard.writeText(address);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  const handleSaveName = () => {
    const nextName = saveAccountName(trimmedDraftName, address);
    setAccountName(nextName);
    setDraftName(nextName);
    setIsEditing(false);
  };

  const handleCancelName = () => {
    setDraftName(accountName);
    setIsEditing(false);
  };

  useEffect(() => {
    let cancelled = false;

    const checkN1NJ4Ownership = async () => {
      if (!address || !address.startsWith('0x')) {
        setHasN1NJ4(false);
        return;
      }

      const owned = await hasN1NJ4NFT(address as Address);
      if (!cancelled) {
        setHasN1NJ4(owned);
      }
    };

    checkN1NJ4Ownership();

    return () => {
      cancelled = true;
    };
  }, [address]);

  const handleN1NJ4BadgeClick = async () => {
    if (!hasN1NJ4) {
      window.location.assign('https://n1nj4.fun');
      return;
    }

    if (!address || !address.startsWith('0x')) {
      return;
    }

    if (selectedN1NJ4) {
      return;
    }

    try {
      setN1NJ4Loading(true);
      const userNFTs = await getN1NJ4NFTs(address as Address);
      if (userNFTs.length > 0) {
        setSelectedN1NJ4(userNFTs[0]);
      }
    } catch (error) {
      console.error('Failed to load N1NJ4 NFT details:', error);
    } finally {
      setN1NJ4Loading(false);
    }
  };

  return (
    <div
      className={`flex min-w-0 flex-1 items-start gap-2.5 sm:items-center ${className}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => {
        if (!isEditing) {
          setIsHovered(false);
        }
      }}
    >
      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-[0.95rem] border p-1.5 sm:h-9 sm:w-9 ${
        isLight
          ? 'border-slate-200/80 bg-white/85 shadow-[0_10px_24px_rgba(148,163,184,0.14)]'
          : 'border-white/10 bg-white/5'
      }`}>
        <Image
          src="/lambdalogo.png"
          alt="Logo"
          width={24}
          height={24}
          className="h-6 w-6 object-contain"
        />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 flex-wrap items-center gap-1.5 sm:gap-2">
          {isEditing ? (
            <div className="flex min-w-0 items-center gap-2">
              <input
                value={draftName}
                onChange={(event) => setDraftName(event.target.value)}
                onBlur={handleSaveName}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    handleSaveName();
                  }
                  if (event.key === 'Escape') {
                    event.preventDefault();
                    handleCancelName();
                  }
                }}
                autoFocus
                className={`h-7 min-w-[128px] rounded-lg border px-2.5 text-sm font-bold outline-none transition-all ${
                  isLight
                    ? 'border-slate-200/80 bg-white/90 text-slate-900 focus:border-amber-400/50 focus:bg-white'
                    : 'border-white/10 bg-white/[0.06] text-white focus:border-amber-300/40 focus:bg-white/[0.08]'
                }`}
              />
              <button
                onMouseDown={(event) => event.preventDefault()}
                onClick={handleSaveName}
                className={`rounded-md border px-2 py-1 text-[10px] font-semibold transition-colors ${
                  isLight
                    ? 'border-emerald-400/25 bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/15'
                    : 'border-emerald-400/25 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/15'
                }`}
              >
                Save
              </button>
            </div>
          ) : (
            <>
              <button
                onClick={() => {
                  setDraftName(accountName);
                  setIsEditing(true);
                  setIsHovered(true);
                }}
                className="group flex items-center gap-1 rounded-md pr-1 text-left"
                title="Rename account"
              >
                <span className={`text-sm font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>{accountName}</span>
                <svg
                  className={`h-3.5 w-3.5 transition-all ${
                    isLight
                      ? isHovered ? 'text-slate-500 opacity-100' : 'text-slate-400 opacity-0 group-hover:text-slate-700'
                      : isHovered ? 'text-gray-500 opacity-100' : 'text-gray-500 opacity-0 group-hover:text-white'
                  }`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m15.232 5.232 3.536 3.536M9 11l6.768-6.768a2.5 2.5 0 1 1 3.536 3.536L12.536 14.536A4 4 0 0 1 10.121 15.657L7 16l.343-3.121A4 4 0 0 1 8.464 10.464L9 11Z" />
                </svg>
              </button>

              <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleN1NJ4BadgeClick}
                  className={`injpass-nameplate ${hasN1NJ4 ? 'injpass-nameplate-gold' : 'injpass-nameplate-muted'} ${n1nj4Loading ? 'animate-pulse' : ''} cursor-pointer`}
                  title={hasN1NJ4 ? 'View your N1NJ4 NFT' : 'Go to n1nj4.fun'}
                >
                  N1NJ4
                </button>
                {/* <span className="injpass-nameplate injpass-nameplate-silver">.INJ</span> */}
              </div>
            </>
          )}
        </div>

        <div className="mt-1.5 flex items-center gap-1.5">
          {address && (
            <span className={`min-w-0 truncate rounded-full border px-2 py-0.5 font-mono text-[10px] ${
              isLight
                ? 'border-slate-200/80 bg-white/78 text-slate-500'
                : 'border-white/10 bg-white/[0.04] text-gray-400'
            }`}>
              {formatAddress(address)}
            </span>
          )}
          <button
            onClick={handleCopyAddress}
            className={`group flex h-6 w-6 shrink-0 items-center justify-center rounded-md border transition-all ${
              isLight
                ? 'border-slate-200/80 bg-white/78 hover:bg-white'
                : 'border-white/10 bg-white/[0.04] hover:bg-white/10'
            }`}
            title="Copy address"
          >
            {copied ? (
              <svg className="h-3 w-3 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className={`h-3 w-3 transition-colors ${isLight ? 'text-slate-500 group-hover:text-slate-900' : 'text-gray-400 group-hover:text-white'}`} fill="none" stroke="currentColor" viewBox="0 0 16 16">
                <rect width="11" height="11" x="4" y="4" rx="1" ry="1" strokeWidth="1.5" />
                <path d="M2 10c-0.8 0-1.5-0.7-1.5-1.5V2c0-0.8 0.7-1.5 1.5-1.5h8.5c0.8 0 1.5 0.7 1.5 1.5" strokeWidth="1.5" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {selectedN1NJ4 && (
        <NFTDetailModal
          nft={selectedN1NJ4}
          onClose={() => setSelectedN1NJ4(null)}
        />
      )}
    </div>
  );
}
