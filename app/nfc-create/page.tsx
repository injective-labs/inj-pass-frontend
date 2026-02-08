'use client';

import { useRouter } from 'next/navigation';

export default function NFCCreatePage() {
  const router = useRouter();

  return (
    <div style={styles.container}>
      <div style={styles.content}>
        <div style={styles.iconContainer}>
          <div style={styles.icon}>📱</div>
          <div style={styles.waves}>
            <div style={styles.wave}></div>
            <div style={styles.wave}></div>
            <div style={styles.wave}></div>
          </div>
        </div>

        <h1 style={styles.title}>NFC Wallet</h1>
        <p style={styles.subtitle}>Coming Soon</p>

        <div style={styles.description}>
          <p style={styles.text}>
            NFC wallet functionality is currently under development.
          </p>
          <p style={styles.text}>
            This feature will allow you to create and unlock your wallet
            using a physical NFC card for enhanced security.
          </p>
        </div>

        <div style={styles.features}>
          <div style={styles.feature}>
            <span style={styles.featureIcon}>🔒</span>
            <span style={styles.featureText}>Physical Security</span>
          </div>
          <div style={styles.feature}>
            <span style={styles.featureIcon}>⚡</span>
            <span style={styles.featureText}>Quick Access</span>
          </div>
          <div style={styles.feature}>
            <span style={styles.featureIcon}>✨</span>
            <span style={styles.featureText}>Offline Key</span>
          </div>
        </div>

        <button onClick={() => router.back()} style={styles.backBtn}>
          ← Back to Welcome
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
    textAlign: 'center',
  },
  iconContainer: {
    position: 'relative',
    width: '120px',
    height: '120px',
    margin: '0 auto 2rem',
  },
  icon: {
    fontSize: '4rem',
    position: 'relative',
    zIndex: 2,
  },
  waves: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    width: '100%',
    height: '100%',
  },
  wave: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: '80px',
    height: '80px',
    border: '2px solid var(--accent-color)',
    borderRadius: '50%',
    transform: 'translate(-50%, -50%)',
    animation: 'pulse 2s ease-out infinite',
    opacity: 0,
  },
  title: {
    fontSize: '2rem',
    fontWeight: '700',
    color: 'var(--primary-text)',
    marginBottom: '0.5rem',
  },
  subtitle: {
    fontSize: '1.25rem',
    fontWeight: '600',
    color: 'var(--accent-color)',
    marginBottom: '2rem',
  },
  description: {
    marginBottom: '2rem',
  },
  text: {
    fontSize: '0.875rem',
    color: 'var(--secondary-text)',
    lineHeight: '1.6',
    marginBottom: '0.75rem',
  },
  features: {
    display: 'flex',
    justifyContent: 'space-around',
    marginBottom: '3rem',
    padding: '1.5rem',
    backgroundColor: 'var(--surface-muted)',
    borderRadius: '12px',
  },
  feature: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '0.5rem',
  },
  featureIcon: {
    fontSize: '1.5rem',
  },
  featureText: {
    fontSize: '0.75rem',
    fontWeight: '600',
    color: 'var(--primary-text)',
  },
  backBtn: {
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
};
