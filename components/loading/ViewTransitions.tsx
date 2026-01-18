/**
 * View Transition Loading States
 *
 * Provides smooth, context-aware transitions between major views.
 * Eliminates jarring hard cuts and provides clear state indication.
 */

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BarChart3, BookOpen, Brain, Home, Settings, TrendingUp } from 'lucide-react';

interface ViewTransitionProps {
  from: 'menu' | 'quiz' | 'analytics' | 'library' | 'settings';
  to: 'menu' | 'quiz' | 'analytics' | 'library' | 'settings';
  progress?: number; // 0-100 for async loading
}

const VIEW_ICONS = {
  menu: Home,
  quiz: Brain,
  analytics: BarChart3,
  library: BookOpen,
  settings: Settings,
} as const;

const VIEW_LABELS = {
  menu: 'Main Menu',
  quiz: 'Training Session',
  analytics: 'Performance Analytics',
  library: 'Reference Library',
  settings: 'Settings',
} as const;

/**
 * Smooth transition overlay between views
 */
export function ViewTransitionOverlay({ from, to, progress }: ViewTransitionProps) {
  const FromIcon = VIEW_ICONS[from];
  const ToIcon = VIEW_ICONS[to];

  return (
    <AnimatePresence mode="wait">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-0 z-50 bg-[var(--color-bg-primary)] flex items-center justify-center"
      >
        <div className="flex flex-col items-center gap-6">
          {/* Transitioning icons */}
          <div className="flex items-center gap-8">
            {/* From icon fading out */}
            <motion.div
              initial={{ opacity: 1, scale: 1 }}
              animate={{ opacity: 0.3, scale: 0.8 }}
              transition={{ duration: 0.3 }}
              className="text-[var(--color-text-secondary)]"
            >
              <FromIcon className="w-12 h-12" />
            </motion.div>

            {/* Animated arrow */}
            <motion.div
              animate={{ x: [0, 10, 0] }}
              transition={{ repeat: Infinity, duration: 1.5, ease: 'easeInOut' }}
              className="text-[var(--color-accent)]"
            >
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 7l5 5m0 0l-5 5m5-5H6"
                />
              </svg>
            </motion.div>

            {/* To icon fading in */}
            <motion.div
              initial={{ opacity: 0.3, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3, delay: 0.2 }}
              className="text-[var(--color-accent)]"
            >
              <ToIcon className="w-12 h-12" />
            </motion.div>
          </div>

          {/* Loading text */}
          <div className="text-center space-y-2">
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="text-lg font-semibold text-[var(--color-text-primary)]"
            >
              {VIEW_LABELS[to]}
            </motion.p>

            {progress !== undefined && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="w-48"
              >
                <div className="h-1.5 bg-[var(--color-border)] rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 0.3, ease: 'easeOut' }}
                    className="h-full bg-[var(--color-accent)] rounded-full"
                  />
                </div>
                <p className="text-sm text-[var(--color-text-secondary)] mt-2">Loading...</p>
              </motion.div>
            )}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

/**
 * Route change progress bar (top of screen)
 */
export function RouteChangeProgressBar({ isActive }: { isActive: boolean }) {
  return (
    <AnimatePresence>
      {isActive && (
        <motion.div
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          exit={{ scaleX: 1, opacity: 0 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          className="fixed top-0 left-0 right-0 z-50 h-1 bg-[var(--color-accent)] origin-left"
        />
      )}
    </AnimatePresence>
  );
}

/**
 * Data loading indicator for async operations
 */
export function DataLoadingIndicator({ message }: { message?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ duration: 0.2 }}
      className="flex items-center gap-3 px-4 py-3 bg-[var(--color-card-bg)] border border-[var(--color-border)] rounded-lg shadow-lg"
    >
      {/* Animated dots */}
      <div className="flex gap-1">
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            animate={{
              scale: [1, 1.3, 1],
              opacity: [0.5, 1, 0.5],
            }}
            transition={{
              repeat: Infinity,
              duration: 1.2,
              delay: i * 0.2,
              ease: 'easeInOut',
            }}
            className="w-2 h-2 bg-[var(--color-accent)] rounded-full"
          />
        ))}
      </div>

      {message && <span className="text-sm text-[var(--color-text-secondary)]">{message}</span>}
    </motion.div>
  );
}

/**
 * Hook for managing view transitions
 */
export function useViewTransition() {
  const [isTransitioning, setIsTransitioning] = React.useState(false);
  const [transitionState, setTransitionState] = React.useState<ViewTransitionProps | null>(null);

  const startTransition = React.useCallback(
    (from: ViewTransitionProps['from'], to: ViewTransitionProps['to']) => {
      setIsTransitioning(true);
      setTransitionState({ from, to, progress: 0 });
    },
    []
  );

  const updateProgress = React.useCallback((progress: number) => {
    setTransitionState((prev) => (prev ? { ...prev, progress } : null));
  }, []);

  const endTransition = React.useCallback(() => {
    // Small delay for smooth exit animation
    setTimeout(() => {
      setIsTransitioning(false);
      setTransitionState(null);
    }, 200);
  }, []);

  return {
    isTransitioning,
    transitionState,
    startTransition,
    updateProgress,
    endTransition,
  };
}

/**
 * Content fade transition wrapper
 */
export function ContentFadeTransition({ children, id }: { children: React.ReactNode; id: string }) {
  return (
    <motion.div
      key={id}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
    >
      {children}
    </motion.div>
  );
}

/**
 * Slide transition for drawer/panel transitions
 */
export function SlideTransition({
  children,
  direction = 'right',
  isOpen,
}: {
  children: React.ReactNode;
  direction?: 'left' | 'right' | 'up' | 'down';
  isOpen: boolean;
}) {
  const variants = {
    left: { initial: { x: '-100%' }, animate: { x: 0 }, exit: { x: '-100%' } },
    right: { initial: { x: '100%' }, animate: { x: 0 }, exit: { x: '100%' } },
    up: { initial: { y: '-100%' }, animate: { y: 0 }, exit: { y: '-100%' } },
    down: { initial: { y: '100%' }, animate: { y: 0 }, exit: { y: '100%' } },
  };

  return (
    <AnimatePresence mode="wait">
      {isOpen && (
        <motion.div
          initial={variants[direction].initial}
          animate={variants[direction].animate}
          exit={variants[direction].exit}
          transition={{ duration: 0.3, ease: 'easeOut' }}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
