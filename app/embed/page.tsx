'use client';

import { useState, useEffect } from 'react';
import { triggerWalletConnect, triggerPasskeySign, isValidOrigin } from '@/lib/auth-bridge';

interface SignRequest {
  id: string;
  message: string;
}

export default function EmbedPage() {
  const [connected, setConnected] = useState(false);
  const [address, setAddress] = useState<string>('');
  const [walletName, setWalletName] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    // Listen for sign requests from parent window
    const handleMessage = async (event: MessageEvent) => {
      // ✅ 安全验证：检查消息来源
      // 在生产环境应该使用严格的白名单
      if (!isValidOrigin(event.origin)) {
        console.warn('Rejected message from unauthorized origin:', event.origin);
        return;
      }
      
      const { type, data } = event.data;

      if (type === 'INJPASS_SIGN_REQUEST') {
        if (!connected) {
          event.source?.postMessage({
            type: 'INJPASS_SIGN_RESPONSE',
            requestId: data.id,
            error: 'Wallet not connected',
          }, { targetOrigin: event.origin });
          return;
        }

        try {
          // ✅ 使用弹窗授权进行签名（避免 iframe 的 WebAuthn 限制）
          const { signature, address: signerAddress } = await triggerPasskeySign(data.message);
          
          event.source?.postMessage({
            type: 'INJPASS_SIGN_RESPONSE',
            requestId: data.id,
            signature: Array.from(signature),
            address: signerAddress,
          }, { targetOrigin: event.origin });
        } catch (err) {
          event.source?.postMessage({
            type: 'INJPASS_SIGN_RESPONSE',
            requestId: data.id,
            error: err instanceof Error ? err.message : 'Signing failed',
          }, { targetOrigin: event.origin });
        }
      }

      if (type === 'INJPASS_DISCONNECT') {
        handleDisconnect();
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [connected]);

  const handleConnect = async () => {
    setLoading(true);
    setError('');

    try {
      // ✅ 使用弹窗授权进行连接（避免 iframe 的 Storage 和 WebAuthn 限制）
      const { address: walletAddress, walletName: name } = await triggerWalletConnect();
      
      setAddress(walletAddress);
      setWalletName(name);
      setConnected(true);

      // Notify parent window
      window.parent.postMessage({
        type: 'INJPASS_CONNECTED',
        address: walletAddress,
        walletName: name,
      }, '*');
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Connection failed';
      setError(errorMsg);
      
      window.parent.postMessage({
        type: 'INJPASS_ERROR',
        error: errorMsg,
      }, '*');
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = () => {
    setAddress('');
    setWalletName('');
    setConnected(false);

    window.parent.postMessage({
      type: 'INJPASS_DISCONNECTED',
    }, '*');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-purple-800 to-indigo-900 flex items-center justify-center p-4">
      <div className="bg-black/30 backdrop-blur-md border border-white/10 rounded-2xl p-6 max-w-sm w-full shadow-2xl">
        {!connected ? (
          <>
            <div className="text-center mb-6">
              <div className="inline-block p-3 bg-purple-500/20 rounded-full mb-3">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-8 h-8 text-purple-300">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                </svg>
              </div>
              <h2 className="text-xl font-bold text-white mb-2">Connect INJ Pass</h2>
              <p className="text-purple-200 text-sm">Use your Passkey to connect</p>
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2 mb-4">
                <p className="text-red-300 text-sm">{error}</p>
              </div>
            )}

            <button
              onClick={handleConnect}
              disabled={loading}
              className="w-full bg-white text-purple-900 rounded-lg px-4 py-3 font-bold hover:bg-purple-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>Connecting...</span>
                </>
              ) : (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
                    <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"></path>
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
                    <line x1="12" x2="12" y1="19" y2="22"></line>
                  </svg>
                  <span>Connect with Passkey</span>
                </>
              )}
            </button>

            <p className="text-purple-300 text-xs text-center mt-4">
              Protected by WebAuthn biometric authentication
            </p>
          </>
        ) : (
          <>
            <div className="text-center mb-6">
              <div className="inline-block p-3 bg-green-500/20 rounded-full mb-3">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-8 h-8 text-green-300">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                  <polyline points="22 4 12 14.01 9 11.01"></polyline>
                </svg>
              </div>
              <h2 className="text-xl font-bold text-white mb-2">Connected</h2>
              <p className="text-purple-200 text-sm break-all font-mono">
                {address.slice(0, 6)}...{address.slice(-4)}
              </p>
            </div>

            <button
              onClick={handleDisconnect}
              className="w-full bg-white/10 border border-white/20 text-white rounded-lg px-4 py-2 font-semibold hover:bg-white/20 transition-all"
            >
              Disconnect
            </button>
          </>
        )}
      </div>
    </div>
  );
}
