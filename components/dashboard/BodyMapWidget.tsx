/**
 * BodyMapWidget - Organ system mastery visualization on SVG body outline
 *
 * Residency Cockpit: Maps UserRolling360Stats.systemStats to body regions.
 * Semantic colors: Mastery (>80%) emerald, Passing (60-79%) amber,
 * Critical (<60%) rose, No data slate. Tooltip shows accuracy % and
 * questions remaining to master. Click deep-links to system drill.
 */

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { getSystemAbbreviation } from '@/lib/constants/blueprint';
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

const MASTERY_THRESHOLD = 80;
const PASSING_THRESHOLD = 60;
const MIN_QS_FOR_MASTERY = 20;

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

/**
 * Convert a system name to its region key (abbreviation) used in SYSTEM_TO_REGION.
 * Falls back to the input if no mapping found.
 */
function getRegionKey(system: string): string {
  const abbreviation = getSystemAbbreviation(system);
  // If abbreviation exists as a key in SYSTEM_TO_REGION, use it
  if (SYSTEM_TO_REGION[abbreviation]) {
    return abbreviation;
  }
  // If the system itself is a key, use it
  if (SYSTEM_TO_REGION[system]) {
    return system;
  }
  // Otherwise return the abbreviation (or original) for potential future regions
  return abbreviation;
}

type MasteryLevel = 'mastery' | 'passing' | 'critical' | 'nodata';

function getMasteryLevel(accuracy: number, total: number): MasteryLevel {
  if (total < 2) return 'nodata';
  if (accuracy >= MASTERY_THRESHOLD) return 'mastery';
  if (accuracy >= PASSING_THRESHOLD) return 'passing';
  return 'critical';
}

function getRegionColor(level: MasteryLevel): string {
  switch (level) {
    case 'mastery':
      return 'var(--color-data-pass)'; // emerald
    case 'passing':
      return 'var(--color-data-provisional)'; // amber
    case 'critical':
      return 'var(--color-data-fail)'; // rose
    default:
      return 'var(--color-bg-tertiary)'; // slate-700 equivalent
  }
}

function questionsToMaster(total: number, correct: number): number {
  if (total >= MIN_QS_FOR_MASTERY && (correct / total) * 100 >= MASTERY_THRESHOLD) return 0;
  const needed = Math.ceil((MASTERY_THRESHOLD / 100) * MIN_QS_FOR_MASTERY);
  return Math.max(0, needed - correct);
}

export function BodyMapWidget({
  systemStats,
  weakestSystems,
  onSystemClick,
  className = '',
}: BodyMapWidgetProps) {
  const weakestSet = new Set(weakestSystems);
  const systemsWithData = Object.entries(systemStats).filter(([, s]) => s.total >= 2);
  const [hoveredSystem, setHoveredSystem] = useState<string | null>(null);

  return (
    <div className={className}>
      <div className="relative w-full max-w-[280px] mx-auto">
        <svg viewBox="0 0 100 100" className="w-full h-auto" style={{ minHeight: 200 }}>
          {/* Simple body outline (front view silhouette) */}
          <ellipse
            cx="50"
            cy="15"
            rx="12"
            ry="8"
            fill="var(--color-bg-tertiary)"
            stroke="var(--color-border)"
            strokeWidth="1"
          />
          <ellipse
            cx="50"
            cy="32"
            rx="18"
            ry="14"
            fill="var(--color-bg-tertiary)"
            stroke="var(--color-border)"
            strokeWidth="1"
          />
          <ellipse
            cx="50"
            cy="55"
            rx="16"
            ry="18"
            fill="var(--color-bg-tertiary)"
            stroke="var(--color-border)"
            strokeWidth="1"
          />
          <rect
            x="42"
            y="68"
            width="16"
            height="20"
            rx="4"
            fill="var(--color-bg-tertiary)"
            stroke="var(--color-border)"
            strokeWidth="1"
          />

          {/* System region dots with tooltips */}
          {systemsWithData.map(([system, stats]) => {
            const regionKey = getRegionKey(system);
            const region = SYSTEM_TO_REGION[regionKey];
            if (!region) return null;
            const isWeak = weakestSet.has(system);
            const level = getMasteryLevel(stats.accuracy, stats.total);
            const color = getRegionColor(level);
            const toMaster = questionsToMaster(stats.total, stats.correct);
            const tooltip =
              level === 'nodata'
                ? `${system}: No data yet`
                : `${system}: ${stats.accuracy.toFixed(0)}% · ${stats.correct}/${stats.total} correct${toMaster > 0 ? ` · ~${toMaster} more to master` : ' (mastered)'}`;

            return (
              <motion.g
                key={system}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3 }}
                onMouseEnter={() => setHoveredSystem(system)}
                onMouseLeave={() => setHoveredSystem(null)}
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
                <title>{tooltip}</title>
                <text
                  x={region.cx}
                  y={region.cy + 0.5}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize="5"
                  fill="var(--color-text-primary)"
                  fontWeight={isWeak ? 600 : 400}
                  pointerEvents="none"
                >
                  {region.label}
                </text>
              </motion.g>
            );
          })}
        </svg>

        {/* Hover tooltip (accessibility + mobile) */}
        {hoveredSystem && systemStats[hoveredSystem] && (
          <div
            className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1.5 rounded-lg bg-data-neutral text-data-neutral text-xs shadow-lg z-10 max-w-[200px] text-center"
            role="tooltip"
          >
            {(() => {
              const s = systemStats[hoveredSystem];
              const toMaster = questionsToMaster(s.total, s.correct);
              return (
                <>
                  <strong>{hoveredSystem}</strong>: {s.accuracy.toFixed(0)}% ({s.correct}/{s.total})
                  {toMaster > 0 ? (
                    <span className="block text-data-neutral mt-0.5">~{toMaster} more to master</span>
                  ) : null}
                </>
              );
            })()}
          </div>
        )}

        <div className="flex flex-wrap justify-center gap-3 mt-2 text-xs text-[var(--color-text-muted)]">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-data-pass" /> Mastery
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-data-provisional" /> Passing
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-[var(--color-data-fail)]/100" /> Weak
          </span>
        </div>
      </div>
    </div>
  );
}
