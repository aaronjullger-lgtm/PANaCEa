/**
 * ExamCountdownCard - Displays PANCE/PANRE countdown and pacing status
 *
 * Critical for PA students: Shows days remaining, curriculum progress,
 * and whether they're on track for their exam date.
 */

import React from 'react';
import { motion } from 'framer-motion';
import { Target, TrendingUp, TrendingDown, AlertCircle } from 'lucide-react';

interface ExamCountdownCardProps {
  examDate: string; // ISO date string
  curriculumPercent: number; // 0-100
  questionsAnswered: number;
  targetQuestionsForPace?: number; // Expected questions by now
  className?: string;
}

/** PANCE prep benchmark: typical target question count */
const TARGET_TOTAL_QUESTIONS = 3500;

/**
 * Calculate days remaining until exam
 */
function getDaysRemaining(examDateStr: string): number {
  const examDate = new Date(examDateStr);
  const now = new Date();
  const diffTime = examDate.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return Math.max(0, diffDays);
}

/**
 * Compute expected questions by now and daily target from exam date.
 * Assumes 365-day prep window; uses days remaining to infer elapsed time.
 */
function getPacingTargets(
  examDateStr: string,
  questionsAnswered: number
): { targetQuestionsForPace: number; dailyTarget: number; totalDaysToExam: number } {
  const daysRemaining = getDaysRemaining(examDateStr);
  const totalDaysToExam = 365;
  const daysElapsed = Math.max(0, Math.min(totalDaysToExam, totalDaysToExam - daysRemaining));
  const targetQuestionsForPace = Math.round(
    (daysElapsed / totalDaysToExam) * TARGET_TOTAL_QUESTIONS
  );
  const questionsRemaining = Math.max(0, TARGET_TOTAL_QUESTIONS - questionsAnswered);
  const dailyTargetRaw = daysRemaining > 0 ? Math.ceil(questionsRemaining / daysRemaining) : 0;
  const dailyTarget = Math.min(80, Math.max(10, dailyTargetRaw));
  return { targetQuestionsForPace, dailyTarget, totalDaysToExam };
}

/**
 * Determine pace status based on progress vs. time elapsed
 */
function getPaceStatus(
  curriculumPercent: number,
  daysRemaining: number,
  totalDaysToExam: number
): {
  status: 'ahead' | 'on_track' | 'behind' | 'urgent';
  label: string;
  color: string;
  icon: typeof TrendingUp;
} {
  const timeElapsedPercent = ((totalDaysToExam - daysRemaining) / totalDaysToExam) * 100;
  const progressDelta = curriculumPercent - timeElapsedPercent;

  if (daysRemaining <= 7 && curriculumPercent < 80) {
    return {
      status: 'urgent',
      label: 'Final push needed',
      color: 'text-[var(--color-data-fail)]',
      icon: AlertCircle,
    };
  }

  if (progressDelta >= 10) {
    return {
      status: 'ahead',
      label: 'Ahead of pace',
      color: 'text-[var(--color-data-pass)]',
      icon: TrendingUp,
    };
  }

  if (progressDelta <= -10) {
    return {
      status: 'behind',
      label: 'Behind pace',
      color: 'text-[var(--color-data-provisional)]',
      icon: TrendingDown,
    };
  }

  return {
    status: 'on_track',
    label: 'On track',
    color: 'text-[var(--color-accent)]',
    icon: TrendingUp,
  };
}

export const ExamCountdownCard: React.FC<ExamCountdownCardProps> = ({
  examDate,
  curriculumPercent,
  questionsAnswered,
  targetQuestionsForPace: targetProp,
  className = '',
}) => {
  const daysRemaining = getDaysRemaining(examDate);
  const {
    targetQuestionsForPace: computedTarget,
    dailyTarget,
    totalDaysToExam,
  } = getPacingTargets(examDate, questionsAnswered);
  const targetQuestionsForPace =
    targetProp !== undefined && targetProp > 0 ? targetProp : computedTarget;

  const paceInfo = getPaceStatus(curriculumPercent, daysRemaining, totalDaysToExam);
  const PaceIcon = paceInfo.icon;

  let daysLabel: string;
  if (daysRemaining === 0) daysLabel = 'Today!';
  else if (daysRemaining === 1) daysLabel = '1 day';
  else daysLabel = `${daysRemaining} days`;

  const questionsDelta = questionsAnswered - targetQuestionsForPace;
  const showQuestionPace = targetQuestionsForPace > 0 && Math.abs(questionsDelta) > 5;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={`
        relative overflow-hidden rounded-xl
        bg-[var(--color-bg-secondary)]
        p-6 shadow-sm
        ${className}
      `}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-muted-amber-500/15 rounded-lg">
            <Target className="w-5 h-5 text-muted-amber-500" />
          </div>
          <h3 className="font-bold text-[var(--color-text-primary)]">PANCE Countdown</h3>
        </div>
        <div className="text-right">
          <div className="text-3xl font-bold text-muted-amber-500 leading-none">
            {daysRemaining}
          </div>
          <div className="text-xs text-[var(--color-text-muted)] mt-1">{daysLabel}</div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="mb-3">
        <div className="flex items-center justify-between text-xs text-[var(--color-text-muted)] mb-1.5">
          <span>Curriculum Progress</span>
          <span className="font-semibold text-[var(--color-text-primary)]">
            {Math.round(curriculumPercent)}%
          </span>
        </div>
        <div className="h-2.5 bg-[var(--color-bg-tertiary)] rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${curriculumPercent}%` }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
            className="h-full bg-gradient-to-r from-muted-amber-500 to-muted-amber-600 rounded-full"
          />
        </div>
      </div>

      {/* Pace status */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <PaceIcon className={`w-4 h-4 ${paceInfo.color}`} />
          <span className={`text-sm font-medium ${paceInfo.color}`}>{paceInfo.label}</span>
        </div>
        {showQuestionPace && (
          <span className="text-xs text-[var(--color-text-muted)]">
            {questionsDelta > 0
              ? `${questionsDelta} questions ahead`
              : `${Math.abs(questionsDelta)} questions behind`}
          </span>
        )}
      </div>

      {/* Daily target (exam countdown–driven) */}
      {daysRemaining > 0 && dailyTarget > 0 && (
        <p className="mt-3 text-xs text-[var(--color-text-muted)]">
          Aim for{' '}
          <span className="font-semibold text-[var(--color-text-secondary)]">
            ~{dailyTarget} questions/day
          </span>{' '}
          to stay on pace
        </p>
      )}

      {/* Urgency message for < 14 days */}
      {daysRemaining <= 14 && daysRemaining > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mt-4 p-3 bg-muted-amber-500/10 rounded-lg"
        >
          <p className="text-xs text-[var(--color-text-secondary)]">
            <span className="font-semibold">Final sprint:</span> Review weak areas and high-yield
            content daily.
          </p>
        </motion.div>
      )}
    </motion.div>
  );
};

export default ExamCountdownCard;
