/**
 * useMobileKeyboardFix Hook
 *
 * Provides utilities to fix common mobile keyboard interaction issues:
 * - Automatic scrolling of inputs into view when keyboard appears
 * - Proper input type detection and correction
 * - Virtual keyboard dismissal handling
 * - Form submission optimization for mobile
 */

import { useEffect, useRef, useCallback, useState } from 'react';

export interface MobileKeyboardFixOptions {
  /** Whether to enable automatic input scrolling into view */
  autoScroll?: boolean;
  /** Whether to add proper input types based on field names */
  fixInputTypes?: boolean;
  /** Whether to handle form submission on mobile */
  optimizeForms?: boolean;
  /** Whether to add touch-friendly attributes */
  touchFriendly?: boolean;
  /** Whether to log debug information */
  debug?: boolean;
}

export interface MobileKeyboardFixResult {
  /** Scroll an input element into view (considering keyboard) */
  scrollInputIntoView: (element: HTMLElement) => void;
  /** Fix input type for a specific element */
  fixInputType: (element: HTMLInputElement) => void;
  /** Add mobile-friendly attributes to an element */
  addMobileAttributes: (element: HTMLElement) => void;
  /** Check if keyboard is currently visible */
  isKeyboardVisible: boolean;
  /** Current viewport height (accounts for keyboard) */
  viewportHeight: number;
  /** Apply fixes to all inputs on the page */
  applyGlobalFixes: () => void;
}

/**
 * Detects if an element will be covered by the virtual keyboard
 */
function willBeCoveredByKeyboard(element: HTMLElement, keyboardHeight: number = 300): boolean {
  const rect = element.getBoundingClientRect();
  const viewportHeight = window.innerHeight;
  return rect.bottom > viewportHeight - keyboardHeight;
}

/**
 * Determines appropriate input type based on element attributes
 */
function determineInputType(element: HTMLInputElement): string {
  const currentType = element.type || 'text';
  const name = element.name || '';
  const id = element.id || '';
  const placeholder = element.placeholder || '';

  // Check for email fields
  if (
    name.includes('email') ||
    id.includes('email') ||
    placeholder.includes('@') ||
    placeholder.includes('email')
  ) {
    return 'email';
  }

  // Check for phone fields
  if (
    name.includes('phone') ||
    id.includes('phone') ||
    name.includes('tel') ||
    id.includes('tel') ||
    placeholder.match(/\b(phone|tel|mobile)\b/i)
  ) {
    return 'tel';
  }

  // Check for number fields
  if (
    name.includes('number') ||
    id.includes('number') ||
    name.includes('age') ||
    id.includes('age') ||
    name.includes('count') ||
    id.includes('count') ||
    placeholder.match(/\b(number|age|count|quantity)\b/i)
  ) {
    return 'number';
  }

  // Check for URL fields
  if (
    name.includes('url') ||
    id.includes('url') ||
    placeholder.includes('http') ||
    placeholder.includes('www')
  ) {
    return 'url';
  }

  // Check for search fields
  if (name.includes('search') || id.includes('search') || placeholder.includes('Search')) {
    return 'search';
  }

  return currentType;
}

/**
 * Determines appropriate inputmode attribute
 */
function determineInputMode(element: HTMLInputElement): string {
  const type = element.type;

  switch (type) {
    case 'number':
      return 'decimal';
    case 'tel':
      return 'tel';
    case 'email':
      return 'email';
    case 'url':
      return 'url';
    default:
      return '';
  }
}

/**
 * Determines appropriate autocomplete attribute
 */
function determineAutocomplete(element: HTMLInputElement): string {
  const name = element.name || '';
  const type = element.type;

  if (type === 'email') return 'email';
  if (type === 'tel') return 'tel';

  if (name.includes('email')) return 'email';
  if (name.includes('username') || name.includes('user')) return 'username';
  if (name.includes('name')) return 'name';
  if (name.includes('password')) return 'current-password';
  if (name.includes('tel') || name.includes('phone')) return 'tel';
  if (name.includes('address')) return 'street-address';
  if (name.includes('city')) return 'address-level2';
  if (name.includes('state') || name.includes('province')) return 'address-level1';
  if (name.includes('zip') || name.includes('postal')) return 'postal-code';
  if (name.includes('country')) return 'country-name';

  return '';
}

