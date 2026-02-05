import React, { useEffect } from 'react';
import { motion } from 'framer-motion';

interface LoaderProps {
  message?: string;
  /** Force dark/black background for imaging review mode */
  forceDark?: boolean;
}

const Loader: React.FC<LoaderProps> = ({ message = 'Loading...', forceDark = false }) => {
  // Prevent scrolling behind the overlay
  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, []);

  // Use theme colors instead of hardcoded colors for light/dark mode consistency
  const bgClass = forceDark ? 'bg-slate-950' : 'bg-[var(--color-bg-primary)]/80 backdrop-blur-md';

  const dotClass = forceDark ? 'bg-slate-100' : 'bg-[var(--color-accent)]';

  const textClass = forceDark ? 'text-slate-200' : 'text-[var(--color-text-primary)]';

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className={`fixed inset-0 ${bgClass} flex flex-col items-center justify-center z-50`}
    >
      <div className="flex space-x-2">
        <motion.div
          className={`w-3 h-3 ${dotClass} rounded-full`}
          animate={{ y: [-8, 0, -8] }}
          transition={{ duration: 0.6, repeat: Infinity, delay: 0 }}
        />
        <motion.div
          className={`w-3 h-3 ${dotClass} rounded-full`}
          animate={{ y: [-8, 0, -8] }}
          transition={{ duration: 0.6, repeat: Infinity, delay: 0.15 }}
        />
        <motion.div
          className={`w-3 h-3 ${dotClass} rounded-full`}
          animate={{ y: [-8, 0, -8] }}
          transition={{ duration: 0.6, repeat: Infinity, delay: 0.3 }}
        />
      </div>
      <p className={`mt-4 ${textClass} font-semibold`} role="status" aria-live="polite">
        {message}
      </p>
    </motion.div>
  );
};

export default Loader;
