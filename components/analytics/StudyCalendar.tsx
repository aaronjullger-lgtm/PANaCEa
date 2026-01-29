/**
 * StudyCalendar Component
 *
 * Versatile calendar view with multiple customizable metrics.
 * Not on the main dashboard - accessible from analytics section.
 *
 * View Modes:
 * - activity: Questions answered per day (GitHub-style heatmap)
 * - performance: Daily accuracy percentage
 * - dueForeceast: Future FSRS review due dates
 * - streaks: Daily streak maintenance
 * - mastery: System mastery progress over time
 * - studyTime: Time spent studying per day
 */

import React, { useMemo, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Calendar,
  Activity,
  Target,
  Clock,
  TrendingUp,
  Flame,
  ChevronLeft,
  ChevronRight,
  BarChart2,
  Settings,
} from 'lucide-react';
import type { PerformanceRecord, SystemCode } from '@/types';
import { ABBREVIATION_TO_TOPIC_MAP } from '@/src/constants';

// ============================================================
// Types
// ============================================================

export type CalendarViewMode =
  | 'activity' // Questions answered
  | 'performance' // Accuracy %
  | 'dueForecast' // Future FSRS reviews
  | 'streaks' // Streak tracking
  | 'mastery' // System mastery
  | 'studyTime'; // Time spent

interface StudyCalendarProps {
  performanceData: PerformanceRecord[];
  /** FSRS due dates for forecast view */
  dueForecasts?: { date: string; count: number; systems: string[] }[];
  /** User's streak history */
  streakHistory?: { date: string; active: boolean; streakLength: number }[];
  /** Default view mode */
  defaultView?: CalendarViewMode;
  /** Number of months to display (default: 3) */
  monthsToShow?: number;
  /** Compact mode for embedding */
  compact?: boolean;
  /** Callback when a day is clicked */
  onDayClick?: (date: string, data: DayData) => void;
}

interface DayData {
  date: string;
  questionsAnswered: number;
  correct: number;
  incorrect: number;
  accuracy: number;
  totalTimeMs: number;
  avgTimeMs: number;
  dueCount?: number;
  streakActive?: boolean;
  streakLength?: number;
  systemBreakdown: Map<string, { correct: number; total: number }>;
}

// ============================================================
// View Mode Configuration
// ============================================================

const VIEW_MODES: Record<
  CalendarViewMode,
  {
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    description: string;
    getIntensity: (data: DayData, maxValue: number) => number;
    getValue: (data: DayData) => number;
    formatValue: (value: number) => string;
    colorScale: string[];
  }