export function useMobileKeyboardFix(
  options: MobileKeyboardFixOptions = {}
): MobileKeyboardFixResult {
  const {
    autoScroll = true,
    fixInputTypes = true,
    optimizeForms = true,
    touchFriendly = true,
    debug = false,
  } = options;

  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const [viewportHeight, setViewportHeight] = useState(
    typeof window !== 'undefined' ? window.innerHeight : 0
  );
  const initialHeight = useRef(viewportHeight);
  const scrollTimeoutRef = useRef<NodeJS.Timeout>();

  // Track keyboard visibility
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleResize = () => {
      const newHeight = window.innerHeight;
      const heightDiff = initialHeight.current - newHeight;
      const keyboardVisible = heightDiff > 150; // Keyboard typically reduces height by >150px

      setViewportHeight(newHeight);
      setIsKeyboardVisible(keyboardVisible);

      if (debug) {
        console.log(
          '[MobileKeyboardFix] Viewport:',
          newHeight,
          'Keyboard:',
          keyboardVisible,
          'Diff:',
          heightDiff
        );
      }
    };

    // Use visualViewport API for more accurate detection on mobile
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleResize);
    } else {
      window.addEventListener('resize', handleResize);
    }

    return () => {
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', handleResize);
      } else {
        window.removeEventListener('resize', handleResize);
      }
    };
  }, [debug]);

  // Auto-scroll inputs into view when focused
  useEffect(() => {
    if (!autoScroll || typeof window === 'undefined') return;

    const handleFocus = (e: FocusEvent) => {
      const target = e.target as HTMLElement;

      // Only handle input-like elements
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT'
      ) {
        scrollInputIntoView(target);
      }
    };

    document.addEventListener('focusin', handleFocus);
    return () => document.removeEventListener('focusin', handleFocus);
  }, [autoScroll]);

  // Fix input types on page load
  useEffect(() => {
    if (!fixInputTypes || typeof document === 'undefined') return;

    const fixAllInputTypes = () => {
      const inputs = document.querySelectorAll('input[type="text"]');
      inputs.forEach((input) => {
        if (input instanceof HTMLInputElement) {
          fixInputType(input);
        }
      });
    };

    // Run after a short delay to ensure DOM is ready
    const timeout = setTimeout(fixAllInputTypes, 100);
    return () => clearTimeout(timeout);
  }, [fixInputTypes]);

  // Optimize forms for mobile
  useEffect(() => {
    if (!optimizeForms || typeof document === 'undefined') return;

    const optimizeAllForms = () => {
      const forms = document.querySelectorAll('form');
      forms.forEach((form) => {
        if (form instanceof HTMLFormElement) {
          // Ensure forms have submit buttons
          const hasSubmitButton = form.querySelector('button[type="submit"], input[type="submit"]');
          if (!hasSubmitButton) {
            const submitButton = document.createElement('button');
            submitButton.type = 'submit';
            submitButton.style.display = 'none';
            form.appendChild(submitButton);
          }

          // Add touch-friendly attributes
          if (touchFriendly) {
            form.setAttribute('autocomplete', 'on');
            form.setAttribute('novalidate', 'novalidate'); // Let browser handle validation
          }
        }
      });
    };

    const timeout = setTimeout(optimizeAllForms, 200);
    return () => clearTimeout(timeout);
  }, [optimizeForms, touchFriendly]);

  const scrollInputIntoView = useCallback(
    (element: HTMLElement) => {
      if (!element || typeof window === 'undefined') return;

      // Clear any existing timeout
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }

      // Use a timeout to ensure the keyboard has time to appear
      scrollTimeoutRef.current = setTimeout(() => {
        const keyboardHeight = 300; // Approximate keyboard height

        if (willBeCoveredByKeyboard(element, keyboardHeight)) {
          // Calculate how much to scroll
          const rect = element.getBoundingClientRect();
          const viewportHeight = window.innerHeight;
          const scrollAmount = rect.bottom - (viewportHeight - keyboardHeight) + 20; // Add 20px padding

          // Scroll the element into view
          element.scrollIntoView({
            behavior: 'smooth',
            block: 'center',
          });

          // Additional scroll if needed
          if (scrollAmount > 0) {
            window.scrollBy({
              top: scrollAmount,
              behavior: 'smooth',
            });
          }

          if (debug) {
            console.log(
              '[MobileKeyboardFix] Scrolled input into view:',
              element.id || element.tagName
            );
          }
        }
      }, 100); // 100ms delay to allow keyboard animation
    },
    [debug]
  );

  const fixInputType = useCallback(
    (element: HTMLInputElement) => {
      if (!element || element.type !== 'text') return;

      const appropriateType = determineInputType(element);
      if (appropriateType !== 'text' && appropriateType !== element.type) {
        element.type = appropriateType;

        // Add inputmode if appropriate
        const inputmode = determineInputMode(element);
        if (inputmode) {
          element.setAttribute('inputmode', inputmode);
        }

        // Add autocomplete if appropriate
        const autocomplete = determineAutocomplete(element);
        if (autocomplete) {
          element.setAttribute('autocomplete', autocomplete);
        }

        if (debug) {
          console.log(
            '[MobileKeyboardFix] Fixed input type:',
            element.id || element.name,
            '->',
            appropriateType
          );
        }
      }
    },
    [debug]
  );

  const addMobileAttributes = useCallback(
    (element: HTMLElement) => {
      if (!element || !touchFriendly) return;

      // Add touch-friendly styles
      if (
        element.tagName === 'INPUT' ||
        element.tagName === 'BUTTON' ||
        element.tagName === 'SELECT'
      ) {
        // Ensure minimum touch target size
        element.style.minHeight = '44px';
        element.style.minWidth = '44px';

        // Add touch action for better scrolling
        element.style.touchAction = 'manipulation';

        // Prevent zoom on double-tap
        if (element.tagName === 'INPUT') {
          (element as HTMLInputElement).style.fontSize = '16px'; // Prevents iOS zoom
        }
      }

      // Add aria attributes for accessibility
      if (!element.hasAttribute('aria-label') && !element.hasAttribute('aria-labelledby')) {
        const label = element.getAttribute('placeholder') || element.getAttribute('title') || '';
        if (label) {
          element.setAttribute('aria-label', label);
        }
      }
    },
    [touchFriendly]
  );

  const applyGlobalFixes = useCallback(() => {
    if (typeof document === 'undefined') return;

    // Fix all text inputs
    if (fixInputTypes) {
      const textInputs = document.querySelectorAll('input[type="text"]');
      textInputs.forEach((input) => {
        if (input instanceof HTMLInputElement) {
          fixInputType(input);
        }
      });
    }

    // Add mobile attributes to interactive elements
    if (touchFriendly) {
      const interactiveElements = document.querySelectorAll(
        'input, button, select, textarea, [role="button"]'
      );
      interactiveElements.forEach((element) => {
        if (element instanceof HTMLElement) {
          addMobileAttributes(element);
        }
      });
    }

    if (debug) {
      console.log(
        '[MobileKeyboardFix] Applied global fixes to',
        document.querySelectorAll('input, button, select, textarea').length,
        'elements'
      );
    }
  }, [fixInputTypes, touchFriendly, debug, fixInputType, addMobileAttributes]);

  return {
    scrollInputIntoView,
    fixInputType,
    addMobileAttributes,
    isKeyboardVisible,
    viewportHeight,
    applyGlobalFixes,
  };
}

