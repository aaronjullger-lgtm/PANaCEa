/**
 * ConfidenceCalibrationCard — "Calibration Curve" widget
 *
 * Shows implicit confidence vs actual accuracy in binned ranges.
 * The diagonal represents perfect calibration — deviations above mean
 * underconfidence, below mean overconfidence.
 *
 * @module components/dashboard/metacognitive/ConfidenceCalibrationCard
 */

import React from 'react';
import type { ConfidenceBucket } from '@/hooks/useMetacognitiveStats';

interface Props {
  buckets: ConfidenceBucket[];
}

export const ConfidenceCalibrationCard: React.FC<Props> = ({ buckets }) => {
  if (buckets.length < 2) {
    return (
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-5">
        <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-2">Confidence Calibration</h3>
        <p className="text-sm text-[var(--color-text-muted)]">
          Need more data across confidence levels to show your calibration curve.
        </p>
      </div>
    );
  }

  // Calculate overall calibration tendency
  let overconfidentBuckets = 0;
  let underconfidentBuckets = 0;
  for (const b of buckets) {
    if (b.avgConfidence > b.actualAccuracy + 0.05) overconfidentBuckets++;
    if (b.avgConfidence < b.actualAccuracy - 0.05) underconfidentBuckets++;
  }

  let calibrationLabel: string;
  let calibrationColor: string;
  if (overconfidentBuckets > underconfidentBuckets + 1) {
    calibrationLabel = 'Slightly overconfident — your accuracy doesn\'t quite match your confidence. Focus on high-confidence misses.';
    calibrationColor = 'text-amber-500';
  } else if (underconfidentBuckets > overconfidentBuckets + 1) {
    calibrationLabel = 'Underconfident — you know more than you think. Trust your preparation.';
    calibrationColor = 'text-blue-500';
  } else {
    calibrationLabel = 'Well calibrated — your confidence closely matches your actual accuracy.';
    calibrationColor = 'text-emerald-500';
  }

  // Chart dimensions
  const W = 200;
  const H = 160;
  const PAD = 28;
  const plotW = W - PAD * 2;
  const plotH = H - PAD * 2;

  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-5">
      <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-1">Confidence Calibration</h3>
      <p className="text-xs text-[var(--color-text-muted)] mb-3">
        Implicit confidence vs actual accuracy
      </p>

      {/* SVG calibration plot */}
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-w-[240px] mx-auto mb-3">
        {/* Perfect calibration diagonal */}
        <line
          x1={PAD}
          y1={PAD + plotH}
          x2={PAD + plotW}
          y2={PAD}
          stroke="var(--color-border)"
          strokeWidth="1"
          strokeDasharray="4 3"
        />

        {/* Axes */}
        <line x1={PAD} y1={PAD + plotH} x2={PAD + plotW} y2={PAD + plotH} stroke="var(--color-border)" strokeWidth="1" />
        <line x1={PAD} y1={PAD} x2={PAD} y2={PAD + plotH} stroke="var(--color-border)" strokeWidth="1" />

        {/* Axis labels */}
        <text x={PAD + plotW / 2} y={H - 2} textAnchor="middle" fontSize="8" fill="var(--color-text-muted)">
          Confidence
        </text>
        <text x={6} y={PAD + plotH / 2} textAnchor="middle" fontSize="8" fill="var(--color-text-muted)" transform={`rotate(-90, 6, ${PAD + plotH / 2})`}>
          Accuracy
        </text>

        {/* Data points */}
        {buckets.map((b, i) => {
          const x = PAD + b.avgConfidence * plotW;
          const y = PAD + plotH - b.actualAccuracy * plotH;
          // Scale dot by sample size (min 4, max 10)
          const r = Math.min(10, Math.max(4, Math.sqrt(b.count) * 1.5));

          return (
            <g key={i}>
              <circle
                cx={x}
                cy={y}
                r={r}
                fill="var(--color-accent)"
                fillOpacity={0.7}
                stroke="var(--color-accent)"
                strokeWidth="1.5"
              />
              {/* Count label */}
              <text x={x} y={y - r - 3} textAnchor="middle" fontSize="7" fill="var(--color-text-muted)">
                n={b.count}
              </text>
            </g>
          );
        })}

        {/* 0% and 100% tick labels */}
        <text x={PAD - 2} y={PAD + plotH + 10} textAnchor="end" fontSize="7" fill="var(--color-text-muted)">0</text>
        <text x={PAD + plotW} y={PAD + plotH + 10} textAnchor="middle" fontSize="7" fill="var(--color-text-muted)">1</text>
        <text x={PAD - 4} y={PAD + 3} textAnchor="end" fontSize="7" fill="var(--color-text-muted)">1</text>
      </svg>

      {/* Insight */}
      <p className={`text-xs leading-relaxed ${calibrationColor}`}>
        {calibrationLabel}
      </p>
    </div>
  );
};

export default ConfidenceCalibrationCard;
