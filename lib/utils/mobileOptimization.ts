/**
 * Mobile Optimization Utilities for StudyPANaCEa
 * Touch gesture support, responsive breakpoints, and mobile-first utilities
 */

import { useState, useEffect, useCallback, useRef } from 'react';

// ============================================================================
// BREAKPOINT DETECTION
// ============================================================================

/**
 * Tailwind CSS default breakpoints
 */
export const BREAKPOINTS = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  '2xl': 1536,
} as const;

export type Breakpoint = keyof typeof BREAKPOINTS;

/**
 * Get current breakpoint based on window width
 */
export function getCurrentBreakpoint(): Breakpoint | 'xs' {
  if (typeof window === 'undefined') return 'md'; // SSR fallback

  const width = window.innerWidth;
  if (width >= BREAKPOINTS['2xl']) return '2xl';
  if (width >= BREAKPOINTS.xl) return 'xl';
  if (width >= BREAKPOINTS.lg) return 'lg';
  if (width >= BREAKPOINTS.md) return 'md';
  if (width >= BREAKPOINTS.sm) return 'sm';
  return 'xs';
}

/**
 * Hook to detect current breakpoint with responsive updates
 */
export function useBreakpoint(): Breakpoint | 'xs' {
  const [breakpoint, setBreakpoint] = useState<Breakpoint | 'xs'>(() => getCurrentBreakpoint());

  useEffect(() => {
    const handleResize = () => {
      const newBreakpoint = getCurrentBreakpoint();
      setBreakpoint((prev) => (prev !== newBreakpoint ? newBreakpoint : prev));
    };

    // Use ResizeObserver for better performance
    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(handleResize);
      observer.observe(document.documentElement);
      return () => observer.disconnect();
    }

    // Fallback to window resize
    window.addEventListener('resize', handleResize, { passive: true });
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return breakpoint;
}

/**
 * Hook to check if viewport matches a specific breakpoint or larger
 */
export function useMediaQuery(breakpoint: Breakpoint): boolean {
  const [matches, setMatches] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth >= BREAKPOINTS[breakpoint];
  });

  useEffect(() => {
    const mediaQuery = window.matchMedia(`(min-width: ${BREAKPOINTS[breakpoint]}px)`);

    const handleChange = (e: MediaQueryListEvent | MediaQueryList) => {
      setMatches(e.matches);
    };

    handleChange(mediaQuery);

    // Modern browsers
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }

    // Legacy browsers
    mediaQuery.addListener(handleChange);
    return () => mediaQuery.removeListener(handleChange);
  }, [breakpoint]);

  return matches;
}

/**
 * Hook to detect mobile device (< md breakpoint)
 */
export function useIsMobile(): boolean {
  return !useMediaQuery('md');
}

/**
 * Hook to detect tablet device (md to lg breakpoint)
 */
export function useIsTablet(): boolean {
  const isMd = useMediaQuery('md');
  const isLg = useMediaQuery('lg');
  return isMd && !isLg;
}

/**
 * Hook to detect desktop device (>= lg breakpoint)
 */
export function useIsDesktop(): boolean {
  return useMediaQuery('lg');
}

// ============================================================================
// DEVICE DETECTION
// ============================================================================

/**
 * Device type detection
 */
export interface DeviceInfo {
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  isTouchDevice: boolean;
  isIOS: boolean;
  isAndroid: boolean;
  isSafari: boolean;
  isStandalone: boolean; // PWA mode
  prefersReducedMotion: boolean;
  devicePixelRatio: number;
}

/**
 * Get comprehensive device information
 */
