import React from 'react';

interface ProgressRingProps {
  score: number;
  size?: number;
  strokeWidth?: number;
  /**
   * Accessible name describing what this progress ring represents
   * (e.g. "PANCE readiness"). Used to build the progressbar's aria-label.
   * Defaults to a generic "Progress".
   */
  label?: string;
}

const ProgressRing: React.FC<ProgressRingProps> = ({
  score,
  size = 120,
  strokeWidth = 10,
  label,
}) => {
  const normalizedScore = Math.max(0, Math.min(100, score));
  const rounded = Math.round(normalizedScore);
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (normalizedScore / 100) * circumference;

  const getScoreColor = () => {
    if (normalizedScore < 50) return 'text-[var(--color-data-fail)]';
    if (normalizedScore < 75) return 'text-[var(--color-data-provisional)]';
    return 'text-[var(--color-data-pass)]';
  };

  const accessibleName = `${label ? `${label}: ` : ''}${rounded}%`;

  return (
    <div
      className="relative"
      style={{ width: size, height: size }}
      role="progressbar"
      aria-valuenow={rounded}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuetext={`${rounded}%`}
      aria-label={accessibleName}
    >
      {/* Decorative visuals — value is exposed via the progressbar ARIA above */}
      <svg className="transform -rotate-90" width={size} height={size} aria-hidden="true" focusable="false">
        <circle
          className="text-[var(--color-border)]"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          fill="transparent"
          r={radius}
          cx={size / 2}
          cy={size / 2}
        />
        <circle
          className={getScoreColor()}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          fill="transparent"
          r={radius}
          cx={size / 2}
          cy={size / 2}
          style={{
            strokeDasharray: circumference,
            strokeDashoffset: offset,
            transition: 'stroke-dashoffset 0.5s ease-in-out',
          }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center" aria-hidden="true">
        <span className={`text-3xl font-bold ${getScoreColor()}`}>
          {rounded}%
        </span>
      </div>
    </div>
  );
};

export default ProgressRing;
