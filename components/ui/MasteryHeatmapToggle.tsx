/**
 * MasteryHeatmapToggle – global toggle for mastery heatmap overlay on dashboard cards.
 */

import React from 'react';
import { Layers } from 'lucide-react';
import { useMasteryHeatmap } from '@/contexts/MasteryHeatmapContext';

interface MasteryHeatmapToggleProps {
  compact?: boolean;
  className?: string;
}

export const MasteryHeatmapToggle: React.FC<MasteryHeatmapToggleProps> = ({
  compact = false,
  className = '',
}) => {
  const { masteryHeatmapOverlay, setMasteryHeatmapOverlay } = useMasteryHeatmap();

  return (
    <button
      type="button"
      onClick={() => setMasteryHeatmapOverlay((v) => !v)}
      className={`
        inline-flex items-center gap-2 rounded-lg border border-[var(--color-border)]
        bg-[var(--color-bg-secondary)] px-3 py-2 text-sm font-medium
        text-[var(--color-text-primary)] transition-colors
        hover:bg-[var(--color-bg-tertiary)]
        focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2
        ${compact ? 'p-2' : ''}
        ${masteryHeatmapOverlay ? 'ring-2 ring-[var(--color-accent)] ring-offset-2 ring-offset-[var(--color-bg-primary)]' : ''}
        ${className}
      `}
      title={masteryHeatmapOverlay ? 'Hide mastery overlay' : 'Show mastery overlay on cards'}
      aria-pressed={masteryHeatmapOverlay}
      aria-label={masteryHeatmapOverlay ? 'Mastery overlay on' : 'Mastery overlay off'}
    >
      <Layers className="h-4 w-4 shrink-0" aria-hidden />
      {!compact && (
        <span>{masteryHeatmapOverlay ? 'Overlay on' : 'Mastery overlay'}</span>
      )}
    </button>
  );
};

export default MasteryHeatmapToggle;
