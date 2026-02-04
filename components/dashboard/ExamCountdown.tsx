/**
 * Exam Countdown Widget
 * Displays days until PANCE/PANRE exam
 * Can be toggled on/off in settings
 */

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Calendar, Settings, X } from 'lucide-react';

interface ExamCountdownProps {
  examDate: Date | null;
  onSetDate?: () => void;
  onHide?: () => void;
}

export function ExamCountdown({ examDate, onSetDate, onHide }: ExamCountdownProps) {
  const [daysUntil, setDaysUntil] = useState<number | null>(null);

  useEffect(() => {
    if (!examDate) {
      setDaysUntil(null);
      return;
    }

    const calculateDays = () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const exam = new Date(examDate);
      exam.setHours(0, 0, 0, 0);

      const diffTime = exam.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      setDaysUntil(diffDays);
    };

    calculateDays();
    const interval = setInterval(calculateDays, 1000 * 60 * 60); // Update every hour

    return () => clearInterval(interval);
  }, [examDate]);

  if (!examDate && !onSetDate) {
    return null;
  }

  // No exam date set
  if (!examDate) {
    return (
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg p-4"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[var(--color-accent)]/20 rounded-lg">
              <Calendar className="w-5 h-5 text-[var(--color-accent)]" />
            </div>
            <div>
              <div className="text-sm font-medium text-[var(--color-text-primary)]">
                Set Your Exam Date
              </div>
              <div className="text-xs text-[var(--color-text-muted)]">
                Track your preparation timeline
              </div>
            </div>
          </div>
          <button
            onClick={onSetDate}
            className="px-4 py-2 text-sm bg-[var(--color-accent)] text-[var(--color-text-inverse)] rounded-lg hover:bg-[var(--color-accent-hover)] transition-colors"
          >
            Set Date
          </button>
        </div>
      </motion.div>
    );
  }

  // Get urgency color
  const getUrgencyColor = () => {
    if (daysUntil === null) return 'text-[var(--color-text-muted)]';
    if (daysUntil < 0) return 'text-[var(--color-data-fail)]';
    if (daysUntil <= 14) return 'text-[var(--color-data-fail)]';
    if (daysUntil <= 30) return 'text-[var(--color-data-provisional)]';
    if (daysUntil <= 60) return 'text-[var(--color-data-provisional)]';
    return 'text-[var(--color-accent)]';
  };

  const urgencyColor = getUrgencyColor();

  // Get message
  const getMessage = () => {
    if (daysUntil === null) return '';
    if (daysUntil < 0) return 'Exam date passed';
    if (daysUntil === 0) return 'Exam is today';
    if (daysUntil === 1) return '1 day until exam';
    if (daysUntil <= 7) return 'Final week';
    if (daysUntil <= 14) return 'Less than 2 weeks';
    if (daysUntil <= 30) return 'Less than 1 month';
    return 'Days until exam';
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg p-4 overflow-hidden"
    >
      {/* Background decoration */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-[var(--color-accent)]/5 rounded-full blur-3xl" />

      <div className="relative">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Calendar className={`w-5 h-5 ${urgencyColor}`} />
            <span className="text-sm text-[var(--color-text-muted)]">PANCE/PANRE Exam</span>
          </div>
          <div className="flex items-center gap-1">
            {onSetDate && (
              <button
                onClick={onSetDate}
                className="p-1 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
                title="Change exam date"
              >
                <Settings className="w-4 h-4" />
              </button>
            )}
            {onHide && (
              <button
                onClick={onHide}
                className="p-1 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
                title="Hide countdown"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        <div className="flex items-end gap-3">
          <div>
            <div className={`text-4xl font-bold ${urgencyColor}`}>
              {daysUntil !== null && daysUntil >= 0 ? daysUntil : '—'}
            </div>
            <div className="text-sm text-[var(--color-text-muted)] mt-1">{getMessage()}</div>
          </div>

          {daysUntil !== null && daysUntil > 0 && (
            <div className="flex-1 text-right">
              <div className="text-xs text-[var(--color-text-muted)]">
                {examDate.toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </div>
            </div>
          )}
        </div>

        {/* Urgency indicator bar */}
        {daysUntil !== null && daysUntil > 0 && daysUntil <= 90 && (
          <div className="mt-3 h-1 bg-[var(--color-bg-primary)] rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${Math.max(0, 100 - (daysUntil / 90) * 100)}%` }}
              transition={{ duration: 1, delay: 0.5 }}
              className={`h-full ${
                daysUntil <= 14
                  ? 'bg-[var(--color-data-fail)]'
                  : daysUntil <= 30
                    ? 'bg-[var(--color-data-provisional)]'
                    : 'bg-[var(--color-data-provisional)]'
              }`}
            />
          </div>
        )}
      </div>
    </motion.div>
  );
}

/**
 * Compact version for header/nav
 */
export function ExamCountdownBadge({ examDate }: { examDate: Date | null }) {
  const [daysUntil, setDaysUntil] = useState<number | null>(null);

  useEffect(() => {
    if (!examDate) {
      setDaysUntil(null);
      return;
    }

    const calculateDays = () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const exam = new Date(examDate);
      exam.setHours(0, 0, 0, 0);

      const diffTime = exam.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      setDaysUntil(diffDays);
    };

    calculateDays();
  }, [examDate]);

  if (!examDate || daysUntil === null || daysUntil < 0) {
    return null;
  }

  const getColor = () => {
    if (daysUntil <= 14)
      return 'text-[var(--color-data-fail)] bg-[var(--color-data-fail)]/10 border-[var(--color-data-fail)]/20';
    if (daysUntil <= 30)
      return 'text-[var(--color-data-provisional)] bg-[var(--color-data-provisional)]/10 border-[var(--color-data-provisional)]/20';
    if (daysUntil <= 60)
      return 'text-[var(--color-data-provisional)] bg-[var(--color-data-provisional)]/10 border-[var(--color-data-provisional)]/20';
    return 'text-[var(--color-accent)] bg-[var(--color-accent)]/10 border-[var(--color-accent)]/20';
  };

  return (
    <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border ${getColor()}`}>
      <Calendar className="w-4 h-4" />
      <span className="text-sm font-medium">
        {daysUntil} {daysUntil === 1 ? 'day' : 'days'}
      </span>
    </div>
  );
}
