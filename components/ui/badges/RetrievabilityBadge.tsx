import React from 'react';
import { Brain, TrendingUp, TrendingDown, AlertCircle } from 'lucide-react';

interface RetrievabilityBadgeProps {
  /** Retrievability percentage (0-100) */
  retrievability: number | null | undefined;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
  /** Show percentage as integer (default true) */
  showPercentage?: boolean;
  /** Tooltip text (defaults to explanation) */
  tooltip?: string;
}

/**
 * RetrievabilityBadge - Displays retrievability percentage with color coding
 *
 * Color coding:
 * - Green (>=80%): High retrievability
 * - Yellow (50-79%): Moderate retrievability
 * - Red (<50%): Low retrievability
 * - Gray: No data (null/undefined)
 *
 * Uses semantic design tokens (Stormy Slate palette).
 */
export const RetrievabilityBadge: React.FC<RetrievabilityBadgeProps> = ({
  retrievability,
  className = '',
  size = 'md',
  showIcon = true,
  showPercentage = true,
  tooltip,
}) => {
  if (retrievability === null || retrievability === undefined) {
    // No retrievability data
    return (
      <div
        className={`
          inline-flex items-center ${getSizeClasses(size)} rounded-lg font-medium
          bg-[var(--color-bg-secondary)] text-[var(--color-text-muted)]
          border border-[var(--color-border)]/30
          ${className}
        `}
        title="Retrievability not available (not reviewed yet)"
      >
        {showIcon && <AlertCircle className={getIconSize(size)} />}
        <span>No data</span>
      </div>
    );
  }

  const clamped = Math.max(0, Math.min(100, retrievability));
  const { level, bgClass, textClass, borderClass, icon: Icon } = getRetrievabilityStyle(clamped);

  const displayText = showPercentage ? `${Math.round(clamped)}%` : level;

  const defaultTooltip =
    level === 'high'
      ? 'High retrievability: You are likely to recall this condition.'
      : level === 'moderate'
      ? 'Moderate retrievability: Review may be beneficial soon.'
      : 'Low retrievability: Consider reviewing this condition.';

  return (
    <div
      className={`
        inline-flex items-center ${getSizeClasses(size)} rounded-lg font-medium
        ${bgClass} ${textClass} ${borderClass}
        border transition-all duration-200
        hover:scale-105 hover:shadow-lg
        ${className}
      `}
      title={tooltip || defaultTooltip}
      aria-label={`Retrievability: ${displayText}`}
    >
      {showIcon && <Icon className={getIconSize(size)} />}
      <span>{displayText}</span>
    </div>
  );
};

function getSizeClasses(size: 'sm' | 'md' | 'lg') {
  switch (size) {
    case 'sm':
      return 'px-2 py-0.5 text-xs gap-1';
    case 'md':
      return 'px-3 py-1 text-sm gap-1.5';
    case 'lg':
      return 'px-4 py-1.5 text-base gap-2';
  }
}

function getIconSize(size: 'sm' | 'md' | 'lg') {
  switch (size) {
    case 'sm':
      return 'w-3 h-3';
    case 'md':
      return 'w-4 h-4';
    case 'lg':
      return 'w-5 h-5';
  }
}

function getRetrievabilityStyle(retrievability: number) {
  let level: 'high' | 'moderate' | 'low';
  let bgClass: string;
  let textClass: string;
  let borderClass: string;
  let icon: React.ComponentType<{ className?: string }>;

  if (retrievability >= 80) {
    level = 'high';
    bgClass = 'bg-data-pass/10';
    textClass = 'text-data-pass';
    borderClass = 'border-data-pass/20';
    icon = TrendingUp;
  } else if (retrievability >= 50) {
    level = 'moderate';
    bgClass = 'bg-data-provisional/10';
    textClass = 'text-data-provisional';
    borderClass = 'border-data-provisional/20';
    icon = Brain;
  } else {
    level = 'low';
    bgClass = 'bg-data-fail/10';
    textClass = 'text-data-fail';
    borderClass = 'border-data-fail/20';
    icon = TrendingDown;
  }

  return { level, bgClass, textClass, borderClass, icon };
}