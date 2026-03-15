/**
 * Smart Study Dashboard
 *
 * A comprehensive, research-backed study optimization dashboard that integrates:
 * - Desirable Difficulties Engine (Bjork)
 * - Cognitive Load Theory (Sweller)
 * - Circadian Optimization (Schmidt, Walker)
 * - FSRS Spaced Repetition
 *
 * This is the "command center" for personalized, efficient learning.
 *
 * @module components/dashboard/SmartStudyDashboard
 */

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Brain,
  Clock,
  Calendar,
  Target,
  Zap,
  Moon,
  Sun,
  Coffee,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Lightbulb,
  BarChart3,
  Battery,
  BatteryLow,
  BatteryMedium,
  BatteryFull,
  Sparkles,
  BookOpen,
  GraduationCap,
  ChevronRight,
  Info,
  Play,
  Pause,
  RefreshCw,
} from 'lucide-react';

import {
  determineChronotype,
  assessSleepImpact,
  generateExamCountdownPlan,
  generateDailySchedule,
  generatePersonalizedTips,
  type ChronotypeProfile,
  type SleepImpactAssessment,
  type ExamCountdownPlan,
  type StudySchedule,
} from '../../lib/services/cognitiveScience/personalizedScheduler';

import {
  calculateOptimalDifficulty,
  createOptimizedStudyPlan,
  type LearnerProfile,
  type StudySessionPlan,
} from '../../lib/services/cognitiveScience/desirableDifficulties';

import {
  calculateTotalLoad,
  generateLoadBasedRecommendations,
  detectExpertiseReversal,
  type CognitiveLoadProfile,
} from '../../lib/services/cognitiveScience/cognitiveLoadOptimizer';

// Mock data for demonstration - in production, fetch from API
const mockLearnerProfile: LearnerProfile = {
  userId: 'demo',
  totalQuestionsAnswered: 350,
  averageAccuracy: 0.72,
  averageResponseTimeMs: 45000,
  retentionRate: 0.78,
  learningVelocity: 8,
  cognitiveLoadCapacity: 'medium',
  optimalStudyDurationMinutes: 90,
  preferredDifficultyLevel: 6,
};

interface SmartStudyDashboardProps {
  userId?: string;
  examDate?: Date;
  onStartSession?: (plan: StudySessionPlan) => void;
  className?: string;
}

