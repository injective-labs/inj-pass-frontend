'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { isNFCSupported, readNFCCard, type NFCCardData } from '@/services/nfc';
import { useTheme } from '@/contexts/ThemeContext';

type CardCenterView = 'scanner' | 'cards';
type ScanState = 'idle' | 'scanning' | 'success' | 'error';

interface CardCenterModalProps {
  isOpen: boolean;
  isActive: boolean;
  onClose: () => void;
  onUseCardAddress?: (address: string) => void;
}

function ScannerArtwork({ scanning, isLight }: { scanning: boolean; isLight: boolean }) {
  return (
    <div className="flex items-center justify-center gap-8 mb-6">
      <div className="relative">
        <div className={`w-52 h-36 rounded-2xl border-[3px] flex items-center justify-between p-5 ${
          isLight
            ? 'bg-gradient-to-br from-white to-slate-100 border-slate-200 shadow-[0_20px_50px_rgba(148,163,184,0.22)]'
            : 'bg-gradient-to-br from-white/10 to-white/5 border-white/20 shadow-2xl'
        }`}>
          <div className="flex flex-col justify-between h-full">
            <div className={`w-12 h-10 rounded ${isLight ? 'bg-gradient-to-br from-cyan-200 to-blue-100' : 'bg-gradient-to-br from-cyan-300/30 to-blue-500/20'}`} />
            <div>
              <div className={`text-xs font-bold mb-2 uppercase tracking-[0.18em] ${isLight ? 'text-slate-500' : 'text-white/60'}`}>Pass Card</div>
              <div className={`w-28 h-4 rounded mb-1 ${isLight ? 'bg-slate-900/5' : 'bg-white/5'}`} />
              <div className={`w-20 h-3 rounded ${isLight ? 'bg-slate-900/5' : 'bg-white/5'}`} />
            </div>
          </div>

          <div className="flex items-center justify-center">
            <svg className={`w-8 h-8 ${isLight ? 'text-slate-400' : 'text-white/40'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0" />
            </svg>
          </div>
        </div>
      </div>

      {scanning && (
        <div className="flex flex-col gap-4">
          <div className="breathing-circle w-3 h-3 rounded-full bg-white" style={{ animationDelay: '0s' }} />
          <div className="breathing-circle w-3 h-3 rounded-full bg-white" style={{ animationDelay: '0.2s' }} />
          <div className="breathing-circle w-3 h-3 rounded-full bg-white" style={{ animationDelay: '0.4s' }} />
        </div>
      )}
    </div>
  );
}

export default function CardCenterModal({
  isOpen,
  isActive,
  onClose,
  onUseCardAddress,
}: CardCenterModalProps) {
  const { theme } = useTheme();
  const [view, setView] = useState<CardCenterView>('scanner');
  const [scanState, setScanState] = useState<ScanState>('idle');
  const [cardData, setCardData] = useState<NFCCardData | null>(null);
  const [nfcError, setNfcError] = useState('');
  const scanSessionRef = useRef(0);

  const resetScanner = useCallback(() => {
    setCardData(null);
    setNfcError('');
    setScanState('idle');
  }, []);

  const startScanner = useCallback(async () => {
    const sessionId = scanSessionRef.current + 1;
    scanSessionRef.current = sessionId;
    setCardData(null);
    setNfcError('');

    if (!isNFCSupported()) {
      setScanState('error');
      setNfcError('NFC is not supported on this device. Please use an Android device with Chrome browser.');
      return;
    }

    setScanState('scanning');

    try {
      const nextCardData = await readNFCCard();

      if (scanSessionRef.current !== sessionId) {
        return;
      }

      setCardData(nextCardData);

      if (!nextCardData.address) {
        setScanState('error');
        setNfcError('This card has no address stored yet. Bind or manage it in Cards first.');
        return;
      }

      setScanState('success');
    } catch (error) {
      if (scanSessionRef.current !== sessionId) {
        return;
      }

      setScanState('error');
      setNfcError((error as Error).message || 'Failed to read NFC card. Please try again.');
    }
  }, []);

  const openCardsView = () => {
    scanSessionRef.current += 1;
    setScanState('idle');
    setView('cards');
  };

  useEffect(() => {
    if (!isOpen || !isActive) {
      scanSessionRef.current += 1;
      return;
    }

    const previousOverflow = document.body.style.overflow;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleEscape);
    const frame = window.requestAnimationFrame(() => {
      setView('scanner');
      resetScanner();
      startScanner();
    });

    return () => {
      window.cancelAnimationFrame(frame);
      scanSessionRef.current += 1;
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleEscape);
    };
  }, [isActive, isOpen, onClose, resetScanner, startScanner]);

  if (!isOpen) {
    return null;
  }

  const isLight = theme === 'light';

  const handleUseCardAddress = () => {
    if (!cardData?.address) {
      return;
    }

    onUseCardAddress?.(cardData.address);
    onClose();
  };

  const containerClassName =
    view === 'scanner'
      ? `relative z-10 w-full max-w-2xl overflow-hidden rounded-[2rem] border ${
          isLight
            ? 'border-slate-200/80 bg-[linear-gradient(180deg,#ffffff,#f6f9ff)] shadow-[0_24px_90px_rgba(148,163,184,0.24)]'
            : 'border-white/10 bg-[#080d18] shadow-[0_24px_90px_rgba(0,0,0,0.55)]'
        }`
      : `relative z-10 flex h-[min(86vh,920px)] w-full max-w-[1240px] flex-col overflow-hidden rounded-[2rem] border ${
          isLight
            ? 'border-slate-200/80 bg-[linear-gradient(180deg,#ffffff,#f6f9ff)] shadow-[0_24px_90px_rgba(148,163,184,0.24)]'
            : 'border-white/10 bg-[#080d18] shadow-[0_24px_90px_rgba(0,0,0,0.55)]'
        }`;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 sm:p-6">
      <button
        aria-label="Close card center"
        className={`absolute inset-0 backdrop-blur-md transition-opacity duration-200 ${
          isActive ? 'opacity-100' : 'opacity-0'
        } ${isLight ? 'bg-slate-100/80' : 'bg-black/80'}`}
        onClick={onClose}
      />

      <div
        className={`${containerClassName} transform-gpu transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
          isActive ? 'translate-y-0 scale-100 opacity-100' : 'translate-y-4 scale-[0.965] opacity-0'
        }`}
      >
        <div className={`border-b px-5 py-4 sm:px-6 ${isLight ? 'border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.9),rgba(255,255,255,0.45))]' : 'border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0))]'}`}>
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className={`flex h-12 w-12 items-center justify-center rounded-2xl border ${isLight ? 'border-slate-200/80 bg-slate-900/[0.03] text-slate-900' : 'border-white/10 bg-white/5 text-white'}`}>
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7 11.5V14m0-2.5v-6a1.5 1.5 0 113 0m-3 6a1.5 1.5 0 00-3 0v2a7.5 7.5 0 0015 0v-5a1.5 1.5 0 00-3 0m-6-3V11m0-5.5v-1a1.5 1.5 0 013 0v1m0 0V11m0-5.5a1.5 1.5 0 013 0v3m0 0V11" />
                </svg>
              </div>
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-gray-500">
                  {view === 'scanner' ? 'Card Pay' : 'Cards'}
                </div>
                <h2 className="mt-1 text-xl font-bold text-white">
                  {view === 'scanner' ? 'Tap a Card to Pay' : 'Manage Your NFC Cards'}
                </h2>
                <p className="mt-1 text-sm text-gray-400">
                  {view === 'scanner'
                    ? 'This is the direct NFC layer from Send. Scan a card and jump straight into the payment flow.'
                    : 'Bind, review, and maintain your linked cards without leaving dashboard.'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {view === 'cards' ? (
                <button
                  onClick={() => {
                    setView('scanner');
                    resetScanner();
                    startScanner();
                  }}
                  className={`rounded-2xl border px-4 py-2.5 text-sm font-semibold transition-all ${isLight ? 'border-slate-200/80 bg-slate-900/[0.03] text-slate-600 hover:bg-slate-900/[0.05] hover:text-slate-900' : 'border-white/10 bg-white/5 text-gray-200 hover:bg-white/10 hover:text-white'}`}
                >
                  Back to Scan
                </button>
              ) : (
                <button
                  onClick={openCardsView}
                  className={`rounded-2xl border px-4 py-2.5 text-sm font-semibold transition-all ${isLight ? 'border-slate-200/80 bg-slate-900/[0.03] text-slate-600 hover:bg-slate-900/[0.05] hover:text-slate-900' : 'border-white/10 bg-white/5 text-gray-200 hover:bg-white/10 hover:text-white'}`}
                >
                  Manage Cards
                </button>
              )}

              <button
                onClick={onClose}
                className={`flex h-11 w-11 items-center justify-center rounded-2xl border transition-all ${isLight ? 'border-slate-200/80 bg-slate-900/[0.03] text-slate-500 hover:bg-slate-900/[0.05] hover:text-slate-900' : 'border-white/10 bg-white/5 text-gray-300 hover:bg-white/10 hover:text-white'}`}
                title="Close"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {view === 'cards' ? (
          <div className={`flex-1 min-h-0 p-2 sm:p-3 ${isLight ? 'bg-slate-900/[0.02]' : 'bg-[#050913]'}`}>
            <div className={`h-full overflow-hidden rounded-[1.5rem] border ${isLight ? 'border-slate-200/80 bg-white/90' : 'border-white/8 bg-black'}`}>
              <iframe
                src="/cards?embed=1&entry=card-center"
                title="Lambda Cards"
                className={`h-full w-full ${isLight ? 'bg-white' : 'bg-black'}`}
              />
            </div>
          </div>
        ) : (
          <div className="px-6 pb-6 pt-5 sm:px-7">
            <div className={`rounded-[1.75rem] border px-6 py-8 sm:px-8 ${isLight ? 'border-slate-200/80 bg-white/78' : 'border-white/10 bg-black/30'}`}>
              <div className="flex flex-col items-center justify-center min-h-[420px]">
                {scanState !== 'success' ? (
                  <>
                    <ScannerArtwork scanning={scanState === 'scanning'} isLight={isLight} />

                    <h4 className="text-base font-bold text-white mb-1">
                      {scanState === 'scanning' ? 'Scanning...' : scanState === 'error' ? 'Scan Interrupted' : 'Ready to Scan'}
                    </h4>
                    <p className="max-w-md text-center text-sm text-gray-400 mb-8">
                      {scanState === 'error' ? (
                        <span className="text-red-400">{nfcError}</span>
                      ) : scanState === 'scanning' ? (
                        'Hold your phone steady near the card. The card address will be injected straight into Send once the scan completes.'
                      ) : (
                        'Tap the card to your device to start a direct card-pay flow.'
                      )}
                    </p>

                    <div className="flex flex-wrap items-center justify-center gap-3">
                      {scanState === 'error' ? (
                        <>
                          <button
                            onClick={startScanner}
                            className="rounded-2xl bg-white px-6 py-3 text-sm font-bold text-black transition-all hover:bg-gray-100"
                          >
                            Retry Scan
                          </button>
                          <button
                            onClick={openCardsView}
                            className={`rounded-2xl border px-6 py-3 text-sm font-semibold transition-all ${isLight ? 'border-slate-200/80 bg-slate-900/[0.03] text-slate-600 hover:bg-slate-900/[0.05] hover:text-slate-900' : 'border-white/10 bg-white/5 text-gray-200 hover:bg-white/10 hover:text-white'}`}
                          >
                            Open Cards
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={startScanner}
                          className={`rounded-2xl border px-6 py-3 text-sm font-semibold transition-all ${isLight ? 'border-slate-200/80 bg-slate-900/[0.03] text-slate-600 hover:bg-slate-900/[0.05] hover:text-slate-900' : 'border-white/10 bg-white/5 text-gray-200 hover:bg-white/10 hover:text-white'}`}
                        >
                          Restart Scan
                        </button>
                      )}
                    </div>
                  </>
                ) : (
                  <>
                    <div className="relative mb-6 flex items-center justify-center w-40 h-40">
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-40 h-40 rounded-full border-2 border-white/30 animate-ping" />
                      </div>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-32 h-32 rounded-full border-2 border-white/40 animate-ping" style={{ animationDelay: '0.15s' }} />
                      </div>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-28 h-28 rounded-full border-2 border-white/50 animate-ping" style={{ animationDelay: '0.3s' }} />
                      </div>

                      <div className="relative w-24 h-24 rounded-full bg-white flex items-center justify-center success-bounce shadow-2xl">
                        <svg className="w-12 h-12 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    </div>

                    <h4 className="text-base font-bold text-white mb-1">Card Ready</h4>
                    <p className="text-center text-sm text-gray-400 mb-6">
                      Card address detected. You can inject it directly into the dashboard send flow.
                    </p>

                    <div className={`w-full max-w-md rounded-2xl border p-4 mb-6 ${isLight ? 'border-slate-200/80 bg-slate-900/[0.03]' : 'border-white/10 bg-white/[0.04]'}`}>
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-500">Card Address</div>
                          <div className="mt-2 break-all font-mono text-sm text-white">{cardData?.address}</div>
                        </div>
                      </div>

                      {cardData?.uid && (
                        <div className={`mt-4 pt-4 ${isLight ? 'border-t border-slate-200/80' : 'border-t border-white/6'}`}>
                          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-500">Card UID</div>
                          <div className="mt-2 font-mono text-xs text-gray-400">{cardData.uid}</div>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center justify-center gap-3">
                      <button
                        onClick={handleUseCardAddress}
                        className="rounded-2xl bg-white px-6 py-3 text-sm font-bold text-black transition-all hover:bg-gray-100"
                      >
                        Send to This Card
                      </button>
                      <button
                        onClick={startScanner}
                        className={`rounded-2xl border px-6 py-3 text-sm font-semibold transition-all ${isLight ? 'border-slate-200/80 bg-slate-900/[0.03] text-slate-600 hover:bg-slate-900/[0.05] hover:text-slate-900' : 'border-white/10 bg-white/5 text-gray-200 hover:bg-white/10 hover:text-white'}`}
                      >
                        Scan Another
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
