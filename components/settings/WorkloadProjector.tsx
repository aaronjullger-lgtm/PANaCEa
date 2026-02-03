/**
 * Workload Projector UI Component (Phase 5: Self-Optimizing Engine)
 *
 * Interactive workload calculator showing the relationship between
 * retention targets and daily study time. Highlights the CMRR point.
 */

import React, { useState } from 'react';
import { TrendingUp, Clock, Target, ChevronDown, ChevronUp } from 'lucide-react';
import WorkloadChart from '../analytics/WorkloadChart';
import { SliderWithInput } from '../ui/SliderWithInput';

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
          <TrendingUp className="w-5 h-5 text-[var(--color-accent)]" />
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
            {/* Daily New Cards: input + stepper + slider; snap to 5,10,20,30,40,50 */}
            <div className="space-y-2">
              <SliderWithInput
                value={dailyNewCards}
                onChange={setDailyNewCards}
                min={5}
                max={50}
                step={5}
                snapValues={[5, 10, 20, 30, 40, 50]}
                label={
                  <span className="flex items-center gap-2 text-sm text-[var(--color-text-primary)]">
                    <Target className="w-4 h-4 text-[var(--color-accent)]" />
                    Daily New Cards
                  </span>
                }
              />
              <div className="flex justify-between text-xs text-[var(--color-text-secondary)]">
                <span>5</span>
                <span>50</span>
              </div>
            </div>

            {/* Available Time: input + stepper + slider; snap to 15,30,60,90,120,180 */}
            <div className="space-y-2">
              <SliderWithInput
                value={availableTime}
                onChange={setAvailableTime}
                min={15}
                max={180}
                step={15}
                snapValues={[15, 30, 60, 90, 120, 180]}
                unit=" min"
                label={
                  <span className="flex items-center gap-2 text-sm text-[var(--color-text-primary)]">
                    <Clock className="w-4 h-4 text-[var(--color-accent)]" />
                    Available Time
                  </span>
                }
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
          <div className="p-3 bg-[var(--color-accent)]/10 border border-[var(--color-accent)]/30 rounded-lg">
            <p className="text-xs text-[var(--color-accent)] leading-relaxed">
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
