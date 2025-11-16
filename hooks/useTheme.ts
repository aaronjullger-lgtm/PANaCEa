
import { useState, useEffect, type Dispatch, type SetStateAction } from 'react';

type Theme = 'light' | 'dark';

// FIX: Import Dispatch and SetStateAction types from 'react' and use them.
export function useTheme(): [Theme, Dispatch<SetStateAction<Theme>>] {
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window === 'undefined') {
      return 'light';
    }
    const savedTheme = window.localStorage.getItem('pance-ai-theme') as Theme;
    return savedTheme || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  });

  useEffect(() => {
    const body = window.document.body;
    if (theme === 'dark') {
      body.classList.add('dark');
    } else {
      body.classList.remove('dark');
    }
    try {
      window.localStorage.setItem('pance-ai-theme', theme);
    } catch (error) {
      console.error("Failed to save theme to localStorage.", error);
    }
  }, [theme]);

  return [theme, setTheme];
}