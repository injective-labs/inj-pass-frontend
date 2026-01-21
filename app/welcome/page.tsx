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
    <div className="screen active" id="welcome-wallet-screen" style={{ position: 'relative' }}>
      {/* Top Banner */}
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        height: '48px',
        background: '#4c3af9',
        zIndex: 99,
        overflow: 'hidden',
        animation: 'slideDownBanner 0.6s ease-out',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 1.2rem',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexShrink: 0 }}>
          <span style={{
            color: 'white',
            fontSize: '1.207rem',
            fontWeight: '700',
            letterSpacing: '0.5px',
            fontFamily: 'var(--font-family)',
          }}>
            INJ Pass
          </span>
        </div>
        <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1 }}>
          <span style={{
            color: 'white',
            fontSize: '0.89rem',
            fontWeight: '600',
            textAlign: 'center',
          }}>
            Injective EVM is online <a href="https://injective.com/zh/build" target="_blank" rel="noopener noreferrer" style={{ color: 'white', textDecoration: 'underline', textUnderlineOffset: '2px' }}>Learn More</a>
          </span>
        </div>
      </div>

      {/* Top Navigation */}
      <nav style={{
        position: 'fixed',
        top: '4rem',
        right: '1rem',
        left: '1rem',
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-end',
        gap: '0.75rem',
      }}>
        <div style={{
          display: 'flex',
          gap: '0.75rem',
          alignItems: 'center',
          marginTop: '-2cm',
          marginLeft: '2.5mm',
        }}>
          <a href="https://t.me/injective" target="_blank" rel="noopener noreferrer" style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '1.6875rem',
            height: '1.6875rem',
            background: 'var(--card-bg)',
            border: '2px solid var(--surface-border)',
            borderRadius: '50%',
            transition: 'all 0.3s ease',
            color: 'var(--primary-text)',
            textDecoration: 'none',
          }}>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" style={{ width: '0.75rem', height: '0.75rem' }}>
              <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.562 8.161l-1.84 8.673c-.136.624-.5.778-.999.485l-2.761-2.036-1.332 1.281c-.147.147-.271.271-.556.271l.199-2.822 5.13-4.638c.223-.199-.049-.31-.346-.111l-6.341 3.993-2.733-.853c-.593-.187-.605-.593.126-.879l10.691-4.12c.496-.183.929.112.762.874z"/>
            </svg>
          </a>
          <a href="https://x.com/INJ_Pass" target="_blank" rel="noopener noreferrer" style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '1.6875rem',
            height: '1.6875rem',
            background: 'var(--card-bg)',
            border: '2px solid var(--surface-border)',
            borderRadius: '50%',
            transition: 'all 0.3s ease',
            color: 'var(--primary-text)',
            textDecoration: 'none',
          }}>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" style={{ width: '0.75rem', height: '0.75rem' }}>
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
            </svg>
          </a>
        </div>
      </nav>

      {/* Hero Section */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        margin: 0,
        maxWidth: 'none',
        width: '100%',
        height: '100vh',
        padding: '2rem',
        paddingTop: 'calc(2rem - 1.5cm)',
      }}>
        <div style={{
          textAlign: 'center',
          width: '100%',
          maxWidth: '600px',
          margin: '0 auto',
          marginTop: 0,
        }}>
          <p style={{
            fontSize: '4.5rem',
            color: '#ffffff',
            margin: '0 0 2rem 0',
            lineHeight: '1.3',
            fontWeight: '700',
            whiteSpace: 'nowrap',
            textShadow: '0 2px 12px rgba(76, 58, 249, 0.6)',
            fontFamily: "'Space Grotesk', 'General Sans', 'Satoshi', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
            letterSpacing: '-0.02em',
          }}>
            One Click to Injective Universe
          </p>
          
          <div style={{ marginBottom: '2rem' }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-start',
              gap: '1rem',
              marginBottom: '1rem',
              marginLeft: 'calc(3cm - 3mm)',
              fontSize: '1.422421875rem',
            }}>
              <span>Easiest Way to Start Onchain Journey</span>
            </div>
          </div>

          {error && (
            <div style={{
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: '8px',
              padding: '1rem',
              marginBottom: '1rem',
              color: '#ef4444',
            }}>
              {error}
            </div>
          )}

          <div style={{
            display: 'flex',
            flexDirection: 'row',
            gap: '1rem',
            alignItems: 'center',
            justifyContent: 'center',
            width: '100%',
            flexWrap: 'wrap',
          }}>
            <button
              onClick={handleCreateWithPasskey}
              disabled={loading}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.75rem',
                background: 'linear-gradient(135deg, #4c3af9, #5c4aff)',
                color: '#ffffff',
                border: 'none',
                borderRadius: '12px',
                padding: '1rem 2rem',
                fontSize: '1rem',
                fontWeight: '700',
                cursor: loading ? 'not-allowed' : 'pointer',
                transition: 'all 0.3s ease',
                boxShadow: '0 8px 24px rgba(76, 58, 249, 0.3)',
                position: 'relative',
                overflow: 'hidden',
                flex: '0 1 auto',
                whiteSpace: 'nowrap',
                letterSpacing: '0.5px',
                animation: 'btnGlow 2s ease-in-out infinite',
                opacity: loading ? 0.6 : 1,
              }}
            >
              <span>{loading ? 'CREATING...' : 'LAUNCH WEB APP'}</span>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '1.25rem', height: '1.25rem' }}>
                <line x1="5" y1="12" x2="19" y2="12" />
                <polyline points="12 5 19 12 12 19" />
              </svg>
            </button>

            <button
              onClick={() => router.push('/passkey-create')}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.75rem',
                background: 'linear-gradient(135deg, var(--teal-accent), var(--teal-dark))',
                color: '#ffffff',
                border: 'none',
                borderRadius: '12px',
                padding: '1rem 2rem',
                fontSize: '1rem',
                fontWeight: '700',
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                boxShadow: '0 12px 32px rgba(16, 185, 129, 0.3)',
                position: 'relative',
                overflow: 'hidden',
                flex: '0 1 auto',
                whiteSpace: 'nowrap',
                letterSpacing: '0.5px',
              }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '1.25rem', height: '1.25rem' }}>
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
        bottom: '1.5rem',
        left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        zIndex: 10,
      }}>
        <span style={{ color: 'var(--secondary-text)', fontSize: '0.875rem' }}>Powered by</span>
        <span style={{ color: 'var(--primary-text)', fontSize: '0.875rem', fontWeight: '600' }}>Injective</span>
      </div>
    </div>
  );
}
