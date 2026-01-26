/**
 * SystemTriageHeatmap.tsx
 *
 * A "Clinical Triage" visualization that replaces the unreadable 14-point
 * spider chart with an instant-triage view.
 *
 * Features:
 * - Tile size = NCCPA Blueprint weight (Cardio largest at 11%)
 * - Color = Performance status (Red/Yellow/Green/Blue)
 * - Pulsing animation for critical systems
 * - Sorted "Pill List" alternative for mobile
 */

import { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../../../lib/utils';
import NCCPA_BLUEPRINT from '../../../lib/nccpa-blueprint';

// =============================================================================
// TYPES
// =============================================================================

interface SystemStats {
  total: number;
  correct: number;
  accuracy: number;
}

interface SystemTriageHeatmapProps {
  systemStats: Record<string, SystemStats>;
  variant?: 'heatmap' | 'pillList';
  className?: string;
  onSystemClick?: (system: string) => void;
}

type TriageStatus = 'critical' | 'at_risk' | 'stable' | 'mastered';

interface TriageCell {
  system: string;
  displayName: string;
  accuracy: number;
  weight: number;
  status: TriageStatus;
  total: number;
}

// =============================================================================
// CONSTANTS
// =============================================================================

// Clinical Triage Color Scheme
const STATUS_CONFIG: Record<
  TriageStatus,
  {
    bg: string;
    border: string;
    text: string;
    label: string;
    emoji: string;
    pulse: boolean;
  }
> = {
  critical: {
    bg: 'bg-data-fail/20',
    border: 'border-data-fail',
    text: 'text-data-fail',
    label: 'Needs CPR',
    emoji: '🔴',
    pulse: true,
  },
  at_risk: {
    bg: 'bg-data-provisional/20',
    border: 'border-data-provisional',
    text: 'text-data-provisional',
    label: 'Unstable',
    emoji: '🟡',
    pulse: false,
  },
  stable: {
    bg: 'bg-data-pass/20',
    border: 'border-data-pass',
    text: 'text-data-pass',
    label: 'Stable',
    emoji: '🟢',
    pulse: false,
  },
  mastered: {
    bg: 'bg-sky-500/20 dark:bg-sky-500/30',
    border: 'border-sky-500',
    text: 'text-sky-500 dark:text-sky-400',
    label: 'Discharge Ready',
    emoji: '🔵',
    pulse: false,
  },
};

// System display names mapping
const SYSTEM_DISPLAY_NAMES: Record<string, string> = {
  CV: 'Cardiovascular',
  PULM: 'Pulmonary',
  GI: 'Gastrointestinal',
  MSK: 'Musculoskeletal',
  HEENT: 'HEENT',
  REPRO: 'Reproductive',
  NEURO: 'Neurological',
  PSYCH: 'Psychiatry',
  ENDO: 'Endocrine',
  DERM: 'Dermatology',
  GU: 'Genitourinary',
  HEME: 'Hematology',
  ID: 'Infectious Disease',
  RENAL: 'Renal',
};

// =============================================================================
// HELPERS
// =============================================================================

function getTriageStatus(accuracy: number): TriageStatus {
  if (accuracy < 60) return 'critical';
  if (accuracy < 75) return 'at_risk';
  if (accuracy < 90) return 'stable';
  return 'mastered';
}

function getTileSize(weight: number): string {
  // Map weight to relative tile size
  if (weight >= 0.1) return 'col-span-2 row-span-2'; // XL (Cardio)
  if (weight >= 0.08) return 'col-span-2'; // L (Pulm, GI, MSK, HEENT, Repro)
  if (weight >= 0.06) return 'col-span-1'; // M (Neuro, Psych, Endo)
  return 'col-span-1'; // S/XS (Derm, GU, Heme, ID, Renal)
}

// =============================================================================
// PILL LIST COMPONENT
// =============================================================================

function TriagePillList({
  cells,
  onSystemClick,
}: {
  cells: TriageCell[];
  onSystemClick?: (system: string) => void;
}) {
  // Sort by accuracy (worst first)
  const sortedCells = [...cells].sort((a, b) => a.accuracy - b.accuracy);

  return (
    <div className="space-y-2">
      <AnimatePresence mode="popLayout">
        {sortedCells.map((cell, index) => {
          const config = STATUS_CONFIG[cell.status];

          return (
            <motion.button
              key={cell.system}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ delay: index * 0.05 }}
              onClick={() => onSystemClick?.(cell.system)}
              className={cn(
                'w-full flex items-center gap-3 p-3 rounded-lg border',
                'hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors',
                config.bg,
                config.border
              )}
            >
              {/* Status Emoji */}
              <span className="text-lg">{config.emoji}</span>

              {/* System Name */}
              <span className="flex-1 text-left font-medium text-slate-900 dark:text-white">
                {cell.displayName}
              </span>

              {/* Accuracy */}
              <span className={cn('font-bold tabular-nums', config.text)}>
                {cell.accuracy.toFixed(0)}%
              </span>

              {/* Progress Bar */}
              <div className="w-20 h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${cell.accuracy}%` }}
                  transition={{ duration: 0.5, delay: index * 0.05 }}
                  className={cn(
                    'h-full rounded-full',
                    config.bg.replace('/20', '').replace('/30', '')
                  )}
                />
              </div>

              {/* Blueprint Weight */}
              <span className="text-xs text-slate-500 dark:text-slate-400 w-10 text-right">
                {(cell.weight * 100).toFixed(0)}%
              </span>
            </motion.button>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

// =============================================================================
// HEATMAP TILE COMPONENT
// =============================================================================

function TriageTile({ cell, onClick }: { cell: TriageCell; onClick?: () => void }) {
  const config = STATUS_CONFIG[cell.status];
  const sizeClass = getTileSize(cell.weight);

  return (
    <motion.button
      onClick={onClick}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      className={cn(
        'relative p-3 rounded-xl border-2 transition-all',
        'hover:shadow-lg cursor-pointer',
        config.bg,
        config.border,
        sizeClass,
        config.pulse && 'animate-pulse'
      )}
    >
      {/* System Name */}
      <div className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wide">
        {cell.displayName}
      </div>

      {/* Blueprint Weight */}
      <div className="text-[10px] text-slate-500 dark:text-slate-400">
        {(cell.weight * 100).toFixed(0)}% of exam
      </div>

      {/* Accuracy - Hero Number */}
      <div className={cn('text-2xl font-black mt-1', config.text)}>{cell.accuracy.toFixed(0)}%</div>

      {/* Progress Bar */}
      <div className="w-full h-1.5 bg-slate-300 dark:bg-slate-600 rounded-full mt-2 overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${cell.accuracy}%` }}
          transition={{ duration: 0.8 }}
          className={cn('h-full rounded-full', config.bg.replace('/20', '').replace('/30', ''))}
        />
      </div>

      {/* Status Label */}
      <div className={cn('text-[10px] mt-1', config.text)}>{config.label}</div>

      {/* Question Count Badge */}
      {cell.total > 0 && (
        <div className="absolute top-2 right-2 text-[9px] bg-white/80 dark:bg-slate-800/80 rounded px-1.5 py-0.5 text-slate-600 dark:text-slate-300">
          n={cell.total}
        </div>
      )}
    </motion.button>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function SystemTriageHeatmap({
  systemStats,
  variant = 'heatmap',
  className,
  onSystemClick,
}: SystemTriageHeatmapProps) {
  // Transform data into triage cells
  const cells = useMemo<TriageCell[]>(() => {
    const result: TriageCell[] = [];

    // Use NCCPA Blueprint weights
    const blueprintWeights = NCCPA_BLUEPRINT || {
      CV: 0.11,
      PULM: 0.09,
      GI: 0.09,
      MSK: 0.09,
      HEENT: 0.08,
      REPRO: 0.08,
      NEURO: 0.07,
      PSYCH: 0.07,
      ENDO: 0.06,
      DERM: 0.05,
      GU: 0.05,
      HEME: 0.04,
      ID: 0.04,
      RENAL: 0.04,
    };

    for (const [system, weight] of Object.entries(blueprintWeights)) {
      const stats = systemStats[system] || { total: 0, correct: 0, accuracy: 0 };
      const accuracy = stats.total > 0 ? stats.accuracy : 0;

      result.push({
        system,
        displayName: SYSTEM_DISPLAY_NAMES[system] || system,
        accuracy,
        weight: weight as number,
        status: stats.total > 0 ? getTriageStatus(accuracy) : 'critical',
        total: stats.total,
      });
    }

    // Sort by weight for heatmap (largest first)
    return result.sort((a, b) => b.weight - a.weight);
  }, [systemStats]);

  // Count by status for summary
  const statusCounts = useMemo(() => {
    return cells.reduce(
      (acc, cell) => {
        acc[cell.status] = (acc[cell.status] || 0) + 1;
        return acc;
      },
      {} as Record<TriageStatus, number>
    );
  }, [cells]);

  if (variant === 'pillList') {
    return (
      <div className={cn('', className)}>
        {/* Summary Header */}
        <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-200 dark:border-slate-700">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
            System Triage
          </h3>
          <div className="flex gap-3 text-xs">
            {statusCounts.critical > 0 && (
              <span className="text-red-500">🔴 {statusCounts.critical}</span>
            )}
            {statusCounts.at_risk > 0 && (
              <span className="text-amber-500">🟡 {statusCounts.at_risk}</span>
            )}
            {statusCounts.stable > 0 && (
              <span className="text-green-500">🟢 {statusCounts.stable}</span>
            )}
            {statusCounts.mastered > 0 && (
              <span className="text-sky-500">🔵 {statusCounts.mastered}</span>
            )}
          </div>
        </div>

        <TriagePillList cells={cells} onSystemClick={onSystemClick} />
      </div>
    );
  }

  return (
    <div className={cn('', className)}>
      {/* Summary Header */}
      <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-200 dark:border-slate-700">
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
          PANCE System Triage
        </h3>
        <div className="flex gap-3 text-xs">
          {statusCounts.critical > 0 && (
            <span className="text-red-500 font-medium">🔴 {statusCounts.critical} Critical</span>
          )}
          {statusCounts.at_risk > 0 && (
            <span className="text-amber-500 font-medium">🟡 {statusCounts.at_risk} At Risk</span>
          )}
          {statusCounts.stable > 0 && (
            <span className="text-green-500 font-medium">🟢 {statusCounts.stable} Stable</span>
          )}
          {statusCounts.mastered > 0 && (
            <span className="text-sky-500 font-medium">🔵 {statusCounts.mastered} Mastered</span>
          )}
        </div>
      </div>

      {/* Heatmap Grid */}
      <div className="grid grid-cols-4 gap-2 auto-rows-fr">
        {cells.map((cell) => (
          <TriageTile key={cell.system} cell={cell} onClick={() => onSystemClick?.(cell.system)} />
        ))}
      </div>

      {/* Legend */}
      <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-700">
        <div className="flex flex-wrap justify-center gap-4 text-xs text-slate-500 dark:text-slate-400">
          <span>🔴 &lt;60% Critical</span>
          <span>🟡 60-75% At Risk</span>
          <span>🟢 75-90% Stable</span>
          <span>🔵 &gt;90% Mastered</span>
        </div>
      </div>
    </div>
  );
}

export default SystemTriageHeatmap;
