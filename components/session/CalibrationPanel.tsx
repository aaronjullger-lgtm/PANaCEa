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
      return <CheckCircle className={`${iconClass} text-green-500`} />;
    case 'overconfident':
      return <TrendingUp className={`${iconClass} text-amber-500`} />;
    case 'underconfident':
      return <TrendingDown className={`${iconClass} text-blue-500`} />;
    case 'fluctuating':
      return <AlertTriangle className={`${iconClass} text-amber-500`} />;
    default:
      return <HelpCircle className={`${iconClass} text-slate-400`} />;
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
        bg: 'bg-green-50 dark:bg-green-900/20',
        border: 'border-green-200 dark:border-green-800',
        text: 'text-green-700 dark:text-green-300',
        badge: 'bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-200',
      };
    case 'overconfident':
      return {
        bg: 'bg-amber-50 dark:bg-amber-900/20',
        border: 'border-amber-200 dark:border-amber-800',
        text: 'text-amber-700 dark:text-amber-300',
        badge: 'bg-amber-100 text-amber-800 dark:bg-amber-800 dark:text-amber-200',
      };
    case 'underconfident':
      return {
        bg: 'bg-blue-50 dark:bg-blue-900/20',
        border: 'border-blue-200 dark:border-blue-800',
        text: 'text-blue-700 dark:text-blue-300',
        badge: 'bg-blue-100 text-blue-800 dark:bg-blue-800 dark:text-blue-200',
      };
    case 'fluctuating':
      return {
        bg: 'bg-amber-50 dark:bg-amber-900/20',
        border: 'border-amber-200 dark:border-amber-800',
        text: 'text-amber-700 dark:text-amber-300',
        badge: 'bg-amber-100 text-amber-800 dark:bg-amber-800 dark:text-amber-200',
      };
    default:
      return {
        bg: 'bg-slate-50 dark:bg-slate-800/50',
        border: 'border-slate-200 dark:border-slate-700',
        text: 'text-slate-600 dark:text-slate-400',
        badge: 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300',
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
            className="stroke-slate-200 dark:stroke-slate-700"
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
                ? 'stroke-green-500'
                : quality >= 40
                  ? 'stroke-amber-500'
                  : 'stroke-red-500'
            }
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray={`${quality} 100`}
          />
        </svg>
        {/* Center text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-lg font-bold text-slate-900 dark:text-white">
            {score.toFixed(2)}
          </span>
        </div>
      </div>
      <span className="mt-1 text-xs text-slate-500 dark:text-slate-400">{qualityLabel}</span>
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
      <div className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400 mb-2">
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
                      className="w-2 bg-slate-300 dark:bg-slate-600 rounded-t transition-all"
                      style={{ height: `${expectedHeight}%` }}
                      title={`Expected: ${Math.round(bin.avgConfidence * 100)}%`}
                    />
                    {/* Actual accuracy bar */}
                    <div
                      className={`w-2 rounded-t transition-all ${
                        calibrationError > 0.1
                          ? 'bg-amber-500'
                          : calibrationError < -0.1
                            ? 'bg-blue-500'
                            : 'bg-green-500'
                      }`}
                      style={{ height: `${height}%` }}
                      title={`Actual: ${Math.round(bin.actualAccuracy * 100)}%`}
                    />
                  </>
                )}
                {!hasData && <div className="w-4 h-2 bg-slate-200 dark:bg-slate-700 rounded" />}
              </div>
              <span className="text-[10px] text-slate-400">{bin.label.split('-')[0]}</span>
            </div>
          );
        })}
      </div>
      <div className="flex justify-between text-[10px] text-slate-400 mt-1">
        <span className="flex items-center gap-1">
          <div className="w-2 h-2 bg-slate-300 dark:bg-slate-600 rounded" />
          Expected
        </span>
        <span className="flex items-center gap-1">
          <div className="w-2 h-2 bg-green-500 rounded" />
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
      <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 mb-3">
        <Brain className="w-6 h-6 text-slate-400" />
      </div>
      <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
        Building Your Profile
      </h4>
      <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
        {progress.required - progress.current} more questions needed for calibration insights
      </p>
      <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2">
        <motion.div
          className="bg-indigo-500 h-2 rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${progress.percentage}%` }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        />
      </div>
      <span className="text-xs text-slate-400 mt-1 block">
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
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4"
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
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className={`rounded-lg border ${colors.border} ${colors.bg} p-3`}
      >
        <div className="flex items-center gap-2">
          <CalibrationIcon state={summary.state} />
          <div className="flex-1">
            <span className={`text-sm font-medium ${colors.text}`}>{label}</span>
            <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1">
              {summary.recommendation}
            </p>
          </div>
          <div className="text-right">
            <div className="text-xs text-slate-500">Brier</div>
            <div className="text-sm font-mono font-medium">{summary.brierScore.toFixed(2)}</div>
          </div>
        </div>
      </motion.div>
    );
  }

  // Full mode - detailed display
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-hidden"
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
              className="p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
              aria-label="Dismiss"
            >
              <span className="text-slate-400">×</span>
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
              className="flex items-start gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800"
            >
              <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-red-700 dark:text-red-300">
                  Illusion of Competence Detected
                </p>
                <p className="text-xs text-red-600 dark:text-red-400 mt-0.5">
                  Fast responses are often incorrect. Consider slowing down to engage more deeply.
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Metrics Grid */}
        <div className="grid grid-cols-3 gap-4">
          {/* Brier Score */}
          <div className="flex flex-col items-center p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50">
            <BrierScoreGauge score={summary.brierScore} />
            <span className="text-xs text-slate-500 dark:text-slate-400 mt-2">Brier Score</span>
          </div>

          {/* Overconfidence Bias */}
          <div className="flex flex-col items-center justify-center p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50">
            <div className="flex items-center gap-1">
              {summary.overconfidenceBias > 0 ? (
                <TrendingUp className="w-4 h-4 text-amber-500" />
              ) : summary.overconfidenceBias < 0 ? (
                <TrendingDown className="w-4 h-4 text-blue-500" />
              ) : (
                <Target className="w-4 h-4 text-green-500" />
              )}
              <span className="text-2xl font-bold text-slate-900 dark:text-white">
                {summary.overconfidenceBias > 0 ? '+' : ''}
                {Math.round(summary.overconfidenceBias * 100)}%
              </span>
            </div>
            <span className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {summary.overconfidenceBias > 0.05
                ? 'Overconfident'
                : summary.overconfidenceBias < -0.05
                  ? 'Underconfident'
                  : 'Balanced'}
            </span>
          </div>

          {/* Sample Size */}
          <div className="flex flex-col items-center justify-center p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50">
            <span className="text-2xl font-bold text-slate-900 dark:text-white">
              {summary.sampleSize}
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400 mt-1">Questions</span>
          </div>
        </div>

        {/* Calibration Curve */}
        {summary.calibrationCurve.length > 0 && (
          <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50">
            <CalibrationCurve curve={summary.calibrationCurve} />
          </div>
        )}

        {/* Recommendation */}
        <div className="flex items-start gap-2 p-3 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800">
          <Info className="w-4 h-4 text-indigo-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-indigo-700 dark:text-indigo-300">{summary.recommendation}</p>
        </div>

        {/* Explainer */}
        <details className="text-xs text-slate-500 dark:text-slate-400">
          <summary className="cursor-pointer hover:text-slate-700 dark:hover:text-slate-300">
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
