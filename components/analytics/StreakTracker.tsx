/**
 * Study Streak Tracker Component
 * Displays current study streak with visual calendar and motivational messaging
 */

import React from 'react';
import { motion } from 'framer-motion';
import { Flame, TrendingUp, Calendar, Award, CheckCircle } from 'lucide-react';
import { getTodayUTC, DAY_NAMES } from '@/lib/utils/timeUtils';

interface StreakTrackerProps {
  currentStreak: number;
  bestStreak: number;
  lastStudyDate?: string;
  streakHistory?: { date: string; studied: boolean }[];
}

export const StreakTracker: React.FC<StreakTrackerProps> = ({
  currentStreak,
  bestStreak,
  lastStudyDate,
  streakHistory = [],
}) => {
  // Handle loading/null states gracefully
  const safeStreak = currentStreak ?? 0;
  const safeBestStreak = bestStreak ?? 0;

  // Use UTC date to ensure consistency regardless of client timezone
  const todayUTC = getTodayUTC();
  const today = todayUTC.toISOString().split('T')[0];
  const studiedToday = lastStudyDate === today;

  // Get last 7 days for mini calendar using UTC
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(todayUTC);
    date.setUTCDate(todayUTC.getUTCDate() - (6 - i));
    return date.toISOString().split('T')[0];
  });

  const getStreakColor = () => {
    if (safeStreak === 0) return 'text-[var(--color-text-muted)]';
    if (safeStreak < 3) return 'text-[var(--color-accent)]';
    if (safeStreak < 7) return 'text-[var(--color-accent)]';
    if (safeStreak < 14) return 'text-[var(--color-accent)]';
    return 'text-[var(--color-accent)]';
  };

  const getStreakMessage = () => {
    if (safeStreak === 0) return 'Maintain your daily continuity.';
    if (safeStreak === 1) return 'Good start. Keep it going.';
    if (safeStreak < 7) return 'Building momentum.';
    if (safeStreak < 14) return 'Strong consistency.';
    if (safeStreak < 30) return 'Sustained effort.';
    return 'Outstanding consistency.';
  };

  const hasStudiedOnDate = (date: string) => {
    return (
      streakHistory.some((entry) => entry.date === date && entry.studied) || date === lastStudyDate
    );
  };

  const isToday = (date: string) => date === today;

  return (
    <div className="bg-[var(--color-bg-primary)] rounded-xl p-6 shadow-sm border border-[var(--color-border)]">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-[var(--color-text-primary)] flex items-center gap-2">
          <Flame className="w-5 h-5 text-[var(--color-accent)]" />
          Study Continuity
        </h3>
        {safeStreak >= safeBestStreak && safeStreak > 0 && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="flex items-center gap-1 text-sm text-[var(--color-accent)]"
          >
            <Award className="w-4 h-4" />
            Personal Best!
          </motion.div>
        )}
      </div>

      {/* Current Streak Display */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <motion.div
            key={safeStreak}
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="flex items-baseline gap-2"
          >
            <span className={`text-5xl font-bold ${getStreakColor()}`}>{safeStreak}</span>
            <span className="text-lg text-[var(--color-text-secondary)]">
              {safeStreak === 1 ? 'day' : 'days'}
            </span>
          </motion.div>
          <p className="text-sm text-[var(--color-text-secondary)] mt-1">{getStreakMessage()}</p>
        </div>

        <div className="text-right">
          <div className="text-sm text-[var(--color-text-muted)]">Best Streak</div>
          <div className="flex items-center gap-1 text-2xl font-bold text-[var(--color-text-primary)]">
            <TrendingUp className="w-5 h-5" />
            {safeBestStreak}
          </div>
        </div>
      </div>

      {/* Mini Calendar - Last 7 Days */}
      <div className="border-t border-[var(--color-border)] pt-4">
        <div className="flex items-center gap-2 mb-3">
          <Calendar className="w-4 h-4 text-[var(--color-text-muted)]" />
          <span className="text-sm font-medium text-[var(--color-text-primary)]">Last 7 Days</span>
        </div>

        <div className="grid grid-cols-7 gap-2">
          {last7Days.map((date, index) => {
            if (!date) return null;
            const hasStudied = hasStudiedOnDate(date);
            const isCurrentDay = isToday(date);
            // Use UTC day to ensure consistency
            const dayName = DAY_NAMES[new Date(date + 'T00:00:00Z').getUTCDay()] ?? '';

            return (
              <motion.div
                key={date}
                initial={{ y: 10 }}
                animate={{ y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="flex flex-col items-center"
              >
                <div className="text-xs text-[var(--color-text-muted)] mb-1">{dayName}</div>
                <motion.div
                  whileHover={{ scale: 1.1 }}
                  className={`
                    w-8 h-8 rounded-lg flex items-center justify-center
                    transition-colors duration-200
                    ${
                      hasStudied
                        ? 'bg-[var(--color-accent)] text-white'
                        : 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-muted)]'
                    }
                    ${isCurrentDay ? 'ring-2 ring-[var(--color-accent)] ring-offset-2' : ''}
                  `}
                  title={hasStudied ? `Studied on ${date}` : `No study on ${date}`}
                >
                  {hasStudied && <Flame className="w-4 h-4" />}
                  {!hasStudied && isCurrentDay && <Calendar className="w-4 h-4" />}
                </motion.div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Study Today CTA */}
      {!studiedToday && (
        <motion.div
          initial={{ y: 10 }}
          animate={{ y: 0 }}
          className="mt-4 p-3 bg-[var(--color-bg-secondary)] rounded-lg border border-[var(--color-border)]"
        >
          <p className="text-sm text-[var(--color-text-primary)] text-center">
            {safeStreak > 0
              ? `Maintain your ${safeStreak}-day continuity. Study today.`
              : 'Start building your study habit today!'}
          </p>
        </motion.div>
      )}

      {/* Studied Today Badge */}
      {studiedToday && (
        <motion.div
          initial={{ scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="mt-4 p-3 bg-[var(--color-bg-secondary)] rounded-lg border border-[var(--color-border)]"
        >
          <p className="text-sm text-[var(--color-data-pass)] text-center flex items-center justify-center gap-2">
            <CheckCircle className="w-4 h-4" />
            Studied today — continuity maintained.
          </p>
        </motion.div>
      )}
    </div>
  );
};

export default StreakTracker;
