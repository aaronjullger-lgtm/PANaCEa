import React from 'react';
import { motion } from 'framer-motion';
import { Brain, Sparkles, AlertTriangle } from 'lucide-react';
import { ExplainabilityTooltip } from '@/components/ui/ExplainabilityTooltip';

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
      description: 'Complete questions so we can tune your personal forgetting curve.',
    },
    early: {
      title: 'Early Calibration',
      description: 'We need ~60 reviews to tune your curve. Predictions are approximate until then.',
    },
    developing: {
      title: 'Building Your Model',
      description: `Based on your last ${current} reviews. FSRS needs ~${target} to tune your personal forgetting curve—keep reviewing consistently.`,
    },
    refining: {
      title: 'Almost Calibrated',
      description: 'Nearly optimal predictions. A few more reviews to fine-tune.',
    },
    calibrated: {
      title: 'Fully Calibrated',
      description: 'FSRS is optimized for your learning patterns.',
    },
  };

  const currentState = stateMessages[state];

  // Compact version for inline display
  if (compact) {
    return (
      <div className="inline-flex items-center gap-2">
        <div className="relative w-24 h-3 bg-[var(--color-bg-tertiary)] rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            className={`absolute inset-y-0 left-0 rounded-full ${
              isCalibrated
                ? 'bg-data-pass'
                : progress > 66
                  ? 'bg-[var(--color-accent)]'
                  : progress > 33
                    ? 'bg-[var(--color-accent)]/70'
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
      onClick={() => {
        if (!isCalibrated) {
          window.location.assign('/study/main-session');
        }
      }}
      className={`p-4 rounded-xl border-2 transition-colors ${
        isCalibrated
          ? 'bg-data-pass/10 border-data-pass/30'
          : 'bg-[var(--color-bg-secondary)] border-[var(--color-border)] cursor-pointer hover:border-action-primary/50 hover:bg-action-muted/10'
      }`}
      role={!isCalibrated ? 'button' : undefined}
      tabIndex={!isCalibrated ? 0 : undefined}
      onKeyDown={(e) => {
        if (!isCalibrated && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          window.location.assign('/study/main-session');
        }
      }}
    >
      <div className="flex items-start gap-3">
        <div
          className={`p-2 rounded-lg ${
            isCalibrated
              ? 'bg-data-pass/10'
              : state === 'not_started'
                ? 'bg-[var(--color-bg-tertiary)]'
                : 'bg-[var(--color-accent)]/10'
          }`}
        >
          {isCalibrated ? (
            <Sparkles className="w-5 h-5 text-data-pass" />
          ) : state === 'early' ? (
            <AlertTriangle className="w-5 h-5 text-data-provisional" />
          ) : (
            <Brain className="w-5 h-5 text-[var(--color-accent)]" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <h4
              className={`font-semibold flex items-center gap-1.5 ${
                isCalibrated ? 'text-data-pass' : 'text-[var(--color-text-primary)]'
              }`}
            >
              {currentState.title}
              {!isCalibrated && (
                <ExplainabilityTooltip
                  formula="FSRS (spaced repetition) needs about 60 reviews to learn your personal forgetting curve. Until then, due-date predictions are approximate."
                  ariaLabel="What does calibration mean?"
                />
              )}
            </h4>
            <span className="text-sm font-medium text-[var(--color-text-muted)]">
              {current}/{target} reviews
            </span>
          </div>

          {/* Progress bar */}
          <div className="relative w-full h-3 bg-[var(--color-bg-tertiary)] rounded-full overflow-hidden mb-2">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
              className={`absolute inset-y-0 left-0 rounded-full ${
                isCalibrated
                  ? 'bg-data-pass'
                  : progress > 66
                    ? 'bg-[var(--color-accent)]'
                    : progress > 33
                      ? 'bg-[var(--color-accent)]/70'
                      : 'bg-data-provisional'
              }`}
            />
            {/* Milestone markers */}
            <div className="absolute inset-0 flex justify-between px-[1px]">
              {[20, 40].map((milestone) => (
                <div
                  key={milestone}
                  className={`w-0.5 h-full ${
                    current >= milestone
                      ? 'bg-[var(--color-border)]/70'
                      : 'bg-[var(--color-border)]/40'
                  }`}
                  style={{ marginLeft: `${(milestone / target) * 100}%` }}
                />
              ))}
            </div>
          </div>

          {showDetails && (
            <p
              className={`text-sm ${
                isCalibrated ? 'text-data-pass' : 'text-[var(--color-text-muted)]'
              }`}
            >
              {currentState.description}
            </p>
          )}
        </div>
      </div>

      {/* Calibration milestones (only show when not calibrated) */}
      {!isCalibrated && showDetails && (
        <div className="mt-3 pt-3 border-t border-[var(--color-border)]">
          <div className="flex justify-between text-xs text-[var(--color-text-muted)]">
            <span className={current >= 20 ? 'text-[var(--color-accent)]' : ''}>
              20: Basic patterns
            </span>
            <span className={current >= 40 ? 'text-[var(--color-accent)]' : ''}>
              40: Good predictions
            </span>
            <span className={current >= 60 ? 'text-data-pass' : ''}>60: Optimized</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default CalibrationProgress;
