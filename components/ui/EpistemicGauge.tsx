/**
 * EpistemicGauge - Uncertainty-Aware Visualization Component
 *
 * Implements "Visual Uncertainty" from Open Learner Models (OLM) research.
 * Shows confidence/opacity based on data sufficiency, preventing false
 * precision that erodes user trust.
 *
 * Key insight: Users prefer "fuzzy" visualizations that communicate
 * uncertainty over precise numbers based on insufficient data.
 *
 * Formula: confidence = min(1, reviewCount / CONFIDENCE_THRESHOLD)
 */

import React from 'react';
import { motion } from 'framer-motion';
import { Info, AlertTriangle, CheckCircle } from 'lucide-react';

// ============================================================================
// TYPES
// ============================================================================

export interface EpistemicGaugeProps {
  /** The value to display (0-100 or 0-1 depending on normalized flag) */
  value: number;
  /** Number of data points this value is based on */
  dataPoints: number;
  /** Minimum data points for full confidence (default: 60) */
  confidenceThreshold?: number;
  /** Label for the gauge */
  label?: string;
  /** Show percentage or raw value */
  showPercentage?: boolean;
  /** Whether value is already 0-100 or needs normalization from 0-1 */
  normalized?: boolean;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Color scheme */
  colorScheme?: 'blue' | 'green' | 'amber' | 'slate';
  /** Whether to show the confidence indicator */
  showConfidenceIndicator?: boolean;
  /** Custom tooltip text for low confidence */
  lowConfidenceTooltip?: string;
  /** Callback when gauge is clicked */
  onClick?: () => void;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const DEFAULT_CONFIDENCE_THRESHOLD = 60;
const MIN_OPACITY = 0.25; // Never go fully invisible
const CALIBRATION_LEVELS = {
  collecting: { threshold: 20, label: 'Collecting Data', color: 'slate' },
  emerging: { threshold: 40, label: 'Emerging Pattern', color: 'amber' },
  provisional: { threshold: 60, label: 'Provisional', color: 'blue' },
  confident: { threshold: Infinity, label: 'Confident', color: 'green' },
} as const;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Calculate confidence (0-1) based on data points
 */
export function calculateConfidence(
  dataPoints: number,
  threshold: number = DEFAULT_CONFIDENCE_THRESHOLD
): number {
  return Math.min(1, dataPoints / threshold);
}

/**
 * Get opacity value (MIN_OPACITY to 1) from confidence
 */
export function confidenceToOpacity(confidence: number): number {
  return MIN_OPACITY + (1 - MIN_OPACITY) * confidence;
}

/**
 * Get calibration level from data points
 */
export function getCalibrationLevel(dataPoints: number): {
  label: string;
  color: string;
  confidence: 'collecting' | 'emerging' | 'provisional' | 'confident';
} {
  if (dataPoints < CALIBRATION_LEVELS.collecting.threshold) {
    return { label: 'Collecting Data', color: 'slate', confidence: 'collecting' };
  }
  if (dataPoints < CALIBRATION_LEVELS.emerging.threshold) {
    return { label: 'Emerging Pattern', color: 'amber', confidence: 'emerging' };
  }
  if (dataPoints < CALIBRATION_LEVELS.provisional.threshold) {
    return { label: 'Provisional', color: 'blue', confidence: 'provisional' };
  }
  return { label: 'Confident', color: 'green', confidence: 'confident' };
}

/**
 * Get remaining questions needed for confidence
 */
export function questionsUntilConfident(
  dataPoints: number,
  threshold: number = DEFAULT_CONFIDENCE_THRESHOLD
): number {
  return Math.max(0, threshold - dataPoints);
}

// ============================================================================
// COMPONENT
// ============================================================================

export const EpistemicGauge: React.FC<EpistemicGaugeProps> = ({
  value,
  dataPoints,
  confidenceThreshold = DEFAULT_CONFIDENCE_THRESHOLD,
  label,
  showPercentage = true,
  normalized = true,
  size = 'md',
  colorScheme = 'blue',
  showConfidenceIndicator = true,
  lowConfidenceTooltip,
  onClick,
}) => {
  // Calculate confidence and derived values
  const confidence = calculateConfidence(dataPoints, confidenceThreshold);
  const opacity = confidenceToOpacity(confidence);
  const calibrationLevel = getCalibrationLevel(dataPoints);
  const remaining = questionsUntilConfident(dataPoints, confidenceThreshold);

  // Normalize value to 0-100
  const displayValue = normalized ? Math.round(value * 100) : Math.round(value);

  // Size classes
  const sizeClasses = {
    sm: { gauge: 'h-2', text: 'text-sm', label: 'text-xs' },
    md: { gauge: 'h-3', text: 'text-base', label: 'text-sm' },
    lg: { gauge: 'h-4', text: 'text-lg', label: 'text-base' },
  };

  // Color classes for the gauge fill
  const colorClasses = {
    blue: 'bg-[var(--color-category-practice)]',
    green: 'bg-data-pass',
    amber: 'bg-data-provisional',
    slate: 'bg-data-neutral',
  };

  // Default tooltip based on calibration level
  const tooltipText =
    lowConfidenceTooltip ||
    (confidence < 1
      ? `Complete ${remaining} more questions for precise prediction.`
      : 'Data confidence is high.');

  return (
    <div
      className={`relative ${onClick ? 'cursor-pointer' : ''}`}
      onClick={onClick}
      {...(onClick
        ? {
            role: 'button',
            tabIndex: 0,
            onKeyDown: (e: React.KeyboardEvent) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick();
              }
            },
          }
        : {})}
    >
      {/* Label with confidence indicator */}
      {(label || showConfidenceIndicator) && (
        <div className="flex items-center justify-between mb-1.5">
          {label && (
            <span
              className={`font-medium text-[var(--color-text-primary)] ${sizeClasses[size].label}`}
            >
              {label}
            </span>
          )}

          {showConfidenceIndicator && (
            <div className="flex items-center gap-1.5">
              {calibrationLevel.confidence === 'collecting' && (
                <AlertTriangle className="w-3.5 h-3.5 text-data-neutral" />
              )}
              {calibrationLevel.confidence === 'emerging' && (
                <Info className="w-3.5 h-3.5 text-data-provisional" />
              )}
              {calibrationLevel.confidence === 'provisional' && (
                <Info className="w-3.5 h-3.5 text-[var(--color-category-practice)]" />
              )}
              {calibrationLevel.confidence === 'confident' && (
                <CheckCircle className="w-3.5 h-3.5 text-data-pass" />
              )}
              <span
                className={`text-[10px] uppercase tracking-wider font-medium ${
                  calibrationLevel.confidence === 'collecting'
                    ? 'text-data-neutral'
                    : calibrationLevel.confidence === 'emerging'
                      ? 'text-data-provisional'
                      : calibrationLevel.confidence === 'provisional'
                        ? 'text-[var(--color-category-practice)]'
                        : 'text-data-pass'
                }`}
              >
                {calibrationLevel.label}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Gauge container with opacity based on confidence */}
      <div className="relative group" style={{ opacity }}>
        {/* Background track */}
        <div
          className={`w-full ${sizeClasses[size].gauge} bg-[var(--color-bg-tertiary)] rounded-full overflow-hidden`}
        >
          {/* Filled portion */}
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${Math.min(100, displayValue)}%` }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            className={`h-full ${colorClasses[colorScheme]} rounded-full`}
          />
        </div>

        {/* Value display */}
        <div className="flex items-center justify-between mt-1">
          <span
            className={`font-semibold text-[var(--color-text-primary)] ${sizeClasses[size].text}`}
          >
            {showPercentage ? `${displayValue}%` : displayValue}
          </span>
          <span className="text-xs text-data-neutral">n={dataPoints}</span>
        </div>

        {/* Tooltip on hover for low confidence */}
        {confidence < 1 && (
          <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
            <div className="absolute -top-10 left-1/2 -translate-x-1/2 px-3 py-1.5 bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] text-xs rounded-lg whitespace-nowrap shadow-lg border border-[var(--color-border)]">
              {tooltipText}
              <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-[var(--color-bg-secondary)] border-r border-b border-[var(--color-border)] rotate-45" />
            </div>
          </div>
        )}
      </div>

      {/* Blur overlay for very low confidence */}
      {confidence < 0.33 && (
        <div
          className="absolute inset-0 backdrop-blur-[1px] pointer-events-none rounded-lg"
          style={{ opacity: 0.5 * (1 - confidence * 3) }}
        />
      )}
    </div>
  );
};

// ============================================================================
// SPECIALIZED VARIANTS
// ============================================================================

/**
 * Circular version of EpistemicGauge
 */
export const EpistemicRadialGauge: React.FC<
  EpistemicGaugeProps & {
    radius?: number;
    strokeWidth?: number;
  }
> = ({
  value,
  dataPoints,
  confidenceThreshold = DEFAULT_CONFIDENCE_THRESHOLD,
  label,
  showPercentage = true,
  normalized = true,
  colorScheme = 'blue',
  radius = 40,
  strokeWidth = 8,
  onClick,
}) => {
  const confidence = calculateConfidence(dataPoints, confidenceThreshold);
  const opacity = confidenceToOpacity(confidence);
  const calibrationLevel = getCalibrationLevel(dataPoints);
  const displayValue = normalized ? Math.round(value * 100) : Math.round(value);

  const circumference = 2 * Math.PI * radius;
  const progress = (displayValue / 100) * circumference;

  const colorMap = {
    blue: 'stroke-[var(--color-category-practice)]',
    green: 'stroke-data-pass',
    amber: 'stroke-data-provisional',
    slate: 'stroke-data-neutral',
  };

  return (
    <div
      className={`relative inline-flex flex-col items-center ${onClick ? 'cursor-pointer' : ''}`}
      onClick={onClick}
      style={{ opacity }}
      {...(onClick
        ? {
            role: 'button',
            tabIndex: 0,
            onKeyDown: (e: React.KeyboardEvent) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick();
              }
            },
          }
        : {})}
    >
      <svg
        width={(radius + strokeWidth) * 2}
        height={(radius + strokeWidth) * 2}
        className="transform -rotate-90"
      >
        {/* Background circle */}
        <circle
          cx={radius + strokeWidth}
          cy={radius + strokeWidth}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          className="stroke-data-neutral dark:stroke-data-neutral"
        />
        {/* Progress circle */}
        <motion.circle
          cx={radius + strokeWidth}
          cy={radius + strokeWidth}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          className={colorMap[colorScheme]}
          initial={{ strokeDasharray: `0 ${circumference}` }}
          animate={{ strokeDasharray: `${progress} ${circumference}` }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        />
      </svg>

      {/* Center value */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xl font-bold text-data-neutral">
          {showPercentage ? `${displayValue}%` : displayValue}
        </span>
        {label && (
          <span className="text-xs text-data-neutral text-center max-w-[80%]">
            {label}
          </span>
        )}
      </div>

      {/* Confidence badge */}
      <div
        className={`mt-2 px-2 py-0.5 rounded-full text-[10px] font-medium ${
          calibrationLevel.confidence === 'collecting'
            ? 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)]'
            : calibrationLevel.confidence === 'emerging'
              ? 'bg-data-provisional/20 text-data-provisional'
              : calibrationLevel.confidence === 'provisional'
                ? 'bg-[color-mix(in_srgb,var(--color-category-practice)_30%,transparent)] text-[var(--color-category-practice)]'
                : 'bg-data-pass/20 text-data-pass'
        }`}
      >
        n={dataPoints}
      </div>
    </div>
  );
};

/**
 * System Mastery Grid with epistemic uncertainty
 */
export interface SystemMasteryData {
  system: string;
  accuracy: number; // 0-1
  dataPoints: number;
}

export const EpistemicSystemGrid: React.FC<{
  systems: SystemMasteryData[];
  confidenceThreshold?: number;
  onSystemClick?: (system: string) => void;
}> = ({ systems, confidenceThreshold = DEFAULT_CONFIDENCE_THRESHOLD, onSystemClick }) => {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {systems.map((system) => (
        <EpistemicGauge
          key={system.system}
          value={system.accuracy}
          dataPoints={system.dataPoints}
          confidenceThreshold={confidenceThreshold}
          label={system.system}
          size="sm"
          colorScheme={system.accuracy >= 0.8 ? 'green' : system.accuracy >= 0.6 ? 'blue' : 'amber'}
          onClick={() => onSystemClick?.(system.system)}
        />
      ))}
    </div>
  );
};

// ============================================================================
// CALIBRATION CALL TO ACTION
// ============================================================================

export interface CalibrationCTAProps {
  currentCount: number;
  targetCount: number;
  onStartCalibration?: () => void;
}

/**
 * Call-to-action component shown when data is insufficient
 * Replaces broken NaN displays with actionable UI
 */
export const CalibrationCTA: React.FC<CalibrationCTAProps> = ({
  currentCount,
  targetCount,
  onStartCalibration,
}) => {
  const remaining = Math.max(0, targetCount - currentCount);
  const progress = Math.min(1, currentCount / targetCount);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-[var(--color-bg-secondary)] rounded-2xl p-6 border border-data-neutral"
    >
      <div className="flex items-start gap-4">
        <div className="p-3 bg-[color-mix(in_srgb,var(--color-category-practice)_30%,transparent)] rounded-xl">
          <Info className="w-6 h-6 text-[var(--color-category-practice)]" />
        </div>
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-data-neutral mb-1">
            Calibration in Progress
          </h3>
          <p className="text-sm text-data-neutral mb-4">
            Complete{' '}
            <span className="font-semibold text-[var(--color-category-practice)]">{remaining}</span> more
            questions to unlock your personalized analytics dashboard.
          </p>

          {/* Progress bar */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-medium text-data-neutral">
                Calibration Progress
              </span>
              <span className="text-xs font-semibold text-data-neutral">
                {currentCount}/{targetCount}
              </span>
            </div>
            <div className="h-2 bg-data-neutral rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${progress * 100}%` }}
                transition={{ duration: 0.5 }}
                className="h-full bg-[var(--color-accent)] rounded-full"
              />
            </div>
          </div>

          {onStartCalibration && (
            <button
              onClick={onStartCalibration}
              className="w-full px-4 py-2.5 bg-[var(--color-category-practice)] hover:bg-[var(--color-category-practice)] text-[var(--color-text-inverse)] font-medium rounded-xl transition-colors"
            >
              Continue Calibration
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
};

export default EpistemicGauge;
