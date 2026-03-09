/**
 * BackLink - Shared back navigation link for deep flows
 *
 * Renders a clickable "Back to Dashboard" or "Back to Practice" link
 * for wayfinding in drill modes, knowledge base, utilities, etc.
 */

import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { ROUTES } from '@/config/routes';

export interface BackLinkProps {
  /** Target path - defaults to /practice for drill modes */
  to?: string;
  /** Label shown next to icon - defaults to "Back to Practice" or "Back to Dashboard" */
  label?: string;
  /** Additional class names */
  className?: string;
}

export const BackLink: React.FC<BackLinkProps> = ({
  to = ROUTES.PRACTICE,
  label = to === ROUTES.STUDY ? 'Back to Dashboard' : 'Back to Practice',
  className = '',
}) => {
  return (
    <Link
      to={to}
      className={`inline-flex items-center gap-1.5 sm:gap-2 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors p-2 rounded-lg hover:bg-[var(--color-bg-tertiary)] min-h-[44px] min-w-[44px] group ${className}`}
      aria-label={label}
    >
      <ArrowLeft
        className="w-5 h-5 transition-transform group-hover:-translate-x-0.5"
        aria-hidden
      />
      <span className="text-sm font-medium hidden sm:inline">{label}</span>
    </Link>
  );
};

export default BackLink;
