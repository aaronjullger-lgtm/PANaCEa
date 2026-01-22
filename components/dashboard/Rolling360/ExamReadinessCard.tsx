/**
 * ExamReadinessCard.tsx
 *
 * The primary dashboard card showing the user's Rolling 360 exam readiness.
 * Displays different states based on data confidence:
 * - Collecting: Progress bar toward first 50 questions
 * - Provisional: Score with yellow warning badge
 * - Confident: Score with pass probability meter
 *
 * Contains the primary "Start Session" CTA button.
 */

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRolling360Stats, Rolling360Stats } from '../../../hooks/useRolling360Stats';
import { useSessionGenerator } from '../../../hooks/useSessionGenerator';
import { CalibrationProtocolUI } from './CalibrationProtocolUI';
import { StartSessionButton, SemanticButton } from '../../ui/SemanticButton';

/** Calibration threshold - users below this see the Calibration Protocol UI */
const CALIBRATION_THRESHOLD = 60;

// =============================================================================
// INLINE ICONS (avoiding dependency issues)
// =============================================================================

const PlayIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path
      fillRule="evenodd"
      d="M4.5 5.653c0-1.426 1.529-2.33 2.779-1.643l11.54 6.348c1.295.712 1.295 2.573 0 3.285L7.28 19.991c-1.25.687-2.779-.217-2.779-1.643V5.653z"
      clipRule="evenodd"
    />
  </svg>
);

const ChartBarIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M18.375 2.25c-1.035 0-1.875.84-1.875 1.875v15.75c0 1.035.84 1.875 1.875 1.875h.75c1.035 0 1.875-.84 1.875-1.875V4.125c0-1.036-.84-1.875-1.875-1.875h-.75zM9.75 8.625c0-1.036.84-1.875 1.875-1.875h.75c1.036 0 1.875.84 1.875 1.875v11.25c0 1.035-.84 1.875-1.875 1.875h-.75a1.875 1.875 0 01-1.875-1.875V8.625zM3 13.125c0-1.036.84-1.875 1.875-1.875h.75c1.036 0 1.875.84 1.875 1.875v6.75c0 1.035-.84 1.875-1.875 1.875h-.75A1.875 1.875 0 013 19.875v-6.75z" />
  </svg>
);

const ExclamationTriangleIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path
      fillRule="evenodd"
      d="M9.401 3.003c1.155-2 4.043-2 5.197 0l7.355 12.748c1.154 2-.29 4.5-2.599 4.5H4.645c-2.309 0-3.752-2.5-2.598-4.5L9.4 3.003zM12 8.25a.75.75 0 01.75.75v3.75a.75.75 0 01-1.5 0V9a.75.75 0 01.75-.75zm0 8.25a.75.75 0 100-1.5.75.75 0 000 1.5z"
      clipRule="evenodd"
    />
  </svg>
);

const CheckCircleIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path
      fillRule="evenodd"
      d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12zm13.36-1.814a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z"
      clipRule="evenodd"
    />
  </svg>
);

const ArrowTrendingUpIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path
      fillRule="evenodd"
      d="M15.22 6.268a.75.75 0 01.968-.432l5.942 2.28a.75.75 0 01.431.97l-2.28 5.941a.75.75 0 11-1.4-.537l1.63-4.251-1.086.483a11.2 11.2 0 00-5.45 5.174.75.75 0 01-1.199.19L9 12.31l-6.22 6.22a.75.75 0 11-1.06-1.06l6.75-6.75a.75.75 0 011.06 0l3.606 3.606a12.694 12.694 0 015.68-4.973l1.086-.484-4.251-1.632a.75.75 0 01-.432-.97z"
      clipRule="evenodd"
    />
  </svg>
);

const SparklesIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path
      fillRule="evenodd"
      d="M9 4.5a.75.75 0 01.721.544l.813 2.846a3.75 3.75 0 002.576 2.576l2.846.813a.75.75 0 010 1.442l-2.846.813a3.75 3.75 0 00-2.576 2.576l-.813 2.846a.75.75 0 01-1.442 0l-.813-2.846a3.75 3.75 0 00-2.576-2.576l-2.846-.813a.75.75 0 010-1.442l2.846-.813A3.75 3.75 0 007.466 7.89l.813-2.846A.75.75 0 019 4.5zM18 1.5a.75.75 0 01.728.568l.258 1.036c.236.94.97 1.674 1.91 1.91l1.036.258a.75.75 0 010 1.456l-1.036.258c-.94.236-1.674.97-1.91 1.91l-.258 1.036a.75.75 0 01-1.456 0l-.258-1.036a2.625 2.625 0 00-1.91-1.91l-1.036-.258a.75.75 0 010-1.456l1.036-.258a2.625 2.625 0 001.91-1.91l.258-1.036A.75.75 0 0118 1.5zM16.5 15a.75.75 0 01.712.513l.394 1.183c.15.447.5.799.948.948l1.183.395a.75.75 0 010 1.422l-1.183.395c-.447.15-.799.5-.948.948l-.395 1.183a.75.75 0 01-1.422 0l-.395-1.183a1.5 1.5 0 00-.948-.948l-1.183-.395a.75.75 0 010-1.422l1.183-.395c.447-.15.799-.5.948-.948l.395-1.183A.75.75 0 0116.5 15z"
      clipRule="evenodd"
    />
  </svg>
);

// =============================================================================
// SKELETON LOADER
// =============================================================================

function ExamReadinessSkeleton() {
  return (
    <div className="bg-slate-800/60 backdrop-blur-xl rounded-2xl p-6 border border-slate-700/50 animate-pulse">
      {/* Header skeleton */}
      <div className="flex items-center justify-between mb-6">
        <div className="h-6 bg-slate-700 rounded-lg w-40" />
        <div className="h-5 bg-slate-700 rounded-full w-24" />
      </div>

      {/* Score skeleton */}
      <div className="flex flex-col items-center mb-6">
        <div className="h-20 w-32 bg-slate-700 rounded-xl mb-2" />
        <div className="h-4 bg-slate-700 rounded w-24" />
      </div>

      {/* Progress bar skeleton */}
      <div className="h-3 bg-slate-700 rounded-full mb-4" />

      {/* Button skeleton */}
      <div className="h-14 bg-slate-700 rounded-xl" />
    </div>
  );
}

// =============================================================================
// COLLECTING STATE (< 50 questions)
// =============================================================================

interface CollectingStateProps {
  stats: Rolling360Stats;
  onStartSession: () => void;
  isStarting: boolean;
}

function CollectingState({ stats, onStartSession, isStarting }: CollectingStateProps) {
  const progress = (stats.totalInWindow / 50) * 100;
  const questionsNeeded = 50 - stats.totalInWindow;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-[var(--color-text-primary)] flex items-center gap-2">
          <SparklesIcon className="w-5 h-5 text-amber-400" />
          Building Your Profile
        </h3>
        <span className="px-3 py-1 bg-slate-700/50 text-slate-300 text-sm rounded-full">
          {stats.totalInWindow}/50 Questions
        </span>
      </div>

      {/* Progress visualization */}
      <div className="text-center py-4">
        <div className="relative inline-flex items-center justify-center">
          {/* Circular progress ring */}
          <svg className="w-32 h-32 transform -rotate-90">
            <circle
              cx="64"
              cy="64"
              r="56"
              stroke="currentColor"
              strokeWidth="8"
              fill="none"
              className="text-slate-700"
            />
            <motion.circle
              cx="64"
              cy="64"
              r="56"
              stroke="currentColor"
              strokeWidth="8"
              fill="none"
              className="text-amber-400"
              strokeLinecap="round"
              initial={{ strokeDasharray: '0 352' }}
              animate={{ strokeDasharray: `${progress * 3.52} 352` }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-3xl font-bold text-[var(--color-text-primary)]">{stats.totalInWindow}</span>
            <span className="text-xs text-slate-400">of 50</span>
          </div>
        </div>
      </div>

      {/* Message */}
      <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4">
        <p className="text-sm text-amber-200 text-center">
          Answer <span className="font-semibold">{questionsNeeded} more questions</span> in Main
          Session to unlock your preliminary PANCE score prediction.
        </p>
      </div>

      {/* Start Button - Primary CTA with high contrast */}
      <StartSessionButton
        onClick={onStartSession}
        isLoading={isStarting}
        leftIcon={!isStarting && <PlayIcon className="w-6 h-6" />}
        buttonId="start-session-collecting"
      >
        {isStarting ? 'Generating Session...' : 'Start Main Session'}
      </StartSessionButton>
    </div>
  );
}

// =============================================================================
// PROVISIONAL STATE (50-179 questions)
// =============================================================================

interface ProvisionalStateProps {
  stats: Rolling360Stats;
  onStartSession: () => void;
  isStarting: boolean;
}

