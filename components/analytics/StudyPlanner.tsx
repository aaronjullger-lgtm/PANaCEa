/**
 * StudyPlanner Component
 *
 * PHASE 4: NEURO-SYMBOLIC INTEGRITY - Milestone 4
 *
 * Visualizes CMRR (Cost-Minimizing Desired Retention) trade-offs
 * to help users understand the workload vs retention balance.
 *
 * Features:
 * - Interactive retention slider with real-time workload estimates
 * - Efficiency curve visualization
 * - Personalized recommendations based on study time
 * - Exam countdown integration
 *
 * @module components/analytics/StudyPlanner
 */

import React, { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  calculateOptimalRetention,
  retentionToLabel,
  getRetentionPresets,
  estimateReviewTime,
  type CMRRInput,
  type CMRROutput,
} from '../../lib/cmrr-optimizer';
import type { ReviewSnapshot } from '../../lib/fsrs';

// ============================================================================
// Types
// ============================================================================

export interface StudyPlannerProps {
  /** User's review history for CMRR calculation */
  reviewHistory: Array<{
    date: string;
    stability: number;
    difficulty: number;
    rating: number;
    state: number;
  }>;

  /** Average daily study time in minutes */
  avgStudyTimeMinutes: number;

  /** Optional exam date for urgency calculations */
  targetExamDate?: Date;

  /** Current FSRS retention setting */
  currentRetention?: number;

  /** Callback when user changes retention setting */
  onRetentionChange?: (newRetention: number) => void;

  /** Whether to show advanced options */
  showAdvanced?: boolean;

  /** Custom class name */
  className?: string;
}

interface PresetButtonProps {
  preset: {
    label: string;
    value: number;
    description: string;
    bestFor: string;
  };
  isSelected: boolean;
  onClick: () => void;
}

// ============================================================================
// Sub-components
// ============================================================================

const PresetButton: React.FC<PresetButtonProps> = ({ preset, isSelected, onClick }) => (
  <button
    onClick={onClick}
    className={`
      flex flex-col items-start p-3 rounded-lg border transition-all
      ${
        isSelected
          ? 'border-action-primary bg-action-muted text-text-primary'
          : 'border-surface-border bg-surface-card hover:border-action-secondary text-text-secondary'
      }
    `}
  >
    <span className="font-medium text-sm">{preset.label}</span>
    <span className="text-xs opacity-70 mt-1">{Math.round(preset.value * 100)}% retention</span>
  </button>
);

const MetricCard: React.FC<{
  label: string;
  value: string | number;
  subtext?: string;
  trend?: 'up' | 'down' | 'neutral';
}> = ({ label, value, subtext, trend }) => (
  <div className="bg-surface-card rounded-lg p-4 border border-surface-border">
    <div className="text-xs text-text-tertiary uppercase tracking-wide mb-1">{label}</div>
    <div className="flex items-baseline gap-2">
      <span className="text-2xl font-semibold text-text-primary">{value}</span>
      {trend && (
      <span
        className={`text-sm ${
          trend === 'up'
            ? 'text-success'
            : trend === 'down'
              ? 'text-error'
              : 'text-text-tertiary'
        }`}
      >
          {trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→'}
        </span>
      )}
    </div>
    {subtext && <div className="text-xs text-text-tertiary mt-1">{subtext}</div>}
  </div>
);

const EfficiencyGauge: React.FC<{
  value: number;
  label: string;
}> = ({ value, label }) => {
  const percentage = Math.min(100, Math.max(0, value));
  const rotation = (percentage / 100) * 180 - 90;

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-32 h-16 overflow-hidden">
        {/* Background arc */}
        <div className="absolute inset-0 border-8 border-surface-border rounded-t-full" />
        {/* Colored segments */}
        <div
          className="absolute inset-0 border-8 rounded-t-full"
          style={{
            borderColor: 'transparent',
            borderTopColor:
              percentage > 66
                ? 'var(--color-success)'
                : percentage > 33
                  ? 'var(--color-warning)'
                  : 'var(--color-error)',
            clipPath: `polygon(0 100%, 100% 100%, 100% 0, 50% 0, 50% 100%)`,
            transform: `rotate(${rotation}deg)`,
            transformOrigin: 'bottom center',
          }}
        />
        {/* Needle */}
        <div
          className="absolute bottom-0 left-1/2 w-1 h-14 bg-text-primary rounded-full origin-bottom transition-transform duration-500"
          style={{ transform: `translateX(-50%) rotate(${rotation}deg)` }}
        />
        {/* Center dot */}
        <div className="absolute bottom-0 left-1/2 w-3 h-3 bg-text-primary rounded-full -translate-x-1/2 translate-y-1/2" />
      </div>
      <div className="text-sm text-text-secondary mt-2">{label}</div>
      <div className="text-lg font-semibold text-text-primary">{percentage.toFixed(0)}%</div>
    </div>
  );
};

