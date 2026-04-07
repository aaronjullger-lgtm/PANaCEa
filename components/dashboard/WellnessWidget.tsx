/**
 * WellnessWidget — Compact dashboard widget showing study wellness status.
 *
 * Displays the wellness signal from useStudyWellness with
 * appropriate visual treatment (color, icon) per wellness level.
 */

import React from 'react';
import { Heart, Sun, Coffee, AlertTriangle } from 'lucide-react';
import type { WellnessSignal, WellnessLevel } from '@/hooks/useStudyWellness';

const LEVEL_CONFIG: Record<WellnessLevel, {
  icon: React.ReactNode;
  bgClass: string;
  textClass: string;
  label: string;
}> = {
  thriving: {
    icon: <Sun className="w-4 h-4" />,
    bgClass: 'bg-[var(--color-data-pass)]/10',
    textClass: 'text-[var(--color-data-pass)]',
    label: 'Thriving',
  },
  steady: {
    icon: <Heart className="w-4 h-4" />,
    bgClass: 'bg-[var(--color-accent)]/10',
    textClass: 'text-[var(--color-accent)]',
    label: 'Steady',
  },
  tired: {
    icon: <Coffee className="w-4 h-4" />,
    bgClass: 'bg-[var(--color-data-provisional)]/10',
    textClass: 'text-[var(--color-data-provisional)]',
    label: 'Take a break',
  },
  burnout_risk: {
    icon: <AlertTriangle className="w-4 h-4" />,
    bgClass: 'bg-[var(--color-data-fail)]/10',
    textClass: 'text-[var(--color-data-fail)]',
    label: 'Rest recommended',
  },
};

interface WellnessWidgetProps {
  signal: WellnessSignal;
  className?: string;
}

export const WellnessWidget: React.FC<WellnessWidgetProps> = ({
  signal,
  className = '',
}) => {
  const config = LEVEL_CONFIG[signal.level];

  return (
    <div className={`rounded-lg ${config.bgClass} p-3 ${className}`}>
      <div className="flex items-center gap-2 mb-1">
        <span className={config.textClass}>{config.icon}</span>
        <span className={`text-xs font-semibold uppercase tracking-wide ${config.textClass}`}>
          {config.label}
        </span>
      </div>
      <p className="text-sm text-[var(--color-text-secondary)] leading-snug">
        {signal.message}
      </p>
      {signal.suggestion && (
        <p className="text-xs text-[var(--color-text-muted)] mt-1.5">
          {signal.suggestion}
        </p>
      )}
    </div>
  );
};

export default WellnessWidget;
