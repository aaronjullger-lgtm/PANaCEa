/**
 * RadialProgress Component
 *
 * Circular progress indicator with customizable colors and animations.
 * Perfect for displaying accuracy, completion percentages, or any metric 0-100%.
 *
 * When color is left as default (accent), uses a color-blind-safe traffic-light scale:
 * - &gt; 80%: Teal (mastery)
 * - 60–80%: Blue (building)
 * - &lt; 60%: Amber (warning/keep trying). Red is never used for "low" progress.
 */

import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { getAccuracyHex } from '../../lib/accuracyColorUtils';

export interface RadialProgressProps {
  /** Progress value (0-100) */
  value: number;
  /** Size of the circle in pixels */
  size?: number;
  /** Thickness of the progress ring */
  strokeWidth?: number;
  /** Color of the progress ring */
  color?: string;
  /** Background color of the track */
  trackColor?: string;
  /** Show percentage text in center */
  showValue?: boolean;
  /** Custom label below the percentage */
  label?: string;
  /** Animation duration in seconds */
  animationDuration?: number;
  /** Additional CSS classes */
  className?: string;
  /** ARIA label for accessibility */
  ariaLabel?: string;
}

export const RadialProgress: React.FC<RadialProgressProps> = ({
  value,
  size = 120,
  strokeWidth = 8,
  color = 'var(--color-accent)',
  trackColor = 'var(--color-bg-secondary)',
  showValue = true,
  label,
  animationDuration = 1,
  className = '',
  ariaLabel,
}) => {
  // Clamp value between 0 and 100
  const clampedValue = Math.max(0, Math.min(100, value));

  // Memoize calculations for performance
  const { radius, circumference, offset, progressColor, fontSize } = useMemo(() => {
    const r = (size - strokeWidth) / 2;
    const circ = 2 * Math.PI * r;
    const off = circ - (clampedValue / 100) * circ;

    // Traffic-light system for accuracy/progress (color-blind safe; never red for "low" metric)
    const pColor =
      color === 'var(--color-accent)' && value !== undefined ? getAccuracyHex(value) : color;

    // Responsive font size based on circle size
    const fs = size < 80 ? 'text-sm' : size < 120 ? 'text-xl' : 'text-2xl';

    return { radius: r, circumference: circ, offset: off, progressColor: pColor, fontSize: fs };
  }, [size, strokeWidth, clampedValue, value, color]);

  return (
    <div
      className={`inline-flex flex-col items-center gap-2 ${className}`}
      role="progressbar"
      aria-valuenow={clampedValue}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={ariaLabel || `${label || 'Progress'}: ${clampedValue}%`}
    >
      <svg width={size} height={size} className="transform -rotate-90" aria-hidden="true">
        {/* Background track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={trackColor}
          strokeWidth={strokeWidth}
          className="opacity-30"
        />

        {/* Progress ring */}
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={progressColor}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{
            duration: animationDuration,
            ease: 'easeOut',
          }}
        />

        {/* Center value text */}
        {showValue && (
          <text
            x={size / 2}
            y={size / 2}
            textAnchor="middle"
            dominantBaseline="central"
            className={`${fontSize} font-bold fill-current text-[var(--color-text-primary)]`}
            style={{ transform: 'rotate(90deg)', transformOrigin: `${size / 2}px ${size / 2}px` }}
          >
            {Math.round(clampedValue)}%
          </text>
        )}
      </svg>

      {/* Optional label */}
      {label && <span className="text-xs text-[var(--color-text-muted)] font-medium">{label}</span>}
    </div>
  );
};

/**
 * Compact variant for inline use
 */
export const RadialProgressCompact: React.FC<
  Omit<RadialProgressProps, 'size' | 'showValue' | 'label'>
> = (props) => {
  return <RadialProgress {...props} size={60} strokeWidth={6} showValue={true} />;
};

/**
 * Multiple radial progress rings for comparison
 */
export interface MultiRadialProgressProps {
  items: Array<{
    value: number;
    label: string;
    color?: string;
  }>;
  size?: number;
  className?: string;
}

export const MultiRadialProgress: React.FC<MultiRadialProgressProps> = ({
  items,
  size = 100,
  className = '',
}) => {
  return (
    <div className={`flex items-center gap-4 ${className}`}>
      {items.map((item, index) => (
        <RadialProgress
          key={index}
          value={item.value}
          label={item.label}
          color={item.color}
          size={size}
        />
      ))}
    </div>
  );
};

export default RadialProgress;
