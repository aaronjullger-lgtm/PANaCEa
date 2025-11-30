
import React, { useEffect } from 'react';
import { motion } from 'framer-motion';

interface LoaderProps {
  message?: string;
}

const Loader: React.FC<LoaderProps> = ({ message = 'Generating...' }) => {
  // Prevent scrolling behind the overlay
  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, []);

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 bg-[var(--color-bg-primary)]/80 dark:bg-[var(--color-bg-primary)]/90 backdrop-blur-sm flex flex-col items-center justify-center z-50"
    >
      <div className="flex space-x-2">
        <motion.div 
          className="w-3 h-3 bg-[var(--color-accent)] rounded-full"
          animate={{ y: [-8, 0, -8] }}
          transition={{ duration: 0.6, repeat: Infinity, delay: 0 }}
        />
        <motion.div 
          className="w-3 h-3 bg-[var(--color-accent)] rounded-full"
          animate={{ y: [-8, 0, -8] }}
          transition={{ duration: 0.6, repeat: Infinity, delay: 0.15 }}
        />
        <motion.div 
          className="w-3 h-3 bg-[var(--color-accent)] rounded-full"
          animate={{ y: [-8, 0, -8] }}
          transition={{ duration: 0.6, repeat: Infinity, delay: 0.3 }}
        />
      </div>
      <p className="mt-4 text-[var(--color-text-secondary)] font-semibold">{message}</p>
    </motion.div>
  );
};

export default Loader;
