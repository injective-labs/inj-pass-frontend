'use client';

import { useEffect, useState } from 'react';
import { unlockByPasskey } from '@/wallet/key-management/createByPasskey';
import { loadWallet } from '@/wallet/keystore/storage';
import { decryptKey } from '@/wallet/keystore';
import { secp256k1 } from '@noble/curves/secp256k1.js';
import { keccak_256 } from '@noble/hashes/sha3.js';
import type { AuthRequest, AuthResponse, WalletConnectRequest, WalletConnectResponse } from '@/lib/auth-bridge';

/**
 * Hash a message using EIP-191 personal_sign prefix so that XMTP / Ethereum
 * wallets can verify the signature on-chain.
 */
function hashPersonalMessage(message: string): Uint8Array {
  const msgBytes = new TextEncoder().encode(message);
  const prefix = new TextEncoder().encode(`\x19Ethereum Signed Message:\n${msgBytes.length}`);
  const combined = new Uint8Array(prefix.length + msgBytes.length);
  combined.set(prefix);
  combined.set(msgBytes, prefix.length);
  return keccak_256(combined);
}

/**
 * 授权窗口页面
 * 在顶层文档运行，可正常调用 WebAuthn (Passkey)
 */

function AuthPageContent() {
  const [query] = useState(() => {
    if (typeof window === 'undefined') {
      return {
        requestId: null as string | null,
        originParam: null as string | null,
        action: 'connect',
      };
    }

    const params = new URLSearchParams(window.location.search);
    return {
      requestId: params.get('requestId'),
      originParam: params.get('origin'),
      action: params.get('action') || 'connect',
    };
  });
  const { requestId, originParam, action } = query;
  
  const [status, setStatus] = useState<'waiting' | 'sign_pending' | 'processing' | 'success' | 'error' | 'ready'>('waiting');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [currentSignRequest, setCurrentSignRequest] = useState<{
    requestId: string;
    message: string;
    origin: string;
  } | null>(null);

  const BALL_W = 82, BALL_H = 82;
  const FULL_W = 400, FULL_H = 530;

  // 🔵 窗口自动伸缩：ready 状态缩小为悬浮球，其他状态展开
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (status === 'ready') {
      window.resizeTo(BALL_W, BALL_H);
      window.moveTo(
        Math.max(0, screen.availWidth  - BALL_W - 20),
        Math.max(0, screen.availHeight - BALL_H - 60),
      );
    } else if (status !== 'waiting') {
      window.resizeTo(FULL_W, FULL_H);
      window.moveTo(
        Math.max(0, screen.availWidth  - FULL_W - 20),
        Math.max(0, screen.availHeight - FULL_H - 60),
      );
      window.focus();
    }
  }, [status]);

  // 📩 监听 embed 页面转发的签名请求（ready 时收到 → 展开窗口显示确认界面）
  useEffect(() => {
    const handleSignRequest = (event: MessageEvent) => {
      const isLocalhost = event.origin.startsWith('http://localhost:');
      const isSameOrigin = event.origin === originParam;
      // embed page posts from window.location.origin (same domain as auth popup)
      const isSameDomain = event.origin === window.location.origin;
      if (!isLocalhost && !isSameOrigin && !isSameDomain) return;

      const { type, requestId: reqId, message: msg } = event.data;
      if (type === 'SIGN_REQUEST' && status === 'ready') {
        setCurrentSignRequest({ requestId: reqId, message: msg, origin: event.origin });
        setStatus('sign_pending');
      }
    };
    window.addEventListener('message', handleSignRequest);
    return () => window.removeEventListener('message', handleSignRequest);
  }, [originParam, status]);

  // 处理 sign_persistent 初始化
  useEffect(() => {
    if (action === 'sign_persistent') {
      setStatus('ready');
    }
  }, [action]);

  // ✅ 用户点击「确认签名」→ Passkey 认证 → 签名
  const handleConfirmSign = async () => {
    if (!currentSignRequest) return;
    const { requestId: reqId, message: msg, origin: reqOrigin } = currentSignRequest;
    setStatus('processing');
    setMessage('Unlocking your wallet...');
    try {
      const keystore = loadWallet();
      if (!keystore?.credentialId) throw new Error('Wallet not found');
      const entropy    = await unlockByPasskey(keystore.credentialId);
      setMessage('Signing...');
      const privateKey  = await decryptKey(keystore.encryptedPrivateKey, entropy);
      const messageHash = hashPersonalMessage(msg);
      const sigBytes    = secp256k1.sign(messageHash, privateKey, {
        lowS: true, prehash: false, format: 'recovered',
      });
      const ethSig = new Uint8Array(65);
      ethSig.set(sigBytes.slice(1, 33), 0);
      ethSig.set(sigBytes.slice(33, 65), 32);
      ethSig[64] = sigBytes[0] + 27;
      window.opener?.postMessage({
        type: 'SIGN_RESPONSE',
        data: { requestId: reqId, signature: Array.from(ethSig), address: keystore.address },
      }, reqOrigin);
      setCurrentSignRequest(null);
      setStatus('success');
      setMessage('Signed!');
      setTimeout(() => setStatus('ready'), 1800);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Signing failed';
      setError(errMsg);
      window.opener?.postMessage({
        type: 'SIGN_RESPONSE',
        data: { requestId: reqId, error: errMsg },
      }, currentSignRequest.origin);
      setCurrentSignRequest(null);
      setStatus('error');
      setTimeout(() => { setStatus('ready'); setError(''); }, 2000);
    }
  };

  // ❌ 用户拒绝签名
  const handleRejectSign = () => {
    if (currentSignRequest) {
      window.opener?.postMessage({
        type: 'SIGN_RESPONSE',
        data: { requestId: currentSignRequest.requestId, error: 'User rejected the request.' },
      }, currentSignRequest.origin);
    }
    setCurrentSignRequest(null);
    setStatus('ready');
  };

  useEffect(() => {
    // sign_persistent 模式由单独的 useEffect 处理
    if (action === 'sign_persistent') {
      return;
    }

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
        // SDK 中只使用 EVM 地址（0x 格式），不转换成 inj1
        // inj1 格式只在 INJ Pass 主产品中显示
        const response: WalletConnectResponse = {
          type: 'WALLET_CONNECT_RESPONSE',
          requestId: request.requestId,
          address: keystore.address, // 0x... EVM format
          walletName: keystore.walletName || 'INJ Pass Wallet',
        };

        window.opener?.postMessage(response, targetOrigin);

        // 🔐 连接成功后，转换为持久化签名模式（不关闭窗口）
        setStatus('ready');
        setMessage('Ready to sign transactions');
        
        // 切换到持久化签名模式，开始监听签名请求
        console.log('✅ Connected, switching to persistent signing mode');
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

        // 3. 签名 — EIP-191 personal_sign (65 bytes: r || s || v)
        setMessage('Signing message...');
        const messageHash = hashPersonalMessage(request.message);
        // Sign with recovered format: [recovery, r(32), s(32)]
        const sigBytes = secp256k1.sign(messageHash, privateKey, {
          lowS: true,
          prehash: false,
          format: 'recovered'
        });
        // Convert to Ethereum format: [r(32), s(32), v] where v = recovery + 27
        const recovery = sigBytes[0];
        const r = sigBytes.slice(1, 33);
        const s = sigBytes.slice(33, 65);
        const ethSignature = new Uint8Array(65);
        ethSignature.set(r, 0);
        ethSignature.set(s, 32);
        ethSignature[64] = recovery + 27; // v = 27 or 28

        // 4. 回传结果（✅ 指定明确的 targetOrigin）
        const response: AuthResponse = {
          type: 'PASSKEY_SIGN_RESPONSE',
          requestId: request.requestId,
          signature: Array.from(ethSignature), // 65 bytes
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

  /* ── BALL MODE ─────────────────────────────────────────────────────────── */
  if (status === 'ready') {
    return (
      <div
        style={{ width: BALL_W, height: BALL_H }}
        className="overflow-hidden bg-transparent flex items-center justify-center"
      >
        <div className="w-[68px] h-[68px] bg-gradient-to-br from-purple-600 to-indigo-700 rounded-full flex items-center justify-center shadow-2xl border border-purple-400/40 cursor-default select-none">
          <span style={{ fontSize: 28, lineHeight: 1 }}>&#x1F510;</span>
        </div>
      </div>
    );
  }

  /* ── SIGN CONFIRM MODE ──────────────────────────────────────────────────── */
  if (status === 'sign_pending' && currentSignRequest) {
    return (
      <div
        style={{ width: FULL_W, height: FULL_H }}
        className="overflow-hidden bg-gradient-to-br from-[#1a0533] to-[#0d1b4b] flex flex-col"
      >
        {/* Title bar */}
        <div className="flex items-center gap-2 px-5 pt-5 pb-3 border-b border-white/10">
          <span style={{ fontSize: 20 }}>&#x270D;&#xFE0F;</span>
          <h2 className="text-white font-bold text-base flex-1">Signature Request</h2>
          <span className="text-xs text-purple-300 bg-purple-500/20 px-2 py-0.5 rounded-full">INJ Pass</span>
        </div>

        {/* Message preview */}
        <div className="flex-1 overflow-auto px-5 py-4">
          <p className="text-purple-300 text-xs font-medium mb-1 uppercase tracking-wider">Message</p>
          <div className="bg-white/5 border border-white/10 rounded-xl p-3 max-h-36 overflow-auto">
            <p className="text-purple-100 text-xs font-mono break-all leading-relaxed">
              {currentSignRequest.message}
            </p>
          </div>

          <p className="text-purple-300 text-xs font-medium mt-4 mb-1 uppercase tracking-wider">Requested by</p>
          <div className="bg-white/5 border border-white/10 rounded-xl px-3 py-2">
            <p className="text-purple-200 text-xs truncate">{currentSignRequest.origin}</p>
          </div>

          <div className="mt-4 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-xl">
            <p className="text-yellow-200 text-xs">
              Your Passkey (fingerprint / Face ID) will be required to complete this signature.
            </p>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex gap-3 px-5 pb-5 pt-3 border-t border-white/10">
          <button
            onClick={handleRejectSign}
            className="flex-1 py-2.5 bg-white/10 text-white rounded-xl border border-white/20 hover:bg-white/20 transition-colors text-sm font-medium"
          >
            Reject
          </button>
          <button
            onClick={handleConfirmSign}
            className="flex-1 py-2.5 bg-purple-500 text-white rounded-xl font-bold hover:bg-purple-400 transition-colors text-sm"
          >
            Sign with Passkey
          </button>
        </div>
      </div>
    );
  }

  /* ── FULL CARD MODE (connect / processing / success / error / waiting) ── */
  return (
    <div
      style={{ width: FULL_W, height: FULL_H }}
      className="overflow-hidden bg-gradient-to-br from-purple-900 via-purple-800 to-indigo-900 flex items-center justify-center p-4"
    >
      <div className="bg-black/30 backdrop-blur-md border border-white/10 rounded-2xl p-8 w-full">
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
            {action === 'sign_persistent'
              ? 'Authorization'
              : action === 'connect'
                ? 'Connect your wallet'
                : 'Sign transaction'}
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
              <p className="text-green-300 text-sm">Shrinking back to ball...</p>
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
              <p className="text-red-400/70 text-xs mt-2">Shrinking back to ball...</p>
            </div>
          )}
        </div>

        {/* Security Notice */}
        <div className="mt-6 pt-6 border-t border-white/10">
          <p className="text-purple-300 text-xs text-center">
            Secured by WebAuthn biometric authentication
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
  return <AuthPageContent />;
}
