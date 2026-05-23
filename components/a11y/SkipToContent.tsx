/**
 * SkipToContent — Accessible skip-navigation link.
 *
 * Renders a visually hidden link that becomes visible on focus (Tab key).
 * Allows keyboard and screen-reader users to bypass repetitive navigation
 * and jump directly to the main content area.
 *
 * WCAG 2.1 SC 2.4.1 (Bypass Blocks)
 *
 * Usage: Place as the first focusable element inside the app root, before any nav.
 *   <SkipToContent targetId="main-content" />
 *   ...
 *   <main id="main-content">...</main>
 */

import React from 'react';

interface SkipToContentProps {
  /** The id of the main content element to skip to */
  targetId?: string;
  /** Custom label (default: "Skip to main content") */
  label?: string;
}

export const SkipToContent: React.FC<SkipToContentProps> = ({
  targetId = 'main-content',
  label = 'Skip to main content',
}) => {
  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    const target = document.getElementById(targetId);
    if (target) {
      target.setAttribute('tabIndex', '-1');
      target.focus();
      target.removeAttribute('tabIndex');
    }
  };

  return (
    <a
      href={`#${targetId}`}
      onClick={handleClick}
      className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[9999] focus:rounded-lg focus:bg-[var(--color-bg-primary)] focus:px-4 focus:py-3 focus:text-sm focus:font-medium focus:text-[var(--color-text-primary)] focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-focus-ring)] focus:ring-offset-2"
    >
      {label}
    </a>
  );
};

export default SkipToContent;
