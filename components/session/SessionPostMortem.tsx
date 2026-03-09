/**
 * SessionPostMortem.tsx
 *
 * The "Victory Screen" shown after completing a study session.
 * Designed to create a dopamine hit by showing:
 * - Score DELTA (not just percentage)
 * - Memories stabilized
 * - Decay prevented
 * - System triage changes
 * - Trajectory improvement
 * - JOL Calibration insights (metacognitive feedback)
 */

import { motion, AnimatePresence } from 'framer-motion';
import {
  Shield,
  Calendar,
  TrendingUp,
  Building2,
  Flame,
  Trophy,
  PartyPopper,
  Check,
  Circle,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { CalibrationPanel } from './CalibrationPanel';
import type { CalibrationSummary } from '../../services/analytics/calibrationService';
import type { SessionImpact } from '../../lib/driftCalculator';

// =============================================================================
// TYPES
// =============================================================================

export interface SystemImpactData {
  system: string;
  questionsAnswered: number;
  accuracyDelta: number;
  previousAccuracy: number;
  newAccuracy: number;
  previousStatus: 'critical' | 'at_risk' | 'stable' | 'mastered';
  newStatus: 'critical' | 'at_risk' | 'stable' | 'mastered';
}

export interface SessionPostMortemData {
  // Basic Stats
  questionsAnswered: number;
  correctCount: number;
  incorrectCount: number;
  accuracy: number;

  // Impact Metrics
  scoreChange: number;
  memoriesStabilized: number;
  decayPrevented: number;
  projectionImprovement: number;

  // System Impact
  systemImpact: SystemImpactData[];

  // Trajectory
  previousProjectedDay7: number;
  newProjectedDay7: number;

  // Streak
  currentStreak: number;
  streakMilestone: string | null;

  // Achievement
  achievementUnlocked: string | null;
}

interface SessionPostMortemProps {
  data: SessionPostMortemData;
  onContinue: () => void;
  onViewDashboard: () => void;
  className?: string;
  // JOL Calibration props
  calibrationSummary?: CalibrationSummary | null;
  isCalibrationReliable?: boolean;
  calibrationProgress?: { current: number; required: number; percentage: number };
}

// =============================================================================
// CONSTANTS
// =============================================================================

const STATUS_COLORS: Record<string, string> = {
  critical: 'text-[var(--color-data-fail)]',
  at_risk: 'text-[var(--color-data-provisional)]',
  stable: 'text-[var(--color-data-pass)]',
  mastered: 'text-[var(--color-accent)]',
};

function StatusDot({ status }: { status: string }) {
  const colorClass = STATUS_COLORS[status] ?? STATUS_COLORS.at_risk;
  return (
    <Circle className={cn('w-2.5 h-2.5 fill-current shrink-0', colorClass)} strokeWidth={0} />
  );
}

// =============================================================================
// SUB-COMPONENTS
// =============================================================================

function ScoreDeltaHero({ delta, accuracy }: { delta: number; accuracy: number }) {
  const isPositive = delta > 0;
  const isNeutral = delta === 0;

  return (
    <motion.div
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ duration: 0.5, type: 'spring' }}
      className="text-center py-6"
    >
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2 }}
        className={cn(
          'text-5xl font-black',
          isPositive
            ? 'text-[var(--color-data-pass)]'
            : isNeutral
              ? 'text-[var(--color-text-muted)]'
              : 'text-[var(--color-data-fail)]'
        )}
      >
        {isPositive ? '+' : ''}
        {delta.toFixed(1)} POINTS
      </motion.div>
      <motion.div
        initial={{ y: 10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="text-[var(--color-text-muted)] text-sm mt-2"
      >
        Your PANCE Score {isPositive ? 'Increased' : isNeutral ? 'Held Steady' : 'Adjusted'}
      </motion.div>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
        className="text-lg text-[var(--color-text-secondary)] mt-1"
      >
        Session Accuracy: <span className="font-bold">{accuracy.toFixed(0)}%</span>
      </motion.div>
    </motion.div>
  );
}

