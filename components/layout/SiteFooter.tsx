/**
 * SiteFooter – Shared copyright + tagline for landing and full-width pages.
 * Use on LandingPage and any standalone marketing or content pages.
 */

import React from 'react';
import { PageContainer } from './PageContainer';

const DEFAULT_TAGLINE = 'Complete study resource for physician assistant students.';

export interface SiteFooterProps {
  /** Optional tagline; default describes PANaCEa */
  tagline?: string;
  /** Optional class for the footer element */
  className?: string;
}

export const SiteFooter: React.FC<SiteFooterProps> = ({
  tagline = DEFAULT_TAGLINE,
  className = '',
}) => {
  const year = new Date().getFullYear();
  return (
    <footer
      className={`border-t border-[var(--color-border)] bg-[var(--color-bg-secondary)] ${className}`.trim()}
    >
      <PageContainer
        as="div"
        maxWidth="7xl"
        className="py-8 text-center text-[var(--color-text-muted)]"
      >
        <p>
          © {year} PANaCEa. {tagline}
        </p>
      </PageContainer>
    </footer>
  );
};

export default SiteFooter;
