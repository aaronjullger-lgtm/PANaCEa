/**
 * Accessibility Utilities
 *
 * Provides helpers for improving keyboard navigation, screen reader support,
 * and overall accessibility compliance.
 */

/**
 * Trap focus within a modal or dialog
 * Ensures keyboard navigation stays within the modal
 *
 * @param container - The container element to trap focus within
 * @returns Cleanup function to remove event listeners
 */
export function trapFocus(container: HTMLElement): () => void {
  const focusableElements = container.querySelectorAll<HTMLElement>(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  );

  const firstFocusable = focusableElements[0];
  const lastFocusable = focusableElements[focusableElements.length - 1];

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key !== 'Tab') return;

    if (e.shiftKey) {
      // Shift + Tab
      if (document.activeElement === firstFocusable) {
        e.preventDefault();
        lastFocusable?.focus();
      }
    } else {
      // Tab
      if (document.activeElement === lastFocusable) {
        e.preventDefault();
        firstFocusable?.focus();
      }
    }
  };

  container.addEventListener('keydown', handleKeyDown);

  // Focus first element on mount
  firstFocusable?.focus();

  // Return cleanup function
  return () => {
    container.removeEventListener('keydown', handleKeyDown);
  };
}

/**
 * Announce message to screen readers
 * Uses ARIA live regions for dynamic content updates
 *
 * @param message - Message to announce
 * @param priority - 'polite' or 'assertive'
 */
export function announceToScreenReader(
  message: string,
  priority: 'polite' | 'assertive' = 'polite'
): void {
  // Find or create live region
  let liveRegion = document.getElementById('aria-live-region');

  if (!liveRegion) {
    liveRegion = document.createElement('div');
    liveRegion.id = 'aria-live-region';
    liveRegion.setAttribute('role', 'status');
    liveRegion.setAttribute('aria-live', priority);
    liveRegion.setAttribute('aria-atomic', 'true');
    liveRegion.style.cssText = `
      position: absolute;
      left: -10000px;
      width: 1px;
      height: 1px;
      overflow: hidden;
    `;
    document.body.appendChild(liveRegion);
  }

  // Update message
  liveRegion.textContent = message;

  // Clear after a delay to allow for repeated announcements
  setTimeout(() => {
    if (liveRegion) {
      liveRegion.textContent = '';
    }
  }, 1000);
}

/**
 * Check if an element is keyboard accessible
 * Validates that interactive elements have proper keyboard support
 *
 * @param element - Element to check
 * @returns Accessibility issues found
 */
export function checkKeyboardAccessibility(element: HTMLElement): {
  isAccessible: boolean;
  issues: string[];
} {
  const issues: string[] = [];
  const tagName = element.tagName.toLowerCase();
  const role = element.getAttribute('role');
  const tabIndex = element.getAttribute('tabindex');

  // Check if interactive element is focusable
  const interactiveRoles = ['button', 'link', 'checkbox', 'radio', 'textbox', 'combobox'];
  const interactiveTags = ['button', 'a', 'input', 'select', 'textarea'];

  const isInteractive =
    interactiveTags.includes(tagName) || (role && interactiveRoles.includes(role));

  if (isInteractive) {
    // Check if element is focusable
    if (tabIndex === '-1') {
      issues.push('Interactive element is not keyboard focusable (tabindex="-1")');
    }

    // Check for click handlers without keyboard handlers
    const hasClickHandler = element.onclick !== null || element.getAttribute('onclick') !== null;
    const hasKeyHandler =
      element.onkeydown !== null ||
      element.onkeypress !== null ||
      element.getAttribute('onkeydown') !== null ||
      element.getAttribute('onkeypress') !== null;

    if (hasClickHandler && !hasKeyHandler && tagName !== 'button' && tagName !== 'a') {
      issues.push('Element has click handler but no keyboard handler');
    }

    // Check for ARIA label
    const hasLabel =
      element.getAttribute('aria-label') ||
      element.getAttribute('aria-labelledby') ||
      element.textContent?.trim();

    if (!hasLabel) {
      issues.push('Interactive element lacks accessible label');
    }
  }

  return {
    isAccessible: issues.length === 0,
    issues,
  };
}

/**
 * Generate unique ID for ARIA relationships
 * Useful for aria-labelledby and aria-describedby
 *
 * @param prefix - Optional prefix for the ID
 * @returns Unique ID string
 */
let idCounter = 0;
export function generateAriaId(prefix: string = 'aria'): string {
  idCounter++;
  return `${prefix}-${idCounter}-${Date.now()}`;
}

/**
 * Get WCAG contrast ratio between two colors
 * Helps ensure text meets accessibility standards
 *
 * @param foreground - Foreground color (hex)
 * @param background - Background color (hex)
 * @returns Contrast ratio (1-21)
 */
