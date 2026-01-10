'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useWallet } from '@/contexts/WalletContext';
import { toHex } from '@/wallet/key-management';

export default function SettingsPage() {
  const router = useRouter();
  const { isUnlocked, address, privateKey, keystore, lock } = useWallet();
  const [showPrivateKey, setShowPrivateKey] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!isUnlocked || !address) {
    if (typeof window !== 'undefined') {
      router.push('/welcome');
    }
    return null;
  }

  const handleCopy = () => {
    if (privateKey) {
      const pkHex = toHex(privateKey);
      navigator.clipboard.writeText(pkHex);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleBack = () => {
    router.back();
  };

  const handleLock = () => {
    lock();
    router.push('/welcome');
  };

  const privateKeyHex = privateKey ? toHex(privateKey) : '';

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <button onClick={handleBack} style={styles.backBtn}>← Back</button>
        <h1 style={styles.title}>Settings</h1>
        <div style={{ width: '60px' }}></div>
      </header>

      <div style={styles.section}>
        <h2 style={styles.sectionTitle}>Account Info</h2>
        <div style={styles.card}>
          <div style={styles.label}>Wallet Address</div>
          <div style={styles.value}>{address}</div>
          <div style={styles.label}>Source</div>
          <div style={styles.value}>{keystore?.source.toUpperCase()}</div>
        </div>
      </div>

      <div style={styles.section}>
        <h2 style={styles.sectionTitle}>Security</h2>
        <div style={styles.card}>
          <div style={styles.exportHeader}>
            <div style={styles.label}>Private Key</div>
            {!showPrivateKey ? (
              <button 
                onClick={() => setShowPrivateKey(true)} 
                style={styles.showBtn}
              >
                👁️ Show
              </button>
            ) : (
              <button 
                onClick={() => setShowPrivateKey(false)} 
                style={styles.hideBtn}
              >
                🕵️ Hide
              </button>
            )}
          </div>

          {showPrivateKey && (
            <div style={styles.pkContainer}>
              <div style={styles.pkBox}>
                {privateKeyHex}
              </div>
              <button onClick={handleCopy} style={styles.copyBtn}>
                {copied ? '✅ Copied' : '📋 Copy Private Key'}
              </button>
              <div style={styles.warning}>
                ⚠️ NEVER share your private key. Anyone with this key can steal your funds.
              </div>
            </div>
          )}
        </div>
      </div>

      <div style={styles.section}>
        <button onClick={handleLock} style={styles.lockBtn}>
          🔒 Lock Wallet
        </button>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: '100vh',
    padding: '1.5rem',
    backgroundColor: 'var(--bg-color)',
    maxWidth: '600px',
    margin: '0 auto',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '2rem',
  },
  title: {
    fontSize: '1.5rem',
    fontWeight: '700',
    color: 'var(--primary-text)',
  },
  backBtn: {
    padding: '0.5rem',
    fontSize: '1rem',
    backgroundColor: 'transparent',
    border: 'none',
    color: 'var(--accent-color)',
    cursor: 'pointer',
    fontWeight: '600',
  },
  section: {
    marginBottom: '2rem',
  },
  sectionTitle: {
    fontSize: '1rem',
    fontWeight: '600',
    color: 'var(--secondary-text)',
    textTransform: 'uppercase',
    marginBottom: '0.75rem',
    letterSpacing: '0.05em',
  },
  card: {
    padding: '1.25rem',
    backgroundColor: 'var(--card-bg)',
    border: '2px solid var(--card-border)',
    borderRadius: '12px',
  },
  label: {
    fontSize: '0.75rem',
    color: 'var(--secondary-text)',
    marginBottom: '0.25rem',
  },
  value: {
    fontSize: '0.875rem',
    color: 'var(--primary-text)',
    fontFamily: 'monospace',
    wordBreak: 'break-all',
    marginBottom: '1rem',
  },
  exportHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  showBtn: {
    padding: '0.4rem 0.8rem',
    fontSize: '0.875rem',
    backgroundColor: 'var(--accent-color)',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
  },
  hideBtn: {
    padding: '0.4rem 0.8rem',
    fontSize: '0.875rem',
    backgroundColor: 'var(--surface-muted)',
    color: 'var(--primary-text)',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
  },
  pkContainer: {
    marginTop: '1rem',
  },
  pkBox: {
    padding: '1rem',
    backgroundColor: 'rgba(0,0,0,0.05)',
    borderRadius: '8px',
    fontSize: '0.875rem',
    fontFamily: 'monospace',
    wordBreak: 'break-all',
    color: 'var(--primary-text)',
    border: '1px dashed var(--card-border)',
    marginBottom: '1rem',
  },
  copyBtn: {
    width: '100%',
    padding: '0.75rem',
    backgroundColor: 'var(--surface-muted)',
    border: '1px solid var(--card-border)',
    borderRadius: '8px',
    color: 'var(--primary-text)',
    cursor: 'pointer',
    fontWeight: '600',
    marginBottom: '1rem',
  },
  warning: {
    fontSize: '0.75rem',
    color: '#ff4d4f',
    textAlign: 'center',
    padding: '0.5rem',
    backgroundColor: 'rgba(255, 77, 79, 0.1)',
    borderRadius: '6px',
  },
  lockBtn: {
    width: '100%',
    padding: '1rem',
    fontSize: '1rem',
    fontWeight: '600',
    backgroundColor: 'transparent',
    border: '2px solid #ff4d4f',
    borderRadius: '12px',
    color: '#ff4d4f',
    cursor: 'pointer',
  },
};