export function getDeviceInfo(): DeviceInfo {
  if (typeof window === 'undefined') {
    return {
      isMobile: false,
      isTablet: false,
      isDesktop: true,
      isTouchDevice: false,
      isIOS: false,
      isAndroid: false,
      isSafari: false,
      isStandalone: false,
      prefersReducedMotion: false,
      devicePixelRatio: 1,
    };
  }

  const ua = navigator.userAgent.toLowerCase();
  const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  const isIOS = /iphone|ipad|ipod/.test(ua);
  const isAndroid = /android/.test(ua);
  const isMobileUA = /mobile|android|iphone|ipod/.test(ua);
  const isTabletUA = /tablet|ipad/.test(ua) || (isAndroid && !/mobile/.test(ua));
  const isSafari = /safari/.test(ua) && !/chrome/.test(ua);
  const isStandalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  return {
    isMobile: isMobileUA && !isTabletUA,
    isTablet: isTabletUA,
    isDesktop: !isMobileUA && !isTabletUA,
    isTouchDevice,
    isIOS,
    isAndroid,
    isSafari,
    isStandalone,
    prefersReducedMotion,
    devicePixelRatio: window.devicePixelRatio || 1,
  };
}

/**
 * Hook to get device information with updates
 */
export function useDeviceInfo(): DeviceInfo {
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo>(() => getDeviceInfo());

  useEffect(() => {
    const handleChange = () => setDeviceInfo(getDeviceInfo());

    // Listen for orientation changes
    window.addEventListener('orientationchange', handleChange);

    // Listen for reduced motion preference changes
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (motionQuery.addEventListener) {
      motionQuery.addEventListener('change', handleChange);
    }

    return () => {
      window.removeEventListener('orientationchange', handleChange);
      if (motionQuery.removeEventListener) {
        motionQuery.removeEventListener('change', handleChange);
      }
    };
  }, []);

  return deviceInfo;
}

// ============================================================================
// TOUCH GESTURE SUPPORT
// ============================================================================

/**
 * Touch gesture types
 */
export type GestureType =
  | 'tap'
  | 'doubletap'
  | 'longpress'
  | 'swipeleft'
  | 'swiperight'
  | 'swipeup'
  | 'swipedown'
  | 'pinch';

/**
 * Touch gesture event data
 */
export interface GestureEvent {
  type: GestureType;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  deltaX: number;
  deltaY: number;
  velocity: number;
  scale?: number; // For pinch gestures
  timestamp: number;
}

/**
 * Gesture detection options
 */
export interface GestureOptions {
  swipeThreshold?: number; // Minimum distance for swipe (default: 50px)
  swipeVelocityThreshold?: number; // Minimum velocity (default: 0.3)
  longPressDelay?: number; // Long press delay in ms (default: 500)
  doubleTapDelay?: number; // Max delay between taps (default: 300)
  onGesture?: (event: GestureEvent) => void;
  onSwipeLeft?: (event: GestureEvent) => void;
  onSwipeRight?: (event: GestureEvent) => void;
  onSwipeUp?: (event: GestureEvent) => void;
  onSwipeDown?: (event: GestureEvent) => void;
  onTap?: (event: GestureEvent) => void;
  onDoubleTap?: (event: GestureEvent) => void;
  onLongPress?: (event: GestureEvent) => void;
}

/**
 * Hook for touch gesture detection
 */
