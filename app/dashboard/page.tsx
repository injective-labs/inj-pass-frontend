'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useWallet } from '@/contexts/WalletContext';
import { getBalance, getTxHistory } from '@/wallet/chain';
import { Balance, TransactionHistory, INJECTIVE_TESTNET } from '@/types/chain';

export default function DashboardPage() {
  const router = useRouter();
  const { isUnlocked, address, lock } = useWallet();
  const [balance, setBalance] = useState<Balance | null>(null);
  const [transactions, setTransactions] = useState<TransactionHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (!isUnlocked || !address) {
      router.push('/welcome');
      return;
    }

    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isUnlocked, address]);

  const loadData = async () => {
    if (!address) return;

    try {
      setLoading(true);
      // Only load balance, skip transaction history for now (RPC intensive)
      const balanceData = await getBalance(address, INJECTIVE_TESTNET);
      
      setBalance(balanceData);
      setTransactions([]); // Empty for now
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const handleLock = () => {
    lock();
    router.push('/welcome');
  };

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.loading}>Loading...</div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* Header */}
      <header style={styles.header}>
        <h1 style={styles.title}>Injective Pass</h1>
        <button onClick={handleLock} style={styles.lockBtn}>
          🔒 Lock
        </button>
      </header>

      {/* Address Display */}
      <div style={styles.addressCard}>
        <div style={styles.addressLabel}>Your Address</div>
        <div style={styles.address}>
          {address?.slice(0, 6)}...{address?.slice(-4)}
        </div>
        <button
          onClick={() => navigator.clipboard.writeText(address || '')}
          style={styles.copyBtn}
        >
          📋 Copy
        </button>
      </div>

      {/* Balance Card */}
      <div style={styles.balanceCard}>
        <div style={styles.balanceLabel}>Total Balance</div>
        <div style={styles.balanceAmount}>
          {balance ? parseFloat(balance.formatted).toFixed(4) : '0.0000'} {balance?.symbol || 'INJ'}
        </div>
        <div style={styles.balanceUsd}>≈ ${balance ? (parseFloat(balance.formatted) * 25).toFixed(2) : '0.00'} USD</div>
        
        <button onClick={handleRefresh} disabled={refreshing} style={styles.refreshBtn}>
          {refreshing ? '⟳ Refreshing...' : '⟳ Refresh'}
        </button>
      </div>

      {/* Quick Actions */}
      <div style={styles.actions}>
        <button onClick={() => router.push('/send')} style={styles.actionBtn}>
          <span style={styles.actionIcon}>📤</span>
          <span>Send</span>
        </button>
        <button onClick={() => router.push('/receive')} style={styles.actionBtn}>
          <span style={styles.actionIcon}>📥</span>
          <span>Receive</span>
        </button>
      </div>

      {/* Transaction History */}
      <div style={styles.historySection}>
        <h2 style={styles.historyTitle}>Recent Transactions</h2>
        {transactions.length === 0 ? (
          <div style={styles.emptyState}>No transactions yet</div>
        ) : (
          <div style={styles.txList}>
            {transactions.map((tx) => (
              <div key={tx.hash} style={styles.txItem}>
                <div style={styles.txIcon}>
                  {tx.from.toLowerCase() === address?.toLowerCase() ? '📤' : '📥'}
                </div>
                <div style={styles.txDetails}>
                  <div style={styles.txAddress}>
                    {tx.from.toLowerCase() === address?.toLowerCase()
                      ? `To: ${tx.to?.slice(0, 6)}...${tx.to?.slice(-4)}`
                      : `From: ${tx.from.slice(0, 6)}...${tx.from.slice(-4)}`}
                  </div>
                  <div style={styles.txTime}>
                    {new Date(tx.timestamp * 1000).toLocaleDateString()}
                  </div>
                </div>
                <div style={styles.txAmount}>
                  {tx.from.toLowerCase() === address?.toLowerCase() ? '-' : '+'}
                  {(Number(tx.value) / 1e18).toFixed(4)} INJ
                </div>
              </div>
            ))}
          </div>
        )}
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
  loading: {
    textAlign: 'center',
    padding: '3rem',
    color: 'var(--secondary-text)',
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
  lockBtn: {
    padding: '0.5rem 1rem',
    fontSize: '0.875rem',
    backgroundColor: 'transparent',
    border: '2px solid var(--surface-border)',
    borderRadius: '8px',
    color: 'var(--primary-text)',
    cursor: 'pointer',
  },
  addressCard: {
    padding: '1.5rem',
    backgroundColor: 'var(--card-bg)',
    border: '2px solid var(--card-border)',
    borderRadius: '12px',
    marginBottom: '1.5rem',
    textAlign: 'center',
  },
  addressLabel: {
    fontSize: '0.75rem',
    fontWeight: '600',
    color: 'var(--secondary-text)',
    textTransform: 'uppercase',
    marginBottom: '0.5rem',
  },
  address: {
    fontSize: '1.25rem',
    fontWeight: '600',
    fontFamily: 'monospace',
    color: 'var(--primary-text)',
    marginBottom: '1rem',
  },
  copyBtn: {
    padding: '0.5rem 1rem',
    fontSize: '0.875rem',
    backgroundColor: 'var(--surface-muted)',
    border: 'none',
    borderRadius: '8px',
    color: 'var(--primary-text)',
    cursor: 'pointer',
  },
  balanceCard: {
    padding: '2rem',
    backgroundColor: 'var(--accent-color)',
    borderRadius: '16px',
    marginBottom: '1.5rem',
    textAlign: 'center',
    color: 'white',
  },
  balanceLabel: {
    fontSize: '0.875rem',
    opacity: 0.9,
    marginBottom: '0.5rem',
  },
  balanceAmount: {
    fontSize: '2.5rem',
    fontWeight: '700',
    marginBottom: '0.25rem',
  },
  balanceUsd: {
    fontSize: '1rem',
    opacity: 0.8,
    marginBottom: '1.5rem',
  },
  refreshBtn: {
    padding: '0.5rem 1rem',
    fontSize: '0.875rem',
    backgroundColor: 'rgba(255,255,255,0.2)',
    border: 'none',
    borderRadius: '8px',
    color: 'white',
    cursor: 'pointer',
  },
  actions: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '1rem',
    marginBottom: '2rem',
  },
  actionBtn: {
    padding: '1.5rem',
    fontSize: '1rem',
    fontWeight: '600',
    backgroundColor: 'var(--card-bg)',
    border: '2px solid var(--card-border)',
    borderRadius: '12px',
    color: 'var(--primary-text)',
    cursor: 'pointer',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '0.5rem',
  },
  actionIcon: {
    fontSize: '2rem',
  },
  historySection: {
    marginTop: '2rem',
  },
  historyTitle: {
    fontSize: '1.25rem',
    fontWeight: '700',
    color: 'var(--primary-text)',
    marginBottom: '1rem',
  },
  emptyState: {
    textAlign: 'center',
    padding: '3rem',
    color: 'var(--secondary-text)',
    backgroundColor: 'var(--surface-muted)',
    borderRadius: '12px',
  },
  txList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
  },
  txItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
    padding: '1rem',
    backgroundColor: 'var(--card-bg)',
    border: '2px solid var(--card-border)',
    borderRadius: '12px',
  },
  txIcon: {
    fontSize: '1.5rem',
  },
  txDetails: {
    flex: 1,
  },
  txAddress: {
    fontSize: '0.875rem',
    fontWeight: '600',
    color: 'var(--primary-text)',
    marginBottom: '0.25rem',
  },
  txTime: {
    fontSize: '0.75rem',
    color: 'var(--secondary-text)',
  },
  txAmount: {
    fontSize: '0.875rem',
    fontWeight: '600',
    fontFamily: 'monospace',
    color: 'var(--primary-text)',
  },
};
