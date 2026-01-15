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
 */

import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../../lib/utils';
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
}

// =============================================================================
// CONSTANTS
// =============================================================================

const STATUS_EMOJI: Record<string, string> = {
  critical: '🔴',
  at_risk: '🟡',
  stable: '🟢',
  mastered: '🔵',
};

const STATUS_COLORS: Record<string, string> = {
  critical: 'text-red-500',
  at_risk: 'text-amber-500',
  stable: 'text-green-500',
  mastered: 'text-sky-500',
};

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
      transition={{ duration: 0.5, type: "spring" }}
      className="text-center py-6"
    >
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2 }}
        className={cn(
          'text-5xl font-black',
          isPositive ? 'text-green-500' : isNeutral ? 'text-slate-400' : 'text-amber-500'
        )}
      >
        {isPositive ? '+' : ''}{delta.toFixed(1)} POINTS
      </motion.div>
      <motion.div
        initial={{ y: 10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="text-slate-500 dark:text-slate-400 text-sm mt-2"
      >
        Your PANCE Score {isPositive ? 'Increased' : isNeutral ? 'Held Steady' : 'Adjusted'}
      </motion.div>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
        className="text-lg text-slate-600 dark:text-slate-300 mt-1"
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
        className="bg-blue-50 dark:bg-blue-900/30 rounded-xl p-4 text-center"
      >
        <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">
          {stabilized}
        </div>
        <div className="text-xs text-blue-700 dark:text-blue-300 mt-1">
          Cards Stabilized
        </div>
        <div className="text-lg mt-1">⬆️</div>
      </motion.div>
      
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="bg-purple-50 dark:bg-purple-900/30 rounded-xl p-4 text-center"
      >
        <div className="text-3xl font-bold text-purple-600 dark:text-purple-400">
          -{decayPrevented.toFixed(1)}%
        </div>
        <div className="text-xs text-purple-700 dark:text-purple-300 mt-1">
          Decay Prevented
        </div>
        <div className="text-lg mt-1">🛡️</div>
      </motion.div>
      
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="bg-emerald-50 dark:bg-emerald-900/30 rounded-xl p-4 text-center"
      >
        <div className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">
          +{bufferDays}
        </div>
        <div className="text-xs text-emerald-700 dark:text-emerald-300 mt-1">
          Days Buffer
        </div>
        <div className="text-lg mt-1">📅</div>
      </motion.div>
    </div>
  );
}

function SystemTriageChanges({ impact }: { impact: SystemImpactData[] }) {
  // Only show systems that actually changed
  const changedSystems = impact.filter(
    s => s.questionsAnswered > 0 && s.accuracyDelta !== 0
  );
  
  if (changedSystems.length === 0) return null;
  
  return (
    <motion.div
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ delay: 0.6 }}
      className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4"
    >
      <h4 className="text-sm font-semibold text-slate-600 dark:text-slate-300 mb-3 flex items-center gap-2">
        🏥 System Triage Update
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
            <span className="font-medium text-slate-700 dark:text-slate-200">
              {sys.system}
            </span>
            <div className="flex items-center gap-2">
              <span className="text-slate-400">
                {STATUS_EMOJI[sys.previousStatus]}→{STATUS_EMOJI[sys.newStatus]}
              </span>
              <span className="text-slate-500 tabular-nums">
                {sys.previousAccuracy.toFixed(0)}% → {sys.newAccuracy.toFixed(0)}%
              </span>
              <span className={cn(
                'font-bold tabular-nums',
                sys.accuracyDelta > 0 ? 'text-green-500' : 'text-red-500'
              )}>
                ({sys.accuracyDelta > 0 ? '+' : ''}{sys.accuracyDelta.toFixed(0)}%)
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
      className="bg-gradient-to-r from-slate-50 to-blue-50 dark:from-slate-800/50 dark:to-blue-900/30 rounded-xl p-4"
    >
      <h4 className="text-sm font-semibold text-slate-600 dark:text-slate-300 mb-2 flex items-center gap-2">
        📈 Trajectory Update
      </h4>
      <div className="text-sm text-slate-600 dark:text-slate-400 space-y-1">
        <div>
          <span className="text-slate-500">Before:</span>{' '}
          <span className="text-red-500">Score projected to drop to {before} in 7 days</span>
        </div>
        <div>
          <span className="text-slate-500">After:</span>{' '}
          <span className={improved ? 'text-green-500' : 'text-amber-500'}>
            Score projected to drop to {after} in 7 days
          </span>
        </div>
      </div>
      {bufferDays > 0 && (
        <div className="mt-3 text-sm font-medium text-emerald-600 dark:text-emerald-400">
          ✅ You just bought yourself {bufferDays} extra day{bufferDays !== 1 ? 's' : ''} of buffer!
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
      transition={{ delay: 0.9, type: "spring", stiffness: 200 }}
      className="text-center"
    >
      <div className="inline-flex items-center gap-2 bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 px-4 py-2 rounded-full">
        <span className="text-xl">🔥</span>
        <span className="font-bold">{streak}-Day Study Streak!</span>
      </div>
      {milestone && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.1 }}
          className="text-sm text-slate-500 mt-2"
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
      transition={{ delay: 1.0, type: "spring" }}
      className="text-center"
    >
      <div className="inline-flex items-center gap-2 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 px-4 py-2 rounded-full">
        <span className="text-xl">🏆</span>
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
}: SessionPostMortemProps) {
  const headline = getHeadline(data);
  
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className={cn(
        'max-w-lg mx-auto bg-white dark:bg-slate-900 rounded-2xl shadow-xl overflow-hidden',
        className
      )}
    >
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-500 to-purple-600 p-6 text-white text-center">
        <motion.div
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="text-3xl mb-2"
        >
          🎉
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
          className="bg-slate-100 dark:bg-slate-800 rounded-full h-3 overflow-hidden"
        >
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${data.accuracy}%` }}
            transition={{ delay: 0.7, duration: 0.8 }}
            className={cn(
              'h-full rounded-full',
              data.accuracy >= 80 ? 'bg-green-500' :
              data.accuracy >= 60 ? 'bg-amber-500' : 'bg-red-500'
            )}
          />
        </motion.div>
        <div className="text-center text-sm text-slate-500">
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
        
        {/* Streak */}
        <StreakBadge streak={data.currentStreak} milestone={data.streakMilestone} />
        
        {/* Achievement */}
        {data.achievementUnlocked && (
          <AchievementBadge achievement={data.achievementUnlocked} />
        )}
      </div>
      
      {/* CTAs */}
      <div className="p-6 pt-0 flex gap-3">
        <motion.button
          initial={{ y: 10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 1.2 }}
          onClick={onContinue}
          className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-xl transition-colors"
        >
          Continue Streak
        </motion.button>
        <motion.button
          initial={{ y: 10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 1.3 }}
          onClick={onViewDashboard}
          className="flex-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold py-3 px-6 rounded-xl transition-colors"
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
  if (data.scoreChange >= 5) return "🚀 MASSIVE GAIN!";
  if (data.scoreChange >= 2) return "💪 Strong Progress!";
  if (data.scoreChange > 0) return "📈 Moving Forward";
  if (data.decayPrevented > 5) return "🛡️ Knowledge Defended";
  if (data.accuracy >= 90) return "⭐ Excellent Session!";
  if (data.accuracy >= 75) return "✅ Solid Work!";
  return "SESSION COMPLETE";
}

export default SessionPostMortem;
