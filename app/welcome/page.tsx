'use client';

import { useState, useEffect } from 'react';
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
  const [showImport, setShowImport] = useState(false);
  const [privateKeyInput, setPrivateKeyInput] = useState('');
  const [walletExists, setWalletExists] = useState(false);

  useEffect(() => {
    setWalletExists(hasWallet());
  }, []);

const handleImport = async () => {
    setLoading(true);
    setError('');
    
    try {
      const result = importPrivateKey(privateKeyInput);
      
      const password = 'temp-password';
      const entropy = sha256(new TextEncoder().encode(password));
      const encrypted = await encryptKey(result.privateKey, entropy);
      
      saveWallet({
        address: result.address,
        encryptedPrivateKey: encrypted,
        source: 'import',
        createdAt: Date.now(),
      });

      const { loadWallet } = await import('@/wallet/keystore');
      const keystore = loadWallet();
      if (keystore) {
        unlock(result.privateKey, keystore);
      }
      
      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to import wallet');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateWithPasskey = async () => {
    setLoading(true);
    setError('');
    
    try {
      const walletExists = hasWallet();

      if (walletExists) {
        const { loadWallet } = await import('@/wallet/keystore');
        const keystore = loadWallet();
        
        if (!keystore || !keystore.credentialId) {
          throw new Error('Invalid wallet data');
        }
        
        const { unlockByPasskey } = await import('@/wallet/key-management/createByPasskey');
        const { decryptKey } = await import('@/wallet/keystore');
        
        const entropy = await unlockByPasskey(keystore.credentialId);
        const privateKey = await decryptKey(keystore.encryptedPrivateKey, entropy);
        
        unlock(privateKey, keystore);
      } else {
        const result = await createByPasskey('user@injective-pass');
        
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
      }
      
      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create wallet');
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

          <div className="flex justify-center w-full animate-fade-in">
            <button
              onClick={handleCreateWithPasskey}
              disabled={loading}
              className="flex items-center justify-center gap-2 md:gap-3 bg-white text-black rounded-2xl px-6 md:px-8 py-4 text-sm md:text-base font-bold cursor-pointer transition-all shadow-lg hover:bg-gray-100 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 whitespace-nowrap tracking-wide"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 md:w-5 md:h-5 flex-shrink-0">
                <line x1="5" y1="12" x2="19" y2="12" />
                <polyline points="12 5 19 12 12 19" />
              </svg>
              <span>{loading ? 'ENTERING...' : 'LAUNCH WEB APP'}</span>
            </button>
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
