/**
 * DrillSummaryCard — Reusable post-drill session summary
 *
 * Displays a compact performance summary at the end of any drill session.
 * Replaces duplicated inline summaries across photo-based drills and provides
 * a drop-in summary for QuizView-based drills that previously had none.
 *
 * Uses Sprint 5 primitives: Button (button.tsx), GlassCard, motion.
 *
 * @example
 * <DrillSummaryCard
 *   drillName="ECG Interpretation"
 *   icon={Activity}
 *   accentColor="var(--color-data-fail)"
 *   stats={{ correct: 8, total: 10, streak: 5, avgTimeMs: 12400 }}
 *   onNewSession={handleReset}
 *   onExit={handleExit}
 * />
 */

import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { springs, successVariants, buttonPressVariants } from '@/config/appViews';
import { RotateCcw, LogOut, Target, Zap, Clock, CheckCircle, type LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useReducedMotion } from '@/hooks/useReducedMotion';

// ============================================================================
// Types
// ============================================================================

export interface DrillSummaryStats {
  /** Number of correct answers */
  correct: number;
  /** Total questions attempted */
  total: number;
  /** Best streak of consecutive correct answers */
  streak: number;
  /** Average time per question in milliseconds (optional) */
  avgTimeMs?: number;
}

interface DrillSummaryCardProps {
  /** Name of the drill for the heading (e.g. "ECG Interpretation") */
  drillName: string;
  /** Lucide icon displayed in the header */
  icon?: LucideIcon;
  /** Accent color CSS value for the icon (e.g. a CSS var or hex) */
  accentColor?: string;
  /** Performance stats to display */
  stats: DrillSummaryStats;
  /** Called when user clicks "New Session" */
  onNewSession: () => void;
  /** Called when user clicks "Exit" */
  onExit: () => void;
  /** Label for the new-session button (default: "Start New Session") */
  newSessionLabel?: string;
  /** Label for the exit button (default: "Exit to Menu") */
  exitLabel?: string;
  /** Additional className for the outer wrapper */
  className?: string;
}

// ============================================================================
// Helpers
// ============================================================================

/** Compute accuracy percentage, clamped 0-100. */
export function computeAccuracy(correct: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((correct / total) * 100);
}

