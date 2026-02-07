/**
 * EorCountdownCard - Displays EOR exam countdown for clinical year PA students
 * Shown when current rotation is an EOR rotation and eorTestDate is set.
 */

import React from 'react';
import { motion } from 'framer-motion';
import { Calendar, Stethoscope } from 'lucide-react';
import type { ClinicalRotation } from '@/types';

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
  return Math.min(40, Math.max(10, Math.ceil(300 / daysRemaining)));
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
      className={`
        relative overflow-hidden rounded-xl 
        border border-[var(--color-border)] 
        bg-gradient-to-br from-emerald-500/10 via-[var(--color-bg-secondary)] to-teal-600/10
        p-6
        ${className}
      `}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-emerald-500/15 rounded-lg">
            <Stethoscope className="w-5 h-5 text-emerald-500" />
          </div>
          <h3 className="font-bold text-[var(--color-text-primary)]">EOR Countdown</h3>
        </div>
        <div className="text-right">
          <div className="text-3xl font-bold text-emerald-500 leading-none">{daysRemaining}</div>
          <div className="text-xs text-[var(--color-text-muted)] mt-1">{daysLabel}</div>
        </div>
      </div>

      <div className="flex items-center gap-2 text-sm text-[var(--color-text-muted)]">
        <Calendar className="w-4 h-4 text-emerald-500/80" />
        <span className="font-medium text-[var(--color-text-secondary)]">{rotation}</span>
      </div>

      {daysRemaining > 0 && dailyTarget > 0 && (
        <p className="mt-3 text-xs text-[var(--color-text-muted)]">
          Aim for{' '}
          <span className="font-semibold text-[var(--color-text-secondary)]">
            ~{dailyTarget} questions/day
          </span>{' '}
          this rotation
        </p>
      )}

      {daysRemaining <= 14 && daysRemaining > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mt-4 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg"
        >
          <p className="text-xs text-[var(--color-text-secondary)]">
            <span className="font-semibold">Final stretch:</span> Focus on rotation-relevant
            content and high-yield systems.
          </p>
        </motion.div>
      )}
    </motion.div>
  );
};

export default EorCountdownCard;
