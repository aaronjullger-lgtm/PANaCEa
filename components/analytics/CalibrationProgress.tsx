import React from 'react';
import { motion } from 'framer-motion';
import { Brain, Sparkles, AlertTriangle } from 'lucide-react';

interface CalibrationProgressProps {
  current: number;
  target?: number;
  showDetails?: boolean;
  compact?: boolean;
}

/**
 * CalibrationProgress - Displays calibration state for FSRS algorithm
 *
 * The FSRS algorithm requires approximately 60 reviews to establish
 * reliable stability predictions. This component shows users their
 * progress toward this calibration threshold.
 *
 * Phase 3 Milestone 4: Epistemic Uncertainty UI
 * 
 * DESIGN TOKENS: This component uses semantic tokens from lib/design-tokens.ts
 * - bg-data-pass (teal) for calibrated/success states
 * - bg-data-provisional (amber) for early/warning states
 * - bg-deep-plum-500 for progress (indigo replacement)
 * - bg-steel-blue-500 for developing state (blue replacement)
 */
export const CalibrationProgress: React.FC<CalibrationProgressProps> = ({
  current,
  target = 60,
  showDetails = true,
  compact = false,
}) => {
  const progress = Math.min((current / target) * 100, 100);
  const isCalibrated = current >= target;

  // Determine calibration state for messaging
  const getCalibrationState = () => {
    if (current === 0) return 'not_started';
    if (current < 20) return 'early';
    if (current < 40) return 'developing';
    if (current < 60) return 'refining';
    return 'calibrated';
  };

  const state = getCalibrationState();

  const stateMessages = {
    not_started: {
      title: 'Begin Calibration',
      description: 'Complete questions to train your personalized learning algorithm.',
      color: 'slate',
    },
    early: {
      title: 'Early Calibration',
      description: 'The algorithm is learning your patterns. Predictions are approximate.',
      color: 'amber',
    },
    developing: {
      title: 'Calibrating...',
      description: 'Memory predictions are improving. Keep reviewing consistently.',
      color: 'blue',
    },
    refining: {
      title: 'Almost Calibrated',
      description: 'Nearly optimal predictions. A few more reviews to fine-tune.',
      color: 'indigo',
    },
    calibrated: {
      title: 'Fully Calibrated',
      description: 'FSRS is optimized for your learning patterns.',
      color: 'emerald',
    },
  };

  const currentState = stateMessages[state];

  // Compact version for inline display
  if (compact) {
    return (
      <div className="inline-flex items-center gap-2">
        <div className="relative w-24 h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            className={`absolute inset-y-0 left-0 rounded-full ${
              isCalibrated
                ? 'bg-data-pass'
                : progress > 66
                  ? 'bg-deep-plum-500'
                  : progress > 33
                    ? 'bg-steel-blue-500'
                    : 'bg-data-provisional'
            }`}
          />
        </div>
        <span className="text-xs text-[var(--color-text-muted)]">
          {current}/{target}
        </span>
        {isCalibrated && <Sparkles className="w-3 h-3 text-data-pass" />}
      </div>
    );
  }

  return (
    <div
      className={`p-4 rounded-xl border-2 transition-colors ${
        isCalibrated
          ? 'bg-data-pass/10 dark:bg-data-pass/5 border-data-pass/30 dark:border-data-pass/20'
          : 'bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-700'
      }`}
    >
      <div className="flex items-start gap-3">
        <div
          className={`p-2 rounded-lg ${
            isCalibrated
              ? 'bg-data-pass/10'
              : state === 'not_started'
                ? 'bg-slate-500/10'
                : 'bg-steel-blue-500/10'
          }`}
        >
          {isCalibrated ? (
            <Sparkles className="w-5 h-5 text-data-pass" />
          ) : state === 'early' ? (
            <AlertTriangle className="w-5 h-5 text-data-provisional" />
          ) : (
            <Brain className="w-5 h-5 text-steel-blue-600 dark:text-steel-blue-400" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <h4
              className={`font-semibold ${
                isCalibrated
                  ? 'text-data-pass'
                  : 'text-[var(--color-text-primary)]'
              }`}
            >
              {currentState.title}
            </h4>
            <span className="text-sm font-medium text-[var(--color-text-muted)]">
              {current}/{target} reviews
            </span>
          </div>

          {/* Progress bar */}
          <div className="relative w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden mb-2">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
              className={`absolute inset-y-0 left-0 rounded-full ${
                isCalibrated
                  ? 'bg-data-pass'
                  : progress > 66
                    ? 'bg-deep-plum-500'
                    : progress > 33
                      ? 'bg-steel-blue-500'
                      : 'bg-data-provisional'
              }`}
            />
            {/* Milestone markers */}
            <div className="absolute inset-0 flex justify-between px-[1px]">
              {[20, 40].map((milestone) => (
                <div
                  key={milestone}
                  className={`w-0.5 h-full ${
                    current >= milestone ? 'bg-white/50' : 'bg-slate-400/30 dark:bg-slate-500/30'
                  }`}
                  style={{ marginLeft: `${(milestone / target) * 100}%` }}
                />
              ))}
            </div>
          </div>

          {showDetails && (
            <p
              className={`text-sm ${
                isCalibrated
                  ? 'text-data-pass'
                  : 'text-[var(--color-text-muted)]'
              }`}
            >
              {currentState.description}
            </p>
          )}
        </div>
      </div>

      {/* Calibration milestones (only show when not calibrated) */}
      {!isCalibrated && showDetails && (
        <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-700">
          <div className="flex justify-between text-xs text-[var(--color-text-muted)]">
            <span className={current >= 20 ? 'text-steel-blue-600 dark:text-steel-blue-400' : ''}>
              20: Basic patterns
            </span>
            <span className={current >= 40 ? 'text-deep-plum-600 dark:text-deep-plum-400' : ''}>
              40: Good predictions
            </span>
            <span className={current >= 60 ? 'text-data-pass' : ''}>
              60: Optimized
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default CalibrationProgress;
