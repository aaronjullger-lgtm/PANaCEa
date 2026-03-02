/**
 * MasteryRing Component
 * 
 * Renders FSRS retrievability as a dynamic SVG ring.
 * retrievability 0.875 → 87.5% filled ring with color gradient.
 */

import React from 'react';

interface MasteryRingProps {
  retrievability: number; // 0.0 - 1.0
  size?: number;
  strokeWidth?: number;
}

export function MasteryRing({ 
  retrievability, 
  size = 48, 
  strokeWidth = 4 
}: MasteryRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.max(0, Math.min(1, retrievability));
  const offset = circumference * (1 - progress);

  // Color gradient based on retrievability
  const color = 
    progress >= 0.9 ? 'stroke-emerald-500' :
    progress >= 0.7 ? 'stroke-blue-500' :
    progress >= 0.5 ? 'stroke-yellow-500' :
    'stroke-red-500';

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={size} height={size} className="transform -rotate-90">
        {/* Background ring */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          className="stroke-slate-800"
          strokeWidth={strokeWidth}
          fill="none"
        />
        {/* Progress ring */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          className={color}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.5s ease' }}
        />
      </svg>
      {/* Center percentage */}
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-xs font-semibold text-slate-100">
          {Math.round(progress * 100)}%
        </span>
      </div>
    </div>
  );
}

// Debounced search bar for Clinical Library
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = React.useState(value);

  React.useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);

  return debouncedValue;
}
