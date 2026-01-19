/**
 * CalibrationProtocolUI.tsx
 *
 * The "Clinical Calibration Protocol" UI for new users (0-60 questions).
 * Turns the cold start into a "Medical Workup" where the user unlocks
 * diagnostic insights about their own brain.
 *
 * Stepper UI:
 * - Step 1 (0-10 qs): Baseline Establishment
 * - Step 2 (10-30 qs): Latency Analysis Unlocked
 * - Step 3 (30-50 qs): Metacognition Unlocked
 * - Step 4 (50-60 qs): Error Typology Unlocked
 */

import React from 'react';
import { motion } from 'framer-motion';
import type { Rolling360Stats } from '../../../hooks/useRolling360Stats';
import { StartSessionButton } from '../../ui/SemanticButton';

// =============================================================================
// ICONS
// =============================================================================

const LockClosedIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path
      fillRule="evenodd"
      d="M12 1.5a5.25 5.25 0 00-5.25 5.25v3a3 3 0 00-3 3v6.75a3 3 0 003 3h10.5a3 3 0 003-3v-6.75a3 3 0 00-3-3v-3c0-2.9-2.35-5.25-5.25-5.25zm3.75 8.25v-3a3.75 3.75 0 10-7.5 0v3h7.5z"
      clipRule="evenodd"
    />
  </svg>
);

const LockOpenIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M18 1.5c2.9 0 5.25 2.35 5.25 5.25v3.75a.75.75 0 01-1.5 0V6.75a3.75 3.75 0 00-7.5 0v3h1.5a3 3 0 013 3v6.75a3 3 0 01-3 3H5.25a3 3 0 01-3-3v-6.75a3 3 0 013-3h9v-3c0-2.9 2.35-5.25 5.25-5.25z" />
  </svg>
);

const ClockIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path
      fillRule="evenodd"
      d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25zM12.75 6a.75.75 0 00-1.5 0v6c0 .414.336.75.75.75h4.5a.75.75 0 000-1.5h-3.75V6z"
      clipRule="evenodd"
    />
  </svg>
);

const BrainIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M9.315 7.584C12.195 3.883 16.695 1.5 21.75 1.5a.75.75 0 01.75.75c0 5.056-2.383 9.555-6.084 12.436A6.75 6.75 0 019.75 22.5a.75.75 0 01-.75-.75v-4.131A15.838 15.838 0 016.382 15H2.25a.75.75 0 01-.75-.75 6.75 6.75 0 017.815-6.666zM15 6.75a2.25 2.25 0 100 4.5 2.25 2.25 0 000-4.5z" />
  </svg>
);

const ExclamationCircleIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path
      fillRule="evenodd"
      d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12zM12 8.25a.75.75 0 01.75.75v3.75a.75.75 0 01-1.5 0V9a.75.75 0 01.75-.75zm0 8.25a.75.75 0 100-1.5.75.75 0 000 1.5z"
      clipRule="evenodd"
    />
  </svg>
);

const PlayIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path
      fillRule="evenodd"
      d="M4.5 5.653c0-1.426 1.529-2.33 2.779-1.643l11.54 6.348c1.295.712 1.295 2.573 0 3.285L7.28 19.991c-1.25.687-2.779-.217-2.779-1.643V5.653z"
      clipRule="evenodd"
    />
  </svg>
);

const SparklesIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path
      fillRule="evenodd"
      d="M9 4.5a.75.75 0 01.721.544l.813 2.846a3.75 3.75 0 002.576 2.576l2.846.813a.75.75 0 010 1.442l-2.846.813a3.75 3.75 0 00-2.576 2.576l-.813 2.846a.75.75 0 01-1.442 0l-.813-2.846a3.75 3.75 0 00-2.576-2.576l-2.846-.813a.75.75 0 010-1.442l2.846-.813A3.75 3.75 0 007.466 7.89l.813-2.846A.75.75 0 019 4.5z"
      clipRule="evenodd"
    />
  </svg>
);

// =============================================================================
// CONSTANTS
// =============================================================================