> = {
  activity: {
    label: 'Questions',
    icon: Activity,
    description: 'Questions answered per day',
    getIntensity: (data, max) => (max > 0 ? data.questionsAnswered / max : 0),
    getValue: (data) => data.questionsAnswered,
    formatValue: (v) => `${v} questions`,
    colorScale: [
      'bg-[var(--color-bg-secondary)]',
      'bg-[var(--color-bg-tertiary)]',
      'bg-steel-blue-100 dark:bg-steel-blue-900/30',
      'bg-steel-blue-300 dark:bg-steel-blue-800/40',
      'bg-steel-blue-500 dark:bg-steel-blue-700/50',
    ],
  },
  performance: {
    label: 'Accuracy',
    icon: Target,
    description: 'Daily accuracy percentage',
    getIntensity: (data) => (data.questionsAnswered > 0 ? data.accuracy / 100 : 0),
    getValue: (data) => data.accuracy,
    formatValue: (v) => `${v}%`,
    colorScale: [
      'bg-[var(--color-bg-secondary)]',
      'bg-[var(--color-bg-tertiary)]',
      'bg-steel-blue-100 dark:bg-steel-blue-900/30',
      'bg-steel-blue-300 dark:bg-steel-blue-800/40',
      'bg-steel-blue-500 dark:bg-steel-blue-700/50',
    ],
  },
  dueForecast: {
    label: 'Due Reviews',
    icon: Calendar,
    description: 'Upcoming FSRS review schedule',
    getIntensity: (data, max) => (max > 0 ? (data.dueCount || 0) / max : 0),
    getValue: (data) => data.dueCount || 0,
    formatValue: (v) => `${v} due`,
    colorScale: [
      'bg-[var(--color-bg-secondary)]',
      'bg-[var(--color-bg-tertiary)]',
      'bg-steel-blue-100 dark:bg-steel-blue-900/30',
      'bg-steel-blue-300 dark:bg-steel-blue-800/40',
      'bg-steel-blue-500 dark:bg-steel-blue-700/50',
    ],
  },
  streaks: {
    label: 'Streaks',
    icon: Flame,
    description: 'Daily study streak tracking',
    getIntensity: (data) => (data.streakActive ? 1 : 0),
    getValue: (data) => data.streakLength || 0,
    formatValue: (v) => (v > 0 ? `${v} day streak` : 'No streak'),
    colorScale: [
      'bg-[var(--color-bg-secondary)]',
      'bg-[var(--color-bg-tertiary)]',
      'bg-steel-blue-100 dark:bg-steel-blue-900/30',
      'bg-steel-blue-300 dark:bg-steel-blue-800/40',
      'bg-steel-blue-500 dark:bg-steel-blue-700/50',
    ],
  },
  mastery: {
    label: 'Mastery',
    icon: TrendingUp,
    description: 'System mastery progress',
    getIntensity: (data) => {
      // Calculate average mastery across systems practiced that day
      const systems = Array.from(data.systemBreakdown.entries());
      if (systems.length === 0) return 0;
      const avgAccuracy =
        systems.reduce((sum, [, s]) => sum + (s.total > 0 ? s.correct / s.total : 0), 0) /
        systems.length;
      return avgAccuracy;
    },
    getValue: (data) => {
      const systems = Array.from(data.systemBreakdown.entries());
      if (systems.length === 0) return 0;
      const avgAccuracy =
        systems.reduce((sum, [, s]) => sum + (s.total > 0 ? (s.correct / s.total) * 100 : 0), 0) /
        systems.length;
      return Math.round(avgAccuracy);
    },
    formatValue: (v) => `${v}% avg mastery`,
    colorScale: [
      'bg-[var(--color-bg-secondary)]',
      'bg-[var(--color-bg-tertiary)]',
      'bg-steel-blue-100 dark:bg-steel-blue-900/30',
      'bg-steel-blue-300 dark:bg-steel-blue-800/40',
      'bg-steel-blue-500 dark:bg-steel-blue-700/50',
    ],
  },
  studyTime: {
    label: 'Time',
    icon: Clock,
    description: 'Study time per day',
    getIntensity: (data, max) => (max > 0 ? data.totalTimeMs / max : 0),
    getValue: (data) => Math.round(data.totalTimeMs / 60000), // Convert to minutes
    formatValue: (v) => (v >= 60 ? `${Math.floor(v / 60)}h ${v % 60}m` : `${v}m`),
    colorScale: [
      'bg-[var(--color-bg-secondary)]',
      'bg-[var(--color-bg-tertiary)]',
      'bg-steel-blue-100 dark:bg-steel-blue-900/30',
      'bg-steel-blue-300 dark:bg-steel-blue-800/40',
      'bg-steel-blue-500 dark:bg-steel-blue-700/50',
    ],
  },
};

// ============================================================
// Helper Functions
// ============================================================

function formatDateKey(date: Date): string {
  // toISOString() always returns "YYYY-MM-DDTHH:mm:ss.sssZ" format
  // Using nullish coalescing to satisfy TypeScript's array access safety
  return date.toISOString().split('T')[0] ?? '';
}

function getMonthDays(year: number, month: number): (Date | null)[][] {
  const firstDay = new Date(Date.UTC(year, month, 1));
  const lastDay = new Date(Date.UTC(year, month + 1, 0));

  const weeks: (Date | null)[][] = [];
  let currentWeek: (Date | null)[] = [];

  // Pad beginning with nulls
  const startDayOfWeek = firstDay.getUTCDay();
  for (let i = 0; i < startDayOfWeek; i++) {
    currentWeek.push(null);
  }

  // Add all days of the month
  for (let day = 1; day <= lastDay.getUTCDate(); day++) {
    currentWeek.push(new Date(Date.UTC(year, month, day)));
    if (currentWeek.length === 7) {
      weeks.push(currentWeek);
      currentWeek = [];
    }
  }

  // Pad end with nulls
  while (currentWeek.length > 0 && currentWeek.length < 7) {
    currentWeek.push(null);
  }
  if (currentWeek.length > 0) {
    weeks.push(currentWeek);
  }

  return weeks;
}

