/**
 * Heatmap Calendar Component
 * 
 * GitHub-style contribution calendar showing study activity and mastery progression.
 * Displays 12 weeks of data with color-coded squares.
 */

import React, { useMemo } from 'react';
import { getTodayUTC, DAY_NAMES } from '@/lib/utils/timeUtils';

// ============================================================================
// Types
// ============================================================================

export interface ProgressDayRecord {
  date: string;          // "2025-01-14"
  attempts: number;
  correct: number;
  accuracy: number;
  system: string;
}

export type HeatmapMetric = 'attempts' | 'accuracy' | 'streak';

interface HeatmapCalendarProps {
  /** Array of daily progress records */
  records: ProgressDayRecord[];
  /** Metric to display */
  metric?: HeatmapMetric;
  /** Number of weeks to display */
  weeks?: number;
}

// ============================================================================
// Constants
// ============================================================================

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Color scales for different metrics - using consistent UI theme colors
const COLOR_SCALES = {
  attempts: [
    'bg-slate-100 dark:bg-slate-800',      // 0 - empty
    'bg-slate-200 dark:bg-slate-700',      // 1-5
    'bg-slate-300 dark:bg-slate-600',      // 6-10
    'bg-slate-400 dark:bg-slate-500',      // 11-20
    'bg-slate-500 dark:bg-slate-400',      // 21+
  ],
  accuracy: [
    'bg-slate-100 dark:bg-slate-800',      // no data
    'bg-slate-200 dark:bg-slate-700',      // <50%
    'bg-slate-300 dark:bg-slate-600',      // 50-69%
    'bg-slate-400 dark:bg-slate-500',      // 70-84%
    'bg-slate-500 dark:bg-slate-400',      // 85%+
  ],
  streak: [
    'bg-slate-100 dark:bg-slate-800',      // 0 - empty
    'bg-slate-200 dark:bg-slate-700',      // 1-2
    'bg-slate-300 dark:bg-slate-600',      // 3-5
    'bg-slate-400 dark:bg-slate-500',      // 6-10
    'bg-slate-500 dark:bg-slate-400',      // 11+
  ],
};

// ============================================================================
// Helper Functions
// ============================================================================

function getColorLevel(value: number, metric: HeatmapMetric): number {
  if (metric === 'attempts') {
    if (value === 0) return 0;
    if (value <= 5) return 1;
    if (value <= 10) return 2;
    if (value <= 20) return 3;
    return 4;
  }
  
  if (metric === 'accuracy') {
    if (value === 0) return 0;
    if (value < 50) return 1;
    if (value < 70) return 2;
    if (value < 85) return 3;
    return 4;
  }
  
  // streak
  if (value === 0) return 0;
  if (value <= 2) return 1;
  if (value <= 5) return 2;
  if (value <= 10) return 3;
  return 4;
}

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

function generateDateRange(weeks: number): Date[] {
  const dates: Date[] = [];
  
  // Get today in UTC using the helper function to ensure consistency
  const today = getTodayUTC();
  
  // Get day of week in UTC (0 = Sunday, 6 = Saturday)
  const todayDayOfWeek = today.getUTCDay();
  
  // Start from the beginning of the week, X weeks ago
  const startDate = new Date(today);
  startDate.setUTCDate(today.getUTCDate() - (weeks * 7) - todayDayOfWeek);
  
  const endDate = new Date(today);
  endDate.setUTCDate(today.getUTCDate() + (6 - todayDayOfWeek));
  
  const current = new Date(startDate);
  while (current <= endDate) {
    dates.push(new Date(current));
    current.setUTCDate(current.getUTCDate() + 1);
  }
  
  return dates;
}

// ============================================================================
// Component
// ============================================================================

