'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

type ThemeMode = 'dark' | 'light';

interface ThemeContextValue {
  theme: ThemeMode;
  toggleTheme: () => void;
  setTheme: (theme: ThemeMode) => void;
}

const THEME_STORAGE_KEY = 'injpass_theme_mode';

const ThemeContext = createContext<ThemeContextValue | null>(null);

function applyTheme(theme: ThemeMode) {
  if (typeof document === 'undefined') return;

  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
  document.body?.setAttribute('data-theme', theme);
}

function getInitialTheme(): ThemeMode {
  if (typeof document !== 'undefined') {
    return document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';
  }

  return 'dark';
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeMode>(getInitialTheme);
  const animationTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    applyTheme(theme);
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  useEffect(() => {
    return () => {
      if (animationTimeoutRef.current !== null) {
        window.clearTimeout(animationTimeoutRef.current);
      }
    };
  }, []);

  const markThemeAnimating = useCallback(() => {
    document.documentElement.dataset.themeAnimating = 'true';

    if (animationTimeoutRef.current !== null) {
      window.clearTimeout(animationTimeoutRef.current);
    }

    animationTimeoutRef.current = window.setTimeout(() => {
      delete document.documentElement.dataset.themeAnimating;
      animationTimeoutRef.current = null;
    }, 650);
  }, []);

  const setTheme = useCallback((nextTheme: ThemeMode) => {
    markThemeAnimating();
    setThemeState(nextTheme);
  }, [markThemeAnimating]);

  const toggleTheme = useCallback(() => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  }, [setTheme, theme]);

  const value = useMemo(
    () => ({
      theme,
      toggleTheme,
      setTheme,
    }),
    [setTheme, theme, toggleTheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }

  return context;
}
