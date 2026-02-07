'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useWallet } from '@/contexts/WalletContext';
import { unlockByPasskey } from '@/wallet/key-management/createByPasskey';
import { unlockByNFC, readNFCTag } from '@/wallet/key-management/createByNFC';
import { decryptKey } from '@/wallet/keystore';
import { saveSessionToken } from '@/services/session';
import type { LocalKeystore } from '@/types/wallet';

export default function UnlockPage() {
  const router = useRouter();
  const { unlock } = useWallet();
  const [keystore, setKeystore] = useState<LocalKeystore | null>(null);
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [nfcScanning, setNfcScanning] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('wallet_keystore');
    if (!stored) {
      router.push('/welcome');
      return;
    }

    try {
      const parsed = JSON.parse(stored) as LocalKeystore;
      setKeystore(parsed);
    } catch {
      router.push('/welcome');
    }
  }, [router]);

  const handleUnlockPasskey = async () => {
    if (!keystore?.credentialId) return;

    setLoading(true);
    setError('');

    try {
      const { entropy, sessionToken } = await unlockByPasskey(keystore.credentialId);
      const privateKey = await decryptKey(keystore.encryptedPrivateKey, entropy);
      
      // Save session token if provided by backend
      if (sessionToken) {
        saveSessionToken(sessionToken, keystore.address);
      }
      
      unlock(privateKey, keystore);
      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to unlock with Passkey');
    } finally {
      setLoading(false);
    }
  };

  const handleUnlockNFC = async () => {
    if (!keystore?.nfcUID) return;

    setNfcScanning(true);
    setError('');

    try {
      const nfcUID = await readNFCTag();
      
      if (nfcUID !== keystore.nfcUID) {
        throw new Error('NFC card does not match the registered card');
      }

      const entropy = await unlockByNFC(nfcUID);
      const privateKey = await decryptKey(keystore.encryptedPrivateKey, entropy);
      
      unlock(privateKey, keystore);
      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to unlock with NFC');
    } finally {
      setNfcScanning(false);
    }
  };

  const handleUnlockPassword = async () => {
    if (!keystore || !password) return;

    setLoading(true);
    setError('');

    try {
      const encoder = new TextEncoder();
      const entropy = encoder.encode(password);
      const privateKey = await decryptKey(keystore.encryptedPrivateKey, entropy);
      
      unlock(privateKey, keystore);
      router.push('/dashboard');
    } catch (err) {
      setError('Incorrect password');
    } finally {
      setLoading(false);
    }
  };

  if (!keystore) {
    return (
      <div style={styles.container}>
        <div style={styles.loading}>Loading...</div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.content}>
        <h1 style={styles.title}>🔒 Unlock Wallet</h1>
        
        <div style={styles.addressCard}>
          <div style={styles.addressLabel}>Wallet Address</div>
          <div style={styles.addressValue}>
            {keystore.address.slice(0, 10)}...{keystore.address.slice(-8)}
          </div>
        </div>

        {error && (
          <div style={styles.errorBanner}>
            {error}
          </div>
        )}

        {keystore.source === 'passkey' && (
          <button
            onClick={handleUnlockPasskey}
            disabled={loading}
            style={styles.primaryBtn}
          >
            {loading ? 'Unlocking...' : '🔑 Unlock with Passkey'}
          </button>
        )}

        {keystore.source === 'nfc' && (
          <button
            onClick={handleUnlockNFC}
            disabled={nfcScanning}
            style={styles.primaryBtn}
          >
            {nfcScanning ? '📡 Scanning NFC...' : '📱 Unlock with NFC'}
          </button>
        )}

        {keystore.source === 'import' && (
          <div style={styles.passwordForm}>
            <label style={styles.label}>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              style={styles.input}
              onKeyDown={(e) => e.key === 'Enter' && handleUnlockPassword()}
            />
            <button
              onClick={handleUnlockPassword}
              disabled={!password || loading}
              style={{
                ...styles.primaryBtn,
                opacity: !password || loading ? 0.5 : 1,
              }}
            >
              {loading ? 'Unlocking...' : '🔓 Unlock'}
            </button>
          </div>
        )}

        <button
          onClick={() => {
            localStorage.removeItem('wallet_keystore');
            router.push('/welcome');
          }}
          style={styles.resetBtn}
        >
          Reset Wallet
        </button>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '1.5rem',
    backgroundColor: 'var(--bg-color)',
  },
  content: {
    width: '100%',
    maxWidth: '400px',
    display: 'flex',
    flexDirection: 'column',
    gap: '1.5rem',
  },
  title: {
    fontSize: '2rem',
    fontWeight: '700',
    textAlign: 'center',
    color: 'var(--primary-text)',
    marginBottom: '1rem',
  },
  addressCard: {
    padding: '1rem',
    backgroundColor: 'var(--surface-muted)',
    borderRadius: '8px',
    textAlign: 'center',
  },
  addressLabel: {
    fontSize: '0.75rem',
    fontWeight: '600',
    color: 'var(--secondary-text)',
    textTransform: 'uppercase',
    marginBottom: '0.5rem',
  },
  addressValue: {
    fontSize: '0.875rem',
    fontFamily: 'monospace',
    color: 'var(--primary-text)',
  },
  primaryBtn: {
    width: '100%',
    padding: '1rem',
    fontSize: '1rem',
    fontWeight: '600',
    backgroundColor: 'var(--accent-color)',
    color: 'white',
    border: 'none',
    borderRadius: '12px',
    cursor: 'pointer',
  },
  passwordForm: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
  },
  label: {
    fontSize: '0.875rem',
    fontWeight: '600',
    color: 'var(--primary-text)',
  },
  input: {
    padding: '0.75rem',
    fontSize: '1rem',
    border: '2px solid var(--surface-border)',
    borderRadius: '8px',
    backgroundColor: 'var(--surface)',
    color: 'var(--primary-text)',
  },
  resetBtn: {
    width: '100%',
    padding: '0.75rem',
    fontSize: '0.875rem',
    backgroundColor: 'transparent',
    color: 'var(--secondary-text)',
    border: '2px solid var(--surface-border)',
    borderRadius: '8px',
    cursor: 'pointer',
  },
  errorBanner: {
    padding: '1rem',
    backgroundColor: '#FEE',
    border: '1px solid #F88',
    borderRadius: '8px',
    color: '#C00',
    fontSize: '0.875rem',
    textAlign: 'center',
  },
  loading: {
    textAlign: 'center',
    color: 'var(--secondary-text)',
  },
};
