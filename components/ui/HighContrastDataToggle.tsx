/**
 * HighContrastDataToggle – WCAG-friendly data visualization mode
 * When on: charts use distinct patterns/borders instead of gradients; better for color deficiency.
 */

import React from 'react';
import { Contrast } from 'lucide-react';
import { useThemeContext } from '@/contexts/ThemeContext';

interface HighContrastDataToggleProps {
  /** Show as compact icon-only button */
  compact?: boolean;
  className?: string;
}

export const HighContrastDataToggle: React.FC<HighContrastDataToggleProps> = ({
  compact = false,
  className = '',
}) => {
  const { highContrastData, setHighContrastData } = useThemeContext();

  return (
    <button
      type="button"
      onClick={() => setHighContrastData((v) => !v)}
      className={`
        inline-flex items-center gap-2 rounded-lg border border-[var(--color-border)]
        bg-[var(--color-bg-secondary)] px-3 py-2 text-sm font-medium
        text-[var(--color-text-primary)] transition-colors
        hover:bg-[var(--color-bg-tertiary)]
        focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2
        ${compact ? 'p-2' : ''}
        ${highContrastData ? 'ring-2 ring-[var(--color-accent)] ring-offset-2 ring-offset-[var(--color-bg-primary)]' : ''}
        ${className}
      `}
      title={highContrastData ? 'Disable high-contrast charts' : 'High-contrast charts (accessibility)'}
      aria-pressed={highContrastData ? 'true' : 'false'}
      aria-label={highContrastData ? 'High-contrast data on' : 'High-contrast data off'}
    >
      <Contrast className="h-4 w-4 shrink-0" aria-hidden />
      {!compact && (
        <span>{highContrastData ? 'High contrast on' : 'High contrast charts'}</span>
      )}
    </button>
  );
};

export default HighContrastDataToggle;
