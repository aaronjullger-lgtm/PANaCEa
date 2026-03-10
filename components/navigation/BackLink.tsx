/**
 * BackLink - Shared back navigation link for deep flows
 *
 * Renders a clickable "Back to Dashboard" or "Back to Practice" link
 * for wayfinding in drill modes, knowledge base, utilities, etc.
 *
 * Navigation model:
 * - Hubs (Practice, Knowledge, Utilities): BackLink to /study (Dashboard) in header/sidebar.
 * - Detail within hub: BackLink to parent hub (e.g. "Back to Generators" when viewing
 *   Mnemonic Generator). Use asButton + onClick for in-flow back (same route, clear state).
 * - Slide-over/Modal: Use close (X) only; pagination arrows are for in-modal navigation.
 * - One primary back affordance per detail view.
 */

import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { ROUTES } from '@/config/routes';

export interface BackLinkProps {
  /** Target path - defaults to /practice for drill modes. Ignored when asButton. */
  to?: string;
  /** Label shown next to icon - defaults based on `to` (Dashboard, Practice, Knowledge, Tools) */
  label?: string;
  /** Additional class names */
  className?: string;
  /**
   * When true, render a button instead of Link. Use for in-flow back (e.g. clearing
   * selected state) when the target is the same route. Requires onClick.
   */
  asButton?: boolean;
  /** Required when asButton. Called when the back button is clicked. */
  onClick?: () => void;
}

function getDefaultLabel(to: string): string {
  if (to === ROUTES.STUDY) return 'Back to Dashboard';
  if (to === ROUTES.PRACTICE) return 'Back to Practice';
  if (to === ROUTES.STUDY_KNOWLEDGE) return 'Back to Knowledge';
  if (to === ROUTES.STUDY_UTILITIES) return 'Back to Tools';
  return 'Back';
}

export const BackLink: React.FC<BackLinkProps> = ({
  to = ROUTES.PRACTICE,
  label,
  className = '',
  asButton = false,
  onClick,
}) => {
  const displayLabel = label ?? (asButton ? 'Back' : getDefaultLabel(to));
  const baseClassName = `inline-flex items-center gap-1.5 sm:gap-2 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors p-2 rounded-lg hover:bg-[var(--color-bg-tertiary)] min-h-[44px] min-w-[44px] group ${className}`;

  if (asButton && onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`${baseClassName} bg-transparent border-0 cursor-pointer`}
        aria-label={displayLabel}
      >
        <ArrowLeft
          className="w-5 h-5 transition-transform group-hover:-translate-x-0.5"
          aria-hidden
        />
        <span className="text-sm font-medium hidden sm:inline">{displayLabel}</span>
      </button>
    );
  }

  return (
    <Link to={to} className={baseClassName} aria-label={displayLabel}>
      <ArrowLeft
        className="w-5 h-5 transition-transform group-hover:-translate-x-0.5"
        aria-hidden
      />
      <span className="text-sm font-medium hidden sm:inline">{displayLabel}</span>
    </Link>
  );
};

export default BackLink;
