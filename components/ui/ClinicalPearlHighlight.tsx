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
      bg-amber-500/10 dark:bg-amber-500/10
      border border-amber-500/30 dark:border-amber-500/30
      text-[var(--color-text-secondary)]
      ${className}
    `}
    role="note"
    aria-label={label}
  >
    <Lightbulb
      className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5"
      aria-hidden
    />
    <div className="flex-1 min-w-0">
      <span className="text-xs font-medium text-amber-600 dark:text-amber-400 uppercase tracking-wide">
        {label}
      </span>
      <div className="mt-1 leading-relaxed">{children}</div>
    </div>
  </div>
);

export default ClinicalPearlHighlight;
