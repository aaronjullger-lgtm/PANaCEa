/**
 * Accessibility Utilities for StudyPANaCEa
 * WCAG 2.1 AA Compliance utilities
 */

import { useEffect, useCallback, useRef } from 'react';

// Screen reader announcements
export function announceToScreenReader(
  message: string,
  priority: 'polite' | 'assertive' = 'polite'
) {
  let region = document.getElementById('sr-announcements');
  if (!region) {
    region = document.createElement('div');
    region.id = 'sr-announcements';
    region.setAttribute('aria-live', priority);
    region.setAttribute('aria-atomic', 'true');
    region.className = 'sr-only';
    document.body.appendChild(region);
  }
  region.textContent = message;
  setTimeout(() => {
    region!.textContent = '';
  }, 3000);
}

const FOCUSABLE_SELECTOR =
  'button:not([disabled]):not([tabindex="-1"]), [href]:not([tabindex="-1"]), input:not([disabled]):not([tabindex="-1"]), select:not([disabled]):not([tabindex="-1"]), textarea:not([disabled]):not([tabindex="-1"]), [tabindex]:not([tabindex="-1"])';

/**
 * Focus management hook — traps Tab / Shift+Tab inside a container.
 *
 * Focusable elements are queried **on every Tab press** so that dynamic content
 * (loading states, conditional buttons, lazy panels) is handled correctly.
 *
 * @param containerRef  Ref to the DOM node that should trap focus
 * @param isActive      Whether the trap is active (typically the modal's `isOpen` state)
 * @param autoFocus     Whether to move focus into the container on activation (default true)
 */
export function useFocusTrap(
  containerRef: React.RefObject<HTMLElement>,
  isActive: boolean,
  autoFocus: boolean = true,
) {
  // Store the element that had focus before the trap activated so we can
  // restore it on deactivation.
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isActive || !containerRef.current) return;

    // Capture previously-focused element for restoration
    previousFocusRef.current = document.activeElement as HTMLElement | null;

    // Auto-focus the first focusable element inside the container
    if (autoFocus) {
      const firstFocusable = containerRef.current.querySelector(
        FOCUSABLE_SELECTOR,
      ) as HTMLElement | null;
      // Small delay lets the browser finish painting (e.g. after AnimatePresence)
      requestAnimationFrame(() => {
        firstFocusable?.focus();
      });
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab' || !containerRef.current) return;

      // Re-query every time so dynamic content is included
      const focusable = Array.from(
        containerRef.current.querySelectorAll(FOCUSABLE_SELECTOR),
      ) as HTMLElement[];

      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!first || !last) return;

      if (e.shiftKey) {
        if (document.activeElement === first || !containerRef.current.contains(document.activeElement)) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last || !containerRef.current.contains(document.activeElement)) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      // Restore focus to the previously-focused element
      previousFocusRef.current?.focus();
    };
  }, [isActive, containerRef, autoFocus]);
}

// Keyboard navigation hook
export function useKeyboardNavigation(onEscape?: () => void) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && onEscape) onEscape();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onEscape]);
}

// Skip link component helper
export function createSkipLink() {
  return {
    className:
      'sr-only focus:not-sr-only focus:absolute focus:z-50 focus:p-4 focus:bg-[var(--color-bg-secondary)] focus:text-[var(--color-accent)]',
    href: '#main-content',
  };
}
