
import { useState, useEffect, type Dispatch, type SetStateAction } from 'react';

type Theme = 'light' | 'dark';

export function useTheme(): [Theme, Dispatch<SetStateAction<Theme>>] {
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window === 'undefined') {
      return 'dark';
    }
    const savedTheme = window.localStorage.getItem('pance-ai-theme') as Theme;
    if (savedTheme) {
      return savedTheme;
    }
    // Default to dark mode for modern aesthetic, but respect system preference
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'dark';
  });

  useEffect(() => {
    const root = window.document.documentElement;
    const body = window.document.body;
    
    if (theme === 'dark') {
      root.classList.add('dark');
      body.classList.add('dark');
    } else {
      root.classList.remove('dark');
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