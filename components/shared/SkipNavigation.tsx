/**
 * Skip Navigation Component
 *
 * Provides keyboard users with a way to skip repetitive navigation content
 * and jump directly to the main content area.
 *
 * WCAG 2.1 Success Criterion 2.4.1: Bypass Blocks
 *
 * @example
 * // Add to App.tsx or layout component
 * <SkipNavigation />
 *
 * // Ensure main content has id="main-content"
 * <main id="main-content">
 *   {/* Your main content *\/}
 * </main>
 */

import React, { useEffect, useState } from 'react';

export interface SkipNavigationProps {
  /** ID of the main content element */
  mainContentId?: string;
  /** Custom label for the skip link */
  label?: string;
  /** Additional CSS classes */
  className?: string;
}

export const SkipNavigation: React.FC<SkipNavigationProps> = ({
  mainContentId = 'main-content',
  label = 'Skip to main content',
  className = '',
}) => {
  const [isVisible, setIsVisible] = useState(false);

  // Show skip link when user presses Tab (keyboard navigation)
  useEffect(() => {
    const handleFirstTab = (e: KeyboardEvent) => {
      if (e.key === 'Tab') {
        setIsVisible(true);
        window.removeEventListener('keydown', handleFirstTab);
      }
    };

    window.addEventListener('keydown', handleFirstTab);
    return () => window.removeEventListener('keydown', handleFirstTab);
  }, []);

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();

    const mainContent = document.getElementById(mainContentId);
    if (mainContent) {
      // Make content focusable if it isn't already
      if (!mainContent.hasAttribute('tabindex')) {
        mainContent.setAttribute('tabindex', '-1');
      }

      // Focus and scroll to main content
      mainContent.focus();
      mainContent.scrollIntoView({ behavior: 'smooth' });

      // Remove focus after a delay to prevent focus trap
      setTimeout(() => {
        if (document.activeElement === mainContent) {
          (mainContent as HTMLElement).blur();
          mainContent.removeAttribute('tabindex');
        }
      }, 1000);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLAnchorElement>) => {
    // Allow Escape to hide the skip link
    if (e.key === 'Escape') {
      setIsVisible(false);
    }
  };

  if (!isVisible) {
    return null;
  }

  return (
    <a
      href={`#${mainContentId}`}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      className={`
        sr-only
        focus:not-sr-only
        focus:absolute
        focus:top-4
        focus:left-4
        focus:z-50
        focus:p-4
        focus:bg-[var(--color-bg-primary)]
        focus:text-[var(--color-text-primary)]
        focus:border-2
        focus:border-[var(--color-accent)]
        focus:rounded-lg
        focus:shadow-lg
        focus:outline-none
        hover:bg-[var(--color-bg-secondary)]
        active:bg-[var(--color-bg-tertiary)]
        transition-all
        duration-200
        ${className}
      `}
      aria-label={label}
    >
      {label}
    </a>
  );
};

/**
 * Skip Navigation Wrapper for Layout Components
 *
 * Convenience component that includes SkipNavigation and ensures
 * main content has proper ID and focus management.
 */
export const SkipNavigationWrapper: React.FC<{
  children: React.ReactNode;
  mainContentId?: string;
  skipLabel?: string;
}> = ({ children, mainContentId = 'main-content', skipLabel }) => {
  return (
    <>
      <SkipNavigation mainContentId={mainContentId} label={skipLabel} />
      {children}
    </>
  );
};

export default SkipNavigation;
