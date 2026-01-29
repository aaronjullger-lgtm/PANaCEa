import React from 'react';

interface ProgressRingProps {
  score: number;
  size?: number;
  strokeWidth?: number;
}

const ProgressRing: React.FC<ProgressRingProps> = ({ score, size = 120, strokeWidth = 10 }) => {
  const normalizedScore = Math.max(0, Math.min(100, score));
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (normalizedScore / 100) * circumference;

  const getScoreColor = () => {
    if (normalizedScore < 50) return 'text-amber-600';
    if (normalizedScore < 75) return 'text-blue-600';
    return 'text-emerald-600';
  };

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg className="transform -rotate-90" width={size} height={size}>
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
      <div className="absolute inset-0 flex items-center justify-center">
        <span className={`text-3xl font-bold ${getScoreColor()}`}>
          {Math.round(normalizedScore)}%
        </span>
      </div>
    </div>
  );
};

export default ProgressRing;
