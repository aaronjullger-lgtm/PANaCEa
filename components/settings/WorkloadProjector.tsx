/**
 * Workload Projector UI Component (Phase 5: Self-Optimizing Engine)
 *
 * Interactive workload calculator showing the relationship between
 * retention targets and daily study time. Highlights the CMRR point.
 */

import React, { useState } from 'react';
import { TrendingUp, Clock, Target, ChevronDown, ChevronUp } from 'lucide-react';
import WorkloadChart from '../analytics/WorkloadChart';

export const WorkloadProjector: React.FC = () => {
  const [dailyNewCards, setDailyNewCards] = useState(10);
  const [availableTime, setAvailableTime] = useState(60);
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="space-y-4">
      {/* Header with Toggle */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between group"
      >
        <div className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-blue-500" />
          <h3 className="font-semibold text-[var(--color-text-primary)]">Workload Projector</h3>
        </div>
        {isExpanded ? (
          <ChevronUp className="w-4 h-4 text-[var(--color-text-secondary)] group-hover:text-[var(--color-text-primary)]" />
        ) : (
          <ChevronDown className="w-4 h-4 text-[var(--color-text-secondary)] group-hover:text-[var(--color-text-primary)]" />
        )}
      </button>

      {!isExpanded && (
        <p className="text-xs text-[var(--color-text-secondary)]">
          Visualize how retention targets affect your daily workload
        </p>
      )}

      {isExpanded && (
        <div className="space-y-4 pt-2">
          {/* Configuration Controls */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Daily New Cards */}
            <div className="space-y-2">
              <label className="flex items-center justify-between text-sm text-[var(--color-text-primary)]">
                <span className="flex items-center gap-2">
                  <Target className="w-4 h-4 text-blue-500" />
                  Daily New Cards
                </span>
                <span className="font-mono text-blue-500">{dailyNewCards}</span>
              </label>
              <input
                type="range"
                min="5"
                max="50"
                step="5"
                value={dailyNewCards}
                onChange={(e) => setDailyNewCards(parseInt(e.target.value, 10))}
                className="w-full accent-blue-500"
              />
              <div className="flex justify-between text-xs text-[var(--color-text-secondary)]">
                <span>5</span>
                <span>50</span>
              </div>
            </div>

            {/* Available Time */}
            <div className="space-y-2">
              <label className="flex items-center justify-between text-sm text-[var(--color-text-primary)]">
                <span className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-blue-500" />
                  Available Time
                </span>
                <span className="font-mono text-blue-500">{availableTime} min</span>
              </label>
              <input
                type="range"
                min="15"
                max="180"
                step="15"
                value={availableTime}
                onChange={(e) => setAvailableTime(parseInt(e.target.value, 10))}
                className="w-full accent-blue-500"
              />
              <div className="flex justify-between text-xs text-[var(--color-text-secondary)]">
                <span>15 min</span>
                <span>3 hrs</span>
              </div>
            </div>
          </div>

          {/* Workload Chart */}
          <div className="p-4 bg-[var(--color-bg-primary)] rounded-lg border border-[var(--color-border)]">
            <WorkloadChart
              dailyNewCards={dailyNewCards}
              availableTimeMinutes={availableTime}
              height={350}
              showTimeAxis={true}
            />
          </div>

          {/* Info Box */}
          <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
            <p className="text-xs text-blue-400 leading-relaxed">
              <strong>CMRR (Compute Minimum Recommended Retention)</strong> shows the optimal
              balance between retention and workload. The chart simulates 365 days of spaced
              repetition to predict steady-state workload for different retention targets.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default WorkloadProjector;