export function useGestures<T extends HTMLElement>(
  ref: React.RefObject<T>,
  options: GestureOptions = {}
) {
  const {
    swipeThreshold = 50,
    swipeVelocityThreshold = 0.3,
    longPressDelay = 500,
    doubleTapDelay = 300,
    onGesture,
    onSwipeLeft,
    onSwipeRight,
    onSwipeUp,
    onSwipeDown,
    onTap,
    onDoubleTap,
    onLongPress,
  } = options;

  const touchState = useRef({
    startX: 0,
    startY: 0,
    startTime: 0,
    lastTapTime: 0,
    longPressTimer: null as NodeJS.Timeout | null,
  });

  const emitGesture = useCallback(
    (event: GestureEvent) => {
      onGesture?.(event);

      switch (event.type) {
        case 'swipeleft':
          onSwipeLeft?.(event);
          break;
        case 'swiperight':
          onSwipeRight?.(event);
          break;
        case 'swipeup':
          onSwipeUp?.(event);
          break;
        case 'swipedown':
          onSwipeDown?.(event);
          break;
        case 'tap':
          onTap?.(event);
          break;
        case 'doubletap':
          onDoubleTap?.(event);
          break;
        case 'longpress':
          onLongPress?.(event);
          break;
      }
    },
    [onGesture, onSwipeLeft, onSwipeRight, onSwipeUp, onSwipeDown, onTap, onDoubleTap, onLongPress]
  );

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const handleTouchStart = (e: TouchEvent) => {
      const touch = e.touches[0];
      touchState.current.startX = touch.clientX;
      touchState.current.startY = touch.clientY;
      touchState.current.startTime = Date.now();

      // Set up long press detection
      touchState.current.longPressTimer = setTimeout(() => {
        emitGesture({
          type: 'longpress',
          startX: touchState.current.startX,
          startY: touchState.current.startY,
          endX: touchState.current.startX,
          endY: touchState.current.startY,
          deltaX: 0,
          deltaY: 0,
          velocity: 0,
          timestamp: Date.now(),
        });
      }, longPressDelay);
    };

    const handleTouchMove = () => {
      // Cancel long press if user moves
      if (touchState.current.longPressTimer) {
        clearTimeout(touchState.current.longPressTimer);
        touchState.current.longPressTimer = null;
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      // Clear long press timer
      if (touchState.current.longPressTimer) {
        clearTimeout(touchState.current.longPressTimer);
        touchState.current.longPressTimer = null;
      }

      const touch = e.changedTouches[0];
      const endX = touch.clientX;
      const endY = touch.clientY;
      const deltaX = endX - touchState.current.startX;
      const deltaY = endY - touchState.current.startY;
      const duration = Date.now() - touchState.current.startTime;
      const velocity = Math.sqrt(deltaX * deltaX + deltaY * deltaY) / duration;

      const gestureBase = {
        startX: touchState.current.startX,
        startY: touchState.current.startY,
        endX,
        endY,
        deltaX,
        deltaY,
        velocity,
        timestamp: Date.now(),
      };

      // Detect swipe
      const absX = Math.abs(deltaX);
      const absY = Math.abs(deltaY);

      if (absX > swipeThreshold || absY > swipeThreshold) {
        if (velocity >= swipeVelocityThreshold) {
          if (absX > absY) {
            // Horizontal swipe
            emitGesture({
              ...gestureBase,
              type: deltaX > 0 ? 'swiperight' : 'swipeleft',
            });
          } else {
            // Vertical swipe
            emitGesture({
              ...gestureBase,
              type: deltaY > 0 ? 'swipedown' : 'swipeup',
            });
          }
          return;
        }
      }

      // Detect tap or double tap
      if (absX < 10 && absY < 10 && duration < 200) {
        const now = Date.now();
        if (now - touchState.current.lastTapTime < doubleTapDelay) {
          emitGesture({ ...gestureBase, type: 'doubletap' });
          touchState.current.lastTapTime = 0;
        } else {
          touchState.current.lastTapTime = now;
          // Delay tap to check for double tap
          setTimeout(() => {
            if (touchState.current.lastTapTime === now) {
              emitGesture({ ...gestureBase, type: 'tap' });
            }
          }, doubleTapDelay);
        }
      }
    };

    element.addEventListener('touchstart', handleTouchStart, { passive: true });
    element.addEventListener('touchmove', handleTouchMove, { passive: true });
    element.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      element.removeEventListener('touchstart', handleTouchStart);
      element.removeEventListener('touchmove', handleTouchMove);
      element.removeEventListener('touchend', handleTouchEnd);
      if (touchState.current.longPressTimer) {
        clearTimeout(touchState.current.longPressTimer);
      }
    };
  }, [ref, swipeThreshold, swipeVelocityThreshold, longPressDelay, doubleTapDelay, emitGesture]);
}

/**
 * Simple swipe detection hook for navigation
 */
