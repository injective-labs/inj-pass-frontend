'use client';

import { useTheme } from '@/contexts/ThemeContext';

interface ThemeToggleButtonProps {
  compact?: boolean;
}

export default function ThemeToggleButton({ compact = false }: ThemeToggleButtonProps) {
  const { theme, toggleTheme } = useTheme();
  const isLight = theme === 'light';
  const containerClass = compact
    ? 'relative flex h-10 w-[70px] items-center rounded-[1rem] border border-white/10 bg-white/[0.06] p-1.5 transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] backdrop-blur-xl shadow-[0_10px_26px_rgba(0,0,0,0.16)] hover:border-white/20'
    : 'relative flex h-12 w-[82px] items-center rounded-[1.1rem] border border-white/10 bg-white/[0.06] p-1.5 transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] backdrop-blur-xl shadow-[0_12px_32px_rgba(0,0,0,0.18)] hover:border-white/20';
  const innerTrackClass = compact ? 'absolute inset-[3px] rounded-[0.82rem]' : 'absolute inset-[3px] rounded-[0.95rem]';
  const iconClass = compact ? 'h-3.5 w-3.5' : 'h-4 w-4';
  const thumbBaseClass = compact
    ? 'absolute left-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-[0.75rem] border shadow-[0_8px_18px_rgba(15,23,42,0.2)] transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]'
    : 'absolute left-1.5 top-1.5 flex h-9 w-9 items-center justify-center rounded-[0.9rem] border shadow-[0_10px_24px_rgba(15,23,42,0.22)] transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]';
  const thumbTranslateClass = compact
    ? (isLight ? 'translate-x-[28px]' : 'translate-x-0')
    : (isLight ? 'translate-x-[38px]' : 'translate-x-0');
  const thumbToneClass = isLight
    ? 'border-amber-200/60 bg-[linear-gradient(180deg,#fffdf5_0%,#ffe28a_100%)] text-amber-600'
    : 'border-white/12 bg-[linear-gradient(180deg,#1f2937_0%,#0f172a_100%)] text-cyan-200';
  const thumbIconClass = compact ? 'h-4 w-4' : 'h-[18px] w-[18px]';

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isLight ? 'Switch to dark mode' : 'Switch to light mode'}
      title={isLight ? 'Switch to night mode' : 'Switch to day mode'}
      className={containerClass}
    >
      <div
        className={`${innerTrackClass} transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
          isLight
            ? 'bg-gradient-to-r from-[#f8b94f]/35 via-[#fff7d6]/80 to-[#ffd66b]/40'
            : 'bg-gradient-to-r from-[#0f172a] via-[#111827] to-[#1e293b]'
        }`}
      />

      <div className="relative z-10 flex w-full items-center justify-between px-1 text-gray-300">
        <svg
          className={`${iconClass} transition-all duration-500 ${isLight ? 'text-amber-500 scale-110' : 'text-white/45'}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          strokeWidth={1.9}
        >
          <circle cx="12" cy="12" r="4.2" />
          <path strokeLinecap="round" d="M12 2.8v2.1M12 19.1v2.1M4.93 4.93l1.48 1.48M17.59 17.59l1.48 1.48M2.8 12h2.1M19.1 12h2.1M4.93 19.07l1.48-1.48M17.59 6.41l1.48-1.48" />
        </svg>
        <svg
          className={`${iconClass} transition-all duration-500 ${isLight ? 'text-slate-400/70' : 'text-cyan-200 scale-110'}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          strokeWidth={1.9}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 12.8A8.8 8.8 0 1111.2 3a6.9 6.9 0 009.8 9.8z" />
        </svg>
      </div>

      <span
        className={`${thumbBaseClass} ${thumbTranslateClass} ${thumbToneClass}`}
      >
        {isLight ? (
          <svg className={thumbIconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <circle cx="12" cy="12" r="4" />
            <path strokeLinecap="round" d="M12 3v2M12 19v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M3 12h2M19 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
          </svg>
        ) : (
          <svg className={thumbIconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M20.3 14.4A8.7 8.7 0 019.6 3.7a8.7 8.7 0 1010.7 10.7z" />
          </svg>
        )}
      </span>
    </button>
  );
}
