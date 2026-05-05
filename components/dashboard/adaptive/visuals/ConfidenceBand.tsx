import React from 'react';

function pointsToPath(points: number[], width: number, height: number): string {
  if (points.length === 0) return '';
  const max = 100;
  return points
    .map((point, index) => {
      const x = (index / Math.max(1, points.length - 1)) * width;
      const y = height - (point / max) * height;
      return `${index === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(' ');
}

export function ConfidenceBand({
  points,
  low,
  high,
  target,
  label,
}: {
  points: number[];
  low: number[];
  high: number[];
  target: number | null;
  label: string;
}) {
  const width = 260;
  const height = 82;
  const top = pointsToPath(high, width, height);
  const bottom = pointsToPath([...low].reverse(), width, height)
    .replace(/^M/, 'L')
    .replaceAll(' L ', ' L ');
  const targetY = target == null ? null : height - (target / 100) * height;

  return (
    <svg role="img" aria-label={label} viewBox={`0 0 ${width} ${height}`} className="h-24 w-full overflow-visible">
      <path d={`${top} ${bottom} Z`} fill="currentColor" opacity="0.12" />
      {targetY != null && (
        <path d={`M 0 ${targetY.toFixed(1)} H ${width}`} stroke="currentColor" strokeDasharray="4 5" opacity="0.45" />
      )}
      <path d={pointsToPath(points, width, height)} fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      {points.map((point, index) => {
        if (index !== 0 && index !== points.length - 1) return null;
        const x = (index / Math.max(1, points.length - 1)) * width;
        const y = height - (point / 100) * height;
        return <circle key={index} cx={x} cy={y} r="3.5" fill="currentColor" />;
      })}
    </svg>
  );
}
