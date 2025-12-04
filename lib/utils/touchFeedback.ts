/**
 * Touch Feedback Utilities
 * Provides haptic feedback and visual touch feedback for mobile devices
 */

/**
 * Trigger haptic feedback on supported devices
 * @param style - Type of haptic feedback ('light', 'medium', 'heavy')
 */
export function hapticFeedback(style: 'light' | 'medium' | 'heavy' = 'medium'): void {
  // Check if the browser supports the Vibration API
  if ('vibrate' in navigator) {
    const duration = style === 'light' ? 10 : style === 'medium' ? 20 : 30;
    navigator.vibrate(duration);
  }
}

/**
 * Add ripple effect to an element on touch
 * @param event - Touch or mouse event
 * @param color - Ripple color (default: white with opacity)
 */
export function addRippleEffect(
  event: React.TouchEvent | React.MouseEvent,
  color: string = 'rgba(255, 255, 255, 0.3)'
): void {
  const target = event.currentTarget as HTMLElement;
  const rect = target.getBoundingClientRect();
  
  // Get click position relative to target
  const x = ('touches' in event ? event.touches[0].clientX : event.clientX) - rect.left;
  const y = ('touches' in event ? event.touches[0].clientY : event.clientY) - rect.top;
  
  // Create ripple element
  const ripple = document.createElement('span');
  ripple.style.position = 'absolute';
  ripple.style.borderRadius = '50%';
  ripple.style.background = color;
  ripple.style.width = '20px';
  ripple.style.height = '20px';
  ripple.style.left = `${x - 10}px`;
  ripple.style.top = `${y - 10}px`;
  ripple.style.pointerEvents = 'none';
  ripple.style.animation = 'ripple-effect 0.6s ease-out';
  
  // Add ripple to target
  const container = target.style.position === 'relative' || target.style.position === 'absolute' 
    ? target 
    : (target.style.position = 'relative', target);
  
  container.appendChild(ripple);
  
  // Remove ripple after animation
  setTimeout(() => {
    ripple.remove();
  }, 600);
}

/**
 * Check if the device supports touch
 */
export function isTouchDevice(): boolean {
  return (
    'ontouchstart' in window ||
    navigator.maxTouchPoints > 0 ||
    ('msMaxTouchPoints' in navigator && (navigator as any).msMaxTouchPoints > 0)
  );
}

/**
 * Get optimal touch target size for the current device
 * Returns size in pixels (44px minimum for accessibility)
 */
export function getOptimalTouchTargetSize(): number {
  const minSize = 44; // WCAG minimum
  const recommendedSize = 48; // Better for accessibility
  
  return isTouchDevice() ? recommendedSize : minSize;
}

/**
 * Add active state classes to an element while it's being pressed
 * Useful for providing visual feedback on touch
 */
export function addPressState(element: HTMLElement, activeClass: string = 'active'): () => void {
  const handleStart = () => element.classList.add(activeClass);
  const handleEnd = () => element.classList.remove(activeClass);
  
  element.addEventListener('touchstart', handleStart);
  element.addEventListener('mousedown', handleStart);
  element.addEventListener('touchend', handleEnd);
  element.addEventListener('mouseup', handleEnd);
  element.addEventListener('touchcancel', handleEnd);
  element.addEventListener('mouseleave', handleEnd);
  
  // Return cleanup function
  return () => {
    element.removeEventListener('touchstart', handleStart);
    element.removeEventListener('mousedown', handleStart);
    element.removeEventListener('touchend', handleEnd);
    element.removeEventListener('mouseup', handleEnd);
    element.removeEventListener('touchcancel', handleEnd);
    element.removeEventListener('mouseleave', handleEnd);
  };
}

/**
 * Prevent double-tap zoom on mobile devices for specific elements
 */
export function preventDoubleTapZoom(element: HTMLElement): () => void {
  let lastTap = 0;
  
  const handleTouch = (event: TouchEvent) => {
    const currentTime = new Date().getTime();
    const tapLength = currentTime - lastTap;
    
    if (tapLength < 500 && tapLength > 0) {
      event.preventDefault();
    }
    
    lastTap = currentTime;
  };
  
  element.addEventListener('touchend', handleTouch, { passive: false });
  
  return () => {
    element.removeEventListener('touchend', handleTouch);
  };
}

// Add CSS for ripple effect animation
if (typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.textContent = `
    @keyframes ripple-effect {
      0% {
        transform: scale(0);
        opacity: 1;
      }
      100% {
        transform: scale(4);
        opacity: 0;
      }
    }
  `;
  document.head.appendChild(style);
}
