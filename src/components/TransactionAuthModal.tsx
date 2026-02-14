'use client';

import { useState, useEffect } from 'react';
import { usePin } from '@/contexts/PinContext';
import { useWallet } from '@/contexts/WalletContext';

interface TransactionAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  transactionType: 'send' | 'swap';
}

export default function TransactionAuthModal({
  isOpen,
  onClose,
  onSuccess,
  transactionType,
}: TransactionAuthModalProps) {
  const { defaultAuthMethod, verifyPin, resetActivity } = usePin();
  const { keystore } = useWallet();
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [closing, setClosing] = useState(false);
  const [scanPhase, setScanPhase] = useState<'idle' | 'scanning' | 'success' | 'error'>('idle');

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setPin('');
      setError('');
      setVerifying(false);
      setClosing(false);
      setScanPhase('idle');
    }
  }, [isOpen]);

  // Auto-start passkey verification when modal opens
  useEffect(() => {
    if (isOpen && defaultAuthMethod === 'passkey' && scanPhase === 'idle') {
      // Small delay to let the animation finish
      const timer = setTimeout(() => {
        setScanPhase('scanning');
        handlePasskeyVerify();
      }, 600);
      return () => clearTimeout(timer);
    }
  }, [isOpen, defaultAuthMethod, scanPhase]);

  if (!isOpen && !closing) return null;

  const handleClose = () => {
    setClosing(true);
    setTimeout(() => {
      setClosing(false);
      onClose();
    }, 300);
  };

  const handlePinVerify = async () => {
    if (pin.length !== 6) {
      setError('PIN must be 6 digits');
      return;
    }

    setVerifying(true);
    setError('');

    try {
      const isValid = await verifyPin(pin);
      if (isValid) {
        resetActivity();
        setScanPhase('success');
        setTimeout(() => {
          onSuccess();
          setPin('');
          setScanPhase('idle');
        }, 800);
      } else {
        setError('Incorrect PIN');
        setScanPhase('error');
        setTimeout(() => setScanPhase('idle'), 1500);
      }
    } catch {
      setError('Failed to verify PIN');
      setScanPhase('error');
    } finally {
      setVerifying(false);
    }
  };

  const handlePasskeyVerify = async () => {
    setVerifying(true);
    setError('');
    setScanPhase('scanning');

    try {
      const { unlockByPasskey } = await import('@/wallet/key-management/createByPasskey');
      
      if (!keystore?.credentialId) {
        throw new Error('No passkey found');
      }
      
      await unlockByPasskey(keystore.credentialId);
      resetActivity();
      setScanPhase('success');
      setTimeout(() => {
        onSuccess();
        setScanPhase('idle');
      }, 800);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to verify');
      setScanPhase('error');
    } finally {
      setVerifying(false);
    }
  };

  const handleRetry = () => {
    setError('');
    setScanPhase('idle');
    if (defaultAuthMethod === 'passkey') {
      setTimeout(() => {
        setScanPhase('scanning');
        handlePasskeyVerify();
      }, 300);
    }
  };

  return (
    <div 
      className={`fixed inset-0 bg-black/80 backdrop-blur-sm flex items-end justify-center z-50 transition-opacity duration-200 ${closing ? 'opacity-0' : 'opacity-100'}`}
      onClick={handleClose}
    >
      <div 
        className={`auth-modal bg-black border-t border-white/10 rounded-t-3xl w-full max-w-2xl shadow-2xl ${
          closing ? 'slide-down' : 'slide-up'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Handle Bar */}
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-10 h-1 bg-white/20 rounded-full" />
        </div>

        {/* Header */}
        <div className="px-6 pb-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-white mb-1">
                {transactionType === 'send' ? 'Verify Send' : 'Verify Swap'}
              </h3>
              <p className="text-gray-400 text-xs">
                {defaultAuthMethod === 'passkey' ? 'Authenticate with biometrics' : 'Enter your PIN to continue'}
              </p>
            </div>
            <button 
              onClick={handleClose}
              className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-all"
            >
              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 pb-8">
          {defaultAuthMethod === 'passkey' ? (
            /* Passkey / Face ID Mode */
            <div className="flex flex-col items-center py-6">
              {/* Face ID Animation */}
              <div className="relative w-24 h-24 mb-6">
                {/* Outer ring */}
                <div className={`absolute inset-0 rounded-full border-2 transition-all duration-500 ${
                  scanPhase === 'scanning' ? 'border-blue-400 animate-pulse' :
                  scanPhase === 'success' ? 'border-green-400' :
                  scanPhase === 'error' ? 'border-red-400' :
                  'border-white/20'
                }`} />
                
                {/* Scanning rings */}
                {scanPhase === 'scanning' && (
                  <>
                    <div className="absolute inset-[-8px] rounded-full border border-blue-400/30 animate-[breathingCircle_2s_ease-in-out_infinite]" />
                    <div className="absolute inset-[-16px] rounded-full border border-blue-400/15 animate-[breathingCircle_2s_ease-in-out_0.5s_infinite]" />
                  </>
                )}

                {/* Success ring */}
                {scanPhase === 'success' && (
                  <div className="absolute inset-[-8px] rounded-full border-2 border-green-400/40 animate-ping" />
                )}

                {/* Icon */}
                <div className="absolute inset-0 flex items-center justify-center">
                  {scanPhase === 'success' ? (
                    <svg className="w-10 h-10 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : scanPhase === 'error' ? (
                    <svg className="w-10 h-10 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  ) : (
                    /* Face ID icon */
                    <svg className={`w-10 h-10 transition-colors duration-300 ${
                      scanPhase === 'scanning' ? 'text-blue-400' : 'text-white/60'
                    }`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                      {/* Face outline corners */}
                      <path d="M7 3H5a2 2 0 00-2 2v2" />
                      <path d="M17 3h2a2 2 0 012 2v2" />
                      <path d="M7 21H5a2 2 0 01-2-2v-2" />
                      <path d="M17 21h2a2 2 0 002-2v-2" />
                      {/* Face features */}
                      <circle cx="9" cy="10" r="0.8" fill="currentColor" />
                      <circle cx="15" cy="10" r="0.8" fill="currentColor" />
                      <path d="M9.5 15a3.5 3.5 0 005 0" />
                    </svg>
                  )}
                </div>
              </div>

              {/* Status text */}
              <p className={`text-sm font-semibold mb-2 transition-colors ${
                scanPhase === 'scanning' ? 'text-blue-400' :
                scanPhase === 'success' ? 'text-green-400' :
                scanPhase === 'error' ? 'text-red-400' :
                'text-white'
              }`}>
                {scanPhase === 'scanning' ? 'Verifying identity...' :
                 scanPhase === 'success' ? 'Verified!' :
                 scanPhase === 'error' ? 'Verification failed' :
                 'Waiting for biometrics'}
              </p>
              <p className="text-xs text-gray-500 mb-4">
                {scanPhase === 'scanning' ? 'Please complete biometric authentication' :
                 scanPhase === 'success' ? 'Transaction authorized' :
                 scanPhase === 'error' ? error || 'Please try again' :
                 'Face ID or fingerprint required'}
              </p>

              {/* Retry button on error */}
              {scanPhase === 'error' && (
                <button
                  onClick={handleRetry}
                  className="px-6 py-2.5 rounded-xl bg-white text-black font-bold text-sm hover:bg-gray-100 transition-all"
                >
                  Try Again
                </button>
              )}

              {/* Cancel button */}
              {(scanPhase === 'idle' || scanPhase === 'scanning') && (
                <button
                  onClick={handleClose}
                  className="px-6 py-2.5 rounded-xl bg-white/5 border border-white/10 text-gray-400 font-bold text-sm hover:bg-white/10 transition-all"
                >
                  Cancel
                </button>
              )}
            </div>
          ) : (
            /* PIN Mode */
            <div className="flex flex-col items-center py-4">
              {/* Lock animation */}
              <div className="relative w-20 h-20 mb-5">
                <div className={`absolute inset-0 rounded-full border-2 transition-all duration-500 ${
                  scanPhase === 'success' ? 'border-green-400' :
                  scanPhase === 'error' ? 'border-red-400' :
                  'border-white/20'
                }`} />
                
                {scanPhase === 'success' && (
                  <div className="absolute inset-[-8px] rounded-full border-2 border-green-400/40 animate-ping" />
                )}

                <div className="absolute inset-0 flex items-center justify-center">
                  {scanPhase === 'success' ? (
                    <svg className="w-8 h-8 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : scanPhase === 'error' ? (
                    <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  ) : (
                    <svg className="w-8 h-8 text-white/60" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                      <rect x="5" y="11" width="14" height="10" rx="2" />
                      <path d="M8 11V7a4 4 0 018 0v4" />
                      <circle cx="12" cy="16" r="1" fill="currentColor" />
                    </svg>
                  )}
                </div>
              </div>

              {/* PIN Input */}
              <div className="w-full max-w-xs mb-4">
                <div className="flex justify-center gap-3 mb-4">
                  {[0, 1, 2, 3, 4, 5].map((i) => (
                    <div
                      key={i}
                      className={`w-3 h-3 rounded-full transition-all duration-200 ${
                        i < pin.length 
                          ? scanPhase === 'error' ? 'bg-red-400 scale-110' : 'bg-white scale-110' 
                          : 'bg-white/20'
                      }`}
                    />
                  ))}
                </div>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  value={pin}
                  onChange={(e) => {
                    setPin(e.target.value.replace(/\D/g, ''));
                    setError('');
                    setScanPhase('idle');
                  }}
                  placeholder=""
                  className="w-full py-3 px-4 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-white/30 transition-all text-center text-2xl tracking-widest font-mono"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && pin.length === 6) {
                      handlePinVerify();
                    }
                  }}
                />
              </div>

              {/* Error message */}
              {error && (
                <p className="text-red-400 text-sm mb-3">{error}</p>
              )}

              {/* Buttons */}
              <div className="flex gap-3 w-full max-w-xs">
                <button
                  onClick={handleClose}
                  disabled={verifying}
                  className="flex-1 py-3 rounded-xl bg-white/5 border border-white/10 text-gray-400 font-bold text-sm hover:bg-white/10 transition-all disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handlePinVerify}
                  disabled={verifying || pin.length !== 6}
                  className="flex-1 py-3 rounded-xl bg-white text-black font-bold text-sm hover:bg-gray-100 transition-all disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {verifying ? (
                    <div className="w-4 h-4 border-2 border-black/20 border-t-black rounded-full animate-spin" />
                  ) : (
                    'Confirm'
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
