'use client';

import { useEffect, useState } from 'react';

type CardCenterTab = 'pay' | 'cards';

interface CardCenterModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function CardCenterModal({ isOpen, onClose }: CardCenterModalProps) {
  const [activeTab, setActiveTab] = useState<CardCenterTab>('pay');

  useEffect(() => {
    if (!isOpen) {
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

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 sm:p-6">
      <button
        aria-label="Close card center"
        className="absolute inset-0 bg-black/80 backdrop-blur-md"
        onClick={onClose}
      />

      <div className="relative z-10 flex h-[min(86vh,920px)] w-full max-w-[1240px] flex-col overflow-hidden rounded-[2rem] border border-white/10 bg-[#080d18] shadow-[0_24px_90px_rgba(0,0,0,0.55)]">
        <div className="border-b border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0))] px-5 py-4 sm:px-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-white">
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h5M5 6h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2Z" />
                </svg>
              </div>
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-gray-500">Card Center</div>
                <h2 className="mt-1 text-xl font-bold text-white">Lambda Pay and NFC Cards</h2>
                <p className="mt-1 text-sm text-gray-400">
                  Pay from a bound card, scan NFC tags, and manage your card inventory without leaving dashboard.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="relative rounded-2xl border border-white/10 bg-white/5 p-1">
                <div
                  className={`absolute top-1 bottom-1 w-[calc(50%-0.25rem)] rounded-[0.9rem] bg-white transition-all duration-300 ${
                    activeTab === 'pay' ? 'left-1' : 'left-[calc(50%+0rem)]'
                  }`}
                />
                <div className="relative grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setActiveTab('pay')}
                    className={`rounded-[0.9rem] px-4 py-2.5 text-sm font-bold transition-all ${
                      activeTab === 'pay' ? 'text-black' : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    Pay
                  </button>
                  <button
                    onClick={() => setActiveTab('cards')}
                    className={`rounded-[0.9rem] px-4 py-2.5 text-sm font-bold transition-all ${
                      activeTab === 'cards' ? 'text-black' : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    Cards
                  </button>
                </div>
              </div>

              <button
                onClick={onClose}
                className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-gray-300 transition-all hover:bg-white/10 hover:text-white"
                title="Close"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        <div className="flex-1 min-h-0 bg-[#050913] p-2 sm:p-3">
          <div className="h-full overflow-hidden rounded-[1.5rem] border border-white/8 bg-black">
            <iframe
              key={activeTab}
              src={activeTab === 'pay' ? '/send?embed=1&entry=card-center' : '/cards?embed=1&entry=card-center'}
              title={activeTab === 'pay' ? 'Lambda Pay' : 'Lambda Cards'}
              className="h-full w-full bg-black"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
