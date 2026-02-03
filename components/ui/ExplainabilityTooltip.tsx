import React, { useState } from 'react';
import { Info } from 'lucide-react';

export interface ExplainabilityTooltipProps {
  /** Short formula or explanation shown on hover (e.g. "Based on your last 336 questions, weighted by difficulty and time decay.") */
  formula: string;
  /** Optional: screen-reader label for the info icon (default: "How is this calculated?") */
  ariaLabel?: string;
  /** Optional: size of the info icon (default: 4 = 1rem) */
  iconSize?: number;
  /** Optional: class for the wrapper (e.g. for alignment next to a label) */
  className?: string;
}

/**
 * ExplainabilityTooltip
 *
 * Renders an (i) info icon. Hovering reveals the formula/explanation so users
 * understand how AI-derived metrics are computed (reduces "black box" distrust).
 */
export function ExplainabilityTooltip({
  formula,
  ariaLabel = 'How is this calculated?',
  iconSize = 4,
  className = '',
}: ExplainabilityTooltipProps) {
  const [visible, setVisible] = useState(false);

  return (
    <span
      role="button"
      tabIndex={0}
      className={`relative inline-flex items-center cursor-help ${className}`}
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
      onFocus={() => setVisible(true)}
      onBlur={() => setVisible(false)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          setVisible((v) => !v);
        }
      }}
    >
      <Info
        className="text-[var(--color-text-muted)] hover:text-[var(--color-accent)] cursor-help transition-colors flex-shrink-0"
        size={iconSize * 4}
        aria-label={ariaLabel}
        role="img"
      />
      {visible && (
        <div
          role="tooltip"
          className="absolute z-[100] left-1/2 -translate-x-1/2 top-full mt-2 w-64 px-3 py-2 text-sm text-[var(--color-text-primary)] bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg shadow-lg"
        >
          <p className="leading-snug">{formula}</p>
          <div className="absolute left-1/2 -translate-x-1/2 -top-1 w-2 h-2 bg-[var(--color-bg-secondary)] border-l border-t border-[var(--color-border)] rotate-45" />
        </div>
      )}
    </span>
  );
}

export default ExplainabilityTooltip;
