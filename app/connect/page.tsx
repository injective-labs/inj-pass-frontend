'use client';

/**
 * Cross-origin wallet connect page.
 *
 * Opens as a popup from partner dApps (e.g. Hash-Mahjong).
 * Protocol:
 *   dApp  → popup : { type: 'INJPASS_SIGN_TX', id, to, value }
 *   popup → dApp  : { type: 'INJPASS_CONNECTED', address }
 *   popup → dApp  : { type: 'INJPASS_TX_RESULT',  id, txHash? error? }
 */

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { importPrivateKey } from '@/wallet/key-management';
import { encryptKey, decryptKey, loadWallet, saveWallet } from '@/wallet/keystore';
import { unlockByPasskey } from '@/wallet/key-management/createByPasskey';
import { sendTransaction } from '@/wallet/chain/evm/sendTransaction';
import type { Address } from 'viem';

// dApps allowed to communicate with this popup.
// '*' is used as fallback when the origin cannot be determined.
const KNOWN_ORIGINS = [
  'https://hash-mahjong-two.vercel.app',
  'http://localhost:3000',
  'http://localhost:3001',
];

type Step = 'loading' | 'unlock' | 'import' | 'connected' | 'signing';

interface SignRequest {
  id: string;
  to: string;
  value: string; // ETH/INJ amount string, e.g. "0.000001"
}