export function useSwipeNavigation(
  onSwipeLeft?: () => void,
  onSwipeRight?: () => void,
  options: { threshold?: number; enabled?: boolean } = {}
) {
  const { threshold = 100, enabled = true } = options;
  const touchStartX = useRef<number>(0);

  useEffect(() => {
    if (!enabled) return;

    const handleTouchStart = (e: TouchEvent) => {
      touchStartX.current = e.touches[0].clientX;
    };

    const handleTouchEnd = (e: TouchEvent) => {
      const deltaX = e.changedTouches[0].clientX - touchStartX.current;

      if (Math.abs(deltaX) > threshold) {
        if (deltaX > 0) {
          onSwipeRight?.();
        } else {
          onSwipeLeft?.();
        }
      }
    };

    document.addEventListener('touchstart', handleTouchStart, { passive: true });
    document.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [onSwipeLeft, onSwipeRight, threshold, enabled]);
}

// ============================================================================
// VIEWPORT UTILITIES
// ============================================================================

/**
 * Viewport dimensions with safe area insets (for notched devices)
 */
export interface ViewportInfo {
  width: number;
  height: number;
  safeAreaTop: number;
  safeAreaBottom: number;
  safeAreaLeft: number;
  safeAreaRight: number;
  orientation: 'portrait' | 'landscape';
  isKeyboardVisible: boolean;
}

/**
 * Get current viewport information
 */
export function getViewportInfo(): ViewportInfo {
  if (typeof window === 'undefined') {
    return {
      width: 0,
      height: 0,
      safeAreaTop: 0,
      safeAreaBottom: 0,
      safeAreaLeft: 0,
      safeAreaRight: 0,
      orientation: 'portrait',
      isKeyboardVisible: false,
    };
  }

  const root = document.documentElement;
  const style = getComputedStyle(root);

  return {
    width: window.innerWidth,
    height: window.innerHeight,
    safeAreaTop:
      parseInt(style.getPropertyValue('--sat') || '0', 10) ||
      parseInt(style.getPropertyValue('env(safe-area-inset-top)') || '0', 10),
    safeAreaBottom:
      parseInt(style.getPropertyValue('--sab') || '0', 10) ||
      parseInt(style.getPropertyValue('env(safe-area-inset-bottom)') || '0', 10),
    safeAreaLeft:
      parseInt(style.getPropertyValue('--sal') || '0', 10) ||
      parseInt(style.getPropertyValue('env(safe-area-inset-left)') || '0', 10),
    safeAreaRight:
      parseInt(style.getPropertyValue('--sar') || '0', 10) ||
      parseInt(style.getPropertyValue('env(safe-area-inset-right)') || '0', 10),
    orientation: window.innerHeight > window.innerWidth ? 'portrait' : 'landscape',
    isKeyboardVisible: false, // Will be updated by hook
  };
}

/**
 * Hook to track viewport information
 */
export function useViewportInfo(): ViewportInfo {
  const [viewport, setViewport] = useState<ViewportInfo>(() => getViewportInfo());
  const initialHeight = useRef(typeof window !== 'undefined' ? window.innerHeight : 0);

  useEffect(() => {
    const handleResize = () => {
      const info = getViewportInfo();
      // Detect keyboard visibility (height reduction > 150px on mobile)
      const heightDiff = initialHeight.current - window.innerHeight;
      info.isKeyboardVisible = heightDiff > 150;
      setViewport(info);
    };

    // Use visualViewport API if available (more accurate on mobile)
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleResize);
      window.visualViewport.addEventListener('scroll', handleResize);
    } else {
      window.addEventListener('resize', handleResize);
    }

    window.addEventListener('orientationchange', handleResize);

    return () => {
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', handleResize);
        window.visualViewport.removeEventListener('scroll', handleResize);
      } else {
        window.removeEventListener('resize', handleResize);
      }
      window.removeEventListener('orientationchange', handleResize);
    };
  }, []);

  return viewport;
}

/**
 * Hook to lock body scroll (for modals on mobile)
 */
