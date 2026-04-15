'use client';

import React, { useMemo } from 'react';
import { motion, type Variants } from 'framer-motion';
import { HelpCircle } from 'lucide-react';
import { useReducedMotion } from '@/hooks/useReducedMotion';

interface BlueprintProgressProps {
  /** Actual questions answered per system */
  systemCounts: Record<string, number>;
  /** NCCPA target weights (e.g. { CV: 0.13, PULM: 0.10, ... }) */
  targetWeights: Record<string, number>;
  /** Total questions answered */
  totalAnswered: number;
  className?: string;
}

/** Display names for NCCPA PANCE systems */
const SYSTEM_LABELS: Record<string, string> = {
  CV: 'Cardiovascular',
  PULM: 'Pulmonary',
  MSK: 'Musculoskeletal',
  GI: 'Gastrointestinal',
  HEENT: 'Head/Neck/ENT',
  REPRO: 'Reproductive',
  NEURO: 'Neurology',
  PSYCH: 'Psychiatry',
  ENDO: 'Endocrinology',
  DERM: 'Dermatology',
  GU: 'Genitourinary',
  HEME: 'Hematology',
  ID: 'Infectious Disease',
  RENAL: 'Renal',
  EMERGENCY: 'Emergency Medicine',
};

/** NCCPA 2025 PANCE blueprint weights */
const NCCPA_WEIGHTS: Record<string, number> = {
  CV: 0.13,
  PULM: 0.10,
  MSK: 0.10,
  GI: 0.09,
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
  EMERGENCY: 0.02,
};

/**
 * Determines the color status of a progress bar based on how closely
 * actual performance matches the target.
 * - Green: within ±3%
 * - Amber: within ±6%
 * - Red: further than ±6%
 */
function getStatusColor(actualPercent: number, targetPercent: number): 'pass' | 'provisional' | 'fail' {
  const diff = Math.abs(actualPercent - targetPercent);
  if (diff <= 3) return 'pass';
  if (diff <= 6) return 'provisional';
  return 'fail';
}

/**
 * Calculates the weighted average alignment across all systems
 */
function calculateOverallAlignment(
  systemCounts: Record<string, number>,
  targetWeights: Record<string, number>,
  totalAnswered: number
): number {
  if (totalAnswered === 0) return 0;

  let totalAlignment = 0;
  const systems = Object.keys(targetWeights).sort(
    (a, b) => (targetWeights[b] || 0) - (targetWeights[a] || 0)
  );

  for (const system of systems) {
    const target = targetWeights[system] || 0;
    const actual = (systemCounts[system] || 0) / totalAnswered;
    const diff = Math.abs(actual - target);
    // Alignment = how close we are to target (1.0 = perfect, 0.0 = very off)
    // Use exponential decay to penalize larger deviations
    const alignment = Math.max(0, 1 - diff / 0.15); // 15% difference = 0 alignment
    totalAlignment += alignment * target;
  }

  return Math.round(totalAlignment * 100);
}