/** Format milliseconds to a human-readable string like "12.4 s" or "1:05". */
export function formatAvgTime(ms: number | undefined): string {
  if (ms === undefined || ms <= 0) return '—';
  const seconds = ms / 1000;
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/** Return a short motivational line based on accuracy. */
export function getMotivationalMessage(accuracy: number): string {
  if (accuracy >= 90) return 'Outstanding performance!';
  if (accuracy >= 75) return 'Solid work — keep building!';
  if (accuracy >= 50) return 'Good effort — review the misses!';
  return 'Keep practicing — you\'ll get there!';
}

/** Map accuracy to a semantic color token. */
function accuracyColor(accuracy: number): string {
  if (accuracy >= 80) return 'var(--color-data-pass)';
  if (accuracy >= 60) return 'var(--color-data-provisional)';
  return 'var(--color-data-fail)';
}

// ============================================================================
// Component
// ============================================================================

const DrillSummaryCard: React.FC<DrillSummaryCardProps> = ({
  drillName,
  icon: Icon,
  accentColor,
  stats,
  onNewSession,
  onExit,
  newSessionLabel = 'Start New Session',
  exitLabel = 'Exit to Menu',
  className = '',
}) => {
  const prefersReducedMotion = useReducedMotion();
  const accuracy = useMemo(() => computeAccuracy(stats.correct, stats.total), [stats.correct, stats.total]);
  const message = useMemo(() => getMotivationalMessage(accuracy), [accuracy]);
  const accColor = accuracyColor(accuracy);

  const statItems = [
    {
      label: 'Accuracy',
      value: `${accuracy}%`,
      icon: Target,
      color: accColor,
    },
    {
      label: 'Correct',
      value: `${stats.correct}/${stats.total}`,
      icon: CheckCircle,
      color: 'var(--color-data-pass)',
    },
    {
      label: 'Best Streak',
      value: String(stats.streak),
      icon: Zap,
      color: 'var(--color-accent)',
    },
    {
      label: 'Avg Time',
      value: formatAvgTime(stats.avgTimeMs),
      icon: Clock,
      color: 'var(--color-text-secondary)',
    },
  ];

  // Staggered stat card entrance
  const statCardVariants = {
    hidden: { opacity: 0, y: 16, scale: 0.9, filter: 'blur(4px)' },
    visible: (i: number) => ({
      opacity: 1,
      y: 0,
      scale: 1,
      filter: 'blur(0px)',
      transition: {
        delay: 0.3 + i * 0.1,
        ...springs.bouncy,
        opacity: { delay: 0.3 + i * 0.1, duration: 0.25 },
      },
    }),
  };

  // Icon entrance with celebratory bounce
  const iconVariants = {
    hidden: { opacity: 0, scale: 0, rotate: -20 },
    visible: {
      opacity: 1,
      scale: 1,
      rotate: 0,
      transition: {
        ...springs.bouncy,
        opacity: { duration: 0.2 },
      },
    },
  };

  return (
    <div className={`flex-1 flex items-center justify-center p-6 ${className}`}>
      <motion.div
        initial={prefersReducedMotion ? false : { scale: 0.92, filter: 'blur(8px)' }}
        animate={{ scale: 1, filter: 'blur(0px)' }}
        transition={
          prefersReducedMotion
            ? { duration: 0 }
            : { ...springs.bouncy, filter: { duration: 0.3 } }
        }
        className="w-full max-w-md"
      >
        <motion.div
          className="p-8 bg-[var(--color-bg-secondary)] rounded-2xl shadow-[0_18px_42px_var(--color-shadow-soft)] border border-[var(--color-border)] text-center"
          variants={prefersReducedMotion ? undefined : successVariants}
          initial="initial"
          animate={prefersReducedMotion ? undefined : 'celebrate'}
        >
          {/* Header icon — bouncy entrance with rotation */}
          {Icon && (
            <motion.div
              variants={prefersReducedMotion ? undefined : iconVariants}
              initial={prefersReducedMotion ? false : 'hidden'}
              animate="visible"
            >
              <Icon
                className="w-14 h-14 mx-auto mb-3"
                style={{ color: accentColor || 'var(--color-accent)' }}
                aria-hidden
              />
            </motion.div>
          )}

          {/* Title — fade up with blur */}
          <motion.h2
            className="text-2xl font-bold text-[var(--color-text-primary)] mb-1"
            initial={prefersReducedMotion ? false : { opacity: 0, y: 8, filter: 'blur(4px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            transition={prefersReducedMotion ? { duration: 0 } : { delay: 0.15, ...springs.snappy, opacity: { delay: 0.15, duration: 0.25 } }}
          >
            Session Complete
          </motion.h2>
          <motion.p
            className="text-[var(--color-text-secondary)] mb-6"
            initial={prefersReducedMotion ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={prefersReducedMotion ? { duration: 0 } : { delay: 0.22, ...springs.snappy, opacity: { delay: 0.22, duration: 0.25 } }}
          >
            {message}
          </motion.p>

          {/* Stat Grid — staggered entrance */}
          <div className="grid grid-cols-2 gap-3 mb-8">
            {statItems.map((item, i) => (
              <motion.div
                key={item.label}
                custom={i}
                variants={prefersReducedMotion ? undefined : statCardVariants}
                initial={prefersReducedMotion ? false : 'hidden'}
                animate="visible"
                className="p-3 rounded-xl bg-[var(--color-bg-tertiary)] border border-[var(--color-border)]"
              >
                <div className="flex items-center justify-center gap-1.5 mb-1">
                  <item.icon
                    className="w-4 h-4"
                    style={{ color: item.color }}
                    aria-hidden
                  />
                  <span className="text-xs font-medium text-[var(--color-text-muted)]">
                    {item.label}
                  </span>
                </div>
                <div
                  className="text-2xl font-bold tabular-nums"
                  style={{ color: item.color }}
                >
                  {item.value}
                </div>
              </motion.div>
            ))}
          </div>

          {/* Actions — staggered with button press physics */}
          <div className="flex flex-col gap-3">
            <motion.div
              initial={prefersReducedMotion ? false : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={prefersReducedMotion ? { duration: 0 } : { delay: 0.7, ...springs.snappy }}
              variants={prefersReducedMotion ? undefined : buttonPressVariants}
              whileHover="hover"
              whileTap="tap"
            >
              <Button
                variant="primary"
                size="lg"
                icon={<RotateCcw className="w-4 h-4" />}
                onClick={onNewSession}
                className="w-full justify-center"
                aria-label={newSessionLabel}
              >
                {newSessionLabel}
              </Button>
            </motion.div>
            <motion.div
              initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={prefersReducedMotion ? { duration: 0 } : { delay: 0.8, ...springs.snappy }}
            >
              <Button
                variant="ghost"
                size="md"
                icon={<LogOut className="w-4 h-4" />}
                onClick={onExit}
                className="w-full justify-center"
                aria-label={exitLabel}
              >
                {exitLabel}
              </Button>
            </motion.div>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
};

export default DrillSummaryCard;
