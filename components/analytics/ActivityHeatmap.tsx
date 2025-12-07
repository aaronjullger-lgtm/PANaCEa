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
import { ABBREVIATION_TO_TOPIC_MAP } from '@/constants';
import DayCellPopover, { DayActivityData } from './DayCellPopover';

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
 * Uses consistent UI theme colors - different shades of the same base color
 */
function getIntensityColor(count: number): string {
  if (count === 0) {
    return 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700';
  } else if (count <= 5) {
    return 'bg-slate-200 dark:bg-slate-700 border-slate-300 dark:border-slate-600';
  } else if (count <= 15) {
    return 'bg-slate-300 dark:bg-slate-600 border-slate-400 dark:border-slate-500';
  } else if (count <= 30) {
    return 'bg-slate-400 dark:bg-slate-500 border-slate-500 dark:border-slate-400';
  } else {
    // High activity → darkest shade
    return 'bg-slate-500 dark:bg-slate-400 border-slate-600 dark:border-slate-300';
  }
}

/**
 * Generate date range for the heatmap grid
 */
function generateDateRange(weeks: number): Date[] {
  const dates: Date[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Start from the beginning of the week, X weeks ago
  const startDate = new Date(today);
  startDate.setDate(today.getDate() - (weeks * 7) - today.getDay());

  const endDate = new Date(today);
  endDate.setDate(today.getDate() + (6 - today.getDay()));

  const current = new Date(startDate);
  while (current <= endDate) {
    dates.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }

  return dates;
}

/**
 * Format date to YYYY-MM-DD
 */
function formatDateKey(date: Date): string {
  return date.toISOString().split('T')[0];
}

/**
 * Get month labels for the header
 * Fixed to properly align with week columns by checking the most common month in each column
 */
function getMonthLabels(dateGrid: (Date | null)[][]): { month: string; colSpan: number }[] {
  const labels: { month: string; colSpan: number }[] = [];
  let currentMonth = -1;
  let colCount = 0;

  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  // Traverse columns (weeks) to build month labels
  for (let colIdx = 0; colIdx < dateGrid[0].length; colIdx++) {
    // Get the most common month in this column (week)
    const monthCounts = new Map<number, number>();
    let hasValidDate = false;
    
    for (let rowIdx = 0; rowIdx < dateGrid.length; rowIdx++) {
      const date = dateGrid[rowIdx][colIdx];
      if (date) {
        hasValidDate = true;
        const month = date.getMonth();
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
          labels.push({ month: MONTHS[currentMonth], colSpan: colCount });
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
    labels.push({ month: MONTHS[currentMonth], colSpan: colCount });
  }

  return labels;
}

const ActivityHeatmap: React.FC<ActivityHeatmapProps> = ({ 
  performanceData, 
  weeks = 13 
}) => {
  const [selectedDay, setSelectedDay] = useState<DayActivityData | null>(null);
  const [popoverPosition, setPopoverPosition] = useState<{ x: number; y: number } | undefined>();

  // Process performance data into daily stats
  const dailyStatsMap = useMemo(() => {
    const statsMap = new Map<string, DailyStats>();

    performanceData.forEach(record => {
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

      const stats = statsMap.get(dateKey)!;
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
    statsMap.forEach(stats => {
      stats.accuracy = stats.questionsAnswered > 0 
        ? Math.round((stats.correct / stats.questionsAnswered) * 100) 
        : 0;
      stats.avgTimeMs = stats.questionsAnswered > 0 
        ? Math.round(stats.totalTimeMs / stats.questionsAnswered) 
        : 0;
    });

    return statsMap;
  }, [performanceData]);

  // Generate the date grid for display
  const dateGrid = useMemo(() => {
    const dates = generateDateRange(weeks);
    const grid: (Date | null)[][] = Array(7).fill(null).map(() => []);

    for (const date of dates) {
      const dayOfWeek = date.getDay();
      grid[dayOfWeek].push(date);
    }

    // Pad each row to the same length
    const maxLen = Math.max(...grid.map(row => row.length));
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
  const handleDayClick = useCallback((date: Date | null, event: React.MouseEvent) => {
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
      const accuracy = systemStats.total > 0 
        ? Math.round((systemStats.correct / systemStats.total) * 100) 
        : 0;
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
      weakestSystem: weakestSystem ? ABBREVIATION_TO_TOPIC_MAP[weakestSystem as SystemCode] || weakestSystem : undefined,
      weakestSystemAccuracy: weakestSystem ? weakestAccuracy : undefined,
    };

    // Get position for popover
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    setPopoverPosition({
      x: rect.left + rect.width / 2,
      y: rect.top
    });
    setSelectedDay(dayData);
  }, [dailyStatsMap]);

  // Close popover
  const handleClosePopover = useCallback(() => {
    setSelectedDay(null);
    setPopoverPosition(undefined);
  }, []);

  const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div className="w-full">
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
              // Each cell is ~14px (w-3.5) + 4px gap = 18px per column
              const width = label.colSpan * 18;
              return (
                <div
                  key={idx}
                  className="text-[10px] sm:text-xs text-[var(--color-text-muted)] font-medium"
                  style={{ 
                    width: `${width}px`,
                    minWidth: `${width}px`,
                    textAlign: 'left',
                    paddingLeft: '2px'
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
                  style={{ visibility: idx === 1 || idx === 3 || idx === 5 ? 'visible' : 'hidden' }}
                >
                  {day}
                </div>
              ))}
            </div>

            {/* Date cells */}
            {dateGrid[0].map((_, colIdx) => (
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
                        duration: 0.2 
                      }}
                      whileHover={{ scale: 1.2, zIndex: 10 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={(e) => handleDayClick(date, e)}
                      disabled={!date}
                      className={`w-3 h-3 sm:w-3.5 sm:h-3.5 rounded-sm border transition-all ${
                        date 
                          ? `${getIntensityColor(count)} cursor-pointer hover:ring-2 hover:ring-[var(--color-accent)]/50` 
                          : 'bg-transparent border-transparent cursor-default'
                      }`}
                      title={date && stats ? `${formatDateKey(date)}: ${count} questions (${stats.accuracy}% accuracy)` : undefined}
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
    </div>
  );
};

export default ActivityHeatmap;
