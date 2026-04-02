'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Flame, AlertCircle, Target, CheckCircle } from 'lucide-react';
import { useReducedMotion } from '@/hooks/useReducedMotion';

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
      color: streak > 0 ? 'text-[var(--color-data-pass)]' : 'text-[var(--color-text-muted)]',
    },
    {
      label: dueLabel,
      value: dueCount,
      icon: AlertCircle,
      color: dueCount > 0 ? 'text-[var(--color-data-provisional)]' : 'text-[var(--color-text-muted)]',
    },
    {
      label: accuracyLabel,
      value: accuracy !== null ? `${accuracy}%` : '—',
      icon: Target,
      color: 'text-[var(--color-accent)]',
    },
    { label: 'Today', value: questionsToday, icon: CheckCircle, color: 'text-[var(--color-accent)]' },
  ];
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
      {stats.map((stat, i) => {
        const isDueCard = stat.label === dueLabel;
        const hasDueItems = isDueCard && dueCount > 0;

        const animate = prefersReducedMotion
          ? { opacity: 1, y: 0 }
          : hasDueItems
            ? {
                opacity: 1,
                y: 0,
                scale: [1, 1.02, 1],
                borderColor: [
                  'var(--color-border)',
                  'rgba(168, 155, 122, 0.5)',
                  'var(--color-border)',
                ],
              }
            : { opacity: 1, y: 0 };
        const transition = prefersReducedMotion
          ? { duration: 0 }
          : hasDueItems
            ? {
                opacity: { delay: i * 0.05, duration: 0.3, ease: 'easeOut' as const },
                y: { delay: i * 0.05, duration: 0.3, ease: 'easeOut' as const },
                scale: {
                  delay: i * 0.05 + 0.3,
                  duration: 2,
                  repeat: Infinity,
                  repeatType: 'loop' as const,
                  ease: 'easeInOut',
                },
                borderColor: {
                  delay: i * 0.05 + 0.3,
                  duration: 2,
                  repeat: Infinity,
                  repeatType: 'loop' as const,
                  ease: 'easeInOut',
                },
              }
            : { delay: i * 0.05, duration: 0.3, ease: 'easeOut' as const };

        return (
          <motion.div
            key={stat.label}
            initial={prefersReducedMotion ? false : { opacity: 0, y: 10 }}
            animate={animate}
            transition={transition}
            className={`flex items-center gap-3 p-3 bg-[var(--color-bg-secondary)] rounded-xl border transition-colors ${
              hasDueItems
                ? 'border-data-provisional/30 hover:border-data-provisional/40'
                : 'border-[var(--color-border)] hover:border-[var(--color-border)]/60'
            }`}
          >
            <div className="p-2 rounded-xl bg-[var(--color-bg-primary)]">
              <stat.icon className={`w-5 h-5 ${stat.color}`} />
            </div>
            <div>
              <div className="text-lg font-bold text-[var(--color-text-primary)] data-nums">
                {stat.value}
              </div>
              <div className="kpi-label">{stat.label}</div>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
};
