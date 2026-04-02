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
    bgClass: 'bg-green-500/10',
    textClass: 'text-green-600',
    label: 'Thriving',
  },
  steady: {
    icon: <Heart className="w-4 h-4" />,
    bgClass: 'bg-blue-500/10',
    textClass: 'text-blue-600',
    label: 'Steady',
  },
  tired: {
    icon: <Coffee className="w-4 h-4" />,
    bgClass: 'bg-amber-500/10',
    textClass: 'text-amber-600',
    label: 'Take a break',
  },
  burnout_risk: {
    icon: <AlertTriangle className="w-4 h-4" />,
    bgClass: 'bg-red-500/10',
    textClass: 'text-red-600',
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
