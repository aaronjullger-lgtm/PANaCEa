/**
 * Loading Progress Component
 * Shows a progress bar at the top of the screen for better perceived performance
 */

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface LoadingProgressProps {
  isLoading: boolean;
  /** Duration in ms for the progress to reach 90% */
  duration?: number;
}

export const LoadingProgress: React.FC<LoadingProgressProps> = ({ 
  isLoading, 
  duration = 2000 
}) => {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (isLoading) {
      setProgress(0);
      
      // Simulate progress that reaches 90% then slows down
      const interval = setInterval(() => {
        setProgress((prev) => {
          // Fast progress to 90%
          if (prev < 90) {
            return prev + (90 / (duration / 50));
          }
          // Slow progress from 90% to 95%
          if (prev < 95) {
            return prev + 0.1;
          }
          return prev;
        });
      }, 50);

      return () => clearInterval(interval);
    } else {
      // Complete the progress bar when loading finishes
      setProgress(100);
      const timeout = setTimeout(() => setProgress(0), 500);
      return () => clearTimeout(timeout);
    }
  }, [isLoading, duration]);

  return (
    <AnimatePresence>
      {(isLoading || progress > 0) && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed top-0 left-0 right-0 z-50 h-1 bg-transparent"
        >
          <motion.div
            className="h-full bg-[var(--color-accent)]"
            style={{
              width: `${progress}%`,
            }}
            initial={{ width: '0%' }}
            animate={{ width: `${progress}%` }}
            transition={{
              duration: 0.3,
              ease: 'easeOut',
            }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
};

/**
 * Top Bar Loading Indicator (simpler version)
 * Thin bar that shows at the very top of the page
 */
export const TopBarLoader: React.FC<{ isLoading: boolean }> = ({ isLoading }) => {
  return (
    <AnimatePresence>
      {isLoading && (
        <motion.div
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          exit={{ scaleX: 0 }}
          transition={{ duration: 1.5, ease: 'easeInOut' }}
          className="fixed top-0 left-0 right-0 h-1 z-50 origin-left bg-[var(--color-accent)]"
        />
      )}
    </AnimatePresence>
  );
};

export default LoadingProgress;