const CALIBRATION_STEPS = [
  {
    step: 1,
    name: 'Baseline Establishment',
    threshold: 10,
    description: 'Building your cognitive baseline',
    icon: SparklesIcon,
    unlockedMetric: null,
  },
  {
    step: 2,
    name: 'Latency Analysis',
    threshold: 30,
    description: 'Measuring your response patterns',
    icon: ClockIcon,
    unlockedMetric: 'avgResponseTime',
  },
  {
    step: 3,
    name: 'Metacognition',
    threshold: 50,
    description: 'Mapping your confidence calibration',
    icon: BrainIcon,
    unlockedMetric: 'confidenceAlignment',
  },
  {
    step: 4,
    name: 'Error Typology',
    threshold: 60,
    description: 'Identifying your knowledge gaps',
    icon: ExclamationCircleIcon,
    unlockedMetric: 'primaryErrorSystem',
  },
];

const CALIBRATION_TARGET = 60;

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function getCurrentStep(totalQuestions: number): number {
  if (totalQuestions < 10) return 1;
  if (totalQuestions < 30) return 2;
  if (totalQuestions < 50) return 3;
  return 4;
}

function getQuestionsToNextUnlock(totalQuestions: number): number {
  if (totalQuestions < 10) return 10 - totalQuestions;
  if (totalQuestions < 30) return 30 - totalQuestions;
  if (totalQuestions < 50) return 50 - totalQuestions;
  return 60 - totalQuestions;
}

function getNextUnlockName(totalQuestions: number): string {
  if (totalQuestions < 10) return 'Latency Analysis';
  if (totalQuestions < 30) return 'Metacognition';
  if (totalQuestions < 50) return 'Error Typology';
  return 'Full Prediction';
}

/**
 * Gets calibration metrics from the stats prop (backend-calculated)
 * Falls back to legacy calculation if calibrationMetrics is not available
 */
function getCalibrationMetrics(stats: Rolling360Stats): {
  avgResponseTimeMs: number | null;
  confidenceAlignment: number | null;
  primaryErrorSystem: string | null;
} {
  // Use real backend metrics if available
  if (stats.calibrationMetrics) {
    return {
      avgResponseTimeMs: stats.calibrationMetrics.avgResponseTimeMs,
      confidenceAlignment: stats.calibrationMetrics.confidenceAlignment,
      primaryErrorSystem: stats.calibrationMetrics.primaryErrorSystem,
    };
  }

  // Fallback: Calculate locally from stats (legacy behavior)
  const total = stats.totalInWindow;
  return {
    avgResponseTimeMs: null, // No local fallback available
    confidenceAlignment: null, // No local fallback available
    primaryErrorSystem: total >= 50 ? stats.weakestSystems[0] || null : null,
  };
}

// =============================================================================
// STEP CARD COMPONENT
// =============================================================================

interface StepCardProps {
  step: (typeof CALIBRATION_STEPS)[0];
  currentQuestions: number;
  metrics: ReturnType<typeof getCalibrationMetrics>;
}

function StepCard({ step, currentQuestions, metrics }: StepCardProps) {
  const isUnlocked = currentQuestions >= step.threshold;
  const isActive = currentQuestions >= step.threshold - 20 && !isUnlocked;
  const progress = Math.min(100, (currentQuestions / step.threshold) * 100);

  const Icon = step.icon;

  // Get unlocked metric value
  let metricDisplay: React.ReactNode = null;
  if (isUnlocked && step.unlockedMetric) {
    switch (step.unlockedMetric) {
      case 'avgResponseTime': {
        const avgTime = metrics.avgResponseTimeMs;
        metricDisplay = avgTime ? `${Math.round(avgTime / 1000)}s avg` : '---';
        break;
      }
      case 'confidenceAlignment': {
        const alignment = metrics.confidenceAlignment;
        metricDisplay = alignment ? `${Math.round(alignment * 100)}%` : '---';
        break;
      }
      case 'primaryErrorSystem': {
        metricDisplay = metrics.primaryErrorSystem || '---';
        break;
      }
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: step.step * 0.1 }}
      className={`relative p-4 rounded-xl border transition-all duration-300 ${
        isUnlocked
          ? 'bg-teal-500/10 border-teal-500/30'
          : isActive
            ? 'bg-slate-700/50 border-amber-500/30'
            : 'bg-slate-800/30 border-slate-700/30 opacity-60'
      }`}
    >
      {/* Lock/Unlock indicator */}
      <div className="absolute top-3 right-3">
        {isUnlocked ? (
          <LockOpenIcon className="w-4 h-4 text-teal-400" />
        ) : (
          <LockClosedIcon className="w-4 h-4 text-slate-500" />
        )}
      </div>

      {/* Step header */}
      <div className="flex items-center gap-3 mb-2">
        <div className={`p-2 rounded-lg ${isUnlocked ? 'bg-teal-500/20' : 'bg-slate-700/50'}`}>
          <Icon className={`w-5 h-5 ${isUnlocked ? 'text-teal-400' : 'text-slate-400'}`} />
        </div>
        <div>
          <h4 className={`text-sm font-medium ${isUnlocked ? 'text-teal-300' : 'text-slate-300'}`}>
            {step.name}
          </h4>
          <p className="text-xs text-slate-500">{step.description}</p>
        </div>
      </div>

      {/* Progress bar (only for active/locked steps) */}
      {!isUnlocked && (
        <div className="mt-3">
          <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
            <motion.div
              className={`h-full ${isActive ? 'bg-amber-500' : 'bg-slate-600'}`}
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.8 }}
            />
          </div>
          <p className="text-xs text-slate-500 mt-1 text-center">
            {step.threshold - currentQuestions} more to unlock
          </p>
        </div>
      )}

      {/* Unlocked metric display */}
      {isUnlocked && metricDisplay && (
        <div className="mt-3 text-center">
          <span className="text-xl font-bold text-teal-400">{metricDisplay}</span>
        </div>
      )}
    </motion.div>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

