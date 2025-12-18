/**
 * responsive.ts
 * 
 * Responsive utility hooks for detecting mobile/tablet breakpoints
 * and providing device-specific UI behaviors.
 */

import { useState, useEffect } from 'react';

/**
 * Mobile breakpoint constant (matches Tailwind's `md` breakpoint)
 */
export const MOBILE_BREAKPOINT = 768;

/**
 * Hook to detect if the current viewport is mobile (<768px)
 * 
 * @returns {boolean} true if viewport width is less than 768px
 * 
 * @example
 * ```tsx
 * const isMobile = useIsMobile();
 * return isMobile ? <MobileNav /> : <DesktopNav />;
 * ```
 */
export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    };

    // Check on mount
    checkMobile();

    // Add resize listener
    window.addEventListener('resize', checkMobile);

    // Cleanup
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  return isMobile;
}

/**
 * Hook to detect tablet viewport (768px - 1024px)
 * 
 * @returns {boolean} true if viewport is in tablet range
 */
export function useIsTablet(): boolean {
  const [isTablet, setIsTablet] = useState(false);

  useEffect(() => {
    const checkTablet = () => {
      const width = window.innerWidth;
      setIsTablet(width >= 768 && width < 1024);
    };

    checkTablet();
    window.addEventListener('resize', checkTablet);
    return () => window.removeEventListener('resize', checkTablet);
  }, []);

  return isTablet;
}

/**
 * Hook to get current viewport width category
 * 
 * @returns {'mobile' | 'tablet' | 'desktop'}
 */
export function useViewportCategory(): 'mobile' | 'tablet' | 'desktop' {
  const [category, setCategory] = useState<'mobile' | 'tablet' | 'desktop'>('desktop');

  useEffect(() => {
    const updateCategory = () => {
      const width = window.innerWidth;
      if (width < 768) setCategory('mobile');
      else if (width < 1024) setCategory('tablet');
      else setCategory('desktop');
    };

    updateCategory();
    window.addEventListener('resize', updateCategory);
    return () => window.removeEventListener('resize', updateCategory);
  }, []);

  return category;
}

/**
 * Minimum touch target size (iOS/Android accessibility guidelines)
 */
export const MIN_TOUCH_TARGET_SIZE = 44; // px
