'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Flame, AlertCircle, Target, CheckCircle } from 'lucide-react';
import { useReducedMotion } from '@/hooks/useReducedMotion';

/**
 * QuickStatsBar — four key study metrics in a responsive grid.
 *
 * Design principles (Linear + PostHog):
 * - Large bold value as the hero; small uppercase label below
 * - Icon is a subtle colored dot, not a heavy container
 * - Whisper border + clean surface; no gradient backgrounds
 * - Due count card gets a subtle pulse when items are pending
 */

interface StatCardProps {
  label: string;
  value: string | number;
  icon: React.ElementType;
  iconColor: string;
  isDue?: boolean;
  index: number;
  prefersReducedMotion: boolean;
}

const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  icon: Icon,
  iconColor,
  isDue = false,
  index,
  prefersReducedMotion,
}) => {
  const animate = prefersReducedMotion
    ? { y: 0 }
    : isDue
      ? {
          y: 0,
          scale: [1, 1.01, 1],
        }
      : { y: 0 };

  const transition = prefersReducedMotion
    ? { duration: 0 }
    : isDue
      ? {
          y: { delay: index * 0.04, duration: 0.25, ease: [0.32, 0.72, 0, 1] as const },
          scale: {
            delay: index * 0.04 + 0.4,
            duration: 3,
            repeat: Infinity,
            repeatType: 'loop' as const,
            ease: 'easeInOut',
          },
        }
      : { delay: index * 0.04, duration: 0.25, ease: [0.32, 0.72, 0, 1] as const };

  return (
    <motion.div
      initial={prefersReducedMotion ? false : { y: 8 }}
      animate={animate}
      transition={transition}
      className={`
        flex items-center gap-3 p-3 sm:p-4 rounded-xl border
        transition-colors duration-200
        ${isDue
          ? 'border-[var(--color-data-provisional)]/25 bg-[var(--color-bg-secondary)] hover:border-[var(--color-data-provisional)]/40'
          : 'border-[var(--color-border)] bg-[var(--color-bg-secondary)] hover:border-[var(--color-border)]'
        }
      `}
    >
      {/* Compact icon indicator */}
      <div
        className={`shrink-0 w-8 h-8 flex items-center justify-center rounded-lg bg-[var(--color-bg-primary)]`}
        aria-hidden="true"
      >
        <Icon className={`w-4 h-4 ${iconColor}`} />
      </div>

      {/* Value + label */}
      <div className="min-w-0">
        <dd className="text-xl sm:text-2xl font-bold text-[var(--color-text-primary)] tracking-tight tabular-nums leading-none">
          {value}
        </dd>
        <dt className="text-[11px] font-medium text-[var(--color-text-muted)] uppercase tracking-wider mt-1">
          {label}
        </dt>
      </div>
    </motion.div>
  );
};

export const QuickStatsBar: React.FC<{
  streak: number;
  dueCount: number;
  accuracy: number | null;
  questionsToday: number;
  /** "Module Accuracy" when Didactic with filtered systems, "Global Accuracy" otherwise */
  accuracyLabel?: string;
  /** "To Review" for students, "Maintenance Due" for Practicing PAs */
  dueLabel?: string;
}> = ({
  streak,
  dueCount,
  accuracy,
  questionsToday,
  accuracyLabel = 'Global Accuracy',
  dueLabel = 'To Review',
}) => {
  const prefersReducedMotion = useReducedMotion();

  const stats = [
    {
      label: 'Day Streak',
      value: streak > 0 ? streak : '—',
      icon: Flame,
      iconColor: streak > 0 ? 'text-[var(--color-data-pass)]' : 'text-[var(--color-text-muted)]',
    },
    {
      label: dueLabel,
      value: dueCount,
      icon: AlertCircle,
      iconColor: dueCount > 0 ? 'text-[var(--color-data-provisional)]' : 'text-[var(--color-text-muted)]',
      isDue: true,
    },
    {
      label: accuracyLabel,
      value: accuracy !== null ? `${accuracy}%` : '—',
      icon: Target,
      iconColor: 'text-[var(--color-accent)]',
    },
    {
      label: 'Today',
      value: questionsToday,
      icon: CheckCircle,
      iconColor: 'text-[var(--color-accent)]',
    },
  ];

  return (
    <dl className="grid grid-cols-2 md:grid-cols-4 gap-3" aria-label="Study statistics">
      {stats.map((stat, i) => (
        <StatCard
          key={stat.label}
          label={stat.label}
          value={stat.value}
          icon={stat.icon}
          iconColor={stat.iconColor}
          isDue={'isDue' in stat && stat.isDue}
          index={i}
          prefersReducedMotion={prefersReducedMotion}
        />
      ))}
    </dl>
  );
};