/**
 * Hook to automatically dismiss keyboard when tapping outside inputs
 */
export function useKeyboardDismissal() {
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;

      // If click is not on an input-like element, blur any focused input
      if (!target.matches('input, textarea, select, [contenteditable="true"]')) {
        const activeElement = document.activeElement as HTMLElement;
        if (
          activeElement &&
          (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA')
        ) {
          activeElement.blur();
        }
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);
}

/**
 * Hook to prevent form submission on enter key in single-line inputs (mobile optimization)
 */
export function useMobileFormSubmission() {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        const target = e.target as HTMLElement;

        // Prevent form submission on enter in single-line inputs (except textareas)
        if (
          target.tagName === 'INPUT' &&
          (target as HTMLInputElement).type !== 'textarea' &&
          !(target as HTMLInputElement).type.includes('submit')
        ) {
          // Find the form
          const form = target.closest('form');
          if (form) {
            // Find the next input or submit button
            const allInputs = Array.from(form.querySelectorAll('input, textarea, select, button'));
            const currentIndex = allInputs.indexOf(target);

            if (currentIndex !== -1 && currentIndex < allInputs.length - 1) {
              // Focus next input
              const nextInput = allInputs[currentIndex + 1] as HTMLElement;
              nextInput.focus();
              e.preventDefault();
            } else {
              // Last element, submit the form
              const submitButton = form.querySelector(
                'button[type="submit"], input[type="submit"]'
              );
              if (submitButton) {
                (submitButton as HTMLElement).click();
              }
            }
          }
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);
}
