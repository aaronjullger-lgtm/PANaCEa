/**
 * BodyMapWidget - Organ system mastery visualization on SVG body outline
 *
 * Residency Cockpit: Maps Rolling 360 systemStats to body regions.
 * Color-coded by accuracy (green=strong, amber=developing, rose=weak).
 */

import React from 'react';
import { motion } from 'framer-motion';

export interface SystemStats {
  total: number;
  correct: number;
  accuracy: number;
}

interface BodyMapWidgetProps {
  systemStats: Record<string, SystemStats>;
  weakestSystems: string[];
  onSystemClick?: (system: string) => void;
  className?: string;
}

// Map system codes to body regions (x, y as % of SVG, approximate)
const SYSTEM_TO_REGION: Record<string, { cx: number; cy: number; r: number; label: string }> = {
  CV: { cx: 50, cy: 28, r: 12, label: 'Cardio' },
  PULM: { cx: 50, cy: 35, r: 10, label: 'Pulm' },
  GI: { cx: 50, cy: 50, r: 14, label: 'GI' },
  HEENT: { cx: 50, cy: 12, r: 8, label: 'HEENT' },
  NEURO: { cx: 50, cy: 18, r: 9, label: 'Neuro' },
  MSK: { cx: 30, cy: 55, r: 10, label: 'MSK' },
  DERM: { cx: 70, cy: 55, r: 8, label: 'Derm' },
  ENDO: { cx: 50, cy: 42, r: 8, label: 'Endo' },
  GU: { cx: 50, cy: 62, r: 8, label: 'GU' },
  RENAL: { cx: 40, cy: 55, r: 7, label: 'Renal' },
  REPRO: { cx: 60, cy: 58, r: 7, label: 'Repro' },
  HEME: { cx: 50, cy: 38, r: 6, label: 'Heme' },
  ID: { cx: 50, cy: 45, r: 7, label: 'ID' },
  PSYCH: { cx: 50, cy: 16, r: 6, label: 'Psych' },
  PRO: { cx: 50, cy: 72, r: 6, label: 'Pro' },
};

function getRegionColor(accuracy: number, isWeak: boolean): string {
  if (isWeak) return 'var(--color-data-fail)';
  if (accuracy >= 80) return 'var(--color-data-pass)';
  if (accuracy >= 60) return 'var(--color-data-provisional)';
  return 'var(--color-data-fail)';
}

export function BodyMapWidget({
  systemStats,
  weakestSystems,
  onSystemClick,
  className = '',
}: BodyMapWidgetProps) {
  const weakestSet = new Set(weakestSystems);
  const systemsWithData = Object.entries(systemStats).filter(([, s]) => s.total >= 2);

  return (
    <div className={className}>
      <div className="relative w-full max-w-[280px] mx-auto">
        <svg
          viewBox="0 0 100 100"
          className="w-full h-auto"
          style={{ minHeight: 200 }}
        >
          {/* Simple body outline (front view silhouette) */}
          <ellipse cx="50" cy="15" rx="12" ry="8" fill="var(--color-bg-tertiary)" stroke="var(--color-border)" strokeWidth="1" />
          <ellipse cx="50" cy="32" rx="18" ry="14" fill="var(--color-bg-tertiary)" stroke="var(--color-border)" strokeWidth="1" />
          <ellipse cx="50" cy="55" rx="16" ry="18" fill="var(--color-bg-tertiary)" stroke="var(--color-border)" strokeWidth="1" />
          <rect x="42" y="68" width="16" height="20" rx="4" fill="var(--color-bg-tertiary)" stroke="var(--color-border)" strokeWidth="1" />

          {/* System region dots */}
          {systemsWithData.map(([system, stats]) => {
            const region = SYSTEM_TO_REGION[system];
            if (!region) return null;
            const isWeak = weakestSet.has(system);
            const color = getRegionColor(stats.accuracy, isWeak);

            return (
              <motion.g
                key={system}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3 }}
              >
                <circle
                  cx={region.cx}
                  cy={region.cy}
                  r={region.r}
                  fill={color}
                  fillOpacity={0.75}
                  stroke={isWeak ? 'var(--color-data-fail)' : 'var(--color-border)'}
                  strokeWidth={isWeak ? 2 : 1}
                  className={onSystemClick ? 'cursor-pointer hover:opacity-90' : ''}
                  onClick={() => onSystemClick?.(system)}
                />
                <text
                  x={region.cx}
                  y={region.cy + 0.5}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize="5"
                  fill="var(--color-text-primary)"
                  fontWeight={isWeak ? 600 : 400}
                >
                  {region.label}
                </text>
              </motion.g>
            );
          })}
        </svg>
        <div className="flex flex-wrap justify-center gap-3 mt-2 text-xs text-[var(--color-text-muted)]">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-[var(--color-data-pass)]" /> Strong
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-[var(--color-data-provisional)]" /> Developing
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-[var(--color-data-fail)]" /> Weak
          </span>
        </div>
      </div>
    </div>
  );
}
