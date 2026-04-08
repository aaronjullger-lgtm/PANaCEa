/**
 * CalibrationPanel
 *
 * Displays JOL (Judgment of Learning) calibration feedback at session end.
 * Shows metacognitive insights including:
 * - Calibration state (well_calibrated, overconfident, underconfident, etc.)
 * - Brier score (prediction accuracy metric)
 * - Calibration curve visualization
 * - Actionable recommendations
 *
 * Integrated with SessionContext's calibration tracking system.
 */

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CheckCircle,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  HelpCircle,
  Brain,
  Target,
  BarChart3,
  Info,
} from 'lucide-react';
import type { CalibrationSummary } from '../../services/analytics/calibrationService';
import { getCalibrationStateLabel } from '../../services/analytics/calibrationService';

interface CalibrationPanelProps {
  /** Calibration summary from session end */
  summary: CalibrationSummary | null;
  /** Whether enough data exists for reliable analysis */
  isReliable: boolean;
  /** Progress towards reliable analysis (for insufficient data state) */
  progress?: {
    current: number;
    required: number;
    percentage: number;
  };
  /** Optional callback when panel is dismissed */
  onDismiss?: () => void;
  /** Whether to show in compact mode */
  compact?: boolean;
}

/**
 * Icon component based on calibration state
 */
function CalibrationIcon({ state }: { state: string }) {
  const iconClass = 'w-6 h-6';

  switch (state) {
    case 'well_calibrated':
      return <CheckCircle className={`${iconClass} text-[var(--color-data-pass)]`} />;
    case 'overconfident':
      return <TrendingUp className={`${iconClass} text-[var(--color-warning)]`} />;
    case 'underconfident':
      return <TrendingDown className={`${iconClass} text-[var(--color-accent)]`} />;
    case 'fluctuating':
      return <AlertTriangle className={`${iconClass} text-[var(--color-warning)]`} />;
    default:
      return <HelpCircle className={`${iconClass} text-[var(--color-text-muted)]`} />;
  }
}

/**
 * Color classes based on calibration state
 */
function getStateColors(state: string): {
  bg: string;
  border: string;
  text: string;
  badge: string;
} {
  switch (state) {
    case 'well_calibrated':
      return {
        bg: 'bg-[var(--color-bg-secondary)]',
        border: 'border-[var(--color-border)]',
        text: 'text-[var(--color-text-primary)]',
        badge: 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-primary)]',
      };
    case 'overconfident':
      return {
        bg: 'bg-[var(--color-bg-secondary)]',
        border: 'border-[var(--color-border)]',
        text: 'text-[var(--color-warning)]',
        badge:
          'bg-[var(--color-bg-tertiary)] text-[var(--color-warning)]',
      };
    case 'underconfident':
      return {
        bg: 'bg-[var(--color-bg-secondary)]',
        border: 'border-[var(--color-border)]',
        text: 'text-[var(--color-accent)]',
        badge:
          'bg-[var(--color-bg-tertiary)] text-[var(--color-accent)]',
      };
    case 'fluctuating':
      return {
        bg: 'bg-[var(--color-bg-secondary)]',
        border: 'border-[var(--color-border)]',
        text: 'text-[var(--color-warning)]',
        badge:
          'bg-[var(--color-bg-tertiary)] text-[var(--color-warning)]',
      };
    default:
      return {
        bg: 'bg-[var(--color-data-neutral)]/50',
        border: 'border-[var(--color-data-neutral)]',
        text: 'text-[var(--color-data-neutral)]',
        badge: 'bg-[var(--color-data-neutral)] text-[var(--color-data-neutral)] ',
      };
  }
}

/**
 * Brier Score Gauge - Visual representation of prediction accuracy
 */