interface CalibrationProtocolUIProps {
  stats: Rolling360Stats;
  onStartSession: () => void;
  isStarting: boolean;
}

export function CalibrationProtocolUI({
  stats,
  onStartSession,
  isStarting,
}: CalibrationProtocolUIProps) {
  const totalQuestions = stats.totalInWindow;
  const currentStep = getCurrentStep(totalQuestions);
  const questionsToNext = getQuestionsToNextUnlock(totalQuestions);
  const nextUnlock = getNextUnlockName(totalQuestions);
  const metrics = getCalibrationMetrics(stats);

  const progressPercent = (totalQuestions / CALIBRATION_TARGET) * 100;

  return (
    <div className="space-y-5">
      {/* Header with medical workup theme */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <SparklesIcon className="w-5 h-5 text-amber-400" />
          Clinical Calibration Protocol
        </h3>
        <span className="px-3 py-1 bg-amber-500/20 text-amber-300 text-xs rounded-full">
          Phase {currentStep}/4
        </span>
      </div>

      {/* Main progress display */}
      <div className="text-center py-3">
        <div className="inline-flex items-center gap-3">
          <span className="text-5xl font-bold text-white">{totalQuestions}</span>
          <span className="text-2xl text-slate-500">/</span>
          <span className="text-2xl text-slate-400">{CALIBRATION_TARGET}</span>
        </div>
        <p className="text-sm text-slate-400 mt-2">Questions to Full Prediction</p>
      </div>

      {/* Overall progress bar */}
      <div className="space-y-2">
        <div className="h-3 bg-slate-700 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-amber-500 via-orange-500 to-teal-500"
            initial={{ width: 0 }}
            animate={{ width: `${progressPercent}%` }}
            transition={{ duration: 1, ease: 'easeOut' }}
          />
        </div>
        <div className="flex justify-between text-xs text-slate-500">
          <span>Calibrating...</span>
          <span>{Math.round(progressPercent)}% Complete</span>
        </div>
      </div>

      {/* Unlockable insights stepper */}
      <div className="grid grid-cols-2 gap-3">
        {CALIBRATION_STEPS.map((step) => (
          <StepCard
            key={step.step}
            step={step}
            currentQuestions={totalQuestions}
            metrics={metrics}
          />
        ))}
      </div>

      {/* Next unlock teaser */}
      <div className="bg-slate-700/30 border border-slate-700/50 rounded-xl p-4 text-center">
        <p className="text-sm text-slate-400">
          <span className="text-amber-400 font-semibold">{questionsToNext} questions</span> until
          you unlock <span className="text-white font-medium">{nextUnlock}</span>
        </p>
      </div>

      {/* Start/Continue Button - Primary CTA with high contrast */}
      <StartSessionButton
        onClick={onStartSession}
        isLoading={isStarting}
        leftIcon={!isStarting && <PlayIcon className="w-6 h-6" />}
        buttonId="start-session-calibration"
      >
        {isStarting ? 'Generating Session...' : 'Continue Calibration'}
      </StartSessionButton>
    </div>
  );
}

export default CalibrationProtocolUI;