function ProvisionalState({ stats, onStartSession, isStarting }: ProvisionalStateProps) {
  const questionsToConfident = 180 - stats.totalInWindow;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-[var(--color-text-primary)] flex items-center gap-2">
          <ChartBarIcon className="w-5 h-5 text-amber-400" />
          Exam Readiness
        </h3>
        <span className="px-3 py-1 bg-amber-500/20 text-amber-300 text-sm rounded-full flex items-center gap-1">
          <ExclamationTriangleIcon className="w-4 h-4" />
          Provisional
        </span>
      </div>

      {/* Score Display */}
      <div className="text-center py-2">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="inline-block"
        >
          <span className="text-6xl font-bold text-[var(--color-text-primary)]">{stats.predictedScore || '---'}</span>
          <span className="text-xl text-slate-400 ml-2">/800</span>
        </motion.div>
        <p className="text-sm text-slate-400 mt-2">Predicted PANCE Score</p>
      </div>

      {/* Accuracy */}
      <div className="flex items-center justify-center gap-8 py-2">
        <div className="text-center">
          <span className="text-2xl font-semibold text-[var(--color-text-primary)]">
            {stats.accuracyPercent?.toFixed(1) || '0'}%
          </span>
          <p className="text-xs text-slate-400">Accuracy</p>
        </div>
        <div className="w-px h-10 bg-slate-700" />
        <div className="text-center">
          <span className="text-2xl font-semibold text-[var(--color-text-primary)]">{stats.totalInWindow}</span>
          <p className="text-xs text-slate-400">Questions</p>
        </div>
      </div>

      {/* Confidence Progress */}
      <div className="space-y-2">
        <div className="flex justify-between text-xs text-slate-400">
          <span>Confidence Building</span>
          <span>{stats.totalInWindow}/180</span>
        </div>
        <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-amber-500 to-orange-500"
            initial={{ width: 0 }}
            animate={{ width: `${(stats.totalInWindow / 180) * 100}%` }}
            transition={{ duration: 0.8 }}
          />
        </div>
        <p className="text-xs text-slate-500 text-center">
          {questionsToConfident} more questions for confident prediction
        </p>
      </div>

      {/* Start Button - Primary CTA with high contrast */}
      <StartSessionButton
        onClick={onStartSession}
        isLoading={isStarting}
        leftIcon={!isStarting && <PlayIcon className="w-6 h-6" />}
        buttonId="start-session-provisional"
      >
        {isStarting ? 'Generating Session...' : 'Continue Main Session'}
      </StartSessionButton>
    </div>
  );
}

// =============================================================================
// CONFIDENT STATE (180+ questions)
// =============================================================================

interface ConfidentStateProps {
  stats: Rolling360Stats;
  onStartSession: () => void;
  isStarting: boolean;
}

