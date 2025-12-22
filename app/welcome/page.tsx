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

  const handleCreateWithPasskey = async () => {
    setLoading(true);
    setError('');
    
    try {
      // Check if wallet already exists in localStorage
      const walletExists = hasWallet();

      let credentialId: string;
      
      if (walletExists) {
        // Wallet exists - use unlock flow instead
        const { loadWallet } = await import('@/wallet/keystore');
        const keystore = loadWallet();
        
        if (!keystore || !keystore.credentialId) {
          throw new Error('Invalid wallet data');
        }
        
        credentialId = keystore.credentialId;
        
        // Unlock existing wallet
        const { unlockByPasskey } = await import('@/wallet/key-management/createByPasskey');
        const { decryptKey } = await import('@/wallet/keystore');
        
        const entropy = await unlockByPasskey(credentialId);
        const privateKey = await decryptKey(keystore.encryptedPrivateKey, entropy);
        
        unlock(privateKey, keystore);
      } else {
        // No wallet - create new one
        const result = await createByPasskey('user@injective-pass');
        
        // Load the wallet that was just created
        const { loadWallet } = await import('@/wallet/keystore');
        const keystore = loadWallet();
        
        if (!keystore) {
          throw new Error('Failed to load created wallet');
        }

        // Unlock the wallet immediately after creation
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

  const handleImport = async () => {
    setLoading(true);
    setError('');
    
    try {
      const result = importPrivateKey(privateKeyInput);
      
      // Encrypt with a simple password-derived key (for demo)
      const password = 'temp-password'; // In production, ask user for password
      const entropy = sha256(new TextEncoder().encode(password));
      const encrypted = await encryptKey(result.privateKey, entropy);
      
      // Save to storage
      saveWallet({
        address: result.address,
        encryptedPrivateKey: encrypted,
        source: 'import',
        createdAt: Date.now(),
      });

      // Unlock immediately
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

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2rem',
      backgroundColor: 'var(--bg-color)',
    }}>
      <div style={{
        width: '100%',
        maxWidth: '480px',
        textAlign: 'center',
      }}>
        <h1 style={{
          fontSize: '2.5rem',
          fontWeight: '700',
          marginBottom: '0.5rem',
          color: 'var(--primary-text)',
        }}>
          Injective Pass
        </h1>
        <p style={{
          fontSize: '1rem',
          color: 'var(--secondary-text)',
          marginBottom: '3rem',
        }}>
          Your secure Passkey-powered wallet
        </p>

        {error && (
          <div style={{
            padding: '1rem',
            marginBottom: '1.5rem',
            backgroundColor: '#FEE',
            border: '1px solid #F88',
            borderRadius: '8px',
            color: '#C00',
            fontSize: '0.875rem',
          }}>
            {error}
          </div>
        )}

        {!showImport ? (
          <>
            <button
              onClick={walletExists ? handleCreateWithPasskey : () => router.push('/passkey-create')}
              disabled={loading}
              style={{
                width: '100%',
                padding: '1rem',
                fontSize: '1rem',
                fontWeight: '600',
                backgroundColor: loading ? 'var(--surface-muted)' : 'var(--accent-color)',
                color: 'white',
                border: 'none',
                borderRadius: '12px',
                marginBottom: '1rem',
                cursor: loading ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                if (!loading) e.currentTarget.style.backgroundColor = 'var(--accent-hover)';
              }}
              onMouseLeave={(e) => {
                if (!loading) e.currentTarget.style.backgroundColor = 'var(--accent-color)';
              }}
            >
              {loading ? 'Unlocking...' : (walletExists ? '🔓 Unlock with Passkey' : '🔐 Create with Passkey')}
            </button>

            <button
              onClick={() => router.push('/nfc-create')}
              disabled={loading}
              style={{
                width: '100%',
                padding: '1rem',
                fontSize: '1rem',
                fontWeight: '600',
                backgroundColor: 'transparent',
                color: 'var(--primary-text)',
                border: '2px solid var(--surface-border)',
                borderRadius: '12px',
                marginBottom: '1rem',
                cursor: 'pointer',
              }}
            >
              📱 Create with NFC
            </button>

            <button
              onClick={() => setShowImport(true)}
              disabled={loading}
              style={{
                width: '100%',
                padding: '1rem',
                fontSize: '1rem',
                fontWeight: '600',
                backgroundColor: 'transparent',
                color: 'var(--secondary-text)',
                border: '2px solid var(--surface-border)',
                borderRadius: '12px',
                cursor: 'pointer',
              }}
            >
              Import Private Key
            </button>
          </>
        ) : (
          <>
            <div style={{ textAlign: 'left', marginBottom: '1.5rem' }}>
              <label style={{
                display: 'block',
                marginBottom: '0.5rem',
                fontSize: '0.875rem',
                fontWeight: '600',
                color: 'var(--primary-text)',
              }}>
                Private Key
              </label>
              <input
                type="password"
                value={privateKeyInput}
                onChange={(e) => setPrivateKeyInput(e.target.value)}
                placeholder="0x..."
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  fontSize: '0.875rem',
                  fontFamily: 'monospace',
                  border: '2px solid var(--surface-border)',
                  borderRadius: '8px',
                  backgroundColor: 'var(--surface)',
                  color: 'var(--primary-text)',
                }}
              />
            </div>

            <button
              onClick={handleImport}
              disabled={loading || !privateKeyInput}
              style={{
                width: '100%',
                padding: '1rem',
                fontSize: '1rem',
                fontWeight: '600',
                backgroundColor: loading || !privateKeyInput ? 'var(--surface-muted)' : 'var(--accent-color)',
                color: 'white',
                border: 'none',
                borderRadius: '12px',
                marginBottom: '1rem',
                cursor: loading || !privateKeyInput ? 'not-allowed' : 'pointer',
              }}
            >
              {loading ? 'Importing...' : 'Import Wallet'}
            </button>

            <button
              onClick={() => {
                setShowImport(false);
                setPrivateKeyInput('');
                setError('');
              }}
              disabled={loading}
              style={{
                width: '100%',
                padding: '1rem',
                fontSize: '1rem',
                fontWeight: '600',
                backgroundColor: 'transparent',
                color: 'var(--secondary-text)',
                border: '2px solid var(--surface-border)',
                borderRadius: '12px',
                cursor: 'pointer',
              }}
            >
              Back
            </button>
          </>
        )}
      </div>
    </div>
  );
}
