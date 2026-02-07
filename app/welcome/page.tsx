'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createByPasskey } from '@/wallet/key-management';
import { importPrivateKey } from '@/wallet/key-management';
import { encryptKey } from '@/wallet/keystore';
import { saveWallet, hasWallet } from '@/wallet/keystore';
import { useWallet } from '@/contexts/WalletContext';
import { sha256 } from '@noble/hashes/sha2.js';

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
        
        const { entropy } = await unlockByPasskey(keystore.credentialId);
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
        
        const { entropy } = await unlockByPasskey(result.credentialId);
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
    <div className="screen active" id="welcome-wallet-screen" style={{ 
      position: 'relative',
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* Top Banner */}
      <div className="welcome-banner" style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        height: 'auto',
        background: '#4c3af9',
        zIndex: 99,
        overflow: 'hidden',
        animation: 'slideDownBanner 0.6s ease-out',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '0.5rem',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexShrink: 0 }}>
          <span style={{
            color: 'white',
            fontSize: 'clamp(0.875rem, 2vw, 1.207rem)',
            fontWeight: '700',
            letterSpacing: '0.5px',
            fontFamily: 'var(--font-family)',
          }}>
            INJ Pass
          </span>
        </div>
        <div style={{ 
          height: '100%', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          flex: 1,
          minWidth: 0,
        }}>
          <span style={{
            color: 'white',
            fontSize: 'clamp(0.65rem, 1.5vw, 0.89rem)',
            fontWeight: '600',
            textAlign: 'center',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}>
            Injective EVM is online <a href="https://injective.com/zh/build" target="_blank" rel="noopener noreferrer" style={{ color: 'white', textDecoration: 'underline', textUnderlineOffset: '2px', whiteSpace: 'nowrap' }}>Learn More</a>
          </span>
        </div>
        <div style={{
          display: 'flex',
          gap: '0.5rem',
          alignItems: 'center',
          flexShrink: 0,
        }}>
          <a href="https://t.me/injective" target="_blank" rel="noopener noreferrer" style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 'clamp(1.2rem, 3vw, 1.6875rem)',
            height: 'clamp(1.2rem, 3vw, 1.6875rem)',
            background: 'rgba(255, 255, 255, 0.1)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            borderRadius: '50%',
            transition: 'all 0.3s ease',
            color: 'white',
            textDecoration: 'none',
            flexShrink: 0,
          }}>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" style={{ width: '50%', height: '50%' }}>
              <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.562 8.161l-1.84 8.673c-.136.624-.5.778-.999.485l-2.761-2.036-1.332 1.281c-.147.147-.271.271-.556.271l.199-2.822 5.13-4.638c.223-.199-.049-.31-.346-.111l-6.341 3.993-2.733-.853c-.593-.187-.605-.593.126-.879l10.691-4.12c.496-.183.929.112.762.874z"/>
            </svg>
          </a>
          <a href="https://x.com/INJ_Pass" target="_blank" rel="noopener noreferrer" style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 'clamp(1.2rem, 3vw, 1.6875rem)',
            height: 'clamp(1.2rem, 3vw, 1.6875rem)',
            background: 'rgba(255, 255, 255, 0.1)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            borderRadius: '50%',
            transition: 'all 0.3s ease',
            color: 'white',
            textDecoration: 'none',
            flexShrink: 0,
          }}>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" style={{ width: '50%', height: '50%' }}>
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
            </svg>
          </a>
        </div>
      </div>

      {/* Hero Section */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        flex: 1,
        width: '100%',
        padding: 'clamp(1rem, 5vw, 2rem)',
        paddingTop: 'clamp(5rem, 12vh, 8rem)',
        paddingBottom: 'clamp(4rem, 10vh, 6rem)',
        minHeight: '100vh',
      }}>
        <div style={{
          textAlign: 'center',
          width: '100%',
          maxWidth: '600px',
          margin: '0 auto',
        }}>
          <p style={{
            fontSize: 'clamp(1.75rem, 7vw, 4.5rem)',
            color: '#ffffff',
            margin: '0 0 1rem 0',
            lineHeight: '1.2',
            fontWeight: '700',
            textShadow: '0 2px 12px rgba(76, 58, 249, 0.6)',
            fontFamily: "'Space Grotesk', 'General Sans', 'Satoshi', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
            letterSpacing: '-0.02em',
            wordBreak: 'break-word',
          }}>
            One Click to Injective Universe
          </p>
          
          <div style={{ marginBottom: '1.5rem' }}>
            <p style={{
              fontSize: 'clamp(0.875rem, 3vw, 1.422rem)',
              color: 'var(--secondary-text)',
              margin: 0,
              lineHeight: '1.5',
              fontWeight: '500',
            }}>
              Easiest Way to Start Onchain Journey
            </p>
          </div>

          {error && (
            <div style={{
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: '8px',
              padding: '0.75rem 1rem',
              marginBottom: '1rem',
              color: '#ef4444',
              fontSize: 'clamp(0.75rem, 2vw, 0.875rem)',
            }}>
              {error}
            </div>
          )}

          <div style={{
            display: 'flex',
            gap: 'clamp(0.75rem, 2vw, 1rem)',
            alignItems: 'stretch',
            justifyContent: 'center',
            width: '100%',
          }} className="welcome-buttons-container">
            <button
              onClick={handleCreateWithPasskey}
              disabled={loading}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 'clamp(0.5rem, 1vw, 0.75rem)',
                background: 'linear-gradient(135deg, #4c3af9, #5c4aff)',
                color: '#ffffff',
                border: 'none',
                borderRadius: '12px',
                padding: 'clamp(0.75rem, 3vw, 1rem) clamp(1rem, 4vw, 2rem)',
                fontSize: 'clamp(0.75rem, 2vw, 1rem)',
                fontWeight: '700',
                cursor: loading ? 'not-allowed' : 'pointer',
                transition: 'all 0.3s ease',
                boxShadow: '0 8px 24px rgba(76, 58, 249, 0.3)',
                position: 'relative',
                overflow: 'hidden',
                whiteSpace: 'nowrap',
                letterSpacing: '0.5px',
                animation: 'btnGlow 2s ease-in-out infinite',
                opacity: loading ? 0.6 : 1,
                minWidth: 0,
              }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 'clamp(0.875rem, 2vw, 1.25rem)', height: 'clamp(0.875rem, 2vw, 1.25rem)', flexShrink: 0 }}>
                <line x1="5" y1="12" x2="19" y2="12" />
                <polyline points="12 5 19 12 12 19" />
              </svg>
              <span>{loading ? 'CREATING...' : 'LAUNCH WEB APP'}</span>
            </button>

            <button
              onClick={() => router.push('/passkey-create')}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 'clamp(0.5rem, 1vw, 0.75rem)',
                background: 'linear-gradient(135deg, var(--teal-accent), var(--teal-dark))',
                color: '#ffffff',
                border: 'none',
                borderRadius: '12px',
                padding: 'clamp(0.75rem, 3vw, 1rem) clamp(1rem, 4vw, 2rem)',
                fontSize: 'clamp(0.75rem, 2vw, 1rem)',
                fontWeight: '700',
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                boxShadow: '0 12px 32px rgba(16, 185, 129, 0.3)',
                position: 'relative',
                overflow: 'hidden',
                whiteSpace: 'nowrap',
                letterSpacing: '0.5px',
                minWidth: 0,
              }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 'clamp(0.875rem, 2vw, 1.25rem)', height: 'clamp(0.875rem, 2vw, 1.25rem)', flexShrink: 0 }}>
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="7 10 12 15 17 10"></polyline>
                <line x1="12" y1="15" x2="12" y2="3"></line>
              </svg>
              <span>Download for Mobile</span>
            </button>
          </div>
        </div>
      </div>

      {/* Powered by Injective */}
      <div style={{
        position: 'fixed',
        bottom: 'clamp(0.75rem, 2vh, 1.5rem)',
        left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        zIndex: 10,
        fontSize: 'clamp(0.75rem, 1.5vw, 0.875rem)',
      }}>
        <span style={{ color: 'var(--secondary-text)' }}>Powered by</span>
        <span style={{ color: 'var(--primary-text)', fontWeight: '600' }}>Injective</span>
      </div>
    </div>
  );
}
