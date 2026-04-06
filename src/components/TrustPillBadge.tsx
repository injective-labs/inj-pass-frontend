'use client';

export default function TrustPillBadge({
  label,
  isLightMode,
  icon,
  className = '',
  showActivation = false,
  activationIndex = 0,
}: {
  label: string;
  isLightMode: boolean;
  icon?: 'custody' | 'passkey' | 'lock';
  className?: string;
  showActivation?: boolean;
  activationIndex?: number;
}) {
  const iconColorClass = isLightMode ? 'text-[#8c56ef]' : 'text-[#ff97bc]';
  const activationDelay = `${activationIndex * 140}ms`;

  return (
    <span
      style={
        showActivation
          ? {
              animationDelay: activationDelay,
            }
          : undefined
      }
      className={`relative inline-flex items-center gap-2 overflow-hidden rounded-full border px-3 py-1.5 text-[0.82rem] sm:px-3.5 sm:py-2 sm:text-sm ${
        isLightMode
          ? 'border-[#161c29]/10 bg-white/72 text-[#273042]/78'
          : 'border-[#d96eff]/16 bg-[linear-gradient(135deg,rgba(116,40,189,0.18),rgba(231,55,132,0.08))] text-white/[0.74]'
      } ${
        showActivation
          ? 'motion-safe:animate-[trustPillReveal_720ms_cubic-bezier(0.22,1,0.36,1)_forwards] opacity-0 translate-y-[6px]'
          : ''
      } ${className}`}
    >
      {showActivation ? (
        <span
          className={`pointer-events-none absolute inset-0 rounded-full opacity-0 motion-safe:animate-[trustPillSurfaceGlow_1100ms_cubic-bezier(0.22,1,0.36,1)_forwards] ${
            isLightMode
              ? 'bg-[linear-gradient(90deg,rgba(16,185,129,0.08),rgba(16,185,129,0.03),transparent)]'
              : 'bg-[linear-gradient(90deg,rgba(74,222,128,0.1),rgba(74,222,128,0.03),transparent)]'
          }`}
          style={{ animationDelay: activationDelay }}
        />
      ) : null}
      {icon ? (
        <span
          className={`relative z-[1] inline-flex h-4 w-4 items-center justify-center ${iconColorClass}`}
          aria-hidden="true"
        >
          {icon === 'custody' ? (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              className="h-3.5 w-3.5"
            >
              <path
                d="M12 3.5 5.75 6.1v4.55c0 4.12 2.58 6.86 6.25 8.85 3.67-1.99 6.25-4.73 6.25-8.85V6.1L12 3.5Z"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinejoin="round"
              />
              <path
                d="M9.4 11.9 11.2 13.7l3.5-3.8"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          ) : icon === 'passkey' ? (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              className="h-3.5 w-3.5"
            >
              <circle
                cx="8.25"
                cy="11"
                r="2.75"
                stroke="currentColor"
                strokeWidth="1.8"
              />
              <path
                d="M11 11h7.25m-2 0v2m-2-2v1.6"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          ) : (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              className="h-3.5 w-3.5"
            >
              <path
                d="M8.25 10V8.75a3.75 3.75 0 1 1 7.5 0V10"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
              <rect
                x="6.25"
                y="10"
                width="11.5"
                height="9"
                rx="2.5"
                stroke="currentColor"
                strokeWidth="1.8"
              />
            </svg>
          )}
        </span>
      ) : (
        <span
          className={`relative z-[1] h-1.5 w-1.5 rounded-full ${
            isLightMode ? 'bg-[#b476ff]' : 'bg-[#ff8fb0]'
          }`}
        />
      )}
      <span className="relative z-[1]">{label}</span>
      {showActivation ? (
        <span className="relative z-[1] ml-0.5 inline-flex h-2.5 w-2.5 items-center justify-center">
          <span
            className={`absolute inset-0 rounded-full opacity-0 motion-safe:animate-[trustPillStatusHalo_2.8s_ease-in-out_infinite] ${
              isLightMode ? 'bg-emerald-400/20' : 'bg-emerald-300/20'
            }`}
            style={{ animationDelay: `${activationIndex * 140 + 480}ms` }}
          />
          <span
            className={`h-1.5 w-1.5 rounded-full opacity-0 motion-safe:animate-[trustPillStatusDot_520ms_cubic-bezier(0.22,1,0.36,1)_forwards,trustPillStatusBreath_2.8s_ease-in-out_infinite] ${
              isLightMode ? 'bg-emerald-500' : 'bg-emerald-300'
            }`}
            style={{ animationDelay: `${activationIndex * 140 + 220}ms, ${activationIndex * 140 + 740}ms` }}
          />
        </span>
      ) : null}
    </span>
  );
}