// Sub-components
const CognitiveLoadGauge: React.FC<{ load: CognitiveLoadProfile }> = ({ load }) => {
  const getLoadColor = () => {
    if (load.isOverloaded) return 'from-red-500 to-red-600';
    if (load.totalLoad > 70) return 'from-amber-500 to-orange-500';
    return 'from-emerald-500 to-cyan-500';
  };

  const getBatteryIcon = () => {
    if (load.availableCapacity < 20) return <BatteryLow className="w-5 h-5 text-data-fail" />;
    if (load.availableCapacity < 50) return <BatteryMedium className="w-5 h-5 text-data-provisional" />;
    return <BatteryFull className="w-5 h-5 text-data-pass" />;
  };

  return (
    <div className="bg-[var(--color-bg-secondary)] rounded-2xl p-5 border border-[var(--color-border)]">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Brain className="w-5 h-5 text-[var(--color-accent)]" />
          <h3 className="font-semibold text-[var(--color-text-primary)]">Cognitive Load</h3>
        </div>
        {getBatteryIcon()}
      </div>

      {/* Load meter */}
      <div className="relative h-4 bg-[var(--color-bg-tertiary)] rounded-full overflow-hidden mb-4">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${Math.min(100, load.totalLoad)}%` }}
          transition={{ duration: 1, ease: 'easeOut' }}
          className={`h-full bg-gradient-to-r ${getLoadColor()} rounded-full`}
        />
        {/* Optimal zone indicator */}
        <div className="absolute top-0 bottom-0 left-[60%] right-[30%] bg-[var(--color-data-pass)]/20" />
      </div>

      {/* Load breakdown */}
      <div className="grid grid-cols-3 gap-2 text-center text-xs">
        <div className="p-2 bg-[var(--color-category-practice)]/20 rounded-lg">
          <div className="text-[var(--color-category-practice)] font-medium">Intrinsic</div>
          <div className="text-lg font-bold text-[var(--color-text-primary)]">
            {Math.round(load.intrinsicLoad)}%
          </div>
        </div>
        <div className="p-2 bg-[var(--color-data-fail)]/20 rounded-lg">
          <div className="text-[var(--color-data-fail)] font-medium">Extraneous</div>
          <div className="text-lg font-bold text-[var(--color-text-primary)]">
            {Math.round(load.extraneousLoad)}%
          </div>
        </div>
        <div className="p-2 bg-[var(--color-data-pass)]/20 rounded-lg">
          <div className="text-[var(--color-data-pass)] font-medium">Germane</div>
          <div className="text-lg font-bold text-[var(--color-text-primary)]">
            {Math.round(load.germaneLoad)}%
          </div>
        </div>
      </div>

      {/* Status message */}
      <div
        className={`mt-4 p-3 rounded-lg text-sm ${
          load.isOverloaded
            ? 'bg-[var(--color-data-fail)]/20 text-[var(--color-data-fail)]'
            : load.optimalBreakTime
              ? 'bg-[var(--color-data-provisional)]/20 text-[var(--color-data-provisional)]'
              : 'bg-[var(--color-data-pass)]/20 text-[var(--color-data-pass)]'
        }`}
      >
        {load.isOverloaded
          ? 'Take a break! Cognitive overload detected.'
          : load.optimalBreakTime
            ? 'Perfect time for a 5-10 minute break!'
            : 'Optimal learning state - keep going!'}
      </div>
    </div>
  );
};

const ChronotypeCard: React.FC<{ chronotype: ChronotypeProfile }> = ({ chronotype }) => {
  const getIcon = () => {
    if (chronotype.type.includes('morning')) return <Sun className="w-6 h-6 text-data-provisional" />;
    if (chronotype.type.includes('evening')) return <Moon className="w-6 h-6 text-indigo-500" />;
    return <Coffee className="w-6 h-6 text-brown-500" />;
  };

  const getTypeLabel = () => {
    const labels: Record<ChronotypeProfile['type'], string> = {
      'strong-morning': 'Early Bird',
      'moderate-morning': 'Morning Person',
      intermediate: 'Flexible Schedule',
      'moderate-evening': 'Night Owl',
      'strong-evening': 'True Night Owl',
    };
    return labels[chronotype.type];
  };

  return (
    <div className="bg-[var(--color-bg-accent-subtle)] rounded-2xl p-5 border border-[var(--color-accent)]/30">
      <div className="flex items-center gap-3 mb-4">
        {getIcon()}
        <div>
          <h3 className="font-semibold text-[var(--color-text-primary)]">Your Chronotype</h3>
          <p className="text-sm text-[var(--color-text-muted)]">{getTypeLabel()}</p>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between text-sm">
          <span className="text-[var(--color-text-muted)]">Peak Cognitive Hour</span>
          <span className="font-medium text-[var(--color-text-primary)]">
            {chronotype.peakCognitiveHour}:00 {chronotype.peakCognitiveHour < 12 ? 'AM' : 'PM'}
          </span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-[var(--color-text-muted)]">Optimal Sleep</span>
          <span className="font-medium text-[var(--color-text-primary)]">
            {chronotype.sleepSchedule.bedtime}:00 - {chronotype.sleepSchedule.wakeTime}:00
          </span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-[var(--color-text-muted)]">Best Study Window</span>
          <span className="font-medium text-[var(--color-text-primary)]">
            {chronotype.optimalStudyWindows[0]?.start}:00 - {chronotype.optimalStudyWindows[0]?.end}
            :00
          </span>
        </div>
      </div>
    </div>
  );
};

const SleepImpactCard: React.FC<{ assessment: SleepImpactAssessment }> = ({ assessment }) => {
  const impactPercent = Math.round(assessment.cognitiveImpact * 100);

  return (
    <div className="bg-[var(--color-bg-secondary)] rounded-2xl p-5 border border-[var(--color-border)]">
      <div className="flex items-center gap-2 mb-4">
        <Moon className="w-5 h-5 text-[var(--color-accent)]" />
        <h3 className="font-semibold text-[var(--color-text-primary)]">Sleep Impact</h3>
      </div>

      <div className="flex items-center gap-4 mb-4">
        <div className="text-4xl font-bold text-[var(--color-text-primary)]">
          {assessment.hoursSlept}h
        </div>
        <div className="flex-1">
          <div className="text-sm text-[var(--color-text-muted)]">Sleep Quality</div>
          <div className="font-medium capitalize text-[var(--color-text-primary)]">
            {assessment.sleepQuality}
          </div>
        </div>
        <div
          className={`text-2xl font-bold ${
            impactPercent >= 90
              ? 'text-[var(--color-data-pass)]'
              : impactPercent >= 70
                ? 'text-[var(--color-data-provisional)]'
                : 'text-[var(--color-data-fail)]'
          }`}
        >
          {impactPercent}%
        </div>
      </div>

      <div className="text-sm text-[var(--color-text-muted)] mb-3">
        Today's Study Capacity:{' '}
        <span className="font-medium text-[var(--color-text-primary)]">{assessment.adjustedStudyCapacity} min</span>
      </div>

      {assessment.recommendations.length > 0 && (
        <div className="text-xs text-[var(--color-text-primary)] bg-[var(--color-bg-tertiary)] p-3 rounded-lg">
          {assessment.recommendations[0]}
        </div>
      )}
    </div>
  );
};

const ExamCountdownCard: React.FC<{ plan: ExamCountdownPlan }> = ({ plan }) => {
  const getPhaseColor = () => {
    switch (plan.phase) {
      case 'initial-learning':
        return 'from-blue-500 to-cyan-500';
      case 'deepening':
        return 'from-purple-500 to-pink-500';
      case 'consolidation':
        return 'from-amber-500 to-orange-500';
      case 'review':
        return 'from-emerald-500 to-teal-500';
      case 'tapering':
        return 'from-green-500 to-lime-500';
    }
  };

  const getPhaseLabel = () => {
    const labels: Record<ExamCountdownPlan['phase'], string> = {
      'initial-learning': 'Initial Learning',
      deepening: 'Deepening',
      consolidation: 'Consolidation',
      review: 'Review',
      tapering: 'Tapering',
    };
    return labels[plan.phase];
  };

  return (
    <div className="bg-[var(--color-bg-accent-subtle)] rounded-2xl p-5 border border-[var(--color-accent)]/30">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-[var(--color-text-primary)]" />
          <h3 className="font-semibold text-[var(--color-text-primary)]">Exam Countdown</h3>
        </div>
        <div className="text-3xl font-bold text-[var(--color-text-primary)]">{plan.daysRemaining}</div>
      </div>

      <div className="text-sm text-[var(--color-text-muted)] mb-3">days remaining</div>

      <div className="bg-[var(--color-bg-tertiary)] rounded-lg p-3 mb-3">
        <div className="text-xs text-[var(--color-text-muted)] mb-1">Current Phase</div>
        <div className="font-medium text-[var(--color-text-primary)]">{getPhaseLabel()}</div>
      </div>

      <div className="flex items-center justify-between text-sm">
        <span className="text-[var(--color-text-muted)]">Daily Target</span>
        <span className="font-medium text-[var(--color-text-primary)]">{plan.dailyTargetMinutes} min</span>
      </div>
    </div>
  );
};

const DifficultyOptimizer: React.FC<{
  difficulty: ReturnType<typeof calculateOptimalDifficulty>;
}> = ({ difficulty }) => {
  const getZonePosition = () => {
    return Math.min(100, Math.max(0, difficulty.currentDifficulty * 10));
  };

  return (
    <div className="bg-[var(--color-bg-secondary)] rounded-2xl p-5 border border-[var(--color-border)]">
      <div className="flex items-center gap-2 mb-4">
        <Target className="w-5 h-5 text-[var(--color-accent)]" />
        <h3 className="font-semibold text-[var(--color-text-primary)]">Optimal Difficulty</h3>
      </div>

      {/* Goldilocks zone visualization */}
      <div className="relative h-8 bg-gradient-to-r from-[var(--color-data-success)] via-[var(--color-data-provisional)] to-[var(--color-data-fail)] rounded-full mb-4 overflow-hidden">
        {/* Optimal zone highlight */}
        <div className="absolute inset-y-0 left-[30%] right-[30%] bg-[var(--color-data-pass)]/50 border-x-2 border-[var(--color-data-pass)]" />
        {/* Current position marker */}
        <motion.div
          initial={{ left: '50%' }}
          animate={{ left: `${getZonePosition()}%` }}
          transition={{ duration: 0.5 }}
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-4 h-4 bg-[var(--color-bg-primary)] rounded-full shadow-lg border-2 border-[var(--color-text-primary)]"
        />
      </div>

      <div className="flex justify-between text-xs text-[var(--color-text-muted)] mb-4">
        <span>Too Easy</span>
        <span className="text-[var(--color-data-pass)] font-medium">Optimal (85%)</span>
        <span>Too Hard</span>
      </div>

      <div
        className={`p-3 rounded-lg text-sm ${
          difficulty.recommendedAdjustment === 'increase'
            ? 'bg-[var(--color-data-provisional)]/20 text-[var(--color-data-provisional)]'
            : difficulty.recommendedAdjustment === 'decrease'
              ? 'bg-[var(--color-category-practice)]/20 text-[var(--color-category-practice)]'
              : 'bg-[var(--color-data-pass)]/20 text-[var(--color-data-pass)]'
        }`}
      >
        {difficulty.explanation}
      </div>
    </div>
  );
};

const TipsCarousel: React.FC<{ tips: string[] }> = ({ tips }) => {
  const [currentTip, setCurrentTip] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTip((prev) => (prev + 1) % tips.length);
    }, 8000);
    return () => clearInterval(interval);
  }, [tips.length]);

  return (
    <div className="bg-[var(--color-bg-accent-subtle)] rounded-2xl p-5 border border-[var(--color-accent)]/30">
      <div className="flex items-center gap-2 mb-4">
        <Lightbulb className="w-5 h-5 text-[var(--color-accent)]" />
        <h3 className="font-semibold text-[var(--color-text-primary)]">Science-Backed Tips</h3>
      </div>

      <AnimatePresence mode="wait">
        <motion.p
          key={currentTip}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className="text-sm text-[var(--color-text-primary)] leading-relaxed min-h-[60px]"
        >
          {tips[currentTip]}
        </motion.p>
      </AnimatePresence>

      <div className="flex gap-1 mt-4">
        {tips.map((_, i) => (
          <button
            key={i}
            onClick={() => setCurrentTip(i)}
            className={`h-1.5 rounded-full transition-all ${
              i === currentTip ? 'w-6 bg-[var(--color-accent)]' : 'w-1.5 bg-[var(--color-bg-tertiary)]'
            }`}
          />
        ))}
      </div>
    </div>
  );
};

const StartSessionButton: React.FC<{
  plan: StudySessionPlan;
  onClick: () => void;
}> = ({ plan, onClick }) => {
  return (
    <motion.button
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className="w-full bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-[var(--color-text-inverse)] rounded-2xl p-5 shadow-lg shadow-[var(--color-accent)]/25"
    >
      <div className="flex items-center justify-between">
        <div className="text-left">
          <div className="font-semibold text-lg mb-1">Start Optimized Session</div>
          <div className="text-sm opacity-80">
            {plan.totalDurationMinutes} min • {plan.blocks.length} blocks •{' '}
            {Math.round(plan.estimatedRetentionGain * 100)}% retention boost
          </div>
        </div>
        <Play className="w-8 h-8" />
      </div>
    </motion.button>
  );
};

// Main Component
export const SmartStudyDashboard: React.FC<SmartStudyDashboardProps> = ({
  userId,
  examDate,
  onStartSession,
  className = '',
}) => {
  // State
  const [sleepHours, setSleepHours] = useState(7);
  const [sleepQuality, setSleepQuality] = useState<'poor' | 'fair' | 'good' | 'excellent'>('good');
  const [sessionMinutes, setSessionMinutes] = useState(0);
  const [lastBreakMinutes, setLastBreakMinutes] = useState(0);

  // Computed values
  const chronotype = useMemo(() => {
    return determineChronotype(7, 23, 'morning', false);
  }, []);

  const sleepAssessment = useMemo(() => {
    return assessSleepImpact(sleepHours, sleepQuality, 1);
  }, [sleepHours, sleepQuality]);

  const examPlan = useMemo(() => {
    if (!examDate) return null;
    return generateExamCountdownPlan(examDate, 15, 0.7, 120);
  }, [examDate]);

  const cognitiveLoad = useMemo(() => {
    return calculateTotalLoad(
      35, // intrinsic
      15, // extraneous
      40, // germane
      sessionMinutes,
      lastBreakMinutes
    );
  }, [sessionMinutes, lastBreakMinutes]);

  const difficulty = useMemo(() => {
    return calculateOptimalDifficulty(mockLearnerProfile, [
      { accuracy: 0.75, responseTimeMs: 40000 },
      { accuracy: 0.8, responseTimeMs: 35000 },
      { accuracy: 0.72, responseTimeMs: 42000 },
    ]);
  }, []);

  const studyPlan = useMemo(() => {
    return createOptimizedStudyPlan(
      ['Cardiovascular', 'Pulmonary', 'GI', 'Renal', 'Neuro'],
      60,
      mockLearnerProfile
    );
  }, []);

  const tips = useMemo(() => {
    return generatePersonalizedTips(chronotype, sleepAssessment, examPlan || undefined);
  }, [chronotype, sleepAssessment, examPlan]);

  const handleStartSession = () => {
    onStartSession?.(studyPlan);
  };

  return (
    <div className={`p-6 bg-[var(--color-bg-primary)] min-h-screen ${className}`}>
      {/* Header */}
      <div className="mb-8">
        <motion.h1
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-3xl font-bold text-[var(--color-text-primary)] mb-2"
        >
          Smart Study Dashboard
        </motion.h1>
        <p className="text-[var(--color-text-muted)]">
          AI-powered study optimization based on cognitive science research
        </p>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        {/* Cognitive Load */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
        >
          <CognitiveLoadGauge load={cognitiveLoad} />
        </motion.div>

        {/* Chronotype */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
        >
          <ChronotypeCard chronotype={chronotype} />
        </motion.div>

        {/* Sleep Impact */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3 }}
        >
          <SleepImpactCard assessment={sleepAssessment} />
        </motion.div>

        {/* Exam Countdown (if exam date set) */}
        {examPlan && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.4 }}
          >
            <ExamCountdownCard plan={examPlan} />
          </motion.div>
        )}

        {/* Difficulty Optimizer */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.5 }}
        >
          <DifficultyOptimizer difficulty={difficulty} />
        </motion.div>

        {/* Tips */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.6 }}
        >
          <TipsCarousel tips={tips} />
        </motion.div>
      </div>

      {/* Research Citations */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.7 }}
        className="mb-8 p-4 bg-[var(--color-bg-secondary)] rounded-xl border border-[var(--color-border)]"
      >
        <div className="flex items-center gap-2 mb-3">
          <BookOpen className="w-4 h-4 text-[var(--color-text-primary)]" />
          <span className="text-sm font-medium text-[var(--color-text-primary)]">
            Powered by Research
          </span>
        </div>
        <div className="flex flex-wrap gap-2 text-xs text-[var(--color-text-muted)]">
          <span className="px-2 py-1 bg-[var(--color-bg-tertiary)] rounded">
            Bjork (2011) - Desirable Difficulties
          </span>
          <span className="px-2 py-1 bg-[var(--color-bg-tertiary)] rounded">
            Sweller (1988) - Cognitive Load Theory
          </span>
          <span className="px-2 py-1 bg-[var(--color-bg-tertiary)] rounded">
            Walker (2008) - Sleep & Memory
          </span>
          <span className="px-2 py-1 bg-[var(--color-bg-tertiary)] rounded">
            Roediger & Karpicke (2006) - Testing Effect
          </span>
        </div>
      </motion.div>

      {/* Start Session Button */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.8 }}
      >
        <StartSessionButton plan={studyPlan} onClick={handleStartSession} />
      </motion.div>
    </div>
  );
};

export default SmartStudyDashboard;