function getIntensityClass(intensity: number, colorScale: string[]): string {
  // Use nullish coalescing for type-safe array access
  // colorScale[i] returns string | undefined in strict mode
  if (intensity === 0) return colorScale[0] ?? '';
  if (intensity < 0.25) return colorScale[1] ?? '';
  if (intensity < 0.5) return colorScale[2] ?? '';
  if (intensity < 0.75) return colorScale[3] ?? '';
  return colorScale[4] ?? '';
}

// ============================================================
// Sub-Components
// ============================================================

interface DayCellProps {
  date: Date | null;
  data: DayData | null;
  viewMode: CalendarViewMode;
  maxValue: number;
  isToday: boolean;
  isFuture: boolean;
  onClick?: () => void;
}

const DayCell: React.FC<DayCellProps> = ({
  date,
  data,
  viewMode,
  maxValue,
  isToday,
  isFuture,
  onClick,
}) => {
  const config = VIEW_MODES[viewMode];

  if (!date) {
    return <div className="w-8 h-8 sm:w-10 sm:h-10" />;
  }

  const intensity = data ? config.getIntensity(data, maxValue) : 0;
  const value = data ? config.getValue(data) : 0;
  const colorClass = getIntensityClass(intensity, config.colorScale);

  return (
    <motion.button
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      disabled={!data && !isFuture}
      className={`
        w-8 h-8 sm:w-10 sm:h-10 rounded-md flex items-center justify-center
        text-xs font-medium transition-all relative
        ${colorClass}
        ${isToday ? 'ring-2 ring-[var(--color-accent)] ring-offset-1' : ''}
        ${isFuture ? 'opacity-60' : ''}
        ${data || isFuture ? 'cursor-pointer hover:ring-2 hover:ring-[var(--color-accent)]/50' : 'cursor-default'}
      `}
      title={data ? config.formatValue(value) : isFuture ? 'Future date' : 'No activity'}
    >
      <span
        className={`
        ${intensity > 0.5 ? 'text-[var(--color-text-inverse)]' : 'text-[var(--color-text-primary)]'}
      `}
      >
        {date.getUTCDate()}
      </span>

      {/* Indicator dot for streak view */}
      {viewMode === 'streaks' && data?.streakActive && (
        <span className="absolute -top-1 -right-1 w-2 h-2 bg-[var(--color-border-strong)] rounded-full" />
      )}
    </motion.button>
  );
};

interface MonthGridProps {
  year: number;
  month: number;
  dataMap: Map<string, DayData>;
  viewMode: CalendarViewMode;
  maxValue: number;
  onDayClick?: (date: string, data: DayData) => void;
}

