import React from 'react';
import { motion } from 'framer-motion';
import { useTheme } from '@/hooks/useTheme';
import { SunIcon } from '@/components/icons/SunIcon';
import { MoonIcon } from '@/components/icons/MoonIcon';

const ThemeToggleButton: React.FC = () => {
  const [theme, setTheme] = useTheme();

  return (
    <motion.button
      onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
      className="relative p-2.5 rounded-full min-w-[44px] min-h-[44px] flex items-center justify-center bg-slate-100 border border-slate-200 text-slate-700 hover:bg-slate-200 hover:border-slate-300 dark:bg-[var(--color-bg-secondary)] dark:border-[var(--color-border)] dark:text-[var(--color-text-secondary)] dark:hover:border-[var(--color-accent)] transition-all duration-200 shadow-sm hover:shadow-md"
      aria-label="Toggle theme"
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
    >
      <motion.div
        initial={false}
        animate={{ rotate: theme === 'dark' ? 0 : 180 }}
        transition={{ duration: 0.3, ease: 'easeInOut' }}
      >
        {theme === 'light' ? (
          <MoonIcon className="w-5 h-5 text-slate-600 dark:text-[var(--color-text-secondary)]" />
        ) : (
          <SunIcon className="w-5 h-5 text-slate-600 dark:text-slate-300" />
        )}
      </motion.div>
    </motion.button>
  );
};

export default ThemeToggleButton;
