'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

type ThemeMode = 'dark' | 'light';

interface ThemeContextValue {
  theme: ThemeMode;
  toggleTheme: () => void;
  setTheme: (theme: ThemeMode) => void;
  isThemeReady: boolean;
}

const THEME_STORAGE_KEY = 'injpass_theme_mode';

const ThemeContext = createContext<ThemeContextValue | null>(null);

function getTimeBasedFallbackTheme(): ThemeMode {
  if (typeof window === 'undefined') {
    return 'dark';
  }

  const hour = new Date().getHours();
  return hour >= 7 && hour < 19 ? 'light' : 'dark';
}

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

function resolveThemePreference(): ThemeMode {
  if (typeof window === 'undefined') {
    return 'dark';
  }

  const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
  if (storedTheme === 'light' || storedTheme === 'dark') {
    return storedTheme;
  }

  const documentTheme = document.documentElement.dataset.theme;
  if (documentTheme === 'light' || documentTheme === 'dark') {
    return documentTheme;
  }

  return getTimeBasedFallbackTheme();
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeMode>(getInitialTheme);
  const [hasHydratedTheme, setHasHydratedTheme] = useState(false);
  const animationTimeoutRef = useRef<number | null>(null);
  const effectiveTheme = hasHydratedTheme ? theme : getInitialTheme();

  useEffect(() => {
    const resolvedTheme = resolveThemePreference();
    applyTheme(resolvedTheme);
    window.localStorage.setItem(THEME_STORAGE_KEY, resolvedTheme);

    const syncId = window.requestAnimationFrame(() => {
      setThemeState(resolvedTheme);
      setHasHydratedTheme(true);
    });

    return () => {
      window.cancelAnimationFrame(syncId);
    };
  }, []);

  useEffect(() => {
    if (!hasHydratedTheme) {
      return;
    }

    applyTheme(theme);
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [hasHydratedTheme, theme]);

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key !== THEME_STORAGE_KEY) return;
      const nextTheme = event.newValue === 'light' ? 'light' : 'dark';
      applyTheme(nextTheme);
      setThemeState(nextTheme);
      setHasHydratedTheme(true);
    };

    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

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
    setHasHydratedTheme(true);
    setThemeState(nextTheme);
  }, [markThemeAnimating]);

  const toggleTheme = useCallback(() => {
    setTheme(effectiveTheme === 'dark' ? 'light' : 'dark');
  }, [effectiveTheme, setTheme]);

  const value = useMemo(
    () => ({
      theme: effectiveTheme,
      toggleTheme,
      setTheme,
      isThemeReady: hasHydratedTheme,
    }),
    [effectiveTheme, hasHydratedTheme, setTheme, toggleTheme]
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