function BrierScoreGauge({ score }: { score: number }) {
  // Brier score: 0 = perfect, 0.25 = random, 1 = worst
  // Map to percentage where 100% = perfect (0) and 0% = random (0.25+)
  const quality = Math.max(0, Math.min(100, (1 - score / 0.25) * 100));
  const qualityLabel =
    quality >= 80 ? 'Excellent' : quality >= 60 ? 'Good' : quality >= 40 ? 'Fair' : 'Developing';

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-20 h-20">
        {/* Background circle */}
        <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
          <circle
            cx="18"
            cy="18"
            r="16"
            fill="none"
            className="stroke-data-neutral"
            strokeWidth="3"
          />
          {/* Progress circle */}
          <circle
            cx="18"
            cy="18"
            r="16"
            fill="none"
            className={
              quality >= 60
                ? 'stroke-[var(--color-data-pass)]'
                : quality >= 40
                  ? 'stroke-[var(--color-warning)]'
                  : 'stroke-[var(--color-data-fail)]'
            }
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray={`${quality} 100`}
          />
        </svg>
        {/* Center text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-lg font-bold text-[var(--color-text-primary)]">
            {score.toFixed(2)}
          </span>
        </div>
      </div>
      <span className="mt-1 text-xs text-[var(--color-data-neutral)]">{qualityLabel}</span>
    </div>
  );
}

/**
 * Mini calibration curve visualization
 */
function CalibrationCurve({ curve }: { curve: CalibrationSummary['calibrationCurve'] }) {
  const maxCount = Math.max(...curve.map((b) => b.count), 1);

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1 text-xs text-[var(--color-data-neutral)] mb-2">
        <BarChart3 className="w-3 h-3" />
        <span>Confidence vs Accuracy</span>
      </div>
      <div className="flex items-end gap-1 h-16">
        {curve.map((bin, i) => {
          const height = bin.count > 0 ? Math.max(10, bin.actualAccuracy * 100) : 0;
          const expectedHeight = bin.count > 0 ? Math.max(10, bin.avgConfidence * 100) : 0;
          const hasData = bin.count > 0;

          // Calculate calibration error as difference between actual and expected
          const calibrationError = bin.actualAccuracy - bin.avgConfidence;

          return (
            <div key={bin.label} className="flex-1 flex flex-col items-center gap-0.5">
              <div className="relative w-full h-16 flex items-end justify-center gap-0.5">
                {hasData && (
                  <>
                    {/* Expected (confidence) bar */}
                    <div
                      className="w-2 bg-[var(--color-data-neutral)] rounded-t transition-all"
                      style={{ height: `${expectedHeight}%` }}
                      title={`Expected: ${Math.round(bin.avgConfidence * 100)}%`}
                    />
                    {/* Actual accuracy bar */}
                    <div
                      className={`w-2 rounded-t transition-all ${
                        calibrationError > 0.1
                          ? 'bg-[var(--color-warning)]'
                          : calibrationError < -0.1
                            ? 'bg-[var(--color-accent)]'
                            : 'bg-[var(--color-data-pass)]'
                      }`}
                      style={{ height: `${height}%` }}
                      title={`Actual: ${Math.round(bin.actualAccuracy * 100)}%`}
                    />
                  </>
                )}
                {!hasData && <div className="w-4 h-2 bg-[var(--color-data-neutral)] rounded" />}
              </div>
              <span className="text-[10px] text-[var(--color-data-neutral)]">{bin.label.split('-')[0]}</span>
            </div>
          );
        })}
      </div>
      <div className="flex justify-between text-[10px] text-[var(--color-data-neutral)] mt-1">
        <span className="flex items-center gap-1">
          <div className="w-2 h-2 bg-[var(--color-data-neutral)] rounded" />
          Expected
        </span>
        <span className="flex items-center gap-1">
          <div className="w-2 h-2 bg-[var(--color-data-pass)] rounded" />
          Actual
        </span>
      </div>
    </div>
  );
}

/**
 * Insufficient data state - shows progress towards reliable analysis
 */
function InsufficientDataState({
  progress,
}: {
  progress: { current: number; required: number; percentage: number };
}) {
  return (
    <div className="text-center py-4">
      <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-[var(--color-data-neutral)] mb-3">
        <Brain className="w-6 h-6 text-[var(--color-data-neutral)]" />
      </div>
      <h4 className="text-sm font-medium text-[var(--color-data-neutral)] mb-1">
        Building Your Profile
      </h4>
      <p className="text-xs text-[var(--color-data-neutral)] mb-3">
        {progress.required - progress.current} more questions needed for calibration insights
      </p>
      <div className="w-full bg-[var(--color-data-neutral)] rounded-full h-2">
        <motion.div
          className="bg-[var(--color-accent)] h-2 rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${progress.percentage}%` }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        />
      </div>
      <span className="text-xs text-[var(--color-data-neutral)] mt-1 block">
        {progress.current}/{progress.required} observations
      </span>
    </div>
  );
}

/**
 * Main CalibrationPanel Component
 */
export function CalibrationPanel({
  summary,
  isReliable,
  progress,
  onDismiss,
  compact = false,
}: CalibrationPanelProps) {
  // If no summary and not enough data, show progress state
  if (!summary || !isReliable) {
    if (progress) {
      return (
        <motion.div
          initial={{ y: 10 }}
          animate={{ y: 0 }}
          className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-4"
        >
          <InsufficientDataState progress={progress} />
        </motion.div>
      );
    }
    return null;
  }

  const { label } = getCalibrationStateLabel(summary.state);
  const colors = getStateColors(summary.state);

  // Compact mode - minimal display
  if (compact) {
    return (
      <motion.div
        initial={{ scale: 0.95 }}
        animate={{ scale: 1 }}
        className={`rounded-lg border ${colors.border} ${colors.bg} p-3`}
      >
        <div className="flex items-center gap-2">
          <CalibrationIcon state={summary.state} />
          <div className="flex-1">
            <span className={`text-sm font-medium ${colors.text}`}>{label}</span>
            <p className="text-xs text-[var(--color-data-neutral)] line-clamp-1">
              {summary.recommendation}
            </p>
          </div>
          <div className="text-right">
            <div className="text-xs text-[var(--color-data-neutral)]">Brier</div>
            <div className="text-sm font-mono font-medium">{summary.brierScore.toFixed(2)}</div>
          </div>
        </div>
      </motion.div>
    );
  }

  // Full mode - detailed display
  return (
    <motion.div
      initial={{ y: 20 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.3 }}
      className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] overflow-hidden"
    >
      {/* Header */}
      <div className={`px-4 py-3 border-b ${colors.border} ${colors.bg}`}>
        <div className="flex items-center gap-3">
          <CalibrationIcon state={summary.state} />
          <div className="flex-1">
            <h3 className={`font-semibold ${colors.text}`}>Metacognitive Calibration</h3>
            <span className={`text-xs px-2 py-0.5 rounded-full ${colors.badge}`}>{label}</span>
          </div>
          {onDismiss && (
            <button
              onClick={onDismiss}
              className="p-1 rounded-lg hover:bg-[var(--color-data-neutral)] transition-colors"
              aria-label="Dismiss"
            >
              <span className="text-[var(--color-data-neutral)]">×</span>
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="p-4 space-y-4">
        {/* Illusion of Competence Warning */}
        <AnimatePresence>
          {summary.illusionOfCompetence && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="flex items-start gap-2 p-3 rounded-lg bg-[var(--color-bg-secondary)] border border-[var(--color-border)]"
            >
              <AlertTriangle className="w-4 h-4 text-[var(--color-data-fail)] flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-[var(--color-text-primary)]">
                  Illusion of Competence Detected
                </p>
                <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
                  Fast responses are often incorrect. Consider slowing down to engage more deeply.
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Metrics Grid */}
        <div className="grid grid-cols-3 gap-4">
          {/* Brier Score */}
          <div className="flex flex-col items-center p-3 rounded-lg bg-[var(--color-data-neutral)]/50">
            <BrierScoreGauge score={summary.brierScore} />
            <span className="text-xs text-[var(--color-data-neutral)] mt-2">Brier Score</span>
          </div>

          {/* Overconfidence Bias */}
          <div className="flex flex-col items-center justify-center p-3 rounded-lg bg-[var(--color-data-neutral)]/50">
            <div className="flex items-center gap-1">
              {summary.overconfidenceBias > 0 ? (
                <TrendingUp className="w-4 h-4 text-[var(--color-warning)]" />
              ) : summary.overconfidenceBias < 0 ? (
                <TrendingDown className="w-4 h-4 text-[var(--color-accent)]" />
              ) : (
                <Target className="w-4 h-4 text-[var(--color-data-pass)]" />
              )}
              <span className="text-2xl font-bold text-[var(--color-text-primary)]">
                {summary.overconfidenceBias > 0 ? '+' : ''}
                {Math.round(summary.overconfidenceBias * 100)}%
              </span>
            </div>
            <span className="text-xs text-[var(--color-data-neutral)] mt-1">
              {summary.overconfidenceBias > 0.05
                ? 'Overconfident'
                : summary.overconfidenceBias < -0.05
                  ? 'Underconfident'
                  : 'Balanced'}
            </span>
          </div>

          {/* Sample Size */}
          <div className="flex flex-col items-center justify-center p-3 rounded-lg bg-[var(--color-data-neutral)]/50">
            <span className="text-2xl font-bold text-[var(--color-text-primary)]">
              {summary.sampleSize}
            </span>
            <span className="text-xs text-[var(--color-data-neutral)] mt-1">Questions</span>
          </div>
        </div>

        {/* Calibration Curve */}
        {summary.calibrationCurve.length > 0 && (
          <div className="p-3 rounded-lg bg-[var(--color-data-neutral)]/50">
            <CalibrationCurve curve={summary.calibrationCurve} />
          </div>
        )}

        {/* Recommendation */}
        <div className="flex items-start gap-2 p-3 rounded-lg bg-[var(--color-bg-secondary)] border border-[var(--color-border)]">
          <Info className="w-4 h-4 text-[var(--color-accent)] flex-shrink-0 mt-0.5" />
          <p className="text-sm text-[var(--color-text-primary)]">
            {summary.recommendation}
          </p>
        </div>

        {/* Explainer */}
        <details className="text-xs text-[var(--color-data-neutral)]">
          <summary className="cursor-pointer hover:text-[var(--color-data-neutral)]">
            What does this mean?
          </summary>
          <div className="mt-2 space-y-1 pl-4">
            <p>
              <strong>Brier Score:</strong> Measures prediction accuracy. Lower is better (0 =
              perfect, 0.25 = random guessing).
            </p>
            <p>
              <strong>Calibration:</strong> How well your confidence matches your actual
              performance. Well-calibrated learners know what they know.
            </p>
            <p>
              <strong>Overconfidence:</strong> Thinking you know more than you do leads to
              inadequate study. Slow down and test yourself more.
            </p>
            <p>
              <strong>Underconfidence:</strong> Performing better than expected. Trust your
              knowledge more!
            </p>
          </div>
        </details>
      </div>
    </motion.div>
  );
}

export default CalibrationPanel;