// ============================================================================
// Main Component
// ============================================================================

export const StudyPlanner: React.FC<StudyPlannerProps> = ({
  reviewHistory,
  avgStudyTimeMinutes,
  targetExamDate,
  currentRetention = 0.9,
  onRetentionChange,
  showAdvanced = false,
  className = '',
}) => {
  // State
  const [selectedRetention, setSelectedRetention] = useState(currentRetention);
  const [showPresets, setShowPresets] = useState(false);

  // Calculate CMRR
  const cmrrResult = useMemo<CMRROutput>(() => {
    const input: CMRRInput = {
      reviewHistory: reviewHistory.map((r) => ({
        date: r.date,
        stability: r.stability,
        difficulty: r.difficulty,
        rating: r.rating,
        state: r.state,
      })),
      avgStudyTimeMinutes,
      targetExamDate,
    };
    return calculateOptimalRetention(input);
  }, [reviewHistory, avgStudyTimeMinutes, targetExamDate]);

  // Get presets
  const presets = useMemo(() => getRetentionPresets(), []);

  // Calculate metrics for selected retention
  const selectedMetrics = useMemo(() => {
    // Estimate workload at selected retention
    const baseWorkload = cmrrResult.workloadEstimate;
    const optimalR = cmrrResult.optimalRetention;

    // Workload scales roughly exponentially with retention
    const workloadRatio = Math.pow(selectedRetention / optimalR, 3);
    const estimatedWorkload = Math.round(baseWorkload * workloadRatio);

    // Knowledge scales with retention
    const knowledgeRatio = selectedRetention / optimalR;
    const estimatedKnowledge = Math.round(cmrrResult.knowledgeScore * knowledgeRatio);

    // Efficiency
    const efficiency = estimatedKnowledge / Math.max(estimatedWorkload, 1);

    return {
      workload: estimatedWorkload,
      knowledge: estimatedKnowledge,
      efficiency: Math.round(efficiency * 100),
      reviewTime: estimateReviewTime(estimatedWorkload),
    };
  }, [selectedRetention, cmrrResult]);

  // Handlers
  const handleSliderChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = parseFloat(e.target.value);
      setSelectedRetention(value);
    },
    []
  );

  const handleSliderCommit = useCallback(() => {
    if (onRetentionChange) {
      onRetentionChange(selectedRetention);
    }
  }, [selectedRetention, onRetentionChange]);

  const handlePresetClick = useCallback(
    (value: number) => {
      setSelectedRetention(value);
      if (onRetentionChange) {
        onRetentionChange(value);
      }
    },
    [onRetentionChange]
  );

  const handleUseOptimal = useCallback(() => {
    setSelectedRetention(cmrrResult.optimalRetention);
    if (onRetentionChange) {
      onRetentionChange(cmrrResult.optimalRetention);
    }
  }, [cmrrResult.optimalRetention, onRetentionChange]);

  // Days until exam
  const daysUntilExam = targetExamDate
    ? Math.max(0, Math.ceil((targetExamDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : null;

  return (
    <div className={`bg-surface-primary rounded-xl p-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-text-primary">Study Planner</h2>
          <p className="text-sm text-text-secondary mt-1">
            Optimize your retention vs workload balance
          </p>
        </div>
        {daysUntilExam !== null && (
          <div className="text-right">
            <div className="text-2xl font-bold text-action-primary">{daysUntilExam}</div>
            <div className="text-xs text-text-tertiary">days until exam</div>
          </div>
        )}
      </div>

      {/* Confidence indicator */}
      {cmrrResult.confidenceLevel !== 'high' && (
        <div
          className="mb-4 p-3 rounded-lg text-sm bg-action-muted text-action-primary border border-surface-border"
        >
          {cmrrResult.recommendation}
        </div>
      )}

      {/* Main slider section */}
      <div className="bg-surface-card rounded-lg p-5 border border-surface-border mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-sm text-text-secondary">Target Retention</div>
            <div className="text-3xl font-bold text-text-primary">
              {Math.round(selectedRetention * 100)}%
            </div>
            <div className="text-sm text-text-tertiary">{retentionToLabel(selectedRetention)}</div>
          </div>

          <button
            onClick={handleUseOptimal}
            className="px-4 py-2 bg-action-primary/20 text-action-primary rounded-lg text-sm font-medium hover:bg-action-primary/30 transition-colors"
          >
            Use Optimal ({Math.round(cmrrResult.optimalRetention * 100)}%)
          </button>
        </div>

        {/* Slider */}
        <div className="relative mt-6 mb-2">
          {/* Track background */}
          <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-2 rounded-full bg-gradient-to-r from-red-500/30 via-yellow-500/30 to-green-500/30" />

          {/* Optimal marker */}
          <div
            className="absolute top-1/2 -translate-y-1/2 w-1 h-4 bg-action-primary rounded-full"
            style={{
              left: `${((cmrrResult.optimalRetention - 0.8) / 0.17) * 100}%`,
            }}
          />

          {/* Slider input */}
          <input
            type="range"
            min="0.80"
            max="0.97"
            step="0.01"
            value={selectedRetention}
            onChange={handleSliderChange}
            onMouseUp={handleSliderCommit}
            onTouchEnd={handleSliderCommit}
            className="relative w-full h-2 appearance-none bg-transparent cursor-pointer z-10
              [&::-webkit-slider-thumb]:appearance-none
              [&::-webkit-slider-thumb]:w-5
              [&::-webkit-slider-thumb]:h-5
              [&::-webkit-slider-thumb]:rounded-full
              [&::-webkit-slider-thumb]:bg-text-primary
              [&::-webkit-slider-thumb]:border-2
              [&::-webkit-slider-thumb]:border-surface-primary
              [&::-webkit-slider-thumb]:shadow-lg
              [&::-webkit-slider-thumb]:cursor-pointer
              [&::-moz-range-thumb]:w-5
              [&::-moz-range-thumb]:h-5
              [&::-moz-range-thumb]:rounded-full
              [&::-moz-range-thumb]:bg-text-primary
              [&::-moz-range-thumb]:border-2
              [&::-moz-range-thumb]:border-surface-primary
              [&::-moz-range-thumb]:cursor-pointer
            "
          />
        </div>

        {/* Slider labels */}
        <div className="flex justify-between text-xs text-text-tertiary mt-1">
          <span>80% (Efficiency)</span>
          <span>97% (Maximum)</span>
        </div>
      </div>

      {/* Metrics grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <MetricCard
          label="Daily Reviews"
          value={selectedMetrics.workload}
          subtext={selectedMetrics.reviewTime.formatted}
          trend={selectedMetrics.workload > cmrrResult.workloadEstimate ? 'up' : 'down'}
        />
        <MetricCard
          label="Knowledge Score"
          value={selectedMetrics.knowledge}
          subtext="out of 100"
          trend={
            selectedMetrics.knowledge > cmrrResult.knowledgeScore
              ? 'up'
              : selectedMetrics.knowledge < cmrrResult.knowledgeScore
                ? 'down'
                : 'neutral'
          }
        />
        <MetricCard
          label="Efficiency"
          value={`${selectedMetrics.efficiency}%`}
          subtext="knowledge per review"
        />
        <MetricCard
          label="Your Reviews"
          value={reviewHistory.length}
          subtext={cmrrResult.confidenceLevel === 'high' ? 'Good sample' : 'Building data...'}
        />
      </div>

      {/* Efficiency gauge */}
      <div className="flex justify-center mb-6">
        <EfficiencyGauge value={selectedMetrics.efficiency} label="Study Efficiency" />
      </div>

      {/* Presets toggle */}
      <div className="border-t border-surface-border pt-4">
        <button
          onClick={() => setShowPresets(!showPresets)}
          className="flex items-center gap-2 text-sm text-text-secondary hover:text-text-primary transition-colors"
        >
          <span>{showPresets ? '▼' : '▶'}</span>
          <span>Quick Presets</span>
        </button>

        <AnimatePresence>
          {showPresets && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mt-4">
                {presets.map((preset) => (
                  <PresetButton
                    key={preset.value}
                    preset={preset}
                    isSelected={Math.abs(selectedRetention - preset.value) < 0.01}
                    onClick={() => handlePresetClick(preset.value)}
                  />
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Advanced options */}
      {showAdvanced && (
        <div className="border-t border-surface-border pt-4 mt-4">
          <h3 className="text-sm font-medium text-text-secondary mb-3">Advanced Details</h3>
          <div className="text-xs text-text-tertiary space-y-1 font-mono bg-surface-card p-3 rounded-lg">
            <div>Optimal R: {cmrrResult.optimalRetention.toFixed(3)}</div>
            <div>Efficiency Ratio: {cmrrResult.efficiencyRatio}</div>
            <div>Confidence: {cmrrResult.confidenceLevel}</div>
            <div>Slider Position: {cmrrResult.sliderPosition}/100</div>
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================================================
// Export
// ============================================================================

export default StudyPlanner;