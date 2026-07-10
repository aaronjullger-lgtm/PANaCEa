import React from 'react';

export interface VisuallyHiddenProps {
  /** Content exposed to assistive tech but hidden visually. */
  children: React.ReactNode;
  /**
   * Render element. Use `span` (default) for inline contexts, `div` for block.
   */
  as?: 'span' | 'div';
}

/**
 * VisuallyHidden — renders content that is available to screen readers but not
 * shown visually (the standard "sr-only" technique). Use it to give an
 * accessible name/description to purely-visual UI (icon glyphs, sparkline
 * trends, decorative arrows) without changing the visual design.
 *
 * Prefer this over ad-hoc `sr-only` spans so the pattern is consistent and
 * testable across the app.
 */
export const VisuallyHidden: React.FC<VisuallyHiddenProps> = ({ children, as = 'span' }) => {
  const Tag = as;
  return <Tag className="sr-only">{children}</Tag>;
};

export default VisuallyHidden;
