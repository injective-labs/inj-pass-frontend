'use client';

export function WalletErrorToast({
  message,
  isExiting,
  isLightMode,
}: {
  message: string;
  isExiting: boolean;
  isLightMode: boolean;
}) {
  return (
    <div
      className={`pointer-events-auto w-[min(24rem,calc(100vw-2rem))] overflow-hidden rounded-[22px] border shadow-[0_16px_42px_rgba(16,8,18,0.18)] backdrop-blur-xl ${
        isLightMode
          ? 'border-red-500/14 bg-[linear-gradient(180deg,rgba(255,255,255,0.92),rgba(255,245,247,0.88))] text-[#311318]'
          : 'border-red-400/18 bg-[linear-gradient(180deg,rgba(40,18,24,0.9),rgba(24,12,16,0.88))] text-red-50'
      } ${
        isExiting
          ? 'motion-safe:animate-[toastOut_320ms_cubic-bezier(0.22,1,0.36,1)_forwards]'
          : 'motion-safe:animate-[toastIn_320ms_cubic-bezier(0.22,1,0.36,1)]'
      }`}
      role="alert"
      aria-live="polite"
    >
      <div className="flex items-start gap-3 px-4 py-3.5">
        <div
          className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border ${
            isLightMode
              ? 'border-red-500/16 bg-red-500/10 text-red-600'
              : 'border-red-400/18 bg-red-500/12 text-red-200'
          }`}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            className="h-4 w-4"
            aria-hidden="true"
          >
            <path
              d="M12 8v4m0 3.5h.01M10.29 3.86 1.82 18a1.25 1.25 0 0 0 1.07 1.88h18.22A1.25 1.25 0 0 0 22.18 18l-8.47-14.14a1.25 1.25 0 0 0-2.42 0Z"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>

        <div className="min-w-0 flex-1">
          <p
            className={`text-xs font-medium uppercase tracking-[0.18em] ${
              isLightMode ? 'text-red-700/72' : 'text-red-100/58'
            }`}
          >
            Wallet Error
          </p>
          <p
            className={`mt-1 text-sm leading-6 ${
              isLightMode ? 'text-[#3c1a20]' : 'text-red-50/92'
            }`}
          >
            {message}
          </p>
        </div>
      </div>

      <div
        className={`h-1 w-full origin-left bg-[linear-gradient(90deg,#ff6a88,#ff8c7a,#ffb07c)] ${
          !isExiting
            ? 'motion-safe:animate-[toastCountdown_4.2s_linear_forwards]'
            : ''
        }`}
      />
    </div>
  );
}
