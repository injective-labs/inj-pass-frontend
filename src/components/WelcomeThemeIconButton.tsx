'use client';

import { useEffect, useRef, useState } from 'react';
import { useTheme } from '@/contexts/ThemeContext';

export default function WelcomeThemeIconButton() {
  const { theme, setTheme } = useTheme();
  const isLightMode = theme === 'light';
  const [isThemeTransitioning, setIsThemeTransitioning] = useState(false);
  const timeoutRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const handleThemeToggle = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
    setIsThemeTransitioning(true);

    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = window.setTimeout(() => {
      setIsThemeTransitioning(false);
      timeoutRef.current = null;
    }, 640);
  };

  return (
    <button
      type="button"
      onClick={handleThemeToggle}
      aria-label={isLightMode ? 'Switch to dark mode' : 'Switch to light mode'}
      className={`inline-flex h-8 w-8 items-center justify-center rounded-full border transition-colors ${
        isLightMode
          ? 'border-[#151a27]/10 bg-white/78 text-[#384055] hover:text-[#11161f]'
          : 'border-white/10 bg-white/[0.05] text-white/75 hover:text-white'
      }`}
    >
      {isLightMode ? (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="currentColor"
          className={`h-4 w-4 transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
            isThemeTransitioning ? 'rotate-180 scale-95' : 'rotate-0 scale-100'
          }`}
        >
          <path d="M12 18a6 6 0 1 0 0-12 6 6 0 0 0 0 12Zm0 4a1 1 0 0 1-1-1v-1a1 1 0 1 1 2 0v1a1 1 0 0 1-1 1Zm0-18a1 1 0 0 1-1-1V2a1 1 0 1 1 2 0v1a1 1 0 0 1-1 1Zm10 8a1 1 0 1 1 0 2h-1a1 1 0 1 1 0-2h1ZM4 12a1 1 0 1 1 0 2H3a1 1 0 1 1 0-2h1Zm14.95 6.364a1 1 0 0 1 1.414 1.414l-.707.707a1 1 0 1 1-1.414-1.414l.707-.707ZM5.757 5.172a1 1 0 0 1 1.414 0l.707.707A1 1 0 1 1 6.464 7.293l-.707-.707a1 1 0 0 1 0-1.414Zm12.193 0a1 1 0 0 1 0 1.414l-.707.707a1 1 0 0 1-1.414-1.414l.707-.707a1 1 0 0 1 1.414 0ZM7.171 16.707a1 1 0 1 1-1.414 1.414l-.707-.707a1 1 0 0 1 1.414-1.414l.707.707Z" />
        </svg>
      ) : (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="currentColor"
          className={`h-4 w-4 transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
            isThemeTransitioning ? 'rotate-180 scale-95' : 'rotate-0 scale-100'
          }`}
        >
          <path d="M21.752 15.002A9 9 0 0 1 11 2.248a1 1 0 0 0-1.185-1.185A11 11 0 1 0 22.937 14.19a1 1 0 0 0-1.185-1.185Z" />
        </svg>
      )}
    </button>
  );
}
