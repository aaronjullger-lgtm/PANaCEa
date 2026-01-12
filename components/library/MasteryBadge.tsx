/**
 * MasteryBadge - Shows user's mastery level for a condition
 * 
 * Displays FSRS-based mastery with color-coded levels:
 * - 🔴 New/Learning (stability < 1)
 * - 🟡 Developing (stability 1-5)
 * - 🟢 Competent (stability 5-15)
 * - 🔵 Mastered (stability > 15)
 */

import React from 'react';
import { Brain, TrendingUp, Award, Zap } from 'lucide-react';

export type MasteryLevel = 'new' | 'learning' | 'developing' | 'competent' | 'mastered';

interface MasteryBadgeProps {
  /** FSRS stability value */
  stability?: number;
  /** Number of times reviewed */
  reviewCount?: number;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Show detailed tooltip */
  showTooltip?: boolean;
  /** Override mastery level manually */
  level?: MasteryLevel;
}

/**
 * Calculate mastery level from FSRS stability
 */
function getMasteryLevel(stability?: number, reviewCount?: number): MasteryLevel {
  if (!stability || stability === 0) {
    return reviewCount && reviewCount > 0 ? 'learning' : 'new';
  }
  if (stability < 1) return 'learning';
  if (stability < 5) return 'developing';
  if (stability < 15) return 'competent';
  return 'mastered';
}

/**
 * Get mastery configuration (colors, labels, icons)
 */
function getMasteryConfig(level: MasteryLevel) {
  const configs = {
    new: {
      label: 'New',
      description: 'Not yet studied',
      color: 'text-slate-400',
      bgColor: 'bg-slate-500/20',
      borderColor: 'border-slate-500/30',
      icon: Zap,
      progressColor: 'bg-slate-400',
      progressPercent: 0,
    },
    learning: {
      label: 'Learning',
      description: 'Just started',
      color: 'text-red-400',
      bgColor: 'bg-red-500/20',
      borderColor: 'border-red-500/30',
      icon: Brain,
      progressColor: 'bg-red-400',
      progressPercent: 15,
    },
    developing: {
      label: 'Developing',
      description: 'Building knowledge',
      color: 'text-amber-400',
      bgColor: 'bg-amber-500/20',
      borderColor: 'border-amber-500/30',
      icon: TrendingUp,
      progressColor: 'bg-amber-400',
      progressPercent: 40,
    },
    competent: {
      label: 'Competent',
      description: 'Solid understanding',
      color: 'text-green-400',
      bgColor: 'bg-green-500/20',
      borderColor: 'border-green-500/30',
      icon: TrendingUp,
      progressColor: 'bg-green-400',
      progressPercent: 70,
    },
    mastered: {
      label: 'Mastered',
      description: 'Long-term retention',
      color: 'text-blue-400',
      bgColor: 'bg-blue-500/20',
      borderColor: 'border-blue-500/30',
      icon: Award,
      progressColor: 'bg-blue-400',
      progressPercent: 100,
    },
  };
  return configs[level];
}

export const MasteryBadge: React.FC<MasteryBadgeProps> = ({
  stability,
  reviewCount,
  size = 'sm',
  showTooltip = true,
  level: overrideLevel,
}) => {
  const level = overrideLevel || getMasteryLevel(stability, reviewCount);
  const config = getMasteryConfig(level);
  const Icon = config.icon;

  const sizeClasses = {
    sm: 'text-[10px] px-1.5 py-0.5 gap-1',
    md: 'text-xs px-2 py-1 gap-1.5',
    lg: 'text-sm px-2.5 py-1.5 gap-2',
  };

  const iconSizes = {
    sm: 'w-2.5 h-2.5',
    md: 'w-3 h-3',
    lg: 'w-4 h-4',
  };

  return (
    <div className="group relative">
      <div
        className={`
          inline-flex items-center rounded-md font-medium
          ${config.bgColor} ${config.borderColor} border ${config.color}
          ${sizeClasses[size]}
        `}
      >
        <Icon className={iconSizes[size]} />
        <span>{config.label}</span>
      </div>

      {/* Tooltip */}
      {showTooltip && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
          <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg shadow-lg p-2 min-w-[140px]">
            <p className="text-xs font-semibold text-[var(--color-text-primary)] mb-1">
              {config.label}
            </p>
            <p className="text-[10px] text-[var(--color-text-muted)] mb-2">
              {config.description}
            </p>
            
            {/* Progress bar */}
            <div className="h-1.5 bg-[var(--color-bg-primary)] rounded-full overflow-hidden">
              <div
                className={`h-full ${config.progressColor} rounded-full transition-all`}
                style={{ width: `${config.progressPercent}%` }}
              />
            </div>
            
            {/* Stats */}
            {(stability !== undefined || reviewCount !== undefined) && (
              <div className="mt-2 flex items-center justify-between text-[10px] text-[var(--color-text-muted)]">
                {stability !== undefined && (
                  <span>Stability: {stability.toFixed(1)}</span>
                )}
                {reviewCount !== undefined && (
                  <span>Reviews: {reviewCount}</span>
                )}
              </div>
            )}
          </div>
          {/* Arrow */}
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-[var(--color-border)]" />
        </div>
      )}
    </div>
  );
};

/**
 * MasteryIndicator - Compact inline indicator
 */
export const MasteryIndicator: React.FC<{
  stability?: number;
  reviewCount?: number;
}> = ({ stability, reviewCount }) => {
  const level = getMasteryLevel(stability, reviewCount);
  const config = getMasteryConfig(level);

  return (
    <div
      className={`w-2 h-2 rounded-full ${config.progressColor}`}
      title={`${config.label}: ${config.description}`}
    />
  );
};

export default MasteryBadge;
