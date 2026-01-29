/**
 * Accessibility Utilities for StudyPANaCEa
 * WCAG 2.1 AA Compliance utilities
 */

import { useEffect, useCallback } from 'react';

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

// Focus management hook
export function useFocusTrap(containerRef: React.RefObject<HTMLElement>, isActive: boolean) {
  useEffect(() => {
    if (!isActive || !containerRef.current) return;

    const focusableElements = containerRef.current.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const firstElement = focusableElements[0] as HTMLElement;
    const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      if (e.shiftKey && document.activeElement === firstElement) {
        e.preventDefault();
        lastElement?.focus();
      } else if (!e.shiftKey && document.activeElement === lastElement) {
        e.preventDefault();
        firstElement?.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    firstElement?.focus();
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isActive, containerRef]);
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
