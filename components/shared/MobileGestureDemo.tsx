/**
 * MobileGestureDemo Component
 * Interactive demonstration of mobile gesture capabilities
 */

import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { StandardButton, PrimaryButton, SecondaryButton } from './StandardButton';
import { MobileGestureHandler, SwipeNavigation, PullToRefresh } from './MobileGestureHandler';
import { useBreakpoint } from '@/lib/utils/mobileOptimization';

export interface MobileGestureDemoProps {
  /** Whether the demo is initially open */
  defaultOpen?: boolean;
  /** Callback when demo is closed */
  onClose?: () => void;
  /** Additional CSS classes */
  className?: string;
}

/**
 * MobileGestureDemo Component
 * Interactive demonstration of mobile gesture capabilities with visual feedback
 */
export const MobileGestureDemo: React.FC<MobileGestureDemoProps> = ({
  defaultOpen = false,
  onClose,
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [gestureLog, setGestureLog] = useState<
    Array<{
      type: string;
      direction?: string;
      timestamp: number;
    }>
  >([]);
  const [activeGesture, setActiveGesture] = useState<string | null>(null);
  const [refreshCount, setRefreshCount] = useState(0);
  const [currentSlide, setCurrentSlide] = useState(0);

  const breakpoint = useBreakpoint();
  const isMobile = breakpoint === 'xs' || breakpoint === 'sm';

  const handleClose = useCallback(() => {
    setIsOpen(false);
    onClose?.();
  }, [onClose]);

  const logGesture = useCallback((type: string, direction?: string) => {
    const entry = {
      type,
      direction,
      timestamp: Date.now(),
    };

    setGestureLog((prev) => [entry, ...prev.slice(0, 9)]); // Keep last 10 entries
    setActiveGesture(type);

    // Clear active gesture after 1 second
    setTimeout(() => {
      setActiveGesture(null);
    }, 1000);
  }, []);

  const handleSwipeLeft = useCallback(() => {
    logGesture('swipe', 'left');
    setCurrentSlide((prev) => Math.min(prev + 1, slides.length - 1));
  }, [logGesture]);

  const handleSwipeRight = useCallback(() => {
    logGesture('swipe', 'right');
    setCurrentSlide((prev) => Math.max(prev - 1, 0));
  }, [logGesture]);

  const handleSwipeUp = useCallback(() => {
    logGesture('swipe', 'up');
  }, [logGesture]);

  const handleSwipeDown = useCallback(() => {
    logGesture('swipe', 'down');
  }, [logGesture]);

  const handleLongPress = useCallback(() => {
    logGesture('longpress');
  }, [logGesture]);

  const handleDoubleTap = useCallback(() => {
    logGesture('doubletap');
  }, [logGesture]);

  const handlePullToRefresh = useCallback(async () => {
    logGesture('pull', 'refresh');

    // Simulate async refresh
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setRefreshCount((prev) => prev + 1);
  }, [logGesture]);

  const slides = [
    {
      title: 'Swipe Navigation',
      content: 'Swipe left/right to navigate between slides',
      color: 'bg-gradient-to-r from-blue-500/20 to-purple-500/20',
    },
    {
      title: 'Pull to Refresh',
      content: 'Pull down to refresh content',
      color: 'bg-gradient-to-r from-green-500/20 to-teal-500/20',
    },
    {
      title: 'Long Press',
      content: 'Press and hold for context actions',
      color: 'bg-gradient-to-r from-amber-500/20 to-orange-500/20',
    },
    {
      title: 'Double Tap',
      content: 'Double tap for quick actions',
      color: 'bg-gradient-to-r from-rose-500/20 to-pink-500/20',
    },
  ];

  if (!isOpen) {
    return (
      <div className={`fixed bottom-4 right-4 z-40 ${className}`}>
        <PrimaryButton onClick={() => setIsOpen(true)} className="shadow-lg">
          <span className="flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"
              />
            </svg>
            Gesture Demo
          </span>
        </PrimaryButton>
      </div>
    );
  }

  return (
    <MobileGestureHandler
      config={{
        enableSwipeNavigation: true,
        enableSwipeToDismiss: true,
        enablePullToRefresh: true,
        enableLongPress: true,
        enableDoubleTap: true,
        swipeThreshold: 30,
        longPressDelay: 800,
      }}
      onSwipeLeft={handleSwipeLeft}
      onSwipeRight={handleSwipeRight}
      onSwipeUp={handleSwipeUp}
      onSwipeDown={handleSwipeDown}
      onLongPress={handleLongPress}
      onDoubleTap={handleDoubleTap}
      onPullToRefresh={handlePullToRefresh}
    >
      <motion.div
        className={`fixed inset-4 md:inset-auto md:top-4 md:right-4 md:bottom-4 md:w-96 z-50 bg-[var(--color-bg-primary)] rounded-2xl shadow-2xl border border-[var(--color-border)] overflow-hidden ${className}`}
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        transition={{ type: 'spring', damping: 25 }}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[var(--color-border)]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 flex items-center justify-center">
              <span className="text-white font-bold">👆</span>
            </div>
            <div>
              <h3 className="font-semibold text-[var(--color-text-primary)]">
                Mobile Gesture Demo
              </h3>
              <p className="text-sm text-[var(--color-text-muted)]">
                {isMobile ? 'Try gestures below' : 'Simulate mobile gestures'}
              </p>
            </div>
          </div>
          <SecondaryButton onClick={handleClose} size="sm" variant="ghost">
            ✕
          </SecondaryButton>
        </div>

        {/* Content */}
        <div className="p-4 space-y-6 overflow-y-auto max-h-[calc(100vh-12rem)]">
          {/* Device Info */}
          <div className="bg-[var(--color-bg-secondary)] rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-[var(--color-text-muted)]">
                Device Detection
              </span>
              <span className="px-2 py-1 text-xs font-medium bg-[var(--color-action-muted)] text-[var(--color-action-primary)] rounded-full">
                {breakpoint.toUpperCase()}
              </span>
            </div>
            <div className="text-sm text-[var(--color-text-primary)]">
              {isMobile
                ? 'Mobile device detected - gestures enabled'
                : 'Desktop device - gestures simulated'}
            </div>
          </div>

          {/* Interactive Demo Area */}
          <PullToRefresh onRefresh={handlePullToRefresh}>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-medium text-[var(--color-text-primary)]">Interactive Demo</h4>
                <span className="text-sm text-[var(--color-text-muted)]">
                  Refresh count: {refreshCount}
                </span>
              </div>

              <SwipeNavigation onSwipeLeft={handleSwipeLeft} onSwipeRight={handleSwipeRight}>
                <div
                  className={`relative rounded-xl p-6 ${slides[currentSlide].color} min-h-[200px] flex flex-col justify-center`}
                >
                  <div className="absolute top-4 left-4 text-sm font-medium text-[var(--color-text-muted)]">
                    Slide {currentSlide + 1} of {slides.length}
                  </div>

                  <div className="text-center">
                    <h3 className="text-xl font-bold text-[var(--color-text-primary)] mb-2">
                      {slides[currentSlide].title}
                    </h3>
                    <p className="text-[var(--color-text-muted)] mb-6">
                      {slides[currentSlide].content}
                    </p>

                    <div className="flex justify-center gap-2">
                      {slides.map((_, index) => (
                        <button
                          key={index}
                          onClick={() => setCurrentSlide(index)}
                          className={`w-2 h-2 rounded-full transition-all ${
                            index === currentSlide
                              ? 'bg-[var(--color-action-primary)] w-4'
                              : 'bg-[var(--color-border)]'
                          }`}
                          aria-label={`Go to slide ${index + 1}`}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Gesture Instructions */}
                  <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-4">
                    <div className="flex items-center gap-1 text-sm text-[var(--color-text-muted)]">
                      <span>← Swipe</span>
                    </div>
                    <div className="flex items-center gap-1 text-sm text-[var(--color-text-muted)]">
                      <span>Press & Hold</span>
                    </div>
                    <div className="flex items-center gap-1 text-sm text-[var(--color-text-muted)]">
                      <span>Pull ↓</span>
                    </div>
                  </div>
                </div>
              </SwipeNavigation>

              {/* Active Gesture Indicator */}
              <AnimatePresence>
                {activeGesture && (
                  <motion.div
                    className="bg-gradient-to-r from-[var(--color-action-primary)]/10 to-[var(--color-action-primary)]/5 border border-[var(--color-action-primary)]/20 rounded-xl p-4"
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-[var(--color-action-primary)] flex items-center justify-center">
                          <span className="text-white">✓</span>
                        </div>
                        <div>
                          <div className="font-medium text-[var(--color-text-primary)]">
                            {activeGesture.charAt(0).toUpperCase() + activeGesture.slice(1)}{' '}
                            detected!
                          </div>
                          <div className="text-sm text-[var(--color-text-muted)]">
                            {activeGesture === 'swipe'
                              ? 'Navigation gesture recognized'
                              : activeGesture === 'longpress'
                                ? 'Context menu available'
                                : activeGesture === 'pull'
                                  ? 'Content refreshing'
                                  : 'Quick action triggered'}
                          </div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Gesture Log */}
              <div className="bg-[var(--color-bg-secondary)] rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-medium text-[var(--color-text-primary)]">Gesture History</h4>
                  <SecondaryButton onClick={() => setGestureLog([])} size="xs" variant="ghost">
                    Clear
                  </SecondaryButton>
                </div>

                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {gestureLog.length === 0 ? (
                    <div className="text-center py-4 text-[var(--color-text-muted)]">
                      No gestures detected yet
                    </div>
                  ) : (
                    gestureLog.map((log, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-2 rounded-lg bg-[var(--color-bg-primary)]"
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-8 h-8 rounded-full flex items-center justify-center ${
                              log.type === 'swipe'
                                ? 'bg-[color-mix(in_srgb,var(--color-category-practice)_10%,transparent)] text-[var(--color-category-practice)]'
                                : log.type === 'longpress'
                                  ? 'bg-data-provisional/10 text-data-provisional'
                                  : log.type === 'doubletap'
                                    ? 'bg-data-pass/10 text-data-pass'
                                    : 'bg-purple-500/10 text-purple-500'
                            }`}
                          >
                            {log.type === 'swipe'
                              ? '↔'
                              : log.type === 'longpress'
                                ? '⏱️'
                                : log.type === 'doubletap'
                                  ? '✌️'
                                  : '↕️'}
                          </div>
                          <div>
                            <div className="font-medium text-[var(--color-text-primary)] capitalize">
                              {log.type} {log.direction ? `(${log.direction})` : ''}
                            </div>
                            <div className="text-xs text-[var(--color-text-muted)]">
                              {new Date(log.timestamp).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                                second: '2-digit',
                              })}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </PullToRefresh>

          {/* Gesture Guide */}
          <div className="bg-gradient-to-br from-[var(--color-bg-secondary)] to-[var(--color-bg-primary)] rounded-xl p-4 border border-[var(--color-border)]">
            <h4 className="font-medium text-[var(--color-text-primary)] mb-3">Gesture Guide</h4>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded bg-[color-mix(in_srgb,var(--color-category-practice)_10%,transparent)] flex items-center justify-center">
                    <span className="text-[var(--color-category-practice)]">←→</span>
                  </div>
                  <span className="text-sm font-medium text-[var(--color-text-primary)]">
                    Swipe
                  </span>
                </div>
                <p className="text-xs text-[var(--color-text-muted)]">Navigate between content</p>
              </div>

              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded bg-data-provisional/10 flex items-center justify-center">
                    <span className="text-data-provisional">⏱️</span>
                  </div>
                  <span className="text-sm font-medium text-[var(--color-text-primary)]">
                    Long Press
                  </span>
                </div>
                <p className="text-xs text-[var(--color-text-muted)]">Open context menu</p>
              </div>

              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded bg-data-pass/10 flex items-center justify-center">
                    <span className="text-data-pass">✌️</span>
                  </div>
                  <span className="text-sm font-medium text-[var(--color-text-primary)]">
                    Double Tap
                  </span>
                </div>
                <p className="text-xs text-[var(--color-text-muted)]">Quick actions</p>
              </div>

              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded bg-purple-500/10 flex items-center justify-center">
                    <span className="text-purple-500">↓</span>
                  </div>
                  <span className="text-sm font-medium text-[var(--color-text-primary)]">
                    Pull Down
                  </span>
                </div>
                <p className="text-xs text-[var(--color-text-muted)]">Refresh content</p>
              </div>
            </div>
          </div>

          {/* Integration Instructions */}
          <div className="bg-[var(--color-bg-secondary)] rounded-xl p-4">
            <h4 className="font-medium text-[var(--color-text-primary)] mb-2">How to Integrate</h4>
            <pre className="text-xs bg-[var(--color-bg-primary)] p-3 rounded-lg overflow-x-auto text-[var(--color-text-muted)]">
              {`import { MobileGestureHandler } from '@/components/shared/MobileGestureHandler';

const MyComponent = () => {
  return (
    <MobileGestureHandler
      config={{
        enableSwipeNavigation: true,
        enablePullToRefresh: true,
      }}
      onSwipeLeft={() => navigateBack()}
      onPullToRefresh={() => refreshData()}
    >
      <YourContent />
    </MobileGestureHandler>
  );
};`}
            </pre>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
          <div className="flex items-center justify-between">
            <div className="text-sm text-[var(--color-text-muted)]">
              {isMobile ? 'Try gestures on this demo' : 'Use touch screen or mouse gestures'}
            </div>
            <div className="flex gap-2">
              <SecondaryButton onClick={handleClose}>Close</SecondaryButton>
              <PrimaryButton
                onClick={() => {
                  setGestureLog([]);
                  setRefreshCount(0);
                  setCurrentSlide(0);
                }}
              >
                Reset Demo
              </PrimaryButton>
            </div>
          </div>
        </div>
      </motion.div>
    </MobileGestureHandler>
  );
};

/**
 * Hook to use the mobile gesture demo in your app
 */
export function useMobileGestureDemo() {
  const [isDemoOpen, setIsDemoOpen] = useState(false);

  const openDemo = useCallback(() => {
    setIsDemoOpen(true);
  }, []);

  const closeDemo = useCallback(() => {
    setIsDemoOpen(false);
  }, []);

  const DemoComponent = useCallback(
    () => <MobileGestureDemo defaultOpen={isDemoOpen} onClose={closeDemo} />,
    [isDemoOpen, closeDemo]
  );

  return {
    isDemoOpen,
    openDemo,
    closeDemo,
    DemoComponent,
  };
}

/**
 * Simple gesture indicator for showing active gestures
 */
export const GestureIndicator: React.FC<{
  gesture: string | null;
  className?: string;
}> = ({ gesture, className = '' }) => {
  return (
    <AnimatePresence>
      {gesture && (
        <motion.div
          className={`fixed top-4 right-4 z-50 bg-gradient-to-r from-[var(--color-action-primary)] to-[var(--color-action-primary)]/80 text-white px-4 py-2 rounded-full shadow-lg ${className}`}
          initial={{ opacity: 0, y: -20, scale: 0.8 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20, scale: 0.8 }}
        >
          <div className="flex items-center gap-2">
            <span className="text-lg">
              {gesture === 'swipe'
                ? '↔'
                : gesture === 'longpress'
                  ? '⏱️'
                  : gesture === 'doubletap'
                    ? '✌️'
                    : '👆'}
            </span>
            <span className="font-medium capitalize">{gesture} detected</span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
