/**
 * Test page for Passkey integration
 * Access at /test-passkey
 */

'use client';

import { useState } from 'react';
import { runAllTests } from './test-passkey';

export default function TestPasskeyPage() {
  const [output, setOutput] = useState<string[]>([]);
  const [running, setRunning] = useState(false);

  const runTests = async () => {
    setRunning(true);
    setOutput([]);

    // Capture console.log
    const originalLog = console.log;
    const originalError = console.error;

    console.log = (...args: any[]) => {
      const message = args
        .map((arg) =>
          typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
        )
        .join(' ');
      setOutput((prev) => [...prev, message]);
      originalLog(...args);
    };

    console.error = (...args: any[]) => {
      const message =
        '❌ ' +
        args
          .map((arg) =>
            typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
          )
          .join(' ');
      setOutput((prev) => [...prev, message]);
      originalError(...args);
    };

    try {
      await runAllTests();
    } catch (error) {
      console.error('Test execution failed:', error);
    }

    // Restore console
    console.log = originalLog;
    console.error = originalError;

    setRunning(false);
  };

  return (
    <div
      style={{
        padding: '2rem',
        fontFamily: 'monospace',
        maxWidth: '900px',
        margin: '0 auto',
      }}
    >
      <h1 style={{ marginBottom: '1rem' }}>🔐 Passkey Integration Test</h1>
      <p style={{ color: '#666', marginBottom: '1rem' }}>
        This test will create a Passkey and verify it with the backend.
      </p>
      <p style={{ color: '#666', marginBottom: '2rem' }}>
        ⚠️ Make sure backend is running and NEXT_PUBLIC_API_URL is configured
      </p>

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
          minHeight: '500px',
          maxHeight: '700px',
          overflow: 'auto',
          whiteSpace: 'pre-wrap',
          fontSize: '0.875rem',
          lineHeight: '1.5',
        }}
      >
        {output.length === 0 ? (
          <div style={{ color: '#666' }}>
            Click &quot;Run Tests&quot; to start...
          </div>
        ) : (
          output.map((line, i) => <div key={i}>{line}</div>)
        )}
      </div>

      <div style={{ marginTop: '1.5rem', padding: '1rem', backgroundColor: '#f5f5f5', borderRadius: '8px' }}>
        <h3 style={{ marginTop: 0 }}>Test Flow:</h3>
        <ol style={{ marginBottom: 0 }}>
          <li>Registration: Request challenge → Create credential → Verify</li>
          <li>Authentication: Request challenge → Get assertion → Verify</li>
        </ol>
      </div>
    </div>
  );
}