function ConfidentState({ stats, onStartSession, isStarting }: ConfidentStateProps) {
  const isPassing = (stats.predictedScore || 0) >= 350;
  const passLikelihood = stats.passLikelihood || 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-[var(--color-text-primary)] flex items-center gap-2">
          <ChartBarIcon className="w-5 h-5 text-teal-400" />
          Exam Readiness
        </h3>
        <span
          className={`px-3 py-1 text-sm rounded-full flex items-center gap-1
          ${isPassing ? 'bg-teal-500/20 text-teal-300' : 'bg-red-500/20 text-red-300'}`}
        >
          {isPassing ? (
            <CheckCircleIcon className="w-4 h-4" />
          ) : (
            <ExclamationTriangleIcon className="w-4 h-4" />
          )}
          {isPassing ? 'On Track' : 'Needs Work'}
        </span>
      </div>

      {/* Score Display */}
      <div className="text-center py-2">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="inline-block"
        >
          <span className={`text-6xl font-bold ${isPassing ? 'text-teal-400' : 'text-red-400'}`}>
            {stats.predictedScore || '---'}
          </span>
          <span className="text-xl text-slate-400 ml-2">/800</span>
        </motion.div>
        <p className="text-sm text-slate-400 mt-2">Predicted PANCE Score</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-3 gap-4 py-2">
        <div className="text-center">
          <span className="text-xl font-semibold text-[var(--color-text-primary)]">
            {stats.accuracyPercent?.toFixed(1) || '0'}%
          </span>
          <p className="text-xs text-slate-400">Accuracy</p>
        </div>
        <div className="text-center">
          <span
            className={`text-xl font-semibold ${isPassing ? 'text-teal-400' : 'text-amber-400'}`}
          >
            {passLikelihood.toFixed(0)}%
          </span>
          <p className="text-xs text-slate-400">Pass Chance</p>
        </div>
        <div className="text-center">
          <span className="text-xl font-semibold text-[var(--color-text-primary)]">{stats.totalInWindow}</span>
          <p className="text-xs text-slate-400">Questions</p>
        </div>
      </div>

      {/* Pass Probability Bar */}
      <div className="space-y-2">
        <div className="flex justify-between text-xs text-slate-400">
          <span>Pass Probability</span>
          <span>{passLikelihood.toFixed(1)}%</span>
        </div>
        <div className="h-3 bg-slate-700 rounded-full overflow-hidden">
          <motion.div
            className={`h-full ${
              isPassing
                ? 'bg-gradient-to-r from-teal-500 to-emerald-500'
                : 'bg-gradient-to-r from-red-500 to-orange-500'
            }`}
            initial={{ width: 0 }}
            animate={{ width: `${passLikelihood}%` }}
            transition={{ duration: 1, ease: 'easeOut' }}
          />
        </div>
      </div>

      {/* Blueprint Adherence */}
      {stats.blueprintAdherence !== null && (
        <div className="flex items-center justify-between text-sm bg-slate-700/30 rounded-lg px-4 py-2">
          <span className="text-slate-400">Blueprint Match</span>
          <span
            className={`font-semibold ${
              stats.blueprintAdherence >= 0.85 ? 'text-teal-400' : 'text-amber-400'
            }`}
          >
            {(stats.blueprintAdherence * 100).toFixed(0)}%
          </span>
        </div>
      )}

      {/* Start Button - Success variant for passing, Primary for needs work */}
      <SemanticButton
        variant={isPassing ? 'success' : 'primary'}
        size="xl"
        fullWidth
        onClick={onStartSession}
        isLoading={isStarting}
        leftIcon={!isStarting && <PlayIcon className="w-6 h-6" />}
        rightIcon={!isStarting && <ArrowTrendingUpIcon className="w-5 h-5" />}
        buttonId="start-session-confident"
      >
        {isStarting ? 'Generating Session...' : 'Start Main Session'}
      </SemanticButton>
    </div>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

interface ExamReadinessCardProps {
  className?: string;
}

export function ExamReadinessCard({ className = '' }: ExamReadinessCardProps) {
  const { stats, isLoading, error } = useRolling360Stats();
  const { generateSession, isGenerating } = useSessionGenerator();

  const handleStartSession = async () => {
    await generateSession({ mode: 'mainSession', size: 20 });
  };

  // Loading state
  if (isLoading) {
    return <ExamReadinessSkeleton />;
  }

  // Error state
  if (error) {
    return (
      <div
        className={`bg-slate-800/60 backdrop-blur-xl rounded-2xl p-6 border border-red-500/30 ${className}`}
      >
        <p className="text-red-400 text-center">Failed to load exam readiness data</p>
      </div>
    );
  }

  // Null stats - shouldn't happen but handle gracefully
  if (!stats) {
    return <ExamReadinessSkeleton />;
  }

  // Determine if user is in calibration phase (< 60 questions)
  const isCalibrating = stats.totalInWindow < CALIBRATION_THRESHOLD;

  return (
    <div
      className={`bg-slate-800/60 backdrop-blur-xl rounded-2xl p-6 border border-slate-700/50 ${className}`}
    >
      <AnimatePresence mode="wait">
        {/* Show Calibration Protocol UI for new users (< 60 questions) */}
        {isCalibrating && (
          <motion.div
            key="calibrating"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <CalibrationProtocolUI
              stats={stats}
              onStartSession={handleStartSession}
              isStarting={isGenerating}
            />
          </motion.div>
        )}

        {/* Show provisional state (60-179 questions) */}
        {!isCalibrating && stats.scoreConfidence === 'provisional' && (
          <motion.div
            key="provisional"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <ProvisionalState
              stats={stats}
              onStartSession={handleStartSession}
              isStarting={isGenerating}
            />
          </motion.div>
        )}

        {stats.scoreConfidence === 'confident' && (
          <motion.div
            key="confident"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <ConfidentState
              stats={stats}
              onStartSession={handleStartSession}
              isStarting={isGenerating}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default ExamReadinessCard;