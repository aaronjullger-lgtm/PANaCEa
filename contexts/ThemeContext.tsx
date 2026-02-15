/**
 * ThemeContext – single source of truth for light/dark theme and high-contrast data viz.
 * Ensures landing page and app share the same theme state and avoid UI inconsistencies.
 * High-contrast data mode: WCAG-friendly charts (patterns, no gradients, distinct borders).
 */

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useMemo,
  type Dispatch,
  type SetStateAction,
  type ReactNode,
} from 'react';

export type Theme = 'light' | 'dark';

function getInitialTheme(): Theme {
  if (typeof globalThis.window === 'undefined') return 'dark';
  const stored = globalThis.localStorage.getItem('pance-ai-theme') as Theme | null;
  if (stored === 'light' || stored === 'dark') return stored;
  return globalThis.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function getInitialHighContrastData(): boolean {
  if (typeof globalThis.window === 'undefined') return false;
  const stored = globalThis.localStorage.getItem('pance-ai-high-contrast-data');
  return stored === 'true';
}

export type ThemeContextValue = {
  theme: Theme;
  setTheme: Dispatch<SetStateAction<Theme>>;
  highContrastData: boolean;
  setHighContrastData: Dispatch<SetStateAction<boolean>>;
};

const ThemeContextInstance = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: Readonly<{ children: ReactNode }>) {
  const [theme, setTheme] = useState<Theme>(getInitialTheme);
  const [highContrastData, setHighContrastData] = useState<boolean>(getInitialHighContrastData);
  const value = useMemo<ThemeContextValue>(
    () => ({ theme, setTheme, highContrastData, setHighContrastData }),
    [theme, highContrastData]
  );

  useEffect(() => {
    const root = document.documentElement;
    const body = document.body;

    root.classList.add('theme-transitioning');
    if (theme === 'dark') {
      root.classList.add('dark');
      body.classList.add('dark');
    } else {
      root.classList.remove('dark');
      body.classList.remove('dark');
    }

    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', theme === 'dark' ? '#101729' : '#e9ecf1');

    requestAnimationFrame(() => {
      requestAnimationFrame(() => root.classList.remove('theme-transitioning'));
    });

    try {
      globalThis.localStorage.setItem('pance-ai-theme', theme);
    } catch {
      // ignore
    }
  }, [theme]);

  useEffect(() => {
    const root = document.documentElement;
    if (highContrastData) {
      root.classList.add('high-contrast-data');
    } else {
      root.classList.remove('high-contrast-data');
    }
    try {
      globalThis.localStorage.setItem('pance-ai-high-contrast-data', String(highContrastData));
    } catch {
      // ignore
    }
  }, [highContrastData]);

  return <ThemeContextInstance.Provider value={value}>{children}</ThemeContextInstance.Provider>;
}

/** @deprecated Use useTheme() and destructure { theme, setTheme } for same behavior */
export function useTheme(): [Theme, Dispatch<SetStateAction<Theme>>] {
  const value = useContext(ThemeContextInstance);
  if (!value) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return [value.theme, value.setTheme];
}

export function useThemeContext(): ThemeContextValue {
  const value = useContext(ThemeContextInstance);
  if (!value) {
    throw new Error('useThemeContext must be used within ThemeProvider');
  }
  return value;
}
