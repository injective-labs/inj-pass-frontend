'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { createByPasskey } from '@/wallet/key-management';
import { importPrivateKey } from '@/wallet/key-management';
import { encryptKey } from '@/wallet/keystore';
import { saveWallet, hasWallet } from '@/wallet/keystore';
import { useWallet } from '@/contexts/WalletContext';
import { sha256 } from '@noble/hashes/sha2.js';
import TunnelBackground from '@/components/TunnelBackground';

export default function WelcomePage() {
  const router = useRouter();
  const { unlock } = useWallet();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [walletNameInput, setWalletNameInput] = useState('');
  const [walletExists, setWalletExists] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setWalletExists(hasWallet());
  }, []);

  // Focus the input shortly after it fades in
  useEffect(() => {
    if (showCreateModal) {
      const t = setTimeout(() => inputRef.current?.focus(), 60);
      return () => clearTimeout(t);
    }
  }, [showCreateModal]);

  const handleCreateWallet = async () => {
    if (!walletNameInput.trim()) {
      setError('Please enter a wallet name');
      return;
    }

    setLoading(true);
    setError('');
    
    try {
      const result = await createByPasskey(walletNameInput.trim());
      
      const { loadWallet } = await import('@/wallet/keystore');
      const keystore = loadWallet();
      
      if (!keystore) {
        throw new Error('Failed to load created wallet');
      }

      const { unlockByPasskey } = await import('@/wallet/key-management/createByPasskey');
      const { decryptKey } = await import('@/wallet/keystore');
      
      const entropy = await unlockByPasskey(result.credentialId);
      const privateKey = await decryptKey(keystore.encryptedPrivateKey, entropy);
      
      unlock(privateKey, keystore);
      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create wallet');
    } finally {
      setLoading(false);
      setShowCreateModal(false);
    }
  };

  const handleRecoverWallet = async () => {
    setLoading(true);
    setError('');
    
    try {
      const { recoverFullWallet } = await import('@/wallet/key-management/recoverByPasskey');
      const result = await recoverFullWallet();
      
      const { loadWallet } = await import('@/wallet/keystore');
      const keystore = loadWallet();
      
      if (!keystore) {
        throw new Error('Failed to load recovered wallet');
      }

      const { unlockByPasskey } = await import('@/wallet/key-management/createByPasskey');
      const { decryptKey } = await import('@/wallet/keystore');
      
      const entropy = await unlockByPasskey(result.credentialId);
      const privateKey = await decryptKey(keystore.encryptedPrivateKey, entropy);
      
      unlock(privateKey, keystore);
      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to recover wallet');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen flex flex-col overflow-hidden">
      {/* Tunnel Background Animation */}
      <TunnelBackground />
      
      {/* Content Layer */}
      <div className="relative z-10">
      {/* Top Banner - Purple Background */}
      <div className="fixed top-0 left-0 right-0 bg-[#4c3af9]/90 backdrop-blur-sm z-50 px-4 py-1.5 flex items-center justify-between gap-2 animate-fade-in overflow-hidden">
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-white text-[0.7rem] md:text-xs font-semibold tracking-wide">
            INJ Pass
          </span>
        </div>
        <div className="flex-1 flex items-center justify-center min-w-0">
          <a href="https://x.com/INJ_Pass" target="_blank" rel="noopener noreferrer" className="text-white text-[0.75rem] md:text-[0.805rem] font-semibold text-center truncate underline underline-offset-2 hover:text-white/80 transition-colors">
            Unaudited Release, DYOR
          </a>
        </div>
        <div className="flex gap-2 items-center flex-shrink-0">
          <a href="https://t.me/injective" target="_blank" rel="noopener noreferrer" className="text-white hover:text-white/70 transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 md:w-[1.1rem] md:h-[1.1rem]">
              <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.562 8.161l-1.84 8.673c-.136.624-.5.778-.999.485l-2.761-2.036-1.332 1.281c-.147.147-.271.271-.556.271l.199-2.822 5.13-4.638c.223-.199-.049-.31-.346-.111l-6.341 3.993-2.733-.853c-.593-.187-.605-.593.126-.879l10.691-4.12c.496-.183.929.112.762.874z"/>
            </svg>
          </a>
          <a href="https://x.com/INJ_Pass" target="_blank" rel="noopener noreferrer" className="text-white hover:text-white/70 transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 md:w-[1.1rem] md:h-[1.1rem]">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
            </svg>
          </a>
        </div>
      </div>

      {/* Hero Section */}
      <div className="flex flex-col items-center justify-center flex-1 w-full px-4 md:px-8 pt-16 md:pt-24 pb-16 md:pb-24 min-h-screen">
        <div className="text-center w-full max-w-2xl mx-auto">
          <h1 className="text-4xl md:text-6xl lg:text-7xl text-white mb-4 leading-tight font-bold tracking-tight break-words animate-fade-in title-3d tunnel-title">
            <span className="lambda-gradient">λ</span> to Injective
          </h1>
          
          <div className="mb-6 animate-fade-in">
            <p className="text-base md:text-lg lg:text-xl text-gray-400 leading-relaxed font-medium">
              Your First Onchain Portal
            </p>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-2xl px-4 py-3 mb-6 text-red-400 text-sm">
              {error}
            </div>
          )}

          <div className="flex flex-col gap-4 w-full max-w-md mx-auto animate-fade-in">

            {/*
              Slot 1: CREATE NEW WALLET button swaps with wallet-name input.
              Both share the same grid cell so RECOVER WALLET never shifts.
            */}
            <div className="grid">
              {/* CREATE NEW WALLET button */}
              <div
                style={{ gridArea: '1 / 1' }}
                className={`transition-all duration-300 ease-in-out ${
                  showCreateModal
                    ? 'opacity-0 -translate-y-1 scale-95 pointer-events-none'
                    : 'opacity-100 translate-y-0 scale-100'
                }`}
              >
                <button
                  onClick={() => setShowCreateModal(true)}
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 md:gap-3 bg-white text-black rounded-2xl px-6 md:px-8 py-4 text-sm md:text-base font-bold cursor-pointer transition-colors shadow-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap tracking-wide"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 md:w-5 md:h-5 flex-shrink-0">
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                  <span>CREATE NEW WALLET</span>
                </button>
              </div>

              {/* Wallet-name input (fades in when showCreateModal = true) */}
              <div
                style={{ gridArea: '1 / 1' }}
                className={`transition-all duration-300 ease-in-out ${
                  showCreateModal
                    ? 'opacity-100 translate-y-0 scale-100'
                    : 'opacity-0 translate-y-1 scale-95 pointer-events-none'
                }`}
              >
                <div className="relative bg-white rounded-2xl shadow-lg">
                  <input
                    ref={inputRef}
                    type="text"
                    value={walletNameInput}
                    onChange={(e) => setWalletNameInput(e.target.value)}
                    placeholder="Wallet name…"
                    className="w-full bg-transparent pl-5 pr-14 py-4 text-black text-sm md:text-base font-bold placeholder-black/40 focus:outline-none rounded-2xl"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && walletNameInput.trim()) handleCreateWallet();
                      if (e.key === 'Escape') {
                        setShowCreateModal(false);
                        setWalletNameInput('');
                        setError('');
                      }
                    }}
                  />
                  {/* Submit arrow button */}
                  <button
                    onClick={handleCreateWallet}
                    disabled={loading || !walletNameInput.trim()}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-xl hover:bg-black/8 transition-colors disabled:opacity-25 disabled:cursor-not-allowed"
                    title="Continue"
                  >
                    {loading ? (
                      <svg className="w-5 h-5 text-black animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* RECOVER WALLET */}
            <button
              onClick={handleRecoverWallet}
              disabled={loading}
              className="flex items-center justify-center gap-2 md:gap-3 bg-white/8 backdrop-blur-sm text-white border border-white/15 rounded-2xl px-6 md:px-8 py-4 text-sm md:text-base font-bold cursor-pointer transition-all hover:bg-white/15 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 whitespace-nowrap tracking-wide"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 md:w-5 md:h-5 flex-shrink-0">
                <path d="M21 2v6h-6" />
                <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
                <path d="M3 22v-6h6" />
                <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
              </svg>
              <span>{loading ? 'RECOVERING...' : 'RECOVER WALLET'}</span>
            </button>

            {/* Back link — fades in when wallet name input is shown */}
            <div
              className={`transition-all duration-300 ease-in-out ${
                showCreateModal
                  ? 'opacity-100'
                  : 'opacity-0 pointer-events-none'
              }`}
            >
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setWalletNameInput('');
                  setError('');
                }}
                className="w-full text-gray-400 text-sm hover:text-white transition-colors text-center py-1"
              >
                ← Back
              </button>
            </div>

          </div>
        </div>
      </div>

      {/* Powered by Injective */}
      <div className="fixed bottom-3 md:bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 z-10 text-xs md:text-sm animate-fade-in">
        <span className="text-gray-400">Powered by</span>
        <span className="text-white font-semibold">Injective</span>
        <Image 
          src="/injlogo.png" 
          alt="Injective Logo" 
          width={20} 
          height={20}
          className="w-4 h-4 md:w-5 md:h-5 -ml-1.5"
        />
      </div>
      </div>
    </div>
  );
}
