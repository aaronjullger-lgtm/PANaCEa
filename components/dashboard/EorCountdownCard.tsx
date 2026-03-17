/**
 * EorCountdownCard - Displays EOR exam countdown for clinical year PA students
 * Shown when current rotation is an EOR rotation and eorTestDate is set.
 */

import React from 'react';
import { motion } from 'framer-motion';
import { Calendar, Stethoscope } from 'lucide-react';
import type { ClinicalRotation } from '@/types';
import { EOR_TARGET_QUESTIONS_DEFAULT } from '@/config/rotation-systems';

interface EorCountdownCardProps {
  examDate: string;
  rotation: ClinicalRotation;
  className?: string;
}

function getDaysRemaining(examDateStr: string): number {
  const examDate = new Date(examDateStr);
  const now = new Date();
  const diffTime = examDate.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return Math.max(0, diffDays);
}

function getEorDailyTarget(daysRemaining: number): number {
  if (daysRemaining <= 0) return 0;
  return Math.min(40, Math.max(10, Math.ceil(EOR_TARGET_QUESTIONS_DEFAULT / daysRemaining)));
}

export const EorCountdownCard: React.FC<EorCountdownCardProps> = ({
  examDate,
  rotation,
  className = '',
}) => {
  const daysRemaining = getDaysRemaining(examDate);
  let daysLabel: string;
  if (daysRemaining === 0) daysLabel = 'Today!';
  else if (daysRemaining === 1) daysLabel = '1 day';
  else daysLabel = `${daysRemaining} days`;

  const dailyTarget = getEorDailyTarget(daysRemaining);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={`eor-accent relative overflow-hidden rounded-xl bg-[var(--color-bg-secondary)] p-6 shadow-sm ${className}`}
    >
      {/* Primary: Title */}
      <div className="flex items-center gap-2 mb-4">
        <div className="p-2 bg-[var(--color-accent)]/15 rounded-lg">
          <Stethoscope className="w-5 h-5 text-[var(--color-accent)]" />
        </div>
        <h3 className="text-lg font-bold text-[var(--color-text-primary)]">EOR Countdown</h3>
      </div>

      {/* Secondary: Days remaining and rotation */}
      <div className="flex items-end justify-between mb-4">
        <div>
          <div className="text-2xl font-bold text-[var(--color-accent)] leading-none">
            {daysRemaining}
          </div>
          <div className="text-xs text-[var(--color-text-muted)] mt-1">{daysLabel}</div>
        </div>
        <div className="flex items-center gap-1 text-sm text-[var(--color-text-secondary)]">
          <Calendar className="w-4 h-4 text-[var(--color-accent)]/80" />
          <span className="font-medium">{rotation}</span>
        </div>
      </div>

      {/* Supporting: Daily target */}
      {daysRemaining > 0 && dailyTarget > 0 && (
        <p className="text-xs text-[var(--color-text-muted)] mb-3">
          <span className="font-semibold text-[var(--color-text-secondary)]">
            {dailyTarget} questions/day
          </span>{' '}
          to stay on track
        </p>
      )}

      {/* Contextual: Final stretch */}
      {daysRemaining <= 14 && daysRemaining > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="p-3 bg-[var(--color-accent)]/10 rounded-lg"
        >
          <p className="text-xs text-[var(--color-text-secondary)]">
            <span className="font-semibold">Final stretch:</span> Focus on rotation-relevant content
            and high-yield systems.
          </p>
        </motion.div>
      )}
    </motion.div>
  );
};

export default EorCountdownCard;
