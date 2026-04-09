/**
 * ClinicalPearlHighlight
 * Highlights a clinical pearl or high-yield takeaway in explanation/feedback UI.
 */

import React from 'react';
import { Lightbulb } from 'lucide-react';

interface ClinicalPearlHighlightProps {
  /** Pearl content (HTML allowed) */
  children: React.ReactNode;
  /** Optional label override */
  label?: string;
  className?: string;
}

export const ClinicalPearlHighlight: React.FC<ClinicalPearlHighlightProps> = ({
  children,
  label = 'Pearl',
  className = '',
}) => (
  <div
    className={`
      flex items-start gap-2 p-3 rounded-lg
      bg-data-provisional/10
      border border-data-provisional/30
      text-[var(--color-text-secondary)]
      ${className}
    `}
    role="note"
    aria-label={label}
  >
    <Lightbulb
      className="w-4 h-4 text-data-provisional flex-shrink-0 mt-0.5"
      aria-hidden
    />
    <div className="flex-1 min-w-0">
      <span className="text-xs font-medium text-data-provisional uppercase tracking-wide">
        {label}
      </span>
      <div className="mt-1 leading-relaxed">{children}</div>
    </div>
  </div>
);

export default ClinicalPearlHighlight;