function ImpactCards({
  stabilized,
  decayPrevented,
  bufferDays,
}: {
  stabilized: number;
  decayPrevented: number;
  bufferDays: number;
}) {
  return (
    <div className="grid grid-cols-3 gap-3">
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="bg-[var(--color-accent)]/10 rounded-xl p-4 text-center"
      >
        <div className="text-3xl font-bold text-[var(--color-accent)]">{stabilized}</div>
        <div className="text-xs text-[var(--color-accent)] mt-1">Cards Stabilized</div>
        <div className="text-lg mt-1">
          <TrendingUp className="w-5 h-5 text-[var(--color-accent)]" />
        </div>
      </motion.div>

      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="bg-[var(--color-data-provisional)]/10 rounded-xl p-4 text-center"
      >
        <div className="text-3xl font-bold text-[var(--color-data-provisional)]">
          -{decayPrevented.toFixed(1)}%
        </div>
        <div className="text-xs text-[var(--color-data-provisional)] mt-1">Decay Prevented</div>
        <div className="text-lg mt-1">
          <Shield className="w-5 h-5 text-[var(--color-data-provisional)]" />
        </div>
      </motion.div>

      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="bg-[var(--color-data-pass)]/10 rounded-xl p-4 text-center"
      >
        <div className="text-3xl font-bold text-[var(--color-data-pass)]">+{bufferDays}</div>
        <div className="text-xs text-[var(--color-data-pass)] mt-1">Days Buffer</div>
        <div className="text-lg mt-1">
          <Calendar className="w-5 h-5 text-[var(--color-data-pass)]" />
        </div>
      </motion.div>
    </div>
  );
}

function SystemTriageChanges({ impact }: { impact: SystemImpactData[] }) {
  // Only show systems that actually changed
  const changedSystems = impact.filter((s) => s.questionsAnswered > 0 && s.accuracyDelta !== 0);

  if (changedSystems.length === 0) return null;

  return (
    <motion.div
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ delay: 0.6 }}
      className="bg-[var(--color-bg-secondary)] rounded-xl p-4"
    >
      <h4 className="text-sm font-semibold text-[var(--color-text-secondary)] mb-3 flex items-center gap-2">
        <Building2 className="w-4 h-4" />
        System Triage Update
      </h4>
      <div className="space-y-2">
        {changedSystems.slice(0, 5).map((sys, i) => (
          <motion.div
            key={sys.system}
            initial={{ x: -10, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: 0.7 + i * 0.1 }}
            className="flex items-center justify-between text-sm"
          >
            <span className="font-medium text-[var(--color-text-primary)]">{sys.system}</span>
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1 text-[var(--color-text-muted)]">
                <StatusDot status={sys.previousStatus} />
                <span className="text-xs">→</span>
                <StatusDot status={sys.newStatus} />
              </span>
              <span className="text-[var(--color-text-muted)] tabular-nums">
                {sys.previousAccuracy.toFixed(0)}% → {sys.newAccuracy.toFixed(0)}%
              </span>
              <span
                className={cn(
                  'font-bold tabular-nums',
                  sys.accuracyDelta > 0
                    ? 'text-[var(--color-data-pass)]'
                    : 'text-[var(--color-data-fail)]'
                )}
              >
                ({sys.accuracyDelta > 0 ? '+' : ''}
                {sys.accuracyDelta.toFixed(0)}%)
              </span>
            </div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}

function TrajectoryUpdate({
  before,
  after,
  bufferDays,
}: {
  before: number;
  after: number;
  bufferDays: number;
}) {
  const improved = after > before;

  return (
    <motion.div
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ delay: 0.8 }}
      className="bg-gradient-to-r from-[var(--color-bg-secondary)] to-[var(--color-bg-tertiary)] rounded-xl p-4"
    >
      <h4 className="text-sm font-semibold text-[var(--color-text-secondary)] mb-2 flex items-center gap-2">
        <TrendingUp className="w-4 h-4" />
        Trajectory Update
      </h4>
      <div className="text-sm text-[var(--color-text-secondary)] space-y-1">
        <div>
          <span className="text-[var(--color-text-muted)]">Before:</span>{' '}
          <span className="text-[var(--color-data-fail)]">
            Score projected to drop to {before} in 7 days
          </span>
        </div>
        <div>
          <span className="text-[var(--color-text-muted)]">After:</span>{' '}
          <span
            className={
              improved ? 'text-[var(--color-data-pass)]' : 'text-[var(--color-data-provisional)]'
            }
          >
            Score projected to drop to {after} in 7 days
          </span>
        </div>
      </div>
      {bufferDays > 0 && (
        <div className="mt-3 text-sm font-medium text-[var(--color-data-pass)] flex items-center gap-2">
          <Check className="w-4 h-4 shrink-0" />
          You just bought yourself {bufferDays} extra day{bufferDays !== 1 ? 's' : ''} of buffer!
        </div>
      )}
    </motion.div>
  );
}

function StreakBadge({ streak, milestone }: { streak: number; milestone: string | null }) {
  if (streak < 2) return null;

  return (
    <motion.div
      initial={{ scale: 0, rotate: -10 }}
      animate={{ scale: 1, rotate: 0 }}
      transition={{ delay: 0.9, type: 'spring', stiffness: 200 }}
      className="text-center"
    >
      <div className="inline-flex items-center gap-2 bg-[var(--color-accent)]/10 text-[var(--color-accent)] px-4 py-2 rounded-full">
        <Flame className="w-5 h-5 shrink-0" />
        <span className="font-bold">{streak}-Day Study Streak!</span>
      </div>
      {milestone && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.1 }}
          className="text-sm text-[var(--color-text-muted)] mt-2"
        >
          {milestone}
        </motion.div>
      )}
    </motion.div>
  );
}

