/**
 * Difficulty Trend Chart
 * 2026 PA Student Optimization - Priority 8
 * 
 * Visualizes how difficulty adjustments correlate with performance over time
 */

import React from 'react';
import { TrendingUp, TrendingDown, Target } from 'lucide-react';
import {
  getDifficultyAdjustmentHistory,
  type DifficultyAdjustmentEvent,
} from '@/services/adaptiveDifficultyService';

interface DifficultyTrendChartProps {
  className?: string;
}

export const DifficultyTrendChart: React.FC<DifficultyTrendChartProps> = ({ className = '' }) => {
  const history = getDifficultyAdjustmentHistory();
  
  if (history.length === 0) {
    return (
      <div className={`p-6 bg-[var(--color-card-bg)] border border-[var(--color-border)] rounded-xl ${className}`}>
        <h3 className="text-lg font-bold text-[var(--color-text-primary)] mb-2">
          Adaptive Difficulty
        </h3>
        <p className="text-sm text-[var(--color-text-muted)]">
          Complete at least 10 questions to see difficulty adjustments
        </p>
      </div>
    );
  }
  
  // Calculate stats
  const totalAdjustments = history.length;
  const harder = history.filter(e => e.toLevel === 'harder').length;
  const easier = history.filter(e => e.toLevel === 'easier').length;
  const avgAccuracy = history.reduce((sum, e) => sum + e.accuracy, 0) / history.length;
  
  return (
    <div className={`p-6 bg-[var(--color-card-bg)] border border-[var(--color-border)] rounded-xl ${className}`}>
      <h3 className="text-lg font-bold text-[var(--color-text-primary)] mb-4">
        Adaptive Difficulty
      </h3>
      
      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="text-center p-3 bg-[var(--color-bg-secondary)] rounded-lg">
          <div className="text-2xl font-bold text-green-500">{harder}</div>
          <div className="text-xs text-[var(--color-text-muted)] mt-1">
            <TrendingUp className="inline w-3 h-3 mr-1" />
            Harder
          </div>
        </div>
        <div className="text-center p-3 bg-[var(--color-bg-secondary)] rounded-lg">
          <div className="text-2xl font-bold text-[var(--color-accent)]">
            {Math.round(avgAccuracy * 100)}%
          </div>
          <div className="text-xs text-[var(--color-text-muted)] mt-1">
            <Target className="inline w-3 h-3 mr-1" />
            Avg Accuracy
          </div>
        </div>
        <div className="text-center p-3 bg-[var(--color-bg-secondary)] rounded-lg">
          <div className="text-2xl font-bold text-blue-500">{easier}</div>
          <div className="text-xs text-[var(--color-text-muted)] mt-1">
            <TrendingDown className="inline w-3 h-3 mr-1" />
            Easier
          </div>
        </div>
      </div>
      
      {/* Recent Adjustments */}
      <div>
        <h4 className="text-sm font-semibold text-[var(--color-text-secondary)] mb-3">
          Recent Adjustments
        </h4>
        <div className="space-y-2 max-h-48 overflow-y-auto">
          {history.slice(-5).reverse().map((event, idx) => (
            <div
              key={idx}
              className="flex items-start gap-3 p-3 bg-[var(--color-bg-secondary)] rounded-lg text-sm"
            >
              <div className="flex-shrink-0 mt-0.5">
                {event.toLevel === 'harder' && (
                  <TrendingUp className="w-4 h-4 text-green-500" />
                )}
                {event.toLevel === 'easier' && (
                  <TrendingDown className="w-4 h-4 text-blue-500" />
                )}
                {event.toLevel === 'maintain' && (
                  <Target className="w-4 h-4 text-[var(--color-accent)]" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium text-[var(--color-text-primary)]">
                    {event.toLevel === 'harder' && 'Challenge Increased'}
                    {event.toLevel === 'easier' && 'Building Confidence'}
                    {event.toLevel === 'maintain' && 'Maintained'}
                  </span>
                  <span className="text-xs text-[var(--color-text-muted)]">
                    {Math.round(event.accuracy * 100)}%
                  </span>
                </div>
                <p className="text-xs text-[var(--color-text-muted)] line-clamp-2">
                  {event.reason}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
      
      {/* Flow State Indicator */}
      <div className="mt-4 p-3 bg-[var(--color-bg-secondary)] rounded-lg">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-[var(--color-text-muted)]">
            Flow State Target
          </span>
          <span className="text-xs font-semibold text-[var(--color-accent)]">
            70-85%
          </span>
        </div>
        <div className="relative h-2 bg-[var(--color-bg-tertiary)] rounded-full overflow-hidden">
          {/* Target zone (70-85%) */}
          <div
            className="absolute top-0 h-full bg-green-500/20"
            style={{ left: '70%', width: '15%' }}
          />
          {/* Current accuracy marker */}
          <div
            className="absolute top-0 h-full w-1 bg-[var(--color-accent)]"
            style={{ left: `${Math.min(Math.max(avgAccuracy * 100, 0), 100)}%` }}
          />
        </div>
        <div className="flex justify-between mt-1 text-xs text-[var(--color-text-muted)]">
          <span>0%</span>
          <span>100%</span>
        </div>
      </div>
    </div>
  );
};

export default DifficultyTrendChart;
