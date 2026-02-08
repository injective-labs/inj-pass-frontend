/**
 * Test page for wallet key management
 * Access at /test-wallet
 */

'use client';

import { useState } from 'react';
import { runKeystoreTests } from '@/wallet/__tests__/keystore.test';

export default function TestWalletPage() {
  const [output, setOutput] = useState<string[]>([]);
  const [running, setRunning] = useState(false);

  const runTests = async () => {
    setRunning(true);
    setOutput([]);

    // Capture console.log
    const logs: string[] = [];
    const originalLog = console.log;
    const originalError = console.error;

    console.log = (...args: any[]) => {
      const message = args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
      ).join(' ');
      logs.push(message);
      setOutput(prev => [...prev, message]);
      originalLog(...args);
    };

    console.error = (...args: any[]) => {
      const message = '❌ ' + args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
      ).join(' ');
      logs.push(message);
      setOutput(prev => [...prev, message]);
      originalError(...args);
    };

    try {
      await runKeystoreTests();
    } catch (error) {
      console.error('Test execution failed:', error);
    }

    // Restore console
    console.log = originalLog;
    console.error = originalError;

    setRunning(false);
  };

  return (
    <div style={{ padding: '2rem', fontFamily: 'monospace', maxWidth: '800px', margin: '0 auto' }}>
      <h1 style={{ marginBottom: '1rem' }}>🧪 Wallet Keystore Tests</h1>
      
      <button
        onClick={runTests}
        disabled={running}
        style={{
          padding: '0.75rem 1.5rem',
          fontSize: '1rem',
          backgroundColor: running ? '#ccc' : '#0066FF',
          color: 'white',
          border: 'none',
          borderRadius: '8px',
          cursor: running ? 'not-allowed' : 'pointer',
          marginBottom: '1.5rem',
        }}
      >
        {running ? 'Running...' : 'Run Tests'}
      </button>

      <div
        style={{
          backgroundColor: '#000',
          color: '#0f0',
          padding: '1rem',
          borderRadius: '8px',
          minHeight: '400px',
          maxHeight: '600px',
          overflow: 'auto',
          whiteSpace: 'pre-wrap',
          fontSize: '0.875rem',
          lineHeight: '1.5',
        }}
      >
        {output.length === 0 ? (
          <div style={{ color: '#666' }}>Click "Run Tests" to start...</div>
        ) : (
          output.map((line, i) => (
            <div key={i}>{line}</div>
          ))
        )}
      </div>
    </div>
  );
}
