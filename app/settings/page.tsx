'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useWallet } from '@/contexts/WalletContext';
import { usePin } from '@/contexts/PinContext';
import { toHex } from '@/wallet/key-management';
import AccountHeader from '../components/AccountHeader';

export default function SettingsPage() {
  const router = useRouter();
  const { isUnlocked, address, privateKey, keystore, lock, isCheckingSession } = useWallet();
  const { hasPin, isPinLocked, autoLockMinutes, setPin, changePin, lockWallet, setAutoLockMinutes, verifyPin } = usePin();
  
  const [showPrivateKey, setShowPrivateKey] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showSecurityModal, setShowSecurityModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'settings' | 'wallet' | 'discover'>('settings');
  const [verifyingPasskey, setVerifyingPasskey] = useState(false);
  const [passkeyError, setPasskeyError] = useState('');
  
  // PIN Management
  const [showPinSetup, setShowPinSetup] = useState(false);
  const [showPinChange, setShowPinChange] = useState(false);
  const [showPinLock, setShowPinLock] = useState(false);
  const [showAutoLockMenu, setShowAutoLockMenu] = useState(false);
  const [showResetPinModal, setShowResetPinModal] = useState(false);
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [oldPin, setOldPin] = useState('');
  const [lockPin, setLockPin] = useState('');
  const [pinError, setPinError] = useState('');
  const [resettingPin, setResettingPin] = useState(false);
  const [pinResetSuccess, setPinResetSuccess] = useState(false);

  // Wait for session check
  if (isCheckingSession) {
    return <div className="min-h-screen flex items-center justify-center"><p className="text-white">Loading...</p></div>;
  }

  if (!isUnlocked || !address) {
    if (typeof window !== 'undefined') {
      router.push('/welcome');
    }
    return null;
  }

  const privateKeyHex = privateKey ? toHex(privateKey) : '';
  const last6Chars = privateKeyHex.slice(-6);
  const keyWithoutLast6 = privateKeyHex.slice(0, -6);

  const handleCopy = () => {
    if (privateKey) {
      navigator.clipboard.writeText(keyWithoutLast6);
      setShowSecurityModal(true);
    }
  };

  const handleLock = () => {
    lock();
    router.push('/welcome');
  };

  // Handle Show Key with Passkey verification
  const handleShowKey = async () => {
    if (showPrivateKey) {
      // If already showing, just hide
      setShowPrivateKey(false);
      setPasskeyError('');
      return;
    }

    // Verify with passkey before showing
    setVerifyingPasskey(true);
    setPasskeyError('');
    
    try {
      const { unlockByPasskey } = await import('@/wallet/key-management/createByPasskey');
      
      if (!keystore?.credentialId) {
        throw new Error('No passkey found');
      }
      
      // Authenticate with passkey
      await unlockByPasskey(keystore.credentialId);
      
      // If authentication successful, show private key
      setShowPrivateKey(true);
      setVerifyingPasskey(false);
    } catch (error) {
      setPasskeyError(error instanceof Error ? error.message : 'Failed to verify passkey');
      setVerifyingPasskey(false);
    }
  };

  // PIN Setup
  const handleSetupPin = async () => {
    setPinError('');
    
    if (newPin.length !== 6 || !/^\d{6}$/.test(newPin)) {
      setPinError('PIN must be exactly 6 digits');
      return;
    }
    
    if (newPin !== confirmPin) {
      setPinError('PINs do not match');
      return;
    }
    
    try {
      await setPin(newPin);
      setShowPinSetup(false);
      setNewPin('');
      setConfirmPin('');
    } catch (error) {
      setPinError(error instanceof Error ? error.message : 'Failed to set PIN');
    }
  };

  // PIN Change
  const handleChangePin = async () => {
    setPinError('');
    
    if (newPin.length !== 6 || !/^\d{6}$/.test(newPin)) {
      setPinError('New PIN must be exactly 6 digits');
      return;
    }
    
    if (newPin !== confirmPin) {
      setPinError('New PINs do not match');
      return;
    }
    
    try {
      const success = await changePin(oldPin, newPin);
      if (success) {
        setShowPinChange(false);
        setOldPin('');
        setNewPin('');
        setConfirmPin('');
      } else {
        setPinError('Current PIN is incorrect');
      }
    } catch (error) {
      setPinError(error instanceof Error ? error.message : 'Failed to change PIN');
    }
  };

  // PIN Lock
  const handlePinLock = () => {
    if (lockPin.length !== 6) {
      setPinError('PIN must be 6 digits');
      return;
    }
    
    lockWallet();
    setShowPinLock(false);
    setLockPin('');
    router.push('/unlock');
  };

  // Reset PIN with Passkey
  const handleResetPinWithPasskey = async () => {
    setResettingPin(true);
    setPinError('');
    
    try {
      // Use passkey to authenticate
      const { unlockByPasskey } = await import('@/wallet/key-management/createByPasskey');
      
      if (!keystore?.credentialId) {
        throw new Error('No passkey found');
      }
      
      // Authenticate with passkey
      await unlockByPasskey(keystore.credentialId);
      
      // If authentication successful, allow setting new PIN
      if (newPin.length !== 6 || !/^\d{6}$/.test(newPin)) {
        setPinError('PIN must be exactly 6 digits');
        setResettingPin(false);
        return;
      }
      
      if (newPin !== confirmPin) {
        setPinError('PINs do not match');
        setResettingPin(false);
        return;
      }
      
      await setPin(newPin);
      setShowResetPinModal(false);
      setNewPin('');
      setConfirmPin('');
      setResettingPin(false);
      
      // Show success message
      setPinResetSuccess(true);
      setTimeout(() => {
        setPinResetSuccess(false);
      }, 3000);
    } catch (error) {
      setPinError(error instanceof Error ? error.message : 'Failed to reset PIN with passkey');
      setResettingPin(false);
    }
  };

  return (
    <div className="min-h-screen pb-24 md:pb-8 bg-black">
      {/* Header - OKX Style */}
      <div className="bg-gradient-to-b from-white/5 to-transparent border-b border-white/5 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 py-6">
          {/* Account Header */}
          <div className="mb-6">
            <AccountHeader address={address} />
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* PIN Reset Success Message */}
        {pinResetSuccess && (
          <div className="mb-6 p-4 rounded-2xl bg-green-500/10 border border-green-500/30 text-green-400 flex items-center gap-3 animate-fade-in">
            <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div>
              <div className="font-bold text-sm">PIN Reset Successful</div>
              <div className="text-xs text-green-300">Your transaction PIN has been successfully reset.</div>
            </div>
          </div>
        )}

        {/* PIN Management Section */}
        <div className="mb-6">
          <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4">PIN Security</h2>
          
          <div className="space-y-3">
            {/* Setup/Change PIN */}
            {!hasPin ? (
              <button
                onClick={() => setShowPinSetup(true)}
                className="w-full flex items-center justify-between p-4 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 transition-all"
              >
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-white hover:bg-gray-100 flex items-center justify-center shadow-lg transition-all">
                    <svg className="w-5 h-5 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </div>
                  <div className="text-left">
                    <div className="text-sm font-bold text-white">Set Transaction PIN</div>
                    <div className="text-xs text-gray-400">Required for all on-chain transactions</div>
                  </div>
                </div>
                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            ) : (
              <>
                {/* Change PIN */}
                <button
                  onClick={() => setShowPinChange(true)}
                  className="w-full flex items-center justify-between p-4 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 transition-all"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-white hover:bg-gray-100 flex items-center justify-center shadow-lg transition-all">
                      <svg className="w-5 h-5 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                      </svg>
                    </div>
                    <div className="text-left">
                      <div className="text-sm font-bold text-white">Change Transaction PIN</div>
                      <div className="text-xs text-gray-400">Update your transaction PIN code</div>
                    </div>
                  </div>
                  <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>

                {/* PIN-Free Transactions Setting */}
                <div className="p-4 rounded-2xl bg-white/5 border border-white/10">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-white hover:bg-gray-100 flex items-center justify-center shadow-lg transition-all">
                        <svg className="w-5 h-5 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                        </svg>
                      </div>
                      <div className="text-left">
                        <div className="text-sm font-bold text-white">PIN-Free Transactions</div>
                        <div className="text-xs text-gray-400">Skip PIN for small amounts</div>
                      </div>
                    </div>
                    
                    {/* PIN-Free Dropdown */}
                    <div className="relative">
                      <button
                        onClick={() => setShowAutoLockMenu(!showAutoLockMenu)}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white text-black font-bold text-sm hover:bg-gray-100 transition-all"
                      >
                        {autoLockMinutes === 0 ? 'Disabled' : `${autoLockMinutes}m`}
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <polyline points="6 9 12 15 18 9" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </button>

                      {showAutoLockMenu && (
                        <>
                          <div className="fixed inset-0 z-40" onClick={() => setShowAutoLockMenu(false)} />
                          <div className="dropdown-menu absolute right-0 top-full mt-2 w-36 bg-black border border-white/10 rounded-xl shadow-2xl z-50 p-2">
                            {[0, 1, 5, 15, 30, 60].map((minutes) => (
                              <button
                                key={minutes}
                                onClick={() => {
                                  setAutoLockMinutes(minutes);
                                  setShowAutoLockMenu(false);
                                }}
                                className={`w-full py-2 px-3 rounded-lg text-sm font-bold transition-all ${
                                  autoLockMinutes === minutes
                                    ? 'bg-white text-black'
                                    : 'bg-transparent text-gray-400 hover:bg-white/10 hover:text-white'
                                }`}
                              >
                                {minutes === 0 ? 'Disabled' : `${minutes}m`}
                              </button>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Reset PIN with Passkey */}
                <button
                  onClick={() => setShowResetPinModal(true)}
                  className="w-full flex items-center justify-between p-4 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 transition-all"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-white hover:bg-gray-100 flex items-center justify-center shadow-lg transition-all">
                      <svg className="w-5 h-5 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                    </div>
                    <div className="text-left">
                      <div className="text-sm font-bold text-white">Reset PIN with Passkey</div>
                      <div className="text-xs text-gray-400">Use biometric to reset your PIN</div>
                    </div>
                  </div>
                  <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Security Section */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider">Private Key</h2>
            <button
              onClick={handleShowKey}
              disabled={verifyingPasskey}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                showPrivateKey 
                  ? 'bg-white text-black' 
                  : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white border border-white/10'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {verifyingPasskey ? (
                <>
                  <svg className="w-3.5 h-3.5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Verifying...
                </>
              ) : (
                showPrivateKey ? 'Hide Key' : 'Show Key'
              )}
            </button>
          </div>
          
          {/* Passkey Verification Info */}
          {!showPrivateKey && !passkeyError && (
            <div className="mb-4 p-3 rounded-xl bg-white/10 border border-white/20 text-white text-xs flex items-start gap-2">
              <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Biometric authentication required to view private key
            </div>
          )}

          {/* Passkey Error Message */}
          {passkeyError && (
            <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-start gap-2">
              <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              {passkeyError}
            </div>
          )}
          
          {showPrivateKey && (
            <div className="p-5 rounded-2xl bg-white/5 border border-white/10 space-y-4">
              {/* Private Key Display */}
              <div className="p-4 rounded-xl bg-black/50 border border-white/10">
                <div className="text-xs text-gray-400 mb-2 uppercase tracking-wider">Private Key</div>
                <div className="font-mono text-xs text-white break-all leading-relaxed">
                  {privateKeyHex}
                </div>
              </div>

              {/* Copy Button */}
              <button
                onClick={handleCopy}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-white hover:bg-gray-100 text-black font-bold text-sm transition-all"
              >
                {copied ? (
                  <>
                    <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Copied!
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <rect width="14" height="14" x="8" y="8" rx="2" ry="2" strokeWidth={2} />
                      <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" strokeWidth={2} />
                    </svg>
                    Copy Private Key
                  </>
                )}
              </button>

              {/* Warning */}
              <div className="flex items-start gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/30">
                <svg className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <p className="text-xs text-red-400">
                  NEVER share your private key. Anyone with this key can steal your funds.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Wallet Actions */}
        <div className="mb-6">
          <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4">Wallet Actions</h2>
          
          <button
            onClick={handleLock}
            className="w-full flex items-center justify-center gap-3 py-4 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-white font-bold text-sm transition-all"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" strokeWidth={2} />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" strokeWidth={2} />
            </svg>
            Lock Wallet
          </button>
        </div>
      </div>

      {/* PIN Setup Modal */}
      {showPinSetup && (
        <div 
          className="modal-overlay fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={() => {
            setShowPinSetup(false);
            setNewPin('');
            setConfirmPin('');
            setPinError('');
          }}
        >
          <div 
            className="modal-content bg-black border border-white/10 rounded-2xl max-w-md w-full shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5 border-b border-white/5">
              <h3 className="text-lg font-bold text-white">Set Transaction PIN</h3>
            </div>
            
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-400 uppercase tracking-wider mb-3">
                  New PIN (6 digits)
                </label>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  value={newPin}
                  onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
                  placeholder="••••••"
                  className="w-full py-3 px-4 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-white/30 transition-all text-center text-2xl tracking-widest font-mono"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-400 uppercase tracking-wider mb-3">
                  Confirm PIN
                </label>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  value={confirmPin}
                  onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ''))}
                  placeholder="••••••"
                  className="w-full py-3 px-4 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-white/30 transition-all text-center text-2xl tracking-widest font-mono"
                />
              </div>

              {pinError && (
                <div className="text-red-400 text-sm text-center">{pinError}</div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => {
                    setShowPinSetup(false);
                    setNewPin('');
                    setConfirmPin('');
                    setPinError('');
                  }}
                  className="flex-1 py-3 rounded-xl bg-white/5 border border-white/10 text-gray-400 font-bold text-sm hover:bg-white/10 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSetupPin}
                  disabled={!newPin || !confirmPin}
                  className="flex-1 py-3 rounded-xl bg-white text-black font-bold text-sm hover:bg-gray-100 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  Set PIN
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PIN Change Modal */}
      {showPinChange && (
        <div 
          className="modal-overlay fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={() => {
            setShowPinChange(false);
            setOldPin('');
            setNewPin('');
            setConfirmPin('');
            setPinError('');
          }}
        >
          <div 
            className="modal-content bg-black border border-white/10 rounded-2xl max-w-md w-full shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5 border-b border-white/5">
              <h3 className="text-lg font-bold text-white">Change Transaction PIN</h3>
            </div>
            
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-400 uppercase tracking-wider mb-3">
                  Current PIN
                </label>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  value={oldPin}
                  onChange={(e) => setOldPin(e.target.value.replace(/\D/g, ''))}
                  placeholder="••••••"
                  className="w-full py-3 px-4 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-white/30 transition-all text-center text-2xl tracking-widest font-mono"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-400 uppercase tracking-wider mb-3">
                  New PIN
                </label>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  value={newPin}
                  onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
                  placeholder="••••••"
                  className="w-full py-3 px-4 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-white/30 transition-all text-center text-2xl tracking-widest font-mono"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-400 uppercase tracking-wider mb-3">
                  Confirm New PIN
                </label>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  value={confirmPin}
                  onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ''))}
                  placeholder="••••••"
                  className="w-full py-3 px-4 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-white/30 transition-all text-center text-2xl tracking-widest font-mono"
                />
              </div>

              {pinError && (
                <div className="text-red-400 text-sm text-center">{pinError}</div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => {
                    setShowPinChange(false);
                    setOldPin('');
                    setNewPin('');
                    setConfirmPin('');
                    setPinError('');
                  }}
                  className="flex-1 py-3 rounded-xl bg-white/5 border border-white/10 text-gray-400 font-bold text-sm hover:bg-white/10 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleChangePin}
                  disabled={!oldPin || !newPin || !confirmPin}
                  className="flex-1 py-3 rounded-xl bg-white text-black font-bold text-sm hover:bg-gray-100 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  Change PIN
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PIN Lock Modal */}
      {showPinLock && (
        <div 
          className="modal-overlay fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={() => {
            setShowPinLock(false);
            setLockPin('');
            setPinError('');
          }}
        >
          <div 
            className="modal-content bg-black border border-white/10 rounded-2xl max-w-md w-full shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5 border-b border-white/5">
              <h3 className="text-lg font-bold text-white">Lock Wallet</h3>
            </div>
            
            <div className="p-5 space-y-4">
              <p className="text-sm text-gray-400 text-center">
                Your wallet will be locked. You'll need your PIN to unlock it.
              </p>

              <div>
                <label className="block text-sm font-bold text-gray-400 uppercase tracking-wider mb-3">
                  Confirm with PIN
                </label>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  value={lockPin}
                  onChange={(e) => setLockPin(e.target.value.replace(/\D/g, ''))}
                  placeholder="••••••"
                  className="w-full py-3 px-4 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-white/30 transition-all text-center text-2xl tracking-widest font-mono"
                  autoFocus
                />
              </div>

              {pinError && (
                <div className="text-red-400 text-sm text-center">{pinError}</div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => {
                    setShowPinLock(false);
                    setLockPin('');
                    setPinError('');
                  }}
                  className="flex-1 py-3 rounded-xl bg-white/5 border border-white/10 text-gray-400 font-bold text-sm hover:bg-white/10 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handlePinLock}
                  disabled={lockPin.length !== 6}
                  className="flex-1 py-3 rounded-xl bg-red-500 hover:bg-red-600 text-white font-bold text-sm transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  Lock Now
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reset PIN with Passkey Modal */}
      {showResetPinModal && (
        <div 
          className="modal-overlay fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={() => {
            setShowResetPinModal(false);
            setNewPin('');
            setConfirmPin('');
            setPinError('');
          }}
        >
          <div 
            className="modal-content bg-black border border-white/10 rounded-2xl max-w-md w-full shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5 border-b border-white/5">
              <h3 className="text-lg font-bold text-white">Reset PIN with Passkey</h3>
            </div>
            
            <div className="p-5 space-y-4">
              <div className="flex items-start gap-3 p-4 rounded-xl bg-blue-500/10 border border-blue-500/30">
                <svg className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-xs text-blue-400">
                  You will be asked to authenticate with your biometric (fingerprint or face) to reset your PIN.
                </p>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-400 uppercase tracking-wider mb-3">
                  New PIN (6 digits)
                </label>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  value={newPin}
                  onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
                  placeholder="••••••"
                  className="w-full py-3 px-4 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-white/30 transition-all text-center text-2xl tracking-widest font-mono"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-400 uppercase tracking-wider mb-3">
                  Confirm New PIN
                </label>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  value={confirmPin}
                  onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ''))}
                  placeholder="••••••"
                  className="w-full py-3 px-4 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-white/30 transition-all text-center text-2xl tracking-widest font-mono"
                />
              </div>

              {pinError && (
                <div className="text-red-400 text-sm text-center">{pinError}</div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => {
                    setShowResetPinModal(false);
                    setNewPin('');
                    setConfirmPin('');
                    setPinError('');
                  }}
                  className="flex-1 py-3 rounded-xl bg-white/5 border border-white/10 text-gray-400 font-bold text-sm hover:bg-white/10 transition-all"
                  disabled={resettingPin}
                >
                  Cancel
                </button>
                <button
                  onClick={handleResetPinWithPasskey}
                  disabled={!newPin || !confirmPin || resettingPin}
                  className="flex-1 py-3 rounded-xl bg-white text-black font-bold text-sm hover:bg-gray-100 transition-all disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {resettingPin ? (
                    <>
                      <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      Authenticating...
                    </>
                  ) : (
                    'Reset PIN'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Security Confirmation Modal */}
      {showSecurityModal && (
        <div 
          className="modal-overlay fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={() => setShowSecurityModal(false)}
        >
          <div 
            className="modal-content bg-black border border-white/10 rounded-2xl max-w-md w-full overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5 border-b border-white/5">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" strokeWidth={2} />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" strokeWidth={2} />
                </svg>
                Security Verification
              </h3>
            </div>
            
            <div className="p-5 space-y-4">
              <p className="text-sm text-gray-400">
                For security, the last 6 characters have been removed from the clipboard. Please note down these characters to complete your backup:
              </p>
              
              <div className="p-5 rounded-2xl bg-white/5 border border-white/10 text-center">
                <span className="text-xs text-gray-400 block mb-3 uppercase tracking-wider">Last 6 Characters</span>
                <span className="text-3xl font-bold text-white font-mono tracking-widest">{last6Chars}</span>
              </div>

              <div className="flex items-start gap-3 p-4 rounded-xl bg-white/5 border border-white/10">
                <svg className="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <p className="text-xs text-gray-400">
                  Make sure to save these characters. You will need them to restore your wallet.
                </p>
              </div>

              <div className="flex gap-3 pt-2">
                <button 
                  onClick={() => setShowSecurityModal(false)}
                  className="flex-1 py-3 rounded-xl bg-white/5 border border-white/10 text-gray-400 font-bold text-sm hover:bg-white/10 transition-all"
                >
                  Cancel
                </button>
                <button 
                  onClick={() => {
                    setCopied(true);
                    setShowSecurityModal(false);
                    setTimeout(() => setCopied(false), 3000);
                  }}
                  className="flex-1 py-3 rounded-xl bg-white text-black font-bold text-sm hover:bg-gray-100 transition-all"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Navigation - Same as Dashboard */}
      <div className="fixed bottom-0 left-0 right-0 bg-black/95 border-t border-white/10 backdrop-blur-lg">
        <div className="max-w-7xl mx-auto px-4">
          <div className="grid grid-cols-3 gap-4 py-3">
            {/* Settings */}
            <button
              onClick={() => setActiveTab('settings')}
              className={`flex flex-col items-center gap-1 py-2 rounded-xl transition-all duration-300 ease-in-out transform ${
                activeTab === 'settings' 
                  ? 'text-white scale-105' 
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              <div className={`p-2 rounded-xl transition-all duration-300 ease-in-out ${
                activeTab === 'settings' 
                  ? 'bg-white/10' 
                  : 'bg-transparent'
              }`}>
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <span className="text-xs font-semibold">Settings</span>
            </button>

            {/* Wallet */}
            <button
              onClick={() => {
                setActiveTab('wallet');
                router.push('/dashboard');
              }}
              className={`flex flex-col items-center gap-1 py-2 rounded-xl transition-all duration-300 ease-in-out transform ${
                activeTab === 'wallet' 
                  ? 'text-white scale-105' 
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              <div className={`p-2 rounded-xl transition-all duration-300 ease-in-out ${
                activeTab === 'wallet' 
                  ? 'bg-white/10' 
                  : 'bg-transparent'
              }`}>
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <rect x="2" y="6" width="20" height="14" rx="2" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M2 10h20" strokeWidth={2} strokeLinecap="round" />
                  <circle cx="18" cy="15" r="1.5" fill="currentColor" />
                </svg>
              </div>
              <span className="text-xs font-semibold">Wallet</span>
            </button>

            {/* Discover */}
            <button
              onClick={() => {
                setActiveTab('discover');
                router.push('/discover');
              }}
              className={`flex flex-col items-center gap-1 py-2 rounded-xl transition-all duration-300 ease-in-out transform ${
                activeTab === 'discover' 
                  ? 'text-white scale-105' 
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              <div className={`p-2 rounded-xl transition-all duration-300 ease-in-out ${
                activeTab === 'discover' 
                  ? 'bg-white/10' 
                  : 'bg-transparent'
              }`}>
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="10" strokeWidth={2} strokeLinecap="round" />
                  <path d="M8 12h8M12 8v8" strokeWidth={2} strokeLinecap="round" />
                  <path d="M15 9l-3 3 3 3" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <span className="text-xs font-semibold">Discover</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
