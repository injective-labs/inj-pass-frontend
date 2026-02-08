'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { isNFCSupported, readNFCCard } from '@/services/nfc';

export default function NFCDiagnosticPage() {
  const router = useRouter();
  const [isSupported, setIsSupported] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [lastScan, setLastScan] = useState<any>(null);
  const [error, setError] = useState('');
  const [logs, setLogs] = useState<string[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || !mounted) return;
    
    const supported = isNFCSupported();
    setIsSupported(supported);
    addLog(`NFC Support: ${supported}`);
    addLog(`User Agent: ${navigator.userAgent}`);
    addLog(`Secure Context: ${window.isSecureContext}`);
    addLog(`Protocol: ${window.location.protocol}`);
  }, [mounted]);

  const addLog = (message: string) => {
    const timestamp = new Date().toISOString();
    setLogs(prev => [...prev, `[${timestamp}] ${message}`]);
    console.log(message);
  };

  const handleScan = async () => {
    setScanning(true);
    setError('');
    setLastScan(null);
    addLog('Starting NFC scan...');

    try {
      const cardData = await readNFCCard();
      addLog(`Scan successful: ${JSON.stringify(cardData)}`);
      setLastScan(cardData);
      setScanning(false);
    } catch (err: any) {
      addLog(`Scan failed: ${err.message}`);
      setError(err.message);
      setScanning(false);
    }
  };

  const clearLogs = () => {
    setLogs([]);
    setLastScan(null);
    setError('');
  };

  if (!mounted) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-gray-400">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white p-6">
      {/* Header */}
      <div className="max-w-4xl mx-auto mb-6">
        <div className="flex items-center gap-4 mb-4">
          <button
            onClick={() => router.back()}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 transition-all"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <polyline points="15 18 9 12 15 6" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <div>
            <h1 className="text-2xl font-bold">NFC Diagnostic</h1>
            <p className="text-gray-400 text-sm">Test and debug NFC functionality</p>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto space-y-6">
        {/* Status Card */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
          <h2 className="text-lg font-bold mb-4">NFC Status</h2>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-gray-400">API Support:</span>
              <span className={`font-bold ${isSupported ? 'text-green-400' : 'text-red-400'}`}>
                {isSupported ? '✓ Supported' : '✗ Not Supported'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-400">Browser:</span>
              <span className="text-white text-sm">
                {navigator.userAgent.includes('Chrome') ? 'Chrome' : 
                 navigator.userAgent.includes('Android') ? 'Android Browser' : 'Other'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-400">HTTPS:</span>
              <span className={`font-bold ${window.isSecureContext ? 'text-green-400' : 'text-red-400'}`}>
                {window.isSecureContext ? '✓ Secure' : '✗ Not Secure'}
              </span>
            </div>
          </div>
        </div>

        {/* Scan Controls */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
          <h2 className="text-lg font-bold mb-4">Scan Test</h2>
          
          {!isSupported ? (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 mb-4">
              <p className="text-red-400 text-sm">
                ⚠️ NFC is not supported. Please use Android Chrome browser on HTTPS.
              </p>
            </div>
          ) : null}

          {error ? (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 mb-4">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          ) : null}

          <button
            onClick={handleScan}
            disabled={!isSupported || scanning}
            className="w-full py-4 px-6 rounded-xl bg-white text-black font-bold hover:bg-gray-100 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {scanning ? 'Scanning... (Tap your card)' : 'Start NFC Scan'}
          </button>

          {lastScan && (
            <div className="mt-4 bg-green-500/10 border border-green-500/30 rounded-xl p-4">
              <h3 className="text-green-400 font-bold mb-2">Last Scan Result</h3>
              <pre className="text-xs text-gray-300 overflow-auto">
                {JSON.stringify(lastScan, null, 2)}
              </pre>
            </div>
          )}
        </div>

        {/* Logs */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold">Debug Logs</h2>
            <button
              onClick={clearLogs}
              className="text-sm text-gray-400 hover:text-white transition-colors"
            >
              Clear
            </button>
          </div>
          <div className="bg-black/30 rounded-xl p-4 max-h-96 overflow-auto">
            {logs.length === 0 ? (
              <p className="text-gray-500 text-sm">No logs yet</p>
            ) : (
              logs.map((log, i) => (
                <div key={i} className="text-xs text-gray-300 font-mono mb-1">
                  {log}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Requirements */}
        <div className="bg-blue-500/10 border border-blue-500/30 rounded-2xl p-6">
          <h2 className="text-lg font-bold text-blue-400 mb-3">Requirements</h2>
          <ul className="space-y-2 text-sm text-gray-300">
            <li>✓ Android device with NFC hardware</li>
            <li>✓ Chrome browser (version 89+)</li>
            <li>✓ NFC enabled in device settings</li>
            <li>✓ HTTPS connection (or localhost)</li>
            <li>✓ NFC permission granted</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
