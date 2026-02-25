'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { unlockByPasskey } from '@/wallet/key-management/createByPasskey';
import { loadWallet } from '@/wallet/keystore/storage';
import { decryptKey } from '@/wallet/keystore';
import { sign } from '@noble/secp256k1';
import { sha256 } from '@noble/hashes/sha2.js';
import type { AuthRequest, AuthResponse, WalletConnectRequest, WalletConnectResponse } from '@/lib/auth-bridge';

/**
 * 授权窗口页面
 * 在顶层文档运行，可正常调用 WebAuthn (Passkey)
 */

function AuthPageContent() {
  const searchParams = useSearchParams();
  const requestId = searchParams.get('requestId');
  const originParam = searchParams.get('origin');
  const action = searchParams.get('action') || 'connect'; // 'connect' 或 'sign'
  
  const [status, setStatus] = useState<'waiting' | 'processing' | 'success' | 'error'>('waiting');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!requestId || !originParam) {
      setError('Invalid request parameters');
      setStatus('error');
      return;
    }

    let processingStarted = false; // 使用本地变量而不是 state

    // 处理钱包连接
    const handleWalletConnect = async (request: WalletConnectRequest, targetOrigin: string) => {
      if (request.requestId !== requestId) {
        console.warn('Request ID mismatch, ignoring');
        return;
      }

      if (processingStarted) {
        console.warn('Already processing, ignoring duplicate request');
        return;
      }

      processingStarted = true;
      setStatus('processing');
      setMessage('Please authenticate with your Passkey...');

      try {
        // 1. 加载钱包
        const keystore = loadWallet();
        if (!keystore || !keystore.credentialId) {
          throw new Error('No wallet found. Please create a wallet first at injpass.com');
        }

        // 2. 使用 Passkey 解锁（✅ 在顶层窗口可正常工作）
        setMessage('Verifying your identity...');
        await unlockByPasskey(keystore.credentialId);

        // 3. 回传连接结果（✅ 指定明确的 targetOrigin）
        const response: WalletConnectResponse = {
          type: 'WALLET_CONNECT_RESPONSE',
          requestId: request.requestId,
          address: keystore.address,
          walletName: keystore.walletName || 'INJ Pass Wallet',
        };

        window.opener?.postMessage(response, targetOrigin);

        setStatus('success');
        setMessage('Connected successfully!');
        setTimeout(() => window.close(), 1500);
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Connection failed';
        setError(errorMsg);
        setStatus('error');

        const response: WalletConnectResponse = {
          type: 'WALLET_CONNECT_RESPONSE',
          requestId: request.requestId,
          error: errorMsg,
        };

        window.opener?.postMessage(response, targetOrigin);
      }
    };

    // 处理签名请求
    const handlePasskeySign = async (request: AuthRequest, targetOrigin: string) => {
      if (request.requestId !== requestId) {
        console.warn('Request ID mismatch, ignoring');
        return;
      }

      if (processingStarted) {
        console.warn('Already processing, ignoring duplicate request');
        return;
      }

      processingStarted = true;
      setStatus('processing');
      setMessage('Please authenticate with your Passkey...');
      
      try {
        // 1. 加载钱包
        const keystore = loadWallet();
        if (!keystore || !keystore.credentialId) {
          throw new Error('Wallet not found');
        }

        // 2. 使用 Passkey 解锁（✅ 在顶层窗口可正常工作）
        setMessage('Unlocking your wallet...');
        const entropy = await unlockByPasskey(keystore.credentialId);
        const privateKey = await decryptKey(keystore.encryptedPrivateKey, entropy);

        // 3. 签名
        setMessage('Signing message...');
        const messageHash = sha256(new TextEncoder().encode(request.message));
        const signature = await sign(messageHash, privateKey);

        // 4. 回传结果（✅ 指定明确的 targetOrigin）
        const response: AuthResponse = {
          type: 'PASSKEY_SIGN_RESPONSE',
          requestId: request.requestId,
          signature: Array.from(signature),
          address: keystore.address,
        };

        window.opener?.postMessage(response, targetOrigin);

        setStatus('success');
        setMessage('Signed successfully!');
        setTimeout(() => window.close(), 1500);
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Authentication failed';
        setError(errorMsg);
        setStatus('error');

        const response: AuthResponse = {
          type: 'PASSKEY_SIGN_RESPONSE',
          requestId: request.requestId,
          error: errorMsg,
        };

        window.opener?.postMessage(response, targetOrigin);
      }
    };

    // ✅ 监听来自 opener 的请求
    const handleMessage = async (event: MessageEvent) => {
      // 基本的 origin 验证（允许 localhost 用于开发）
      const isLocalhost = event.origin.startsWith('http://localhost:');
      const isSameOrigin = event.origin === originParam;
      
      if (!isLocalhost && !isSameOrigin) {
        console.warn('Origin mismatch:', { expected: originParam, received: event.origin });
        setError('Origin verification failed');
        setStatus('error');
        return;
      }

      const data = event.data;

      // 处理钱包连接请求
      if (data.type === 'WALLET_CONNECT' && data.requestId === requestId) {
        await handleWalletConnect(data as WalletConnectRequest, event.origin);
      }

      // 处理签名请求
      if (data.type === 'PASSKEY_SIGN' && data.requestId === requestId) {
        await handlePasskeySign(data as AuthRequest, event.origin);
      }
    };

    window.addEventListener('message', handleMessage);

    // 通知 opener 窗口已准备就绪
    if (window.opener) {
      window.opener.postMessage({ type: 'AUTH_WINDOW_READY', requestId }, originParam);
    }

    return () => window.removeEventListener('message', handleMessage);
  }, [requestId, originParam]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-purple-800 to-indigo-900 flex items-center justify-center p-4">
      <div className="bg-black/30 backdrop-blur-md border border-white/10 rounded-2xl p-8 max-w-md w-full">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="inline-block p-3 bg-purple-500/20 rounded-full mb-3">
            <svg 
              xmlns="http://www.w3.org/2000/svg" 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="2" 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              className="w-10 h-10 text-purple-300"
            >
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white mb-1">INJ Pass</h1>
          <p className="text-purple-200 text-sm">
            {action === 'connect' ? 'Connect your wallet' : 'Sign transaction'}
          </p>
        </div>

        {/* Status Display */}
        <div className="text-center">
          {status === 'waiting' && (
            <div className="py-8">
              <div className="animate-pulse h-12 w-12 border-4 border-purple-300/30 border-t-purple-300 rounded-full mx-auto mb-4"></div>
              <p className="text-white/70 text-sm">Initializing...</p>
            </div>
          )}

          {status === 'processing' && (
            <div className="py-8">
              <div className="animate-spin h-16 w-16 border-4 border-white/20 border-t-white rounded-full mx-auto mb-4"></div>
              <p className="text-white text-lg font-medium">{message}</p>
              <p className="text-purple-200 text-sm mt-2">This may take a few seconds</p>
            </div>
          )}

          {status === 'success' && (
            <div className="py-8">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-green-500/20 rounded-full mb-4">
                <svg 
                  xmlns="http://www.w3.org/2000/svg" 
                  viewBox="0 0 24 24" 
                  fill="none" 
                  stroke="currentColor" 
                  strokeWidth="3" 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  className="w-10 h-10 text-green-400"
                >
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
              </div>
              <p className="text-white text-xl font-bold mb-2">{message}</p>
              <p className="text-green-300 text-sm">Window will close automatically</p>
            </div>
          )}

          {status === 'error' && (
            <div className="py-8">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-red-500/20 rounded-full mb-4">
                <svg 
                  xmlns="http://www.w3.org/2000/svg" 
                  viewBox="0 0 24 24" 
                  fill="none" 
                  stroke="currentColor" 
                  strokeWidth="3" 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  className="w-10 h-10 text-red-400"
                >
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="15" y1="9" x2="9" y2="15"></line>
                  <line x1="9" y1="9" x2="15" y2="15"></line>
                </svg>
              </div>
              <p className="text-white text-xl font-bold mb-2">Failed</p>
              <p className="text-red-300 text-sm bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 mt-4">
                {error}
              </p>
              <button
                onClick={() => window.close()}
                className="mt-6 px-6 py-2 bg-white/10 hover:bg-white/20 border border-white/20 text-white rounded-lg transition-colors"
              >
                Close
              </button>
            </div>
          )}
        </div>

        {/* Security Notice */}
        <div className="mt-6 pt-6 border-t border-white/10">
          <p className="text-purple-300 text-xs text-center">
            🔒 Secured by WebAuthn biometric authentication
          </p>
          {originParam && (
            <p className="text-purple-400/60 text-xs text-center mt-2">
              Requested by: {originParam}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AuthPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-purple-800 to-indigo-900 flex items-center justify-center">
        <div className="animate-spin h-16 w-16 border-4 border-white/20 border-t-white rounded-full"></div>
      </div>
    }>
      <AuthPageContent />
    </Suspense>
  );
}