export function useBodyScrollLock(isLocked: boolean): void {
  useEffect(() => {
    if (!isLocked) return;

    const originalStyle = {
      overflow: document.body.style.overflow,
      position: document.body.style.position,
      top: document.body.style.top,
      width: document.body.style.width,
    };

    const scrollY = window.scrollY;

    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = '100%';

    return () => {
      document.body.style.overflow = originalStyle.overflow;
      document.body.style.position = originalStyle.position;
      document.body.style.top = originalStyle.top;
      document.body.style.width = originalStyle.width;
      window.scrollTo(0, scrollY);
    };
  }, [isLocked]);
}

// ============================================================================
// TOUCH-FRIENDLY INTERACTION HANDLERS
// ============================================================================

/**
 * Options for touch-friendly button
 */
export interface TouchButtonOptions {
  /** Minimum touch target size in pixels (WCAG recommends 44px) */
  minTouchTarget?: number;
  /** Haptic feedback on tap (if supported) */
  hapticFeedback?: boolean;
  /** Prevent double-tap zoom */
  preventDoubleZoom?: boolean;
  /** Active state scale */
  activeScale?: number;
}

/**
 * Get touch-friendly button props
 */
export function getTouchButtonProps(
  options: TouchButtonOptions = {}
): React.HTMLAttributes<HTMLButtonElement> {
  const { minTouchTarget = 44, hapticFeedback = true, preventDoubleZoom = true } = options;

  return {
    style: {
      minWidth: `${minTouchTarget}px`,
      minHeight: `${minTouchTarget}px`,
      touchAction: preventDoubleZoom ? 'manipulation' : undefined,
    },
    onClick: (e) => {
      // Trigger haptic feedback if supported
      if (hapticFeedback && 'vibrate' in navigator) {
        navigator.vibrate(10);
      }
    },
  };
}

/**
 * Hook for touch-friendly press interactions with visual feedback
 */
export function usePressable<T extends HTMLElement>(
  ref: React.RefObject<T>,
  options: {
    onPress?: () => void;
    onLongPress?: () => void;
    longPressDelay?: number;
    disabled?: boolean;
  } = {}
) {
  const { onPress, onLongPress, longPressDelay = 500, disabled = false } = options;
  const [isPressed, setIsPressed] = useState(false);
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  const isLongPress = useRef(false);

  useEffect(() => {
    const element = ref.current;
    if (!element || disabled) return;

    const handleStart = () => {
      setIsPressed(true);
      isLongPress.current = false;

      if (onLongPress) {
        longPressTimer.current = setTimeout(() => {
          isLongPress.current = true;
          onLongPress();
          // Haptic feedback for long press
          if ('vibrate' in navigator) {
            navigator.vibrate(50);
          }
        }, longPressDelay);
      }
    };

    const handleEnd = () => {
      setIsPressed(false);

      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current);
        longPressTimer.current = null;
      }

      // Only trigger press if not a long press
      if (!isLongPress.current && onPress) {
        onPress();
        // Haptic feedback for tap
        if ('vibrate' in navigator) {
          navigator.vibrate(10);
        }
      }
    };

    const handleCancel = () => {
      setIsPressed(false);
      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current);
        longPressTimer.current = null;
      }
    };

    element.addEventListener('touchstart', handleStart, { passive: true });
    element.addEventListener('touchend', handleEnd, { passive: true });
    element.addEventListener('touchcancel', handleCancel, { passive: true });
    element.addEventListener('mousedown', handleStart);
    element.addEventListener('mouseup', handleEnd);
    element.addEventListener('mouseleave', handleCancel);

    return () => {
      element.removeEventListener('touchstart', handleStart);
      element.removeEventListener('touchend', handleEnd);
      element.removeEventListener('touchcancel', handleCancel);
      element.removeEventListener('mousedown', handleStart);
      element.removeEventListener('mouseup', handleEnd);
      element.removeEventListener('mouseleave', handleCancel);
    };
  }, [ref, onPress, onLongPress, longPressDelay, disabled]);

  return { isPressed };
}

// ============================================================================
// MOBILE-SPECIFIC UTILITIES
// ============================================================================