const HeatmapCalendar: React.FC<HeatmapCalendarProps> = ({
  records,
  metric = 'attempts',
  weeks = 12,
}) => {
  // Create a map for quick lookup
  const recordMap = useMemo(() => {
    const map = new Map<string, ProgressDayRecord>();
    for (const record of records) {
      map.set(record.date, record);
    }
    return map;
  }, [records]);
  
  // Generate the date grid
  const dateGrid = useMemo(() => {
    const dates = generateDateRange(weeks);
    const grid: (Date | null)[][] = Array(7).fill(null).map(() => []);
    
    for (const date of dates) {
      // Use UTC day of week to ensure consistency
      const dayOfWeek = date.getUTCDay();
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
  
  // Get month labels for the header - aligned with columns
  const monthLabels = useMemo(() => {
    const labels: { month: string; startCol: number; endCol: number }[] = [];
    let currentMonth = -1;
    let monthStartCol = 0;
    
    // Iterate through columns to find month boundaries
    const numCols = dateGrid[0].length;
    for (let colIdx = 0; colIdx < numCols; colIdx++) {
      // Check the first non-null date in this column to determine the month
      let colMonth = -1;
      for (let rowIdx = 0; rowIdx < dateGrid.length; rowIdx++) {
        const date = dateGrid[rowIdx][colIdx];
        if (date) {
          // Use UTC month to ensure consistency
          colMonth = date.getUTCMonth();
          break;
        }
      }
      
      if (colMonth !== -1) {
        if (colMonth !== currentMonth) {
          // Month changed, save previous month label
          if (currentMonth !== -1) {
            labels.push({ 
              month: MONTHS[currentMonth], 
              startCol: monthStartCol, 
              endCol: colIdx - 1 
            });
          }
          currentMonth = colMonth;
          monthStartCol = colIdx;
        }
      }
    }
    
    // Add final month label
    if (currentMonth !== -1) {
      labels.push({ 
        month: MONTHS[currentMonth], 
        startCol: monthStartCol, 
        endCol: numCols - 1 
      });
    }
    
    return labels;
  }, [dateGrid]);
  
  // Get value for a specific date
  const getValue = (date: Date | null): number => {
    if (!date) return 0;
    const record = recordMap.get(formatDate(date));
    if (!record) return 0;
    
    switch (metric) {
      case 'attempts':
        return record.attempts;
      case 'accuracy':
        return record.accuracy;
      case 'streak':
        return record.attempts > 0 ? 1 : 0; // Simplified streak
      default:
        return 0;
    }
  };
  
  // Format tooltip text
  const getTooltip = (date: Date | null): string => {
    if (!date) return '';
    const record = recordMap.get(formatDate(date));
    const dateStr = date.toLocaleDateString('en-US', { 
      weekday: 'short', 
      month: 'short', 
      day: 'numeric' 
    });
    
    if (!record) {
      return `${dateStr}: No activity`;
    }
    
    return `${dateStr}: ${record.attempts} questions, ${record.accuracy.toFixed(0)}% accuracy`;
  };
  
  return (
    <div className="card-premium-glass card-noise-texture p-5 rounded-2xl w-full">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold tracking-tight text-slate-900 dark:text-slate-100">
          Study Activity
        </h3>
        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
          <span>Less</span>
          {COLOR_SCALES[metric].map((color, idx) => (
            <div
              key={idx}
              className={`w-3 h-3 rounded-sm ${color}`}
            />
          ))}
          <span>More</span>
        </div>
      </div>
      
      {/* Month labels - positioned above their corresponding columns */}
      <div className="flex mb-1 ml-8" style={{ position: 'relative', width: 'calc(100% - 2rem)' }}>
        {monthLabels.map((label, idx) => {
          const totalCols = dateGrid[0].length;
          const width = ((label.endCol - label.startCol + 1) / totalCols) * 100;
          const left = (label.startCol / totalCols) * 100;
          
          return (
            <div
              key={idx}
              className="text-xs text-slate-600 dark:text-slate-400 font-medium"
              style={{ 
                position: 'absolute',
                left: `${left}%`,
                width: `${width}%`,
              }}
            >
              {label.month}
            </div>
          );
        })}
      </div>
      
      {/* Grid - Full width with evenly distributed squares */}
      <div className="flex w-full">
        {/* Day labels - show only Mon/Wed/Fri like GitHub */}
        <div className="flex flex-col gap-0.5 mr-2 flex-shrink-0">
          {DAY_NAMES.map((day, idx) => (
            <div
              key={idx}
              className="h-3 text-xs text-slate-600 dark:text-slate-400 flex items-center"
              style={{ visibility: idx === 1 || idx === 3 || idx === 5 ? 'visible' : 'hidden' }}
            >
              {day}
            </div>
          ))}
        </div>
        
        {/* Cells - Full width with justify-between */}
        <div className="flex flex-1 justify-between">
          {dateGrid[0].map((_, colIdx) => (
            <div key={colIdx} className="flex flex-col gap-0.5">
              {dateGrid.map((row, rowIdx) => {
                const date = row[colIdx];
                const value = getValue(date);
                const level = getColorLevel(value, metric);
                const colorClass = COLOR_SCALES[metric][level];
                const tooltip = getTooltip(date);
                const isFuture = date && date > new Date();
                
                return (
                  <div
                    key={rowIdx}
                    className={`w-3 h-3 rounded-sm transition-all duration-200 ${
                      isFuture 
                        ? 'bg-slate-100 dark:bg-slate-800' 
                        : colorClass
                    } ${date ? 'cursor-pointer hover:ring-2 hover:ring-slate-900 dark:hover:ring-slate-300 hover:scale-110' : ''}`}
                    title={tooltip}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>
      
      {/* Summary stats */}
      <div className="mt-4 pt-3 border-t border-slate-200/60 dark:border-slate-700/60 grid grid-cols-3 gap-4">
        <div className="text-center">
          <div className="text-3xl font-light text-slate-900 dark:text-slate-100">
            {records.reduce((sum, r) => sum + r.attempts, 0)}
          </div>
          <div className="stat-label-sm mt-1">Total Questions</div>
        </div>
        <div className="text-center">
          <div className="text-3xl font-light text-slate-900 dark:text-slate-100">
            {records.length}
          </div>
          <div className="stat-label-sm mt-1">Active Days</div>
        </div>
        <div className="text-center">
          <div className="text-3xl font-light text-slate-900 dark:text-slate-100">
            {records.length > 0 
              ? (records.reduce((sum, r) => sum + r.accuracy, 0) / records.length).toFixed(0)
              : 0}%
          </div>
          <div className="stat-label-sm mt-1">Avg Accuracy</div>
        </div>
      </div>
    </div>
  );
};

export default HeatmapCalendar;

// Generate mock data for development/testing
export function generateMockHeatmapData(days: number = 90): ProgressDayRecord[] {
  const records: ProgressDayRecord[] = [];
  const systems = ['CV', 'PULM', 'GI', 'NEURO', 'MSK', 'DERM', 'HEME', 'ENDO'];
  
  for (let i = 0; i < days; i++) {
    // 60% chance of having activity on any day
    if (Math.random() > 0.4) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      
      const attempts = Math.floor(Math.random() * 30) + 1;
      const correct = Math.floor(attempts * (0.5 + Math.random() * 0.45));
      
      records.push({
        date: formatDate(date),
        attempts,
        correct,
        accuracy: (correct / attempts) * 100,
        system: systems[Math.floor(Math.random() * systems.length)],
      });
    }
  }
  
  return records;
}
