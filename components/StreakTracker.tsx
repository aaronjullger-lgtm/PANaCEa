/**
 * Study Streak Tracker Component
 * Displays current study streak with visual calendar and motivational messaging
 */

import React from 'react';
import { motion } from 'framer-motion';
import { Flame, TrendingUp, Calendar, Award, CheckCircle } from 'lucide-react';

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
  // Use UTC date to ensure consistency regardless of client timezone
  const now = new Date();
  const todayUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
  const today = todayUTC.toISOString().split('T')[0];
  const studiedToday = lastStudyDate === today;
  
  // Get last 7 days for mini calendar using UTC
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(todayUTC);
    date.setUTCDate(todayUTC.getUTCDate() - (6 - i));
    return date.toISOString().split('T')[0];
  });
  
  const getStreakColor = () => {
    if (currentStreak === 0) return 'text-slate-400';
    if (currentStreak < 3) return 'text-orange-500';
    if (currentStreak < 7) return 'text-orange-600';
    if (currentStreak < 14) return 'text-red-500';
    return 'text-red-600';
  };
  
  const getStreakMessage = () => {
    if (currentStreak === 0) return "Start your streak today!";
    if (currentStreak === 1) return "Great start! Keep it going!";
    if (currentStreak < 7) return "Building momentum!";
    if (currentStreak < 14) return "You're on fire!";
    if (currentStreak < 30) return "Unstoppable! Keep crushing it!";
    return "Legendary dedication!";
  };
  
  const hasStudiedOnDate = (date: string) => {
    return streakHistory.some(entry => entry.date === date && entry.studied) || 
           (date === lastStudyDate);
  };
  
  const isToday = (date: string) => date === today;
  
  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-sm border border-slate-200 dark:border-slate-700">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
          <Flame className="w-5 h-5 text-orange-500" />
          Study Streak
        </h3>
        {currentStreak >= bestStreak && currentStreak > 0 && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="flex items-center gap-1 text-sm text-yellow-600 dark:text-yellow-500"
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
            key={currentStreak}
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="flex items-baseline gap-2"
          >
            <span className={`text-5xl font-bold ${getStreakColor()}`}>
              {currentStreak}
            </span>
            <span className="text-lg text-slate-600 dark:text-slate-400">
              {currentStreak === 1 ? 'day' : 'days'}
            </span>
          </motion.div>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            {getStreakMessage()}
          </p>
        </div>
        
        <div className="text-right">
          <div className="text-sm text-slate-500 dark:text-slate-400">
            Best Streak
          </div>
          <div className="flex items-center gap-1 text-2xl font-bold text-slate-700 dark:text-slate-300">
            <TrendingUp className="w-5 h-5" />
            {bestStreak}
          </div>
        </div>
      </div>
      
      {/* Mini Calendar - Last 7 Days */}
      <div className="border-t border-slate-200 dark:border-slate-700 pt-4">
        <div className="flex items-center gap-2 mb-3">
          <Calendar className="w-4 h-4 text-slate-500" />
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
            Last 7 Days
          </span>
        </div>
        
        <div className="grid grid-cols-7 gap-2">
          {last7Days.map((date, index) => {
            const hasStudied = hasStudiedOnDate(date);
            const isCurrentDay = isToday(date);
            // Use UTC day to ensure consistency
            const dayName = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][new Date(date + 'T00:00:00Z').getUTCDay()];
            
            return (
              <motion.div
                key={date}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="flex flex-col items-center"
              >
                <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">
                  {dayName}
                </div>
                <motion.div
                  whileHover={{ scale: 1.1 }}
                  className={`
                    w-8 h-8 rounded-lg flex items-center justify-center
                    transition-colors duration-200
                    ${hasStudied
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
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-4 p-3 bg-[var(--color-bg-secondary)] rounded-lg border border-[var(--color-border)]"
        >
          <p className="text-sm text-slate-700 dark:text-slate-300 text-center">
            {currentStreak > 0 
              ? `Keep your ${currentStreak}-day streak alive! Study today.`
              : 'Start building your study habit today!'
            }
          </p>
        </motion.div>
      )}
      
      {/* Studied Today Badge */}
      {studiedToday && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="mt-4 p-3 bg-[var(--color-bg-secondary)] rounded-lg border border-[var(--color-border)]"
        >
          <p className="text-sm text-green-700 dark:text-green-300 text-center flex items-center justify-center gap-2">
            <CheckCircle className="w-4 h-4" />
            Studied today - Streak active!
          </p>
        </motion.div>
      )}
    </div>
  );
};

export default StreakTracker;
