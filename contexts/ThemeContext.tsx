/**
 * ThemeContext – single source of truth for light/dark theme
 * Ensures landing page and app share the same theme state and avoid UI inconsistencies.
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

type ThemeContextValue = [Theme, Dispatch<SetStateAction<Theme>>];

const ThemeContextInstance = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: Readonly<{ children: ReactNode }>) {
  const [theme, setTheme] = useState<Theme>(getInitialTheme);
  const value = useMemo<ThemeContextValue>(() => [theme, setTheme], [theme]);

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

  return <ThemeContextInstance.Provider value={value}>{children}</ThemeContextInstance.Provider>;
}

export function useTheme(): ThemeContextValue {
  const value = useContext(ThemeContextInstance);
  if (!value) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return value;
}
