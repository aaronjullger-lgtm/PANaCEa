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
import { ABBREVIATION_TO_TOPIC_MAP } from '@/src/constants';
import DayCellPopover, { DayActivityData } from './DayCellPopover';
import { getTodayUTC, DAY_NAMES } from '@/lib/utils/timeUtils';

interface ActivityHeatmapProps {
  performanceData: PerformanceRecord[];
  /** Number of weeks to display (default: 13 for quarterly view) */
  weeks?: number;
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
 * Uses vibrant color scale: darker = more activity
 */
function getIntensityColor(count: number): string {
  if (count === 0) {
    return 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700';
  } else if (count <= 5) {
    return 'bg-blue-200 dark:bg-blue-900/50 border-blue-300 dark:border-blue-800';
  } else if (count <= 15) {
    return 'bg-blue-400 dark:bg-blue-700 border-blue-500 dark:border-blue-600';
  } else if (count <= 30) {
    return 'bg-blue-600 dark:bg-blue-600 border-blue-700 dark:border-blue-500';
  } else {
    // High activity → darkest, most vibrant shade
    return 'bg-blue-800 dark:bg-blue-500 border-blue-900 dark:border-blue-400';
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

/**
 * Get month labels for the header
 * Fixed to properly align with week columns by checking the most common month in each column
 */
function getMonthLabels(dateGrid: (Date | null)[][]): { month: string; colSpan: number }[] {
  const labels: { month: string; colSpan: number }[] = [];
  let currentMonth = -1;
  let colCount = 0;

  const MONTHS = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];

  // Guard: Ensure dateGrid has at least one row
  const firstRow = dateGrid[0];
  if (!firstRow) return labels;

  // Traverse columns (weeks) to build month labels
  for (let colIdx = 0; colIdx < firstRow.length; colIdx++) {
    // Get the most common month in this column (week)
    const monthCounts = new Map<number, number>();
    let hasValidDate = false;

    for (let rowIdx = 0; rowIdx < dateGrid.length; rowIdx++) {
      const date = dateGrid[rowIdx]?.[colIdx];
      if (date) {
        hasValidDate = true;
        // Use UTC month to ensure consistency
        const month = date.getUTCMonth();
        monthCounts.set(month, (monthCounts.get(month) || 0) + 1);
      }
    }

    if (hasValidDate) {
      // Find the month with most occurrences in this column
      let dominantMonth = -1;
      let maxCount = 0;
      monthCounts.forEach((count, month) => {
        if (count > maxCount) {
          maxCount = count;
          dominantMonth = month;
        }
      });

      if (dominantMonth !== currentMonth) {
        if (currentMonth !== -1 && colCount > 0) {
          const monthName = MONTHS[currentMonth] ?? '';
          labels.push({ month: monthName, colSpan: colCount });
        }
        currentMonth = dominantMonth;
        colCount = 1;
      } else {
        colCount++;
      }
    }
  }

  // Push final month
  if (currentMonth !== -1 && colCount > 0) {
    const monthName = MONTHS[currentMonth] ?? '';
    labels.push({ month: monthName, colSpan: colCount });
  }

  return labels;
}

const ActivityHeatmap: React.FC<ActivityHeatmapProps> = ({ performanceData, weeks = 13 }) => {
  const [selectedDay, setSelectedDay] = useState<DayActivityData | null>(null);
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
            No Activity Yet
          </h3>
          <p className="text-sm text-[var(--color-text-muted)] text-center max-w-sm mb-6">
            Your study activity will appear here once you start answering questions.
          </p>
          <button
            onClick={() => (window.location.href = '/menu')}
            className="px-6 py-3 bg-slate-800/50 hover:bg-slate-700 border border-slate-600 hover:border-white rounded-xl text-white font-semibold transition-all shadow-lg flex items-center gap-2 mx-auto"
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
            Start First Session
          </button>
        </div>
      )}

      {/* Heatmap Content */}
      {hasActivity && (
        <>
          {/* Legend */}
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

          {/* Heatmap Grid Container - Scrollable on mobile */}
          <div className="overflow-x-auto">
            <div className="inline-block min-w-full">
              {/* Month labels */}
              <div className="flex mb-2 ml-8 sm:ml-10">
                {monthLabels.map((label, idx) => {
                  // Calculate the width based on column count with proper cell and gap sizing
                  // CELL_WIDTH_WITH_GAP = cell width (14px for w-3.5) + gap (4px) = 18px per column
                  const CELL_WIDTH_WITH_GAP = 18;
                  const width = label.colSpan * CELL_WIDTH_WITH_GAP;
                  return (
                    <div
                      key={idx}
                      className="text-[10px] sm:text-xs text-[var(--color-text-muted)] font-medium"
                      style={{
                        width: `${width}px`,
                        minWidth: `${width}px`,
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

                {/* Date cells */}
                {(dateGrid[0] ?? []).map((_, colIdx) => (
                  <div key={colIdx} className="flex flex-col gap-0.5 sm:gap-1">
                    {dateGrid.map((row, rowIdx) => {
                      const date = row[colIdx];
                      const dateKey = date ? formatDateKey(date) : null;
                      const stats = dateKey ? dailyStatsMap.get(dateKey) : null;
                      const count = stats?.questionsAnswered || 0;

                      return (
                        <motion.button
                          key={`${rowIdx}-${colIdx}`}
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{
                            delay: colIdx * 0.01,
                            duration: 0.2,
                          }}
                          whileHover={{ scale: 1.2, zIndex: 10 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={(e) => handleDayClick(date ?? null, e)}
                          disabled={!date}
                          className={`w-3 h-3 sm:w-3.5 sm:h-3.5 rounded-sm border transition-all ${
                            date
                              ? `${getIntensityColor(count)} cursor-pointer hover:ring-2 hover:ring-[var(--color-accent)]/50`
                              : 'bg-transparent border-transparent cursor-default'
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