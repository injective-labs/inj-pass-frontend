'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { triggerWalletConnect, triggerPasskeySign, isValidOrigin } from '@/lib/auth-bridge';

/* ── 尺寸常量 ─────────────────────────────────────────────────────────── */
const BALL_SIZE = 56;   // 悬浮球直径 px
const CARD_W    = 360;  // 展开卡片宽
const CARD_H    = 280;  // 展开卡片高
const CONNECT_W = 360;  // 连接前卡片宽
const CONNECT_H = 300;  // 连接前卡片高

/** 通知父窗口（SDK）调整 iframe 尺寸 */
function requestResize(width: number, height: number) {
  window.parent.postMessage({
    type: 'INJPASS_RESIZE',
    width,
    height,
  }, '*');
}

export default function EmbedPage() {
  const [connected, setConnected] = useState(false);
  const [address, setAddress] = useState<string>('');
  const [walletName, setWalletName] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [authPopup, setAuthPopup] = useState<Window | null>(null);
  const [hasPendingSign, setHasPendingSign] = useState(false);
  const [minimized, setMinimized] = useState(false); // 悬浮球 / 展开
  
  // 追踪活动的签名请求（用于停止轮询）
  const activeSignRequests = useRef<Set<string>>(new Set());

  // body 透明 — useEffect 作为保险，真正的首屏透明由内联 <style> 保证

  // ── iframe 自动伸缩 ──────────────────────────────────────────────────
  useEffect(() => {
    if (!connected) {
      requestResize(CONNECT_W, CONNECT_H);
    } else if (minimized) {
      requestResize(BALL_SIZE, BALL_SIZE);
    } else {
      requestResize(CARD_W, CARD_H);
    }
  }, [connected, minimized]);

  // 连接成功后自动缩成小球
  useEffect(() => {
    if (connected && !minimized) {
      // 短暂展示 connected 状态后缩成球
      const t = setTimeout(() => setMinimized(true), 1200);
      return () => clearTimeout(t);
    }
  }, [connected]);

  // 有签名请求时自动展开（让用户看到提示）
  useEffect(() => {
    if (hasPendingSign && minimized) {
      setMinimized(false);
    }
  }, [hasPendingSign]);

  const expand  = useCallback(() => setMinimized(false), []);
  const minimize = useCallback(() => setMinimized(true), []);

  // ── 消息监听 ────────────────────────────────────────────────────────
  useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      if (!isValidOrigin(event.origin)) return;
      const { type, data } = event.data;

      if (type === 'INJPASS_SIGN_REQUEST') {
        console.log('📩 Received INJPASS_SIGN_REQUEST:', data);
        
        if (!connected) {
          console.log('❌ Wallet not connected');
          event.source?.postMessage({
            type: 'INJPASS_SIGN_RESPONSE',
            requestId: data.id,
            error: 'Wallet not connected',
          }, { targetOrigin: event.origin });
          return;
        }

        // 如果 popup 已关闭，重新打开用于签名
        if (!authPopup || authPopup.closed) {
          console.log('🔄 Auth popup closed, reopening for signing...');
          
          // 打开新的 auth popup，使用 sign_persistent 模式（跳过 connect，直接进入 ready 状态）
          const authUrl = `${window.location.origin}/auth?action=sign_persistent`;
          const width = 400, height = 600;
          const left = Math.max(0, (screen.availWidth || screen.width) - width - 20);
          const top = Math.max(0, (screen.availHeight || screen.height) - height - 60);
          const features = `width=${width},height=${height},left=${left},top=${top},menubar=no,toolbar=no,location=no,status=no,resizable=yes,scrollbars=no`;
          
          const newPopup = window.open(authUrl, 'injpass_auth', features);
          
          if (!newPopup) {
            console.log('❌ Popup blocked');
            event.source?.postMessage({
              type: 'INJPASS_SIGN_RESPONSE',
              requestId: data.id,
              error: 'Popup blocked. Please allow popups for this site.',
            }, { targetOrigin: event.origin });
            return;
          }
          
          setAuthPopup(newPopup);
          
          // 标记这个请求为活动状态
          activeSignRequests.current.add(data.id);
          
          // 等待 popup 加载完成（sign_persistent 模式会自动设置 status='ready'）
          let attempts = 0;
          const maxAttempts = 30; // 3秒超时
          
          const sendSignRequest = () => {
            // 如果请求已经被响应（从 activeSignRequests 中移除），停止轮询
            if (!activeSignRequests.current.has(data.id)) {
              console.log('✅ Sign request completed, stopping polling');
              return;
            }
            
            if (attempts >= maxAttempts) {
              console.log('❌ Popup loading timeout');
              activeSignRequests.current.delete(data.id);
              event.source?.postMessage({
                type: 'INJPASS_SIGN_RESPONSE',
                requestId: data.id,
                error: 'Auth popup loading timeout',
              }, { targetOrigin: event.origin });
              return;
            }
            
            if (newPopup.closed) {
              console.log('❌ Popup was closed');
              activeSignRequests.current.delete(data.id);
              event.source?.postMessage({
                type: 'INJPASS_SIGN_RESPONSE',
                requestId: data.id,
                error: 'Auth popup was closed',
              }, { targetOrigin: event.origin });
              return;
            }
            
            attempts++;
            console.log(`   Sending SIGN_REQUEST to popup (attempt ${attempts}/${maxAttempts})`);
            newPopup.postMessage({
              type: 'SIGN_REQUEST',
              requestId: data.id,
              message: data.message,
            }, window.location.origin);
            
            // 继续轮询直到收到响应
            setTimeout(sendSignRequest, 100);
          };
          
          // 等待 500ms 让 popup 加载，然后开始发送请求
          setTimeout(sendSignRequest, 500);
          setHasPendingSign(true);
          
        } else {
          // Popup 仍然打开，直接发送签名请求
          console.log('✅ Sending sign request to existing popup');
          authPopup.postMessage({
            type: 'SIGN_REQUEST',
            requestId: data.id,
            message: data.message,
          }, window.location.origin);
          try { authPopup.focus(); } catch (_) {}
          setHasPendingSign(true);
        }
      }

      if (type === 'SIGN_RESPONSE') {
        console.log('✅ Received SIGN_RESPONSE:', data);
        
        // 从活动请求中移除（停止轮询）
        if (data.requestId) {
          activeSignRequests.current.delete(data.requestId);
        }
        
        setHasPendingSign(false);
        window.parent.postMessage({
          type: 'INJPASS_SIGN_RESPONSE',
          requestId: data.requestId,
          signature: data.signature,
          address: data.address,
          error: data.error,
        }, '*');
      }

      if (type === 'INJPASS_DISCONNECT') {
        handleDisconnect();
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [connected, authPopup]);

  // ── 连接 / 断开 ────────────────────────────────────────────────────
  const handleConnect = async () => {
    setLoading(true);
    setError('');
    try {
      const { address: walletAddress, walletName: name, popup } = await triggerWalletConnect();
      setAddress(walletAddress);
      setWalletName(name);
      setConnected(true);

      if (popup && !popup.closed) {
        setAuthPopup(popup);
      }

      window.parent.postMessage({
        type: 'INJPASS_CONNECTED',
        address: walletAddress,
        walletName: name,
      }, '*');
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Connection failed';
      setError(errorMsg);
      window.parent.postMessage({ type: 'INJPASS_ERROR', error: errorMsg }, '*');
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = () => {
    if (authPopup && !authPopup.closed) authPopup.close();
    setAuthPopup(null);
    setAddress('');
    setWalletName('');
    setConnected(false);
    setMinimized(false);
    window.parent.postMessage({ type: 'INJPASS_DISCONNECTED' }, '*');
  };

  /* ================================================================== */
  /* ██  BALL MODE  ████████████████████████████████████████████████████ */
  /* ================================================================== */
  if (connected && minimized) {
    return (
      <div
        onClick={expand}
        style={{ width: BALL_SIZE, height: BALL_SIZE }}
          className="relative cursor-pointer select-none"
        >
        <div className="w-full h-full bg-gradient-to-br from-purple-600 to-indigo-700 rounded-full flex items-center justify-center shadow-xl border border-purple-400/40 transition-transform hover:scale-110 active:scale-95">
          <span style={{ fontSize: 24, lineHeight: 1 }}>&#x1F510;</span>
        </div>
        {/* 签名通知小绿点 */}
        {hasPendingSign && (
          <span className="absolute -top-0.5 -right-0.5 block w-3.5 h-3.5 bg-yellow-400 rounded-full animate-ping" />
        )}
        {hasPendingSign && (
          <span className="absolute -top-0.5 -right-0.5 block w-3.5 h-3.5 bg-yellow-400 rounded-full" />
        )}
      </div>
    );
  }

  /* ================================================================== */
  /* ██  EXPANDED CONNECTED CARD  ████████████████████████████████████ */
  /* ================================================================== */
  if (connected && !minimized) {
    return (
      <div
        style={{ width: CARD_W }}
        className="bg-gradient-to-br from-purple-900 via-purple-800 to-indigo-900 rounded-2xl shadow-2xl overflow-hidden"
      >
        {/* 标题栏 + 最小化按钮 */}
        <div className="flex items-center justify-between px-4 pt-3 pb-2">
          <div className="flex items-center gap-2">
            <div className="relative w-8 h-8 bg-green-500/20 rounded-full flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-green-400">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
              {hasPendingSign && (
                <span className="absolute -top-0.5 -right-0.5 block w-2.5 h-2.5 bg-yellow-400 rounded-full animate-ping" />
              )}
            </div>
            <div>
              <p className="text-white text-sm font-semibold leading-tight">INJ Pass</p>
              <p className="text-purple-300 text-xs font-mono">
                {address.slice(0, 6)}...{address.slice(-4)}
              </p>
            </div>
          </div>
          <button
            onClick={minimize}
            title="Minimize"
            className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/10 hover:bg-white/20 transition-colors text-white/70 hover:text-white"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
          </button>
        </div>

        <div className="px-4 pb-4 space-y-2.5">
          {/* 签名待处理时的提示 */}
          {hasPendingSign && authPopup && !authPopup.closed && (
            <button
              onClick={() => { try { authPopup.focus(); } catch (_) {} }}
              className="w-full py-2 bg-yellow-500/20 border border-yellow-500/40 text-yellow-200 rounded-lg text-xs font-semibold hover:bg-yellow-500/30 transition-all flex items-center justify-center gap-1.5 animate-pulse"
            >
              <span>&#x26A0;&#xFE0F;</span>
              <span>Signature pending — tap to view</span>
            </button>
          )}

          {/* Show wallet 按钮 */}
          {!hasPendingSign && authPopup && !authPopup.closed && (
            <button
              onClick={() => { try { authPopup.focus(); } catch (_) {} }}
              className="w-full py-1.5 bg-purple-500/10 border border-purple-500/20 text-purple-300 rounded-lg text-xs hover:bg-purple-500/20 transition-all"
            >
              Show wallet popup
            </button>
          )}

          <button
            onClick={handleDisconnect}
            className="w-full py-2 bg-white/10 border border-white/20 text-white rounded-lg text-sm font-semibold hover:bg-white/20 transition-all"
          >
            Disconnect
          </button>
        </div>
      </div>
    );
  }

  /* ================================================================== */
  /* ██  CONNECT CARD (not connected)  ████████████████████████████████ */
  /* ================================================================== */
  return (
    <div
      style={{ width: CONNECT_W }}
      className="bg-gradient-to-br from-purple-900 via-purple-800 to-indigo-900 rounded-2xl shadow-2xl p-6"
    >
      <div className="text-center mb-5">
        <div className="inline-block p-3 bg-purple-500/20 rounded-full mb-3">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-8 h-8 text-purple-300">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
          </svg>
        </div>
        <h2 className="text-xl font-bold text-white mb-1">Connect INJ Pass</h2>
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

      <p className="text-purple-300 text-xs text-center mt-3">
        Protected by WebAuthn biometric authentication
      </p>
    </div>
  );
}