const MonthGrid: React.FC<MonthGridProps> = ({
  year,
  month,
  dataMap,
  viewMode,
  maxValue,
  onDayClick,
}) => {
  const weeks = useMemo(() => getMonthDays(year, month), [year, month]);
  const today = formatDateKey(new Date());

  const MONTH_NAMES = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ];
  const DAY_HEADERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

  // Type-safe month name lookup
  const monthName = MONTH_NAMES[month];

  return (
    <div className="flex-shrink-0">
      <h4 className="text-sm font-semibold text-[var(--color-text-primary)] mb-3 text-center">
        {monthName ?? 'Unknown'} {year}
      </h4>

      {/* Day headers */}
      <div className="grid grid-cols-7 gap-1 mb-1">
        {DAY_HEADERS.map((day, idx) => {
          const dayLabel = day;
          return (
            <div
              key={idx}
              className="w-8 sm:w-10 text-center text-[10px] text-[var(--color-text-muted)]"
            >
              {dayLabel}
            </div>
          );
        })}
      </div>

      {/* Calendar grid */}
      <div className="space-y-1">
        {weeks.map((week, weekIdx) => (
          <div key={weekIdx} className="grid grid-cols-7 gap-1">
            {week.map((date, dayIdx) => {
              const dateKey = date ? formatDateKey(date) : null;
              const data = dateKey ? dataMap.get(dateKey) || null : null;
              const isToday = dateKey === today;
              const isFuture = date ? date > new Date() : false;

              return (
                <DayCell
                  key={dayIdx}
                  date={date}
                  data={data}
                  viewMode={viewMode}
                  maxValue={maxValue}
                  isToday={isToday}
                  isFuture={isFuture}
                  onClick={() => dateKey && data && onDayClick?.(dateKey, data)}
                />
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
};

// ============================================================
// Main Component
// ============================================================

const StudyCalendar: React.FC<StudyCalendarProps> = ({
  performanceData,
  dueForecasts = [],
  streakHistory = [],
  defaultView = 'activity',
  monthsToShow = 3,
  compact = false,
  onDayClick,
}) => {
  const [viewMode, setViewMode] = useState<CalendarViewMode>(defaultView);
  const [monthOffset, setMonthOffset] = useState(0);
  const [showViewSelector, setShowViewSelector] = useState(false);

  // Process performance data into daily stats
  const dataMap = useMemo(() => {
    const map = new Map<string, DayData>();

    // Process performance records
    performanceData.forEach((record) => {
      const date = new Date(record.timestamp);
      const dateKey = formatDateKey(date);

      if (!map.has(dateKey)) {
        map.set(dateKey, {
          date: dateKey,
          questionsAnswered: 0,
          correct: 0,
          incorrect: 0,
          accuracy: 0,
          totalTimeMs: 0,
          avgTimeMs: 0,
          systemBreakdown: new Map(),
        });
      }

      const data = map.get(dateKey)!;
      data.questionsAnswered++;

      if (record.isCorrect) {
        data.correct++;
      } else {
        data.incorrect++;
      }

      if (record.timeSpentMs) {
        data.totalTimeMs += record.timeSpentMs;
      }

      // Track system performance
      if (record.system && record.system !== 'OTHER') {
        const systemStats = data.systemBreakdown.get(record.system) || { correct: 0, total: 0 };
        systemStats.total++;
        if (record.isCorrect) systemStats.correct++;
        data.systemBreakdown.set(record.system, systemStats);
      }
    });

    // Calculate derived values
    map.forEach((data) => {
      data.accuracy =
        data.questionsAnswered > 0 ? Math.round((data.correct / data.questionsAnswered) * 100) : 0;
      data.avgTimeMs =
        data.questionsAnswered > 0 ? Math.round(data.totalTimeMs / data.questionsAnswered) : 0;
    });

    // Merge due forecasts
    dueForecasts.forEach((forecast) => {
      const existing: DayData = map.get(forecast.date) || {
        date: forecast.date,
        questionsAnswered: 0,
        correct: 0,
        incorrect: 0,
        accuracy: 0,
        totalTimeMs: 0,
        avgTimeMs: 0,
        systemBreakdown: new Map(),
      };
      existing.dueCount = forecast.count;
      map.set(forecast.date, existing);
    });

    // Merge streak history
    streakHistory.forEach((streak) => {
      const existing = map.get(streak.date);
      if (existing) {
        existing.streakActive = streak.active;
        existing.streakLength = streak.streakLength;
      }
    });

    return map;
  }, [performanceData, dueForecasts, streakHistory]);

  // Calculate max value for intensity scaling
  const maxValue = useMemo(() => {
    const config = VIEW_MODES[viewMode];
    let max = 0;
    dataMap.forEach((data) => {
      const value = config.getValue(data);
      if (value > max) max = value;
    });
    return max || 1;
  }, [dataMap, viewMode]);

  // Generate months to display
  const monthsData = useMemo(() => {
    const months: { year: number; month: number }[] = [];
    const now = new Date();

    for (let i = monthsToShow - 1; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i + monthOffset, 1);
      months.push({ year: date.getFullYear(), month: date.getMonth() });
    }

    return months;
  }, [monthsToShow, monthOffset]);

  const config = VIEW_MODES[viewMode];

  return (
    <div
      className={`
      bg-[var(--color-bg-secondary)] rounded-xl p-4 sm:p-6
      ${compact ? 'max-w-md' : ''}
    `}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <config.icon className="w-5 h-5 text-[var(--color-accent)]" />
          <div>
            <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">
              Study Calendar
            </h3>
            <p className="text-xs text-[var(--color-text-muted)]">{config.description}</p>
          </div>
        </div>

        {/* View Selector Button */}
        <div className="relative">
          <button
            onClick={() => setShowViewSelector(!showViewSelector)}
            className="flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg
              bg-[var(--color-bg-tertiary)] hover:bg-[var(--color-bg-tertiary)]/80
              text-[var(--color-text-primary)] transition-colors"
          >
            <BarChart2 className="w-4 h-4" />
            {config.label}
            <Settings className="w-3 h-3" />
          </button>

          {/* View Mode Dropdown */}
          <AnimatePresence>
            {showViewSelector && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="absolute right-0 top-full mt-2 w-48 z-50
                  bg-[var(--color-bg-secondary)] border border-[var(--color-border)]
                  rounded-lg shadow-xl overflow-hidden"
              >
                {(Object.keys(VIEW_MODES) as CalendarViewMode[]).map((mode) => {
                  const modeConfig = VIEW_MODES[mode];
                  const Icon = modeConfig.icon;
                  return (
                    <button
                      key={mode}
                      onClick={() => {
                        setViewMode(mode);
                        setShowViewSelector(false);
                      }}
                      className={`
                        w-full flex items-center gap-2 px-4 py-2 text-sm text-left
                        hover:bg-[var(--color-bg-tertiary)] transition-colors
                        ${viewMode === mode ? 'bg-[var(--color-accent)]/10 text-[var(--color-accent)]' : 'text-[var(--color-text-primary)]'}
                      `}
                    >
                      <Icon className="w-4 h-4" />
                      {modeConfig.label}
                    </button>
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => setMonthOffset((mo) => mo - 1)}
          className="p-2 rounded-lg hover:bg-[var(--color-bg-tertiary)] transition-colors"
        >
          <ChevronLeft className="w-5 h-5 text-[var(--color-text-muted)]" />
        </button>

        <button
          onClick={() => setMonthOffset(0)}
          className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-accent)] transition-colors"
        >
          Today
        </button>

        <button
          onClick={() => setMonthOffset((mo) => mo + 1)}
          disabled={monthOffset >= 0}
          className="p-2 rounded-lg hover:bg-[var(--color-bg-tertiary)] transition-colors disabled:opacity-30"
        >
          <ChevronRight className="w-5 h-5 text-[var(--color-text-muted)]" />
        </button>
      </div>

      {/* Calendar Grid */}
      <div
        className={`
        flex gap-6 overflow-x-auto pb-2
        ${compact ? 'justify-center' : 'justify-start sm:justify-center'}
      `}
      >
        {monthsData.map(({ year, month }) => (
          <MonthGrid
            key={`${year}-${month}`}
            year={year}
            month={month}
            dataMap={dataMap}
            viewMode={viewMode}
            maxValue={maxValue}
            onDayClick={onDayClick}
          />
        ))}
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-2 mt-4 text-xs text-[var(--color-text-muted)]">
        <span>Less</span>
        <div className="flex gap-1">
          {config.colorScale.map((color, idx) => (
            <div key={idx} className={`w-3 h-3 rounded-sm ${color}`} />
          ))}
        </div>
        <span>More</span>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-[var(--color-border)]">
        <div className="text-center">
          <div className="text-2xl font-bold text-[var(--color-text-primary)]">
            {performanceData.length}
          </div>
          <div className="text-xs text-[var(--color-text-muted)]">Total Questions</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-[var(--color-accent)]">{dataMap.size}</div>
          <div className="text-xs text-[var(--color-text-muted)]">Active Days</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-[var(--color-text-primary)]">
            {Math.round(
              performanceData.length > 0
                ? (performanceData.filter((r) => r.isCorrect).length / performanceData.length) * 100
                : 0
            )}
            %
          </div>
          <div className="text-xs text-[var(--color-text-muted)]">Avg Accuracy</div>
        </div>
      </div>
    </div>
  );
};

export default StudyCalendar;
