/**
 * MobileGestureHandler Component
 * Provides mobile-specific gesture support for navigation and interactions
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { StandardButton, PrimaryButton, OutlineButton } from './StandardButton';
import { useBreakpoint, useMediaQuery } from '@/lib/utils/mobileOptimization';

export interface GestureConfig {
  /** Enable swipe gestures for navigation */
  enableSwipeNavigation?: boolean;
  /** Enable swipe to dismiss for modals/drawers */
  enableSwipeToDismiss?: boolean;
  /** Enable pull-to-refresh */
  enablePullToRefresh?: boolean;
  /** Enable long press for context menus */
  enableLongPress?: boolean;
  /** Enable double tap for quick actions */
  enableDoubleTap?: boolean;
  /** Custom swipe threshold in pixels */
  swipeThreshold?: number;
  /** Custom long press delay in ms */
  longPressDelay?: number;
}

export interface MobileGestureHandlerProps {
  /** Configuration for gesture behaviors */
  config?: GestureConfig;
  /** Callback for swipe left gesture */
  onSwipeLeft?: () => void;
  /** Callback for swipe right gesture */
  onSwipeRight?: () => void;
  /** Callback for swipe up gesture */
  onSwipeUp?: () => void;
  /** Callback for swipe down gesture */
  onSwipeDown?: () => void;
  /** Callback for long press gesture */
  onLongPress?: () => void;
  /** Callback for double tap gesture */
  onDoubleTap?: () => void;
  /** Callback for pull-to-refresh */
  onPullToRefresh?: () => Promise<void> | void;
  /** Children to render */
  children: React.ReactNode;
  /** Additional CSS classes */
  className?: string;
}

/**
 * MobileGestureHandler Component
 * Wraps content with mobile gesture detection and visual feedback
 */