function AchievementBadge({ achievement }: { achievement: string }) {
  return (
    <motion.div
      initial={{ y: 20, opacity: 0, scale: 0.9 }}
      animate={{ y: 0, opacity: 1, scale: 1 }}
      transition={{ delay: 1.0, type: 'spring' }}
      className="text-center"
    >
      <div className="inline-flex items-center gap-2 bg-[var(--color-accent)]/10 text-[var(--color-accent)] px-4 py-2 rounded-full">
        <Trophy className="w-5 h-5 shrink-0" />
        <span className="font-bold">{achievement}</span>
      </div>
    </motion.div>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function SessionPostMortem({
  data,
  onContinue,
  onViewDashboard,
  className,
  calibrationSummary,
  isCalibrationReliable,
  calibrationProgress,
}: SessionPostMortemProps) {
  const headline = getHeadline(data);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className={cn(
        'max-w-lg mx-auto bg-[var(--color-bg-primary)] rounded-2xl shadow-xl overflow-hidden',
        className
      )}
    >
      {/* Header */}
      <div className="bg-gradient-to-r from-[var(--color-accent)] to-[var(--color-accent-hover)] p-6 text-[var(--color-text-inverse)] text-center">
        <motion.div
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="mb-2"
        >
          <PartyPopper className="w-10 h-10 mx-auto text-[var(--color-text-inverse)]" />
        </motion.div>
        <motion.h2
          initial={{ y: -10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="text-2xl font-bold"
        >
          {headline}
        </motion.h2>
      </div>

      {/* Content */}
      <div className="p-6 space-y-5">
        {/* Score Delta Hero */}
        <ScoreDeltaHero delta={data.scoreChange} accuracy={data.accuracy} />

        {/* Accuracy Bar */}
        <motion.div
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ delay: 0.5, duration: 0.5 }}
          className="bg-[var(--color-bg-secondary)] rounded-full h-3 overflow-hidden"
        >
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${data.accuracy}%` }}
            transition={{ delay: 0.7, duration: 0.8 }}
            className={cn(
              'h-full rounded-full',
              data.accuracy >= 80
                ? 'bg-[var(--color-data-pass)]'
                : data.accuracy >= 60
                  ? 'bg-[var(--color-data-provisional)]'
                  : 'bg-[var(--color-data-fail)]'
            )}
          />
        </motion.div>
        <div className="text-center text-sm text-[var(--color-text-muted)]">
          {data.correctCount}/{data.questionsAnswered} Correct
        </div>

        {/* Impact Cards */}
        <ImpactCards
          stabilized={data.memoriesStabilized}
          decayPrevented={data.decayPrevented}
          bufferDays={data.projectionImprovement}
        />

        {/* System Triage Changes */}
        <SystemTriageChanges impact={data.systemImpact} />

        {/* Trajectory Update */}
        <TrajectoryUpdate
          before={data.previousProjectedDay7}
          after={data.newProjectedDay7}
          bufferDays={data.projectionImprovement}
        />

        {/* Metacognitive Calibration */}
        <CalibrationPanel
          summary={calibrationSummary ?? null}
          isReliable={isCalibrationReliable ?? false}
          progress={calibrationProgress}
          compact
        />

        {/* Streak */}
        <StreakBadge streak={data.currentStreak} milestone={data.streakMilestone} />

        {/* Achievement */}
        {data.achievementUnlocked && <AchievementBadge achievement={data.achievementUnlocked} />}
      </div>

      {/* CTAs */}
      <div className="p-6 pt-0 flex gap-3">
        <motion.button
          initial={{ y: 10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 1.2 }}
          onClick={onContinue}
          className="flex-1 bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-[var(--color-text-inverse)] font-semibold py-3 px-6 rounded-xl transition-colors"
        >
          Continue Streak
        </motion.button>
        <motion.button
          initial={{ y: 10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 1.3 }}
          onClick={onViewDashboard}
          className="flex-1 bg-[var(--color-bg-secondary)] hover:bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)] font-semibold py-3 px-6 rounded-xl transition-colors"
        >
          View Dashboard
        </motion.button>
      </div>
    </motion.div>
  );
}

// =============================================================================
// HELPERS
// =============================================================================

function getHeadline(data: SessionPostMortemData): string {
  if (data.scoreChange >= 5) return 'MASSIVE GAIN!';
  if (data.scoreChange >= 2) return 'Strong Progress!';
  if (data.scoreChange > 0) return 'Moving Forward';
  if (data.decayPrevented > 5) return 'Knowledge Defended';
  if (data.accuracy >= 90) return 'Excellent Session!';
  if (data.accuracy >= 75) return 'Solid Work!';
  return 'SESSION COMPLETE';
}

export default SessionPostMortem;