/**
 * Prevent iOS rubber-band scrolling on fixed containers
 */
export function preventRubberBand(element: HTMLElement): () => void {
  let startY = 0;

  const handleTouchStart = (e: TouchEvent) => {
    startY = e.touches[0].clientY;
  };

  const handleTouchMove = (e: TouchEvent) => {
    const scrollTop = element.scrollTop;
    const scrollHeight = element.scrollHeight;
    const offsetHeight = element.offsetHeight;
    const currentY = e.touches[0].clientY;
    const isAtTop = scrollTop <= 0 && currentY > startY;
    const isAtBottom = scrollTop + offsetHeight >= scrollHeight && currentY < startY;

    if (isAtTop || isAtBottom) {
      e.preventDefault();
    }
  };

  element.addEventListener('touchstart', handleTouchStart, { passive: true });
  element.addEventListener('touchmove', handleTouchMove, { passive: false });

  return () => {
    element.removeEventListener('touchstart', handleTouchStart);
    element.removeEventListener('touchmove', handleTouchMove);
  };
}

/**
 * iOS input zoom prevention - set font-size to 16px minimum
 */
export function getIOSInputProps(): React.InputHTMLAttributes<HTMLInputElement> {
  return {
    style: {
      fontSize: '16px', // Prevents iOS zoom on focus
    },
  };
}

/**
 * Safe area CSS variables for use with Tailwind
 * Add to :root in CSS: --sat: env(safe-area-inset-top);
 */
export const SAFE_AREA_CSS = `
:root {
  --sat: env(safe-area-inset-top);
  --sab: env(safe-area-inset-bottom);
  --sal: env(safe-area-inset-left);
  --sar: env(safe-area-inset-right);
}

/* Utility classes */
.safe-top { padding-top: env(safe-area-inset-top); }
.safe-bottom { padding-bottom: env(safe-area-inset-bottom); }
.safe-left { padding-left: env(safe-area-inset-left); }
.safe-right { padding-right: env(safe-area-inset-right); }
.safe-x { padding-left: env(safe-area-inset-left); padding-right: env(safe-area-inset-right); }
.safe-y { padding-top: env(safe-area-inset-top); padding-bottom: env(safe-area-inset-bottom); }
.safe-all { 
  padding-top: env(safe-area-inset-top);
  padding-bottom: env(safe-area-inset-bottom);
  padding-left: env(safe-area-inset-left);
  padding-right: env(safe-area-inset-right);
}
`;

/**
 * Pull-to-refresh hook for mobile
 */
export function usePullToRefresh(
  onRefresh: () => Promise<void>,
  options: { threshold?: number; enabled?: boolean } = {}
) {
  const { threshold = 80, enabled = true } = options;
  const [isPulling, setIsPulling] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const startY = useRef(0);

  useEffect(() => {
    if (!enabled) return;

    const handleTouchStart = (e: TouchEvent) => {
      if (window.scrollY === 0) {
        startY.current = e.touches[0].clientY;
        setIsPulling(true);
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isPulling || isRefreshing) return;

      const currentY = e.touches[0].clientY;
      const distance = Math.max(0, (currentY - startY.current) * 0.5); // Dampen pull

      if (distance > 0 && window.scrollY === 0) {
        e.preventDefault();
        setPullDistance(Math.min(distance, threshold * 1.5));
      }
    };

    const handleTouchEnd = async () => {
      if (!isPulling) return;

      if (pullDistance >= threshold && !isRefreshing) {
        setIsRefreshing(true);
        try {
          await onRefresh();
        } finally {
          setIsRefreshing(false);
        }
      }

      setIsPulling(false);
      setPullDistance(0);
    };

    document.addEventListener('touchstart', handleTouchStart, { passive: true });
    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [enabled, isPulling, isRefreshing, pullDistance, threshold, onRefresh]);

  return {
    isPulling,
    isRefreshing,
    pullDistance,
    pullProgress: Math.min(pullDistance / threshold, 1),
  };
}