export function getContrastRatio(foreground: string, background: string): number {
  const getLuminance = (hex: string): number => {
    // Remove # if present
    hex = hex.replace('#', '');

    // Convert to RGB
    const r = parseInt(hex.substring(0, 2), 16) / 255;
    const g = parseInt(hex.substring(2, 4), 16) / 255;
    const b = parseInt(hex.substring(4, 6), 16) / 255;

    // Apply gamma correction
    const rsRGB = r <= 0.03928 ? r / 12.92 : Math.pow((r + 0.055) / 1.055, 2.4);
    const gsRGB = g <= 0.03928 ? g / 12.92 : Math.pow((g + 0.055) / 1.055, 2.4);
    const bsRGB = b <= 0.03928 ? b / 12.92 : Math.pow((b + 0.055) / 1.055, 2.4);

    // Calculate relative luminance
    return 0.2126 * rsRGB + 0.7152 * gsRGB + 0.0722 * bsRGB;
  };

  const l1 = getLuminance(foreground);
  const l2 = getLuminance(background);

  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);

  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Check if contrast meets WCAG standards
 *
 * @param ratio - Contrast ratio
 * @param level - 'AA' or 'AAA'
 * @param size - 'normal' or 'large' (large is 18pt+ or 14pt+ bold)
 * @returns Whether the contrast meets the standard
 */
export function meetsContrastStandard(
  ratio: number,
  level: 'AA' | 'AAA' = 'AA',
  size: 'normal' | 'large' = 'normal'
): boolean {
  if (level === 'AAA') {
    return size === 'large' ? ratio >= 4.5 : ratio >= 7;
  }
  return size === 'large' ? ratio >= 3 : ratio >= 4.5;
}

/**
 * Add skip link for keyboard navigation
 * Allows users to skip to main content
 *
 * @param targetId - ID of the main content container
 * @returns The skip link element
 */
export function createSkipLink(targetId: string = 'main-content'): HTMLElement {
  const skipLink = document.createElement('a');
  skipLink.href = `#${targetId}`;
  skipLink.textContent = 'Skip to main content';
  skipLink.className = 'skip-link';
  skipLink.style.cssText = `
    position: absolute;
    left: -10000px;
    top: auto;
    width: 1px;
    height: 1px;
    overflow: hidden;
    background: #000;
    color: #fff;
    padding: 10px 20px;
    text-decoration: none;
    z-index: 100000;
  `;

  // Make visible on focus
  skipLink.addEventListener('focus', () => {
    skipLink.style.left = '0';
    skipLink.style.width = 'auto';
    skipLink.style.height = 'auto';
  });

  skipLink.addEventListener('blur', () => {
    skipLink.style.left = '-10000px';
    skipLink.style.width = '1px';
    skipLink.style.height = '1px';
  });

  return skipLink;
}

/**
 * Keyboard event handler helper
 * Simplifies handling Enter and Space for custom interactive elements
 *
 * @param callback - Function to call on activation
 * @returns Keyboard event handler
 */
export function createKeyboardHandler(callback: () => void): (event: KeyboardEvent) => void {
  return (event: KeyboardEvent) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      callback();
    }
  };
}

/**
 * Create accessible button props
 * Returns props that ensure button accessibility
 *
 * @param onClick - Click handler
 * @param label - Accessible label
 * @param options - Additional options
 * @returns Props object
 */
export function createAccessibleButtonProps(
  onClick: () => void,
  label: string,
  options: {
    disabled?: boolean;
    pressed?: boolean;
    expanded?: boolean;
  } = {}
): {
  onClick: () => void;
  onKeyDown: (e: KeyboardEvent) => void;
  role: 'button';
  tabIndex: number;
  'aria-label': string;
  'aria-disabled'?: boolean;
  'aria-pressed'?: boolean;
  'aria-expanded'?: boolean;
} {
  const { disabled = false, pressed, expanded } = options;

  return {
    onClick,
    onKeyDown: createKeyboardHandler(onClick),
    role: 'button',
    tabIndex: disabled ? -1 : 0,
    'aria-label': label,
    ...(disabled && { 'aria-disabled': true }),
    ...(pressed !== undefined && { 'aria-pressed': pressed }),
    ...(expanded !== undefined && { 'aria-expanded': expanded }),
  };
}

/**
 * Detect if user prefers reduced motion
 * Respects system accessibility preferences
 *
 * @returns Whether user prefers reduced motion
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;

  const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  return mediaQuery.matches;
}

/**
 * Get accessible animation duration
 * Returns 0 if user prefers reduced motion
 *
 * @param duration - Normal animation duration in ms
 * @returns Duration respecting user preferences
 */
export function getAccessibleDuration(duration: number): number {
  return prefersReducedMotion() ? 0 : duration;
}
