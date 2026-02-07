import React from 'react';
import { Star, TrendingUp, Minus, Flame } from 'lucide-react';

interface YieldBadgeProps {
  yield: number | string | null | undefined;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
}

/**
 * YieldBadge - Displays PANCE yield score with color coding
 *
 * Supports both numeric (1-3) and text ('HIGH', 'MEDIUM', 'LOW') formats.
 * Uses clinical color coding: red for high yield, amber for medium, gray for low.
 */
export const YieldBadge: React.FC<YieldBadgeProps> = ({
  yield: yieldValue,
  className = '',
  size = 'md',
  showIcon = true,
}) => {
  if (!yieldValue) {
    return null;
  }

  const {
    level,
    numericValue,
    displayText,
    icon: Icon,
    bgClass,
    textClass,
    borderClass,
  } = parseYieldValue(yieldValue);

  const sizeClasses = {
    sm: 'px-2 py-0.5 text-xs gap-1',
    md: 'px-3 py-1 text-sm gap-1.5',
    lg: 'px-4 py-1.5 text-base gap-2',
  };

  const iconSizes = {
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
    lg: 'w-5 h-5',
  };

  return (
    <div
      className={`
        inline-flex items-center ${sizeClasses[size]} rounded-lg font-bold
        ${bgClass} ${textClass} ${borderClass}
        border transition-all duration-200
        hover:scale-105 hover:shadow-lg
        ${className}
      `}
    >
      {showIcon && <Icon className={iconSizes[size]} />}
      <span>{displayText}</span>
    </div>
  );
};

/**
 * Parse yield value and determine styling
 */
function parseYieldValue(yieldValue: number | string | null | undefined) {
  let numericValue: number | null = null;
  let level: 'high' | 'medium' | 'low' = 'low';

  // Handle numeric values (1-3 scale)
  if (typeof yieldValue === 'number') {
    numericValue = yieldValue;
    if (yieldValue >= 3) level = 'high';
    else if (yieldValue === 2) level = 'medium';
    else level = 'low';
  }
  // Handle string values
  else if (typeof yieldValue === 'string') {
    const upper = yieldValue.toUpperCase();

    // Check for text levels
    if (upper.includes('HIGH')) {
      level = 'high';
    } else if (upper.includes('MEDIUM') || upper.includes('MED')) {
      level = 'medium';
    } else if (upper.includes('LOW')) {
      level = 'low';
    }
    // Try to parse as number
    else {
      const parsed = parseInt(yieldValue);
      if (!isNaN(parsed)) {
        numericValue = parsed;
        if (parsed >= 3) level = 'high';
        else if (parsed === 2) level = 'medium';
        else level = 'low';
      }
    }
  }

  const displayText =
    level === 'high' ? 'HIGH YIELD' : level === 'medium' ? 'MEDIUM YIELD' : 'LOW YIELD';

  const configs = {
    high: {
      icon: Flame, // 🔥 for HIGH YIELD
      bgClass: 'bg-red-950/50',
      textClass: 'text-red-200',
      borderClass: 'border-red-700/60',
    },
    medium: {
      icon: TrendingUp,
      bgClass: 'bg-amber-950/50',
      textClass: 'text-amber-200',
      borderClass: 'border-amber-700/60',
    },
    low: {
      icon: Minus,
      bgClass: 'bg-slate-800/50',
      textClass: 'text-slate-400',
      borderClass: 'border-slate-600/60',
    },
  };

  return {
    level,
    numericValue,
    displayText,
    ...configs[level],
  };
}

/**
 * Compact variant - just shows star rating without text
 */
export const YieldStars: React.FC<{
  yield: number | string | null | undefined;
  className?: string;
}> = ({ yield: yieldValue, className = '' }) => {
  const { numericValue, level } = parseYieldValue(yieldValue);
  const stars = numericValue
    ? Math.max(1, Math.min(5, numericValue))
    : level === 'high'
      ? 5
      : level === 'medium'
        ? 3
        : 1;

  const colorClass =
    level === 'high' ? 'text-red-400' : level === 'medium' ? 'text-amber-400' : 'text-slate-500';

  return (
    <div className={`flex items-center gap-0.5 ${className}`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={`w-3 h-3 ${i < stars ? colorClass : 'text-slate-700'} ${i < stars ? 'fill-current' : ''}`}
        />
      ))}
    </div>
  );
};

export default YieldBadge;
