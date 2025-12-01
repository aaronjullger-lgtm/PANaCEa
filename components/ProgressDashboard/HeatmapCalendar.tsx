/**
 * Heatmap Calendar Component
 * 
 * GitHub-style contribution calendar showing study activity and mastery progression.
 * Displays 12 weeks of data with color-coded squares.
 */

import React, { useMemo } from 'react';

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

const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Color scales for different metrics
const COLOR_SCALES = {
  attempts: [
    'bg-slate-100 dark:bg-slate-800',      // 0 - using slate-800 for dark mode empty squares
    'bg-emerald-200 dark:bg-emerald-900',  // 1-5
    'bg-emerald-300 dark:bg-emerald-800',  // 6-10
    'bg-emerald-400 dark:bg-emerald-700',  // 11-20
    'bg-emerald-500 dark:bg-emerald-600',  // 21+
  ],
  accuracy: [
    'bg-slate-100 dark:bg-slate-800',      // no data - using slate-800 for dark mode
    'bg-red-300 dark:bg-red-900',          // <50%
    'bg-amber-300 dark:bg-amber-800',      // 50-69%
    'bg-emerald-300 dark:bg-emerald-700',  // 70-84%
    'bg-emerald-500 dark:bg-emerald-500',  // 85%+
  ],
  streak: [
    'bg-slate-100 dark:bg-slate-800',      // 0 - using slate-800 for dark mode
    'bg-orange-200 dark:bg-orange-900',    // 1-2
    'bg-orange-300 dark:bg-orange-800',    // 3-5
    'bg-orange-400 dark:bg-orange-700',    // 6-10
    'bg-orange-500 dark:bg-orange-600',    // 11+
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
  
  // Get month labels for the header
  const monthLabels = useMemo(() => {
    const labels: { month: string; colSpan: number }[] = [];
    let currentMonth = -1;
    let colCount = 0;
    
    // Check first row (Sunday) for month changes
    for (const date of dateGrid[0]) {
      if (date) {
        const month = date.getMonth();
        if (month !== currentMonth) {
          if (currentMonth !== -1) {
            labels.push({ month: MONTHS[currentMonth], colSpan: colCount });
          }
          currentMonth = month;
          colCount = 1;
        } else {
          colCount++;
        }
      } else {
        colCount++;
      }
    }
    
    if (currentMonth !== -1) {
      labels.push({ month: MONTHS[currentMonth], colSpan: colCount });
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
      
      {/* Month labels */}
      <div className="flex mb-1 ml-8 w-full">
        {monthLabels.map((label, idx) => (
          <div
            key={idx}
            className="text-xs text-slate-600 dark:text-slate-400 flex-1"
          >
            {label.month}
          </div>
        ))}
      </div>
      
      {/* Grid - Full width with evenly distributed squares */}
      <div className="flex w-full">
        {/* Day labels - show all 7 days */}
        <div className="flex flex-col gap-0.5 mr-2 flex-shrink-0">
          {DAYS_OF_WEEK.map((day, idx) => (
            <div
              key={idx}
              className="h-3 text-xs text-slate-600 dark:text-slate-400 flex items-center"
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