export const MobileGestureHandler: React.FC<MobileGestureHandlerProps> = ({
  config = {},
  onSwipeLeft,
  onSwipeRight,
  onSwipeUp,
  onSwipeDown,
  onLongPress,
  onDoubleTap,
  onPullToRefresh,
  children,
  className = '',
}) => {
  const {
    enableSwipeNavigation = true,
    enableSwipeToDismiss = false,
    enablePullToRefresh = false,
    enableLongPress = true,
    enableDoubleTap = true,
    swipeThreshold = 50,
    longPressDelay = 500,
  } = config;

  const containerRef = useRef<HTMLDivElement>(null);
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastTapRef = useRef<number>(0);
  const pullStartRef = useRef<number>(0);
  const pullDistanceRef = useRef<number>(0);

  const [gestureState, setGestureState] = useState<{
    active: boolean;
    type: 'swipe' | 'longpress' | 'doubletap' | 'pull' | null;
    direction: 'left' | 'right' | 'up' | 'down' | null;
    progress: number;
  }>({
    active: false,
    type: null,
    direction: null,
    progress: 0,
  });

  const [showGestureHint, setShowGestureHint] = useState(false);
  const isMobile = useMediaQuery('md'); // Returns true if screen is mobile (< md breakpoint)
  const breakpoint = useBreakpoint();

  // Show gesture hint on first mobile visit
  useEffect(() => {
    if (isMobile && !localStorage.getItem('gestureHintShown')) {
      const timer = setTimeout(() => {
        setShowGestureHint(true);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [isMobile]);

  const hideGestureHint = useCallback(() => {
    setShowGestureHint(false);
    localStorage.setItem('gestureHintShown', 'true');
  }, []);

  const handleTouchStart = useCallback(
    (e: TouchEvent) => {
      const touch = e.touches[0];
      if (!touch) return;

      touchStartRef.current = {
        x: touch.clientX,
        y: touch.clientY,
        time: Date.now(),
      };

      pullStartRef.current = touch.clientY;

      // Start long press detection
      if (enableLongPress) {
        longPressTimerRef.current = setTimeout(() => {
          if (touchStartRef.current) {
            setGestureState({
              active: true,
              type: 'longpress',
              direction: null,
              progress: 1,
            });
            onLongPress?.();
          }
        }, longPressDelay);
      }
    },
    [enableLongPress, longPressDelay, onLongPress]
  );

  const handleTouchMove = useCallback(
    (e: TouchEvent) => {
      const touch = e.touches[0];
      if (!touch || !touchStartRef.current) return;

      // Cancel long press if moving
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }

      const deltaX = touch.clientX - touchStartRef.current.x;
      const deltaY = touch.clientY - touchStartRef.current.y;
      const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

      // Detect pull-to-refresh
      if (enablePullToRefresh && touch.clientY > pullStartRef.current) {
        pullDistanceRef.current = touch.clientY - pullStartRef.current;
        const progress = Math.min(pullDistanceRef.current / 100, 1);
        setGestureState({
          active: true,
          type: 'pull',
          direction: 'down',
          progress,
        });
        return;
      }

      // Detect swipe
      if (distance > 10) {
        const isHorizontal = Math.abs(deltaX) > Math.abs(deltaY);
        const direction = isHorizontal
          ? deltaX > 0
            ? 'right'
            : 'left'
          : deltaY > 0
            ? 'down'
            : 'up';

        const progress = Math.min(distance / swipeThreshold, 1);

        setGestureState({
          active: true,
          type: 'swipe',
          direction,
          progress,
        });
      }
    },
    [enablePullToRefresh, swipeThreshold]
  );

  const handleTouchEnd = useCallback(
    (e: TouchEvent) => {
      // Clear long press timer
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }

      if (!touchStartRef.current) return;

      const touch = e.changedTouches[0];
      if (!touch) return;

      const deltaX = touch.clientX - touchStartRef.current.x;
      const deltaY = touch.clientY - touchStartRef.current.y;
      const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
      const duration = Date.now() - touchStartRef.current.time;

      // Handle pull-to-refresh completion
      if (gestureState.type === 'pull' && pullDistanceRef.current > 80) {
        onPullToRefresh?.();
      }

      // Handle swipe completion
      if (gestureState.type === 'swipe' && distance > swipeThreshold) {
        const isHorizontal = Math.abs(deltaX) > Math.abs(deltaY);

        if (isHorizontal) {
          if (deltaX > 0) {
            onSwipeRight?.();
          } else {
            onSwipeLeft?.();
          }
        } else {
          if (deltaY > 0) {
            onSwipeDown?.();
          } else {
            onSwipeUp?.();
          }
        }
      }

      // Detect tap/double tap
      if (distance < 10 && duration < 200) {
        const now = Date.now();
        if (enableDoubleTap && now - lastTapRef.current < 300) {
          onDoubleTap?.();
          lastTapRef.current = 0;
        } else {
          lastTapRef.current = now;
        }
      }

      // Reset gesture state
      setGestureState({
        active: false,
        type: null,
        direction: null,
        progress: 0,
      });
      touchStartRef.current = null;
      pullDistanceRef.current = 0;
    },
    [
      gestureState.type,
      swipeThreshold,
      enableDoubleTap,
      onSwipeLeft,
      onSwipeRight,
      onSwipeUp,
      onSwipeDown,
      onDoubleTap,
      onPullToRefresh,
    ]
  );

  // Setup event listeners
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !isMobile) return;

    container.addEventListener('touchstart', handleTouchStart, { passive: true });
    container.addEventListener('touchmove', handleTouchMove, { passive: true });
    container.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
      }
    };
  }, [isMobile, handleTouchStart, handleTouchMove, handleTouchEnd]);

  // Visual feedback for gestures
  const renderGestureFeedback = () => {
    if (!gestureState.active) return null;

    switch (gestureState.type) {
      case 'swipe':
        return (
          <motion.div
            className="fixed inset-0 pointer-events-none z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.3 }}
            exit={{ opacity: 0 }}
          >
            <div
              className={`absolute top-0 left-0 w-full h-full bg-gradient-to-r ${
                gestureState.direction === 'right'
                  ? 'from-green-500/20 to-transparent'
                  : gestureState.direction === 'left'
                    ? 'from-transparent to-green-500/20'
                    : gestureState.direction === 'down'
                      ? 'from-green-500/20 to-transparent via-transparent'
                      : 'from-transparent to-green-500/20 via-transparent'
              }`}
            />
          </motion.div>
        );

      case 'pull':
        return (
          <motion.div
            className="fixed top-0 left-0 right-0 pointer-events-none z-50 flex items-center justify-center"
            style={{ height: `${pullDistanceRef.current}px` }}
            animate={{ opacity: gestureState.progress }}
          >
            <div className="bg-[var(--color-action-primary)] rounded-full p-3">
              <svg
                className="w-6 h-6 text-white"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 14l-7 7m0 0l-7-7m7 7V3"
                />
              </svg>
            </div>
          </motion.div>
        );

      case 'longpress':
        return (
          <motion.div
            className="fixed inset-0 pointer-events-none z-50 flex items-center justify-center"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 0.7, scale: 1 }}
            exit={{ opacity: 0, scale: 1.2 }}
          >
            <div className="bg-[var(--color-action-primary)] rounded-full p-4">
              <svg
                className="w-8 h-8 text-white"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                />
              </svg>
            </div>
          </motion.div>
        );

      default:
        return null;
    }
  };

  // Gesture hint overlay
  const renderGestureHint = () => {
    if (!showGestureHint || !isMobile) return null;

    return (
      <AnimatePresence>
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[var(--color-overlay)]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={hideGestureHint}
        >
          <motion.div
            className="bg-[var(--color-bg-secondary)] rounded-2xl p-6 max-w-md w-full"
            initial={{ scale: 0.9, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.9, y: 20 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-center mb-6">
              <h3 className="text-xl font-semibold text-[var(--color-text-primary)] mb-2">
                Mobile Gestures Available
              </h3>
              <p className="text-[var(--color-text-muted)]">
                Use gestures for faster navigation and interactions
              </p>
            </div>

            <div className="space-y-4 mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[var(--color-action-muted)] flex items-center justify-center">
                  <span className="text-lg">←→</span>
                </div>
                <div>
                  <p className="font-medium text-[var(--color-text-primary)]">Swipe left/right</p>
                  <p className="text-sm text-[var(--color-text-muted)]">Navigate between screens</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[var(--color-action-muted)] flex items-center justify-center">
                  <span className="text-lg">↓</span>
                </div>
                <div>
                  <p className="font-medium text-[var(--color-text-primary)]">Pull down</p>
                  <p className="text-sm text-[var(--color-text-muted)]">Refresh content</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[var(--color-action-muted)] flex items-center justify-center">
                  <span className="text-lg">⏱️</span>
                </div>
                <div>
                  <p className="font-medium text-[var(--color-text-primary)]">Long press</p>
                  <p className="text-sm text-[var(--color-text-muted)]">Open context menu</p>
                </div>
              </div>
            </div>

            <div className="flex justify-center">
              <PrimaryButton onClick={hideGestureHint}>Got it!</PrimaryButton>
            </div>
          </motion.div>
        </motion.div>
      </AnimatePresence>
    );
  };

  return (
    <div
      ref={containerRef}
      className={`relative ${className}`}
      style={{
        touchAction: enableSwipeNavigation ? 'pan-y' : 'auto',
      }}
    >
      {children}
      {renderGestureFeedback()}
      {renderGestureHint()}
    </div>
  );
};

/**
 * Hook to use mobile gestures in any component
 */
export function useMobileGestures(config: GestureConfig = {}) {
  const [gesture, setGesture] = useState<{
    type: 'swipe' | 'longpress' | 'doubletap' | 'pull' | null;
    direction: 'left' | 'right' | 'up' | 'down' | null;
    progress: number;
  }>({
    type: null,
    direction: null,
    progress: 0,
  });

  const containerRef = useRef<HTMLDivElement>(null);
  const isMobile = useMediaQuery('md');

  const handleGesture = useCallback(
    (type: typeof gesture.type, direction: typeof gesture.direction, progress: number) => {
      setGesture({ type, direction, progress });
    },
    []
  );

  return {
    containerRef,
    gesture,
    handleGesture,
    isMobile,
  };
}

/**
 * Simple swipe navigation component for carousels
 */
export const SwipeNavigation: React.FC<{
  onSwipeLeft: () => void;
  onSwipeRight: () => void;
  children: React.ReactNode;
  className?: string;
}> = ({ onSwipeLeft, onSwipeRight, children, className = '' }) => {
  const { containerRef, gesture } = useMobileGestures({
    enableSwipeNavigation: true,
    swipeThreshold: 30,
  });

  useEffect(() => {
    if (gesture.type === 'swipe') {
      if (gesture.direction === 'left') {
        onSwipeLeft();
      } else if (gesture.direction === 'right') {
        onSwipeRight();
      }
    }
  }, [gesture, onSwipeLeft, onSwipeRight]);

  return (
    <div ref={containerRef} className={`relative overflow-hidden ${className}`}>
      {children}
      {gesture.type === 'swipe' && (
        <motion.div
          className="absolute inset-0 pointer-events-none"
          initial={{ opacity: 0 }}
          animate={{ opacity: gesture.progress * 0.3 }}
          exit={{ opacity: 0 }}
        >
          <div
            className={`absolute inset-0 bg-gradient-to-r ${
              gesture.direction === 'left'
                ? 'from-transparent to-[var(--color-action-primary)]/20'
                : 'from-[var(--color-action-primary)]/20 to-transparent'
            }`}
          />
        </motion.div>
      )}
    </div>
  );
};

/**
 * Pull-to-refresh wrapper component
 */
export const PullToRefresh: React.FC<{
  onRefresh: () => Promise<void> | void;
  children: React.ReactNode;
  className?: string;
}> = ({ onRefresh, children, className = '' }) => {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { containerRef, gesture } = useMobileGestures({
    enablePullToRefresh: true,
  });

  useEffect(() => {
    if (gesture.type === 'pull' && gesture.progress >= 1 && !isRefreshing) {
      setIsRefreshing(true);
      Promise.resolve(onRefresh()).finally(() => {
        setIsRefreshing(false);
      });
    }
  }, [gesture, onRefresh, isRefreshing]);

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {isRefreshing && (
        <motion.div
          className="absolute top-0 left-0 right-0 flex items-center justify-center py-2"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
        >
          <div className="animate-spin rounded-full h-6 w-6 border-2 border-[var(--color-action-primary)] border-t-transparent" />
        </motion.div>
      )}
      <motion.div
        style={{ y: gesture.type === 'pull' ? Math.min(gesture.progress * 50, 50) : 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      >
        {children}
      </motion.div>
    </div>
  );
};