export function BlueprintProgressBar({
  systemCounts,
  targetWeights,
  totalAnswered,
  className = '',
}: BlueprintProgressProps) {
  const prefersReducedMotion = useReducedMotion();

  // Sort systems by target weight descending
  const sortedSystems = useMemo(
    () =>
      Object.keys(targetWeights).sort(
        (a, b) => (targetWeights[b] || 0) - (targetWeights[a] || 0)
      ),
    [targetWeights]
  );

  // Calculate overall alignment
  const overallAlignment = useMemo(
    () => calculateOverallAlignment(systemCounts, targetWeights, totalAnswered),
    [systemCounts, targetWeights, totalAnswered]
  );

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.03, delayChildren: 0 },
    },
  } satisfies Variants;

  const itemVariants = {
    hidden: { opacity: 0, y: 8 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.3, ease: 'easeOut' } },
  } satisfies Variants;

  return (
    <div
      className={`rounded-lg p-5 ${className}`}
      style={{ backgroundColor: 'var(--color-bg-secondary)' }}
    >
      {/* Header */}
      <div className="mb-5 flex items-center gap-2">
        <h3
          className="text-sm font-semibold"
          style={{ color: 'var(--color-text-primary)' }}
        >
          PANCE Blueprint Coverage
        </h3>
        <div className="group relative">
          <HelpCircle
            size={16}
            style={{ color: 'var(--color-text-secondary)' }}
            className="cursor-help"
            aria-hidden="true"
          />
          <div
            className="pointer-events-none absolute left-0 top-6 w-48 rounded bg-black/80 px-3 py-2 text-xs text-[var(--color-text-inverse)] opacity-0 transition-opacity group-hover:opacity-100 group-hover:pointer-events-auto"
            style={{ backgroundColor: 'rgba(0, 0, 0, 0.8)' }}
          >
            Shows how your study distribution aligns with the official NCCPA PANCE blueprint.
            Green = on target, amber = close, red = needs focus.
          </div>
        </div>
      </div>

      {/* Progress bars */}
      <motion.div
        className="space-y-3"
        variants={containerVariants}
        initial={prefersReducedMotion ? 'visible' : 'hidden'}
        animate="visible"
      >
        {sortedSystems.map((system) => {
          const targetPercent = (targetWeights[system] || 0) * 100;
          const actualCount = systemCounts[system] || 0;
          const actualPercent = totalAnswered > 0 ? (actualCount / totalAnswered) * 100 : 0;
          const status = getStatusColor(actualPercent, targetPercent);
          const displayName = SYSTEM_LABELS[system] || system;

          // Determine bar fill color based on status
          let barColor = 'var(--color-data-pass)';
          if (status === 'provisional') barColor = 'var(--color-data-provisional)';
          if (status === 'fail') barColor = 'var(--color-data-fail)';

          const targetCount = Math.round((targetPercent / 100) * totalAnswered);

          return (
            <motion.div
              key={system}
              variants={itemVariants}
              className="flex items-center gap-3"
            >
              {/* System label */}
              <div className="w-12 flex-shrink-0">
                <span
                  className="text-xs font-semibold"
                  style={{ color: 'var(--color-text-primary)' }}
                >
                  {system}
                </span>
              </div>

              {/* Progress bar container */}
              <div className="flex-1">
                  <div
                    className="relative h-5 overflow-hidden rounded-sm border border-opacity-20"
                    style={{
                      backgroundColor: 'var(--color-bg-tertiary)',
                      borderColor: 'var(--color-text-muted)',
                    }}
                  >
                  {/* Filled bar */}
                  <motion.div
                    className="h-full"
                    style={{ backgroundColor: barColor, transformOrigin: 'left' }}
                    initial={{ scaleX: 0 }}
                    animate={{ scaleX: Math.min(actualPercent / 100, 1) }}
                    transition={{ duration: 0.6, ease: 'easeOut' }}
                  />

                  {/* Target marker */}
                  {targetPercent > 0 && (
                    <div
                      className="absolute top-0 bottom-0 w-0.5 opacity-60"
                      style={{
                        left: `${Math.min(targetPercent, 100)}%`,
                        backgroundColor: 'var(--color-accent)',
                      }}
                    />
                  )}
                </div>
              </div>

              {/* Fraction text */}
              <div className="w-14 flex-shrink-0 text-right">
                <span
                  className="text-xs font-medium"
                  style={{ color: 'var(--color-text-secondary)' }}
                >
                  <span className="tabular-nums">{actualCount}/{targetCount}</span>
                </span>
              </div>
            </motion.div>
          );
        })}
      </motion.div>

      {/* Overall alignment summary */}
      <div
        className="mt-5 border-t border-opacity-20 pt-4"
        style={{ borderColor: 'var(--color-text-muted)' }}
      >
        <div className="flex items-center justify-between">
          <span
            className="text-xs font-medium"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            Overall alignment:
          </span>
          <motion.span
            className="text-sm font-semibold tabular-nums"
            style={{ color: 'var(--color-accent)' }}
            initial={prefersReducedMotion ? false : { opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.8, ease: 'easeOut' }}
          >
            {overallAlignment}%
          </motion.span>
        </div>
      </div>

      {/* No data state */}
      {totalAnswered === 0 && (
        <div
          className="mt-4 text-center text-xs"
          style={{ color: 'var(--color-text-muted)' }}
        >
          Complete questions to see blueprint coverage data
        </div>
      )}
    </div>
  );
}
