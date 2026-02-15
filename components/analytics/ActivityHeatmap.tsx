/**
 * ActivityHeatmap Component
 *
 * GitHub-style contribution calendar showing daily study activity intensity.
 * Displays the number of questions answered per day using intensity shading.
 * Users can click a day to see a detailed summary panel.
 */

import React, { useMemo, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import type { PerformanceRecord, SystemCode } from '@/types';
import { useLowPowerMode } from '@/hooks/useLowPowerMode';
import { ABBREVIATION_TO_TOPIC_MAP } from '@/src/constants';
import DayCellPopover, { DayActivityData } from './DayCellPopover';
import { getTodayUTC, DAY_NAMES } from '@/lib/utils/timeUtils';

interface ActivityHeatmapProps {
  performanceData: PerformanceRecord[];
  /** Number of weeks to display (default: 13 for quarterly view) */
  weeks?: number;
  /** Called when user clicks "Start First Session" in empty state. If not provided, falls back to /menu (parent should pass callback for in-app nav). */
  onStartFirstSession?: () => void;
}

interface DailyStats {
  date: string; // YYYY-MM-DD
  questionsAnswered: number;
  correct: number;
  incorrect: number;
  accuracy: number;
  totalTimeMs: number;
  avgTimeMs: number;
  systemPerformance: Map<string, { correct: number; total: number }>;
}

/**
 * Color intensity based on questions answered per day
 * Uses semantic action-blue scale: darker = more activity
 * Following "Stormy Slate" design system
 */
function getIntensityColor(count: number): string {
  if (count === 0) {
    return 'bg-slate-100 dark:bg-[var(--color-bg-tertiary)] border-slate-200 dark:border-[var(--color-border)]';
  } else if (count <= 5) {
    return 'bg-[var(--color-accent)]/20 border-[var(--color-accent)]/30';
  } else if (count <= 15) {
    return 'bg-[var(--color-accent)]/50 border-[var(--color-accent)]/60';
  } else if (count <= 30) {
    return 'bg-[var(--color-accent)]/75 border-[var(--color-accent)]/80';
  } else {
    // High activity → darkest, most vibrant shade
    return 'bg-[var(--color-accent)] border-[var(--color-accent)]';
  }
}

/**
 * Generate date range for the heatmap grid
 * Uses UTC dates to ensure consistency regardless of client timezone
 */
function generateDateRange(weeks: number): Date[] {
  const dates: Date[] = [];

  // Get today in UTC using the helper function
  const today = getTodayUTC();

  // Get day of week in UTC (0 = Sunday, 6 = Saturday)
  const todayDayOfWeek = today.getUTCDay();

  // Start from the beginning of the week, X weeks ago
  const startDate = new Date(today);
  startDate.setUTCDate(today.getUTCDate() - weeks * 7 - todayDayOfWeek);

  const endDate = new Date(today);
  endDate.setUTCDate(today.getUTCDate() + (6 - todayDayOfWeek));

  const current = new Date(startDate);
  while (current <= endDate) {
    dates.push(new Date(current));
    current.setUTCDate(current.getUTCDate() + 1);
  }

  return dates;
}

/**
 * Format date to YYYY-MM-DD
 */
function formatDateKey(date: Date): string {
  return date.toISOString().split('T')[0] ?? '';
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * Get month labels for the header, aligned left-flush with the first week of each month (GitHub-style).
 * Returns startCol (first column index where that month appears) and endCol (exclusive) for positioning.
 */
function getMonthLabels(
  dateGrid: (Date | null)[][]
): { month: string; startCol: number; endCol: number }[] {
  const firstRow = dateGrid[0];
  if (!firstRow) return [];

  const numCols = firstRow.length;
  // For each month (0-11), find the first column index that contains any day in that month
  const firstColByMonth = new Map<number, number>();

  for (let colIdx = 0; colIdx < numCols; colIdx++) {
    const monthsInColumn = new Set<number>();
    for (let rowIdx = 0; rowIdx < dateGrid.length; rowIdx++) {
      const date = dateGrid[rowIdx]?.[colIdx];
      if (date) monthsInColumn.add(date.getUTCMonth());
    }
    monthsInColumn.forEach((month) => {
      if (!firstColByMonth.has(month)) firstColByMonth.set(month, colIdx);
    });
  }

  // Build sorted list of (month, startCol), then add endCol
  const entries = Array.from(firstColByMonth.entries()).sort((a, b) => a[1] - b[1]);

  return entries.map(([monthNum, startCol], i) => {
    const endCol = i + 1 < entries.length ? entries[i + 1]![1] : numCols;
    return {
      month: MONTHS[monthNum] ?? '',
      startCol,
      endCol,
    };
  });
}

const ActivityHeatmap: React.FC<ActivityHeatmapProps> = ({
  performanceData,
  weeks = 13,
  onStartFirstSession,
}) => {
  const [selectedDay, setSelectedDay] = useState<DayActivityData | null>(null);
  const lowPower = useLowPowerMode();

  const handleStartFirstSession = useCallback(() => {
    if (onStartFirstSession) {
      onStartFirstSession();
    } else {
      window.location.href = '/menu';
    }
  }, [onStartFirstSession]);
  const [popoverPosition, setPopoverPosition] = useState<{ x: number; y: number } | undefined>();

  // Process performance data into daily stats
  const dailyStatsMap = useMemo(() => {
    const statsMap = new Map<string, DailyStats>();

    performanceData.forEach((record) => {
      const date = new Date(record.timestamp);
      const dateKey = formatDateKey(date);

      if (!statsMap.has(dateKey)) {
        statsMap.set(dateKey, {
          date: dateKey,
          questionsAnswered: 0,
          correct: 0,
          incorrect: 0,
          accuracy: 0,
          totalTimeMs: 0,
          avgTimeMs: 0,
          systemPerformance: new Map(),
        });
      }

      const stats = statsMap.get(dateKey);
      if (!stats) return; // Guard: skip this iteration (return in forEach = continue)
      stats.questionsAnswered++;

      if (record.isCorrect) {
        stats.correct++;
      } else {
        stats.incorrect++;
      }

      if (record.timeSpentMs) {
        stats.totalTimeMs += record.timeSpentMs;
      }

      // Track system performance
      if (record.system && record.system !== 'OTHER') {
        const systemKey = record.system;
        const systemStats = stats.systemPerformance.get(systemKey) || { correct: 0, total: 0 };
        systemStats.total++;
        if (record.isCorrect) {
          systemStats.correct++;
        }
        stats.systemPerformance.set(systemKey, systemStats);
      }
    });

    // Calculate accuracy and average time
    statsMap.forEach((stats) => {
      stats.accuracy =
        stats.questionsAnswered > 0
          ? Math.round((stats.correct / stats.questionsAnswered) * 100)
          : 0;
      stats.avgTimeMs =
        stats.questionsAnswered > 0 ? Math.round(stats.totalTimeMs / stats.questionsAnswered) : 0;
    });

    return statsMap;
  }, [performanceData]);

  // Generate the date grid for display
  const dateGrid = useMemo(() => {
    const dates = generateDateRange(weeks);
    const grid: (Date | null)[][] = Array(7)
      .fill(null)
      .map(() => []);

    for (const date of dates) {
      // Use UTC day of week to ensure consistency
      const dayOfWeek = date.getUTCDay();
      grid[dayOfWeek]?.push(date);
    }

    // Pad each row to the same length
    const maxLen = Math.max(...grid.map((row) => row.length));
    for (const row of grid) {
      while (row.length < maxLen) {
        row.unshift(null);
      }
    }

    return grid;
  }, [weeks]);

  // Get month labels
  const monthLabels = useMemo(() => getMonthLabels(dateGrid), [dateGrid]);

  // Recent activity list for mobile (last 14 days with activity, newest first)
  const recentActivityList = useMemo(() => {
    const entries = Array.from(dailyStatsMap.entries())
      .filter(([, s]) => s.questionsAnswered > 0)
      .sort(([a], [b]) => (a > b ? -1 : 1))
      .slice(0, 14);
    return entries.map(([dateKey, stats]) => ({
      dateKey,
      ...stats,
      displayDate: (() => {
        const d = new Date(dateKey + 'T12:00:00Z');
        const today = getTodayUTC();
        const todayKey = formatDateKey(today);
        if (dateKey === todayKey) return 'Today';
        const yesterday = new Date(today);
        yesterday.setUTCDate(yesterday.getUTCDate() - 1);
        if (dateKey === formatDateKey(yesterday)) return 'Yesterday';
        return d.toLocaleDateString(undefined, {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
        });
      })(),
    }));
  }, [dailyStatsMap]);

  // Handle day cell click
  const handleDayClick = useCallback(
    (date: Date | null, event: React.MouseEvent) => {
      if (!date) return;

      const dateKey = formatDateKey(date);
      const stats = dailyStatsMap.get(dateKey);

      if (!stats || stats.questionsAnswered === 0) {
        // No activity on this day
        return;
      }

      // Find weakest system
      let weakestSystem: string | undefined;
      let weakestAccuracy = 100;

      stats.systemPerformance.forEach((systemStats, systemCode) => {
        const accuracy =
          systemStats.total > 0 ? Math.round((systemStats.correct / systemStats.total) * 100) : 0;
        if (accuracy < weakestAccuracy) {
          weakestAccuracy = accuracy;
          weakestSystem = systemCode;
        }
      });

      const dayData: DayActivityData = {
        date: stats.date,
        questionsAnswered: stats.questionsAnswered,
        correct: stats.correct,
        incorrect: stats.incorrect,
        accuracy: stats.accuracy,
        avgTimeMs: stats.avgTimeMs,
        weakestSystem: weakestSystem
          ? ABBREVIATION_TO_TOPIC_MAP[weakestSystem as SystemCode] || weakestSystem
          : undefined,
        weakestSystemAccuracy: weakestSystem ? weakestAccuracy : undefined,
      };

      // Get position for popover
      const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
      setPopoverPosition({
        x: rect.left + rect.width / 2,
        y: rect.top,
      });
      setSelectedDay(dayData);
    },
    [dailyStatsMap]
  );

  // Close popover
  const handleClosePopover = useCallback(() => {
    setSelectedDay(null);
    setPopoverPosition(undefined);
  }, []);

  const DAYS_OF_WEEK = DAY_NAMES;

  // Check if there's any activity data
  const hasActivity = performanceData.length > 0;

  return (
    <div className="w-full">
      {/* Empty State */}
      {!hasActivity && (
        <div className="flex flex-col items-center justify-center py-12 px-4 bg-[var(--color-bg-secondary)] rounded-xl">
          <div className="mb-4">
            <svg
              className="w-20 h-20 text-[var(--color-text-muted)] opacity-50"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-[var(--color-text-primary)] mb-2">
            Not yet assessed
          </h3>
          <p className="text-sm text-[var(--color-text-muted)] text-center max-w-sm mb-6">
            Your activity heatmap will appear here once you answer questions.
          </p>
          <button
            onClick={handleStartFirstSession}
            aria-label="Take a 10-question diagnostic quiz to unlock this graph"
            className="px-6 py-3 bg-[var(--color-accent)] hover:bg-[var(--color-accent)]/90 border border-[var(--color-accent)]/40 rounded-xl text-[var(--color-text-inverse)] font-semibold transition-all shadow-lg flex items-center gap-2 mx-auto"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            Take a 10-question diagnostic quiz to unlock this graph
          </button>
        </div>
      )}

      {/* Heatmap Content */}
      {hasActivity && (
        <>
          {/* Mobile: List view of recent activity (no hover, easy to scan) */}
          <div className="md:hidden mb-4">
            <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-2">
              Recent Activity
            </h3>
            <ul className="space-y-1 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)]/50 overflow-hidden">
              {recentActivityList.length === 0 ? (
                <li className="px-4 py-3 text-sm text-[var(--color-text-muted)]">
                  No recent days with activity
                </li>
              ) : (
                recentActivityList.map((item) => (
                  <li
                    key={item.dateKey}
                    className="flex items-center justify-between px-4 py-3 min-h-[44px] text-sm border-b border-[var(--color-border)] last:border-b-0"
                  >
                    <span className="font-medium text-[var(--color-text-primary)]">
                      {item.displayDate}
                    </span>
                    <span className="text-[var(--color-text-secondary)] tabular-nums">
                      {item.questionsAnswered} q · {item.accuracy}%
                    </span>
                  </li>
                ))
              )}
            </ul>
          </div>

          {/* Legend - desktop or above list on mobile */}
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
              Activity Heatmap
            </h3>
            <div className="flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
              <span>Less</span>
              <div className="flex gap-1">
                {[0, 1, 10, 20, 40].map((count, idx) => (
                  <div
                    key={idx}
                    className={`w-3 h-3 rounded-sm border ${getIntensityColor(count)}`}
                    title={`${count === 0 ? 'No activity' : count === 1 ? '1-5 questions' : count === 10 ? '6-15 questions' : count === 20 ? '16-30 questions' : '31+ questions'}`}
                  />
                ))}
              </div>
              <span>More</span>
            </div>
          </div>

          <p className="md:hidden text-xs text-[var(--color-text-muted)] mb-2">
            Scroll horizontally for full calendar
          </p>
          {/* Heatmap Grid Container - Horizontal scroll on mobile, touch-friendly */}
          <div
            className="overflow-x-auto -mx-1 px-1"
            style={{ WebkitOverflowScrolling: 'touch' }}
            role="region"
            aria-label="Study calendar grid - scroll horizontally for full view"
          >
            <div className="inline-block min-w-full">
              {/* Month labels - left-flush with first week of each month (GitHub-style) */}
              <div className="relative mb-2 ml-8 sm:ml-10" style={{ height: '1.25rem' }}>
                {monthLabels.map((label, idx) => {
                  const CELL_WIDTH_WITH_GAP = 18;
                  const left = label.startCol * CELL_WIDTH_WITH_GAP;
                  const width = (label.endCol - label.startCol) * CELL_WIDTH_WITH_GAP;
                  return (
                    <div
                      key={idx}
                      className="absolute text-[10px] sm:text-xs text-[var(--color-text-muted)] font-medium"
                      style={{
                        left: `${left}px`,
                        width: `${width}px`,
                        textAlign: 'left',
                        paddingLeft: '2px',
                      }}
                    >
                      {label.month}
                    </div>
                  );
                })}
              </div>

              {/* Grid */}
              <div className="flex gap-0.5 sm:gap-1">
                {/* Day labels - only show Mon/Wed/Fri like GitHub */}
                <div className="flex flex-col gap-0.5 sm:gap-1 pr-1 sm:pr-2">
                  {DAYS_OF_WEEK.map((day, idx) => (
                    <div
                      key={day}
                      className="h-3 text-[10px] sm:text-xs text-[var(--color-text-muted)] flex items-center w-6 sm:w-8"
                      style={{
                        visibility: idx === 1 || idx === 3 || idx === 5 ? 'visible' : 'hidden',
                      }}
                    >
                      {day}
                    </div>
                  ))}
                </div>

                {/* Date cells — GPU layer; no stagger/hover when low power (battery drain audit) */}
                {(dateGrid[0] ?? []).map((_, colIdx) => (
                  <div
                    key={colIdx}
                    className="flex flex-col gap-0.5 sm:gap-1"
                    style={{ transform: 'translateZ(0)' }}
                  >
                    {dateGrid.map((row, rowIdx) => {
                      const date = row[colIdx];
                      const dateKey = date ? formatDateKey(date) : null;
                      const stats = dateKey ? dailyStatsMap.get(dateKey) : null;
                      const count = stats?.questionsAnswered || 0;

                      return (
                        <motion.button
                          key={`${rowIdx}-${colIdx}`}
                          initial={lowPower ? false : { opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={
                            lowPower ? { duration: 0 } : { delay: colIdx * 0.01, duration: 0.2 }
                          }
                          whileHover={lowPower ? undefined : { scale: 1.2, zIndex: 10 }}
                          whileTap={lowPower ? undefined : { scale: 0.95 }}
                          onClick={(e) => handleDayClick(date ?? null, e)}
                          disabled={!date}
                          className={`w-3 h-3 sm:w-3.5 sm:h-3.5 rounded-sm border transition-all ${
                            date
                              ? `${getIntensityColor(count)} cursor-pointer hover:ring-2 hover:ring-[var(--color-accent)]/50`
                              : 'bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-600 cursor-default'
                          }`}
                          title={
                            date && stats
                              ? `${formatDateKey(date)}: ${count} questions (${stats.accuracy}% accuracy)`
                              : undefined
                          }
                        />
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Popover */}
          {selectedDay && (
            <DayCellPopover
              data={selectedDay}
              position={popoverPosition}
              onClose={handleClosePopover}
            />
          )}
        </>
      )}
    </div>
  );
};

export default ActivityHeatmap;