export default function ConnectPage() {
  const [step, setStep] = useState<Step>('loading');
  const [callerOrigin, setCallerOrigin] = useState('*');
  const [address, setAddress] = useState('');
  const [signRequest, setSignRequest] = useState<SignRequest | null>(null);
  const [error, setError] = useState('');
  const [statusMsg, setStatusMsg] = useState('');
  const [loading, setLoading] = useState(false);

  // Unlock (passkey) state
  const [password, setPassword] = useState('');
  const [walletSource, setWalletSource] = useState<'passkey' | 'import' | null>(null);

  // Import state
  const [pkInput, setPkInput] = useState('');
  const [showPk, setShowPk] = useState(false);
  const [importPassword, setImportPassword] = useState('');
  const [importPasswordConfirm, setImportPasswordConfirm] = useState('');
  const [importStep, setImportStep] = useState<'key' | 'password'>('key');

  const privateKeyRef = useRef<Uint8Array | null>(null);

  // ── Init: detect caller origin and check for existing wallet ──────────────
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const origin = params.get('origin') ?? document.referrer
      ? new URL(document.referrer || window.location.href).origin
      : '*';
    if (origin && origin !== window.location.origin) setCallerOrigin(origin);

    const ks = loadWallet();
    if (ks) {
      setWalletSource(ks.source as 'passkey' | 'import');
      setStep('unlock');
    } else {
      setStep('import');
    }
  }, []);

  // ── Listen for sign requests from the opener ──────────────────────────────
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (!e.data || e.data.type !== 'INJPASS_SIGN_TX') return;
      if (!KNOWN_ORIGINS.includes(e.origin) && e.origin !== callerOrigin) return;
      setSignRequest({ id: e.data.id, to: e.data.to, value: e.data.value });
      setStep('signing');
      setError('');
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [callerOrigin]);

  // ── Helpers ───────────────────────────────────────────────────────────────
  const postToOpener = (msg: object) => {
    window.opener?.postMessage(msg, callerOrigin === '*' ? '*' : callerOrigin);
  };

  const afterAuth = (pk: Uint8Array, addr: string) => {
    privateKeyRef.current = pk;
    setAddress(addr);
    setStep('connected');
    postToOpener({ type: 'INJPASS_CONNECTED', address: addr });
  };

  // ── Unlock with passkey ───────────────────────────────────────────────────
  const handlePasskeyUnlock = async () => {
    setError('');
    setLoading(true);
    try {
      const ks = loadWallet();
      if (!ks?.credentialId) throw new Error('No passkey found');
      const entropy = await unlockByPasskey(ks.credentialId);
      const pk = await decryptKey(ks.encryptedPrivateKey, entropy);
      afterAuth(pk, ks.address);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  // ── Unlock with password ──────────────────────────────────────────────────
  const handlePasswordUnlock = async () => {
    if (!password) return;
    setError('');
    setLoading(true);
    try {
      const ks = loadWallet();
      if (!ks) throw new Error('No wallet found');
      const encoder = new TextEncoder();
      const rawEntropy = encoder.encode(password);
      const entropy = new Uint8Array(Math.max(rawEntropy.length, 32));
      entropy.set(rawEntropy);
      const pk = await decryptKey(ks.encryptedPrivateKey, entropy);
      afterAuth(pk, ks.address);
    } catch {
      setError('Incorrect password');
    } finally {
      setLoading(false);
    }
  };

  // ── Import private key (new wallet) ───────────────────────────────────────
  const handleImportKey = async () => {
    if (!pkInput.trim() || !importPassword || importPassword !== importPasswordConfirm) return;
    setError('');
    setLoading(true);
    try {
      const { privateKey, address: addr } = importPrivateKey(pkInput.trim());
      const encoder = new TextEncoder();
      const rawEntropy = encoder.encode(importPassword);
      const entropy = new Uint8Array(Math.max(rawEntropy.length, 32));
      entropy.set(rawEntropy);
      const encrypted = await encryptKey(privateKey, entropy);
      saveWallet({ address: addr, encryptedPrivateKey: encrypted, source: 'import', createdAt: Date.now(), walletName: 'INJ Pass' });
      afterAuth(privateKey, addr);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Invalid key');
    } finally {
      setLoading(false);
    }
  };

  // ── Confirm sign request ──────────────────────────────────────────────────
  const handleSign = async () => {
    if (!signRequest || !privateKeyRef.current) return;
    setLoading(true);
    setStatusMsg('Sending transaction…');
    try {
      const txHash = await sendTransaction(
        privateKeyRef.current,
        signRequest.to as Address,
        signRequest.value,
      );
      postToOpener({ type: 'INJPASS_TX_RESULT', id: signRequest.id, txHash });
      setStatusMsg('✅ Transaction sent');
      setSignRequest(null);
      setStep('connected');
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      postToOpener({ type: 'INJPASS_TX_RESULT', id: signRequest.id, error: msg });
      setError(msg);
      setStatusMsg('');
      setStep('connected');
    } finally {
      setLoading(false);
    }
  };

  const handleReject = () => {
    if (!signRequest) return;
    postToOpener({ type: 'INJPASS_TX_RESULT', id: signRequest.id, error: 'User rejected' });
    setSignRequest(null);
    setStep('connected');
  };

  // ── UI ────────────────────────────────────────────────────────────────────
  return (
    <div className="connect-root">
      <div className="connect-header">
        <Image src="/lambdalogo.png" alt="INJ Pass" width={28} height={28} className="connect-logo" />
        <span className="connect-title">INJ Pass</span>
      </div>

      {/* Loading */}
      {step === 'loading' && (
        <div className="connect-body">
          <div className="connect-spinner" />
        </div>
      )}

      {/* Unlock */}
      {step === 'unlock' && (
        <div className="connect-body">
          <p className="connect-label">Unlock your wallet to connect</p>
          {error && <p className="connect-error">{error}</p>}
          {walletSource === 'passkey' ? (
            <button className="connect-btn connect-btn-primary" onClick={handlePasskeyUnlock} disabled={loading}>
              {loading ? 'Authenticating…' : '🔑 Authenticate with Passkey'}
            </button>
          ) : (
            <>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handlePasswordUnlock()}
                placeholder="Wallet password"
                className="connect-input"
                autoFocus
              />
              <button className="connect-btn connect-btn-primary" onClick={handlePasswordUnlock} disabled={loading || !password}>
                {loading ? 'Unlocking…' : 'Unlock'}
              </button>
            </>
          )}
          <button className="connect-btn connect-btn-ghost" onClick={() => setStep('import')}>
            Import a different wallet
          </button>
        </div>
      )}

      {/* Import */}
      {step === 'import' && (
        <div className="connect-body">
          <p className="connect-label">
            {importStep === 'key' ? 'Enter your private key' : 'Set a password'}
          </p>
          {error && <p className="connect-error">{error}</p>}
          {importStep === 'key' ? (
            <>
              <div className="connect-input-row">
                <input
                  type={showPk ? 'text' : 'password'}
                  value={pkInput}
                  onChange={(e) => setPkInput(e.target.value)}
                  placeholder="Private key (hex)"
                  className="connect-input connect-input-mono"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && pkInput.trim()) setImportStep('password');
                  }}
                  autoFocus
                />
                <button className="connect-eye" onClick={() => setShowPk((s) => !s)}>
                  {showPk ? '🙈' : '👁'}
                </button>
              </div>
              <button
                className="connect-btn connect-btn-primary"
                onClick={() => { setError(''); setImportStep('password'); }}
                disabled={!pkInput.trim()}
              >
                Next
              </button>
            </>
          ) : (
            <>
              <input
                type="password"
                value={importPassword}
                onChange={(e) => setImportPassword(e.target.value)}
                placeholder="Password (min 8 chars)"
                className="connect-input"
                autoFocus
              />
              <input
                type="password"
                value={importPasswordConfirm}
                onChange={(e) => setImportPasswordConfirm(e.target.value)}
                placeholder="Confirm password"
                className="connect-input"
                onKeyDown={(e) => e.key === 'Enter' && handleImportKey()}
              />
              {importPassword && importPasswordConfirm && importPassword !== importPasswordConfirm && (
                <p className="connect-error">Passwords do not match</p>
              )}
              <div className="connect-btn-row">
                <button className="connect-btn connect-btn-ghost" onClick={() => setImportStep('key')}>Back</button>
                <button
                  className="connect-btn connect-btn-primary"
                  onClick={handleImportKey}
                  disabled={loading || !importPassword || importPassword !== importPasswordConfirm}
                >
                  {loading ? 'Importing…' : 'Connect'}
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Connected — waiting for sign requests */}
      {step === 'connected' && (
        <div className="connect-body connect-body-center">
          <div className="connect-status-dot" />
          <p className="connect-label">Connected</p>
          <p className="connect-addr">{address.slice(0, 10)}…{address.slice(-8)}</p>
          {statusMsg && <p className="connect-status-msg">{statusMsg}</p>}
          <p className="connect-hint">Waiting for transaction requests…</p>
        </div>
      )}

      {/* Signing */}
      {step === 'signing' && signRequest && (
        <div className="connect-body">
          <p className="connect-label">Transaction Request</p>
          <div className="connect-tx-card">
            <div className="connect-tx-row">
              <span className="connect-tx-key">To</span>
              <span className="connect-tx-val connect-mono">{signRequest.to.slice(0, 10)}…{signRequest.to.slice(-8)}</span>
            </div>
            <div className="connect-tx-row">
              <span className="connect-tx-key">Amount</span>
              <span className="connect-tx-val">{signRequest.value} INJ</span>
            </div>
          </div>
          {error && <p className="connect-error">{error}</p>}
          <div className="connect-btn-row">
            <button className="connect-btn connect-btn-ghost" onClick={handleReject} disabled={loading}>Reject</button>
            <button className="connect-btn connect-btn-primary" onClick={handleSign} disabled={loading}>
              {loading ? 'Sending…' : 'Confirm'}
            </button>
          </div>
          <p className="connect-hint">Your private key never leaves this window.</p>
        </div>
      )}

      <style>{`
        .connect-root {
          min-height: 100vh;
          background: #0a0a14;
          color: #e0e0ff;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          display: flex;
          flex-direction: column;
        }
        .connect-header {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 16px 20px;
          border-bottom: 1px solid rgba(255,255,255,0.08);
          background: #0d0d1e;
        }
        .connect-logo { border-radius: 8px; object-fit: contain; }
        .connect-title {
          font-size: 15px;
          font-weight: 700;
          color: #fff;
          letter-spacing: 0.5px;
        }
        .connect-body {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 12px;
          padding: 24px 20px;
        }
        .connect-body-center {
          align-items: center;
          justify-content: center;
          text-align: center;
        }
        .connect-label {
          font-size: 13px;
          font-weight: 600;
          color: #c0c0e0;
          margin-bottom: 4px;
        }
        .connect-addr {
          font-family: monospace;
          font-size: 12px;
          color: #888;
        }
        .connect-hint {
          font-size: 11px;
          color: #555;
          margin-top: 4px;
        }
        .connect-error {
          font-size: 11px;
          color: #f87171;
          background: rgba(248,113,113,0.1);
          border: 1px solid rgba(248,113,113,0.2);
          border-radius: 8px;
          padding: 8px 12px;
        }
        .connect-input {
          width: 100%;
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.12);
          border-radius: 10px;
          padding: 11px 14px;
          color: #e0e0ff;
          font-size: 13px;
          outline: none;
          transition: border-color 0.15s;
          box-sizing: border-box;
        }
        .connect-input:focus { border-color: #4c3af9; }
        .connect-input-mono { font-family: monospace; font-size: 11px; }
        .connect-input-row { display: flex; gap: 8px; align-items: center; }
        .connect-eye {
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.12);
          border-radius: 8px;
          padding: 10px 12px;
          cursor: pointer;
          font-size: 14px;
          flex-shrink: 0;
        }
        .connect-btn {
          width: 100%;
          padding: 12px;
          border-radius: 12px;
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
          border: none;
          transition: all 0.15s;
        }
        .connect-btn:disabled { opacity: 0.45; cursor: not-allowed; }
        .connect-btn-primary {
          background: #4c3af9;
          color: #fff;
        }
        .connect-btn-primary:hover:not(:disabled) { background: #5a49ff; }
        .connect-btn-ghost {
          background: rgba(255,255,255,0.06);
          color: #aaa;
          border: 1px solid rgba(255,255,255,0.1);
        }
        .connect-btn-ghost:hover:not(:disabled) { background: rgba(255,255,255,0.1); }
        .connect-btn-row { display: flex; gap: 10px; }
        .connect-btn-row .connect-btn { flex: 1; }
        .connect-spinner {
          width: 32px; height: 32px;
          border: 3px solid rgba(255,255,255,0.1);
          border-top-color: #4c3af9;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
          margin: auto;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        .connect-status-dot {
          width: 10px; height: 10px;
          border-radius: 50%;
          background: #34d399;
          box-shadow: 0 0 8px #34d399;
          margin-bottom: 8px;
        }
        .connect-status-msg {
          font-size: 12px;
          color: #34d399;
        }
        .connect-tx-card {
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 12px;
          padding: 14px;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .connect-tx-row { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
        .connect-tx-key { font-size: 11px; color: #666; flex-shrink: 0; }
        .connect-tx-val { font-size: 12px; color: #e0e0ff; text-align: right; word-break: break-all; }
        .connect-mono { font-family: monospace; }
      `}</style>
    </div>
  );
}
