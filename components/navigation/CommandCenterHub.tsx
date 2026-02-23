'use client';

import React, { useState, useMemo, useCallback, useEffect, useRef, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { GlassCard } from '@/components/ui/GlassCard';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { RecommendationFeed } from '@/components/dashboard/RecommendationFeed';
import { useUser } from '@clerk/clerk-react';
import {
  Zap,
  Target,
  Brain,
  Stethoscope,
  BarChart3,
  Calculator,
  BookOpen,
  Pill,
  Activity,
  Clock,
  Trophy,
  TrendingUp,
  ChevronRight,
  Play,
  Flame,
  AlertCircle,
  CheckCircle,
  Timer,
  GraduationCap,
  Beaker,
  Layers,
  LucideIcon,
  User,
  FileImage,
  Shield,
  Droplets,
  GitCompare,
  FileCheck,
  Siren,
  Hash,
  Heart,
  Wind,
  Eye,
  MessageSquare,
  Image,
  Scan,
  FlaskConical,
  Headphones,
  FolderTree,
  Sparkles,
  MoreHorizontal,
  RotateCcw,
} from 'lucide-react';
import type { PerformanceRecord, Question, SessionSettings, SystemCode } from '@/types';
import type { ClinicalRotation } from '@/types';
import { loadUserProfile, updateUserProfile } from '@/services/analytics';
import { getSystemsForRotation, isEorRotation } from '@/config/rotation-systems';
import { RotationSelector } from '@/components/onboarding/RotationSelector';
import {
  AnalyticsDashboard,
  DatabaseAnalyticsDashboard,
  LearningProfileDashboard,
  AdvancedLearningProfileDashboard,
  UserFriendlyStatsDisplay,
} from '@/config/lazyComponents';
import {
  VISUAL_DIAGNOSTICS_MODES,
  CLINICAL_SIMULATION_MODES,
  QUESTION_PRACTICE_MODES,
  SPECIALTY_DRILL_MODES,
  CATEGORY_INFO,
  STUDY_OUTCOME_GROUPS,
  getModeById,
  type TrainingModeConfig,
  type TrainingCategory,
} from '@/config/training-modes';
import { TO_REVIEW_LABEL } from '@/config/labels';
import { useUserContext } from '@/hooks/useUserContext';
import { useRolling360Stats } from '@/hooks/useRolling360Stats';
import { useUnifiedStats } from '@/hooks/useUnifiedStats';
import UnifiedDashboard from '@/components/dashboard/UnifiedDashboard';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { calculateDayStreak } from '@/lib/dashboardUtils';
import { QuickStatsBarSkeleton, SkeletonLoader } from '@/components/loading';
import { ABBREVIATION_TO_TOPIC_MAP } from '@/src/constants';
import { CurriculumGrid } from '@/components/dashboard/CurriculumGrid';
import { BodyMapWidget } from '@/components/dashboard/BodyMapWidget';
import { RoundsButton } from '@/components/dashboard/RoundsButton';
import { HighContrastDataToggle } from '@/components/ui/HighContrastDataToggle';
import {
  SmartSchedulerGantt,
  type ScheduleBlock,
} from '@/components/analytics/SmartSchedulerGantt';
import { getLastSession, clearLastSession, type LastSessionData } from '@/lib/utils/sessionStorage';
import { WelcomeBackCard } from '@/components/dashboard/WelcomeBackCard';
import { ExamCountdownCard } from '@/components/dashboard/ExamCountdownCard';
import { EorCountdownCard } from '@/components/dashboard/EorCountdownCard';
import { CircadianInsightCard } from '@/components/dashboard/CircadianInsightCard';
import { TimeBoxButtons } from '@/components/dashboard/TimeBoxButtons';
import { ProgressRingWidget } from '@/components/dashboard/ProgressRingWidget';
import { RecommendedActionCard } from '@/components/dashboard/RecommendedActionCard';
import { usePullToRefresh } from '@/hooks/useSwipeGestures';

// ============================================================================
// Types
// ============================================================================

interface CommandCenterHubProps {
  performanceData: PerformanceRecord[];
  missedQuestions: Question[];
  flaggedQuestions: Question[];
  growthAreas: string[];
  dueCount?: number;
  examLabel?: string;
  /** When true, show skeleton instead of QuickStatsBar (prevents 0% during load) */
  isLoadingStats?: boolean;
  onStartSession: (settings?: SessionSettings) => void;
  onNavigateToDrillMode: (modeId: string) => void;
  /** Navigate to system drill with a specific system pre-selected (Residency Cockpit) */
  onNavigateToDrillWithSystem?: (modeId: string, system: string) => void;
  onNavigateToToolkit: () => void;
  onNavigateToGapAnalysis: () => void;
  onNavigateToClinicalProfile?: () => void;
  onNavigateToIntegrations?: () => void;
  onNavigateToSimulation?: (settings?: {
    initialFocus?: 'all' | 'growth' | 'flagged' | 'due';
  }) => void;
  onNavigateToReference?: () => void;
  /** My Library: upload PDFs, set active cache for Tutor */
  onNavigateToMyLibrary?: () => void;
  /** Study Companion: PDF + citations + chat with textbook */
  onNavigateToStudyCompanion?: () => void;
  /** SRS Flashcards: variant-aware cards + generative mnemonics (Hard → exaggerated image) */
  onNavigateToSrsFlashcards?: () => void;
  onNavigateToCustomStudy?: () => void;
  /** Opens Pearl Deck (Rapid Review - saved pearls only) */
  onNavigateToPearlDeck?: () => void;
  /** Clinical Eye: image analysis with code execution */
  onNavigateToClinicalEye?: () => void;
  /** Anatomy Visualizer: Firefly + Gemini segmentation */
  onNavigateToVisualizer?: () => void;
  /** Opens the Settings modal (for Current Curriculum "Change" button) */
  onOpenSettings?: () => void;
  /** Profile-aware Reasoning Tutor chat */
  onNavigateToTutorChat?: () => void;
  /** When true, show Continue Learning card above the fold (Zeigarnik) */
  hasActiveSession?: boolean;
  /** Optional: current question index and total for "Resume Question N – M remaining" */
  resumeContext?: { current: number; total: number; remaining: number };
  /** Callback to return to in-progress session (e.g. setView('quiz')) */
  onResumeSession?: () => void;
  /** Initial Study Tools tab when opened via NavRail Reference/Progress (URL ?tab=resources|analytics) */
  initialStudyToolsTab?: 'training' | 'resources' | 'analytics';
}

// Icon mapping
const ICON_MAP: Record<string, LucideIcon> = {
  Brain,
  Zap,
  Target,
  Stethoscope,
  BookOpen,
  Pill,
  Activity,
  Clock,
  Trophy,
  Flame,
  AlertCircle,
  CheckCircle,
  Timer,
  GraduationCap,
  Beaker,
  FileImage,
  Shield,
  Layers,
  Droplets,
  GitCompare,
  FileCheck,
  Siren,
  Hash,
  Heart,
  Wind,
  Eye,
  MessageSquare,
  Image,
  Scan,
  FlaskConical,
  Headphones,
  FolderTree,
  Calculator,
  BarChart3,
  TrendingUp,
  Sparkles,
};

// ============================================================================
// Subcomponents
// ============================================================================

// Grand Rounds Banner (Standalone Daily Challenge)
// Didactic: "Targeted Daily Question" from enabled systems only; Clinical/Pro: Global Grand Rounds
const GrandRoundsBanner: React.FC<{
  onStart: () => void;
  /** When true, show "Targeted Daily Question" and pass targeted flag so mode fetches by enabled systems */
  isDidactic?: boolean;
}> = ({ onStart, isDidactic }) => {
  const today = new Date();
  const dateStr = today.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });

  const title = isDidactic ? 'Targeted Daily Question' : 'Grand Rounds';
  const subtitle = isDidactic
    ? 'One question from your current curriculum.'
    : 'Same questions for everyone — daily standardized assessment.';

  const handleStart = () => {
    if (isDidactic) {
      try {
        sessionStorage.setItem('panceai_grand_rounds_targeted', '1');
      } catch {
        /* ignore */
      }
    }
    onStart();
  };

  return (
    <GlassCard variant="warning" hoverable className="mb-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-start gap-4 flex-1">
          <div className="p-3 rounded-xl bg-muted-amber/20 backdrop-blur-sm">
            <Trophy className="w-6 h-6 text-muted-amber" />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-xl font-bold text-[var(--color-text-primary)]">{title}</h3>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-muted-amber/10 text-muted-amber border border-muted-amber/20">
                Daily Challenge • {dateStr}
              </span>
            </div>
            <p className="text-sm text-[var(--color-text-muted)]">{subtitle}</p>
          </div>
        </div>

        <PrimaryButton variant="warning" size="md" icon={Play} onClick={handleStart}>
          Start
        </PrimaryButton>
      </div>
    </GlassCard>
  );
};

// Core Adaptive Hero (Main Event)
const CoreAdaptiveHero: React.FC<{
  onStart: () => void;
  accuracy: number | null;
  questionsToday: number;
  examLabel: string;
  /** When true, show "Knowledge Maintenance" / "PANRE-LA Check-in" instead of Core PANCE */
  isPracticing?: boolean;
  /** Sub-label for Start Session (e.g. "Testing: CV, PULM, GI Only") - shown for Didactic users */
  enabledSystemsLabel?: string | null;
  /** Optional label for accuracy (e.g. "Module Accuracy") */
  accuracyLabel?: string;
  /** Weak areas from analytics; when present, show "Focusing on your weak areas: X, Y" */
  growthAreas?: string[];
}> = ({
  onStart,
  accuracy,
  questionsToday,
  examLabel,
  isPracticing,
  enabledSystemsLabel,
  accuracyLabel,
  growthAreas = [],
}) => {
  const mainTitle = isPracticing ? 'Knowledge Maintenance' : 'Core PANCE Simulation';
  const badgeLabel = isPracticing ? 'PANRE-LA Check-in' : `${examLabel} Prep`;
  // Core PANCE Simulation: no weak-area copy — strict NCCIPA blueprint only
  const subtitle = isPracticing
    ? growthAreas.length > 0
      ? `Focusing on your weak areas: ${growthAreas.slice(0, 3).join(', ')}.`
      : 'Maintain your certification knowledge with adaptive questions.'
    : 'Strict NCCPA blueprint weighting. Exam-representative mix — no adaptive bias.';
  return (
    <GlassCard variant="primary" hoverable className="mb-6">
      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6">
        <div className="flex-1 flex flex-col justify-between">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-xl bg-action-blue/20 backdrop-blur-sm">
              <Brain className="w-7 h-7 text-action-blue" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="text-xl font-bold text-[var(--color-text-primary)]">{mainTitle}</h3>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-action-blue/10 text-action-blue border border-action-blue/20">
                  {badgeLabel}
                </span>
              </div>
              <p className="text-base text-[var(--color-text-secondary)]">{subtitle}</p>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-4 text-[var(--color-text-muted)]">
            <span className="inline-flex items-center gap-1.5 text-sm">
              <Target className="w-4 h-4 text-sage-500" aria-hidden />
              {accuracy !== null ? `${accuracy}%` : 'Waiting for first session'}{' '}
              {accuracyLabel ?? 'accuracy'}
            </span>
            <span className="inline-flex items-center gap-1.5 text-sm">
              <CheckCircle className="w-4 h-4 text-action-blue" aria-hidden />
              {questionsToday} today
            </span>
          </div>
        </div>

        <div className="flex flex-col items-end gap-1">
          <PrimaryButton
            variant="secondary"
            size="lg"
            icon={Play}
            iconRight={ChevronRight}
            onClick={onStart}
          >
            Start Session
          </PrimaryButton>
          {enabledSystemsLabel && (
            <span className="text-xs text-[var(--color-text-muted)]">{enabledSystemsLabel}</span>
          )}
        </div>
      </div>
    </GlassCard>
  );
};

// OSCE Section (Standalone Feature)
const OSCESection: React.FC<{ onStart: () => void }> = ({ onStart }) => {
  return (
    <GlassCard variant="info" hoverable className="mb-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-start gap-4 flex-1">
          <div className="p-3 rounded-xl bg-steel-blue-400/20 backdrop-blur-sm">
            <MessageSquare className="w-6 h-6 text-steel-blue-500" />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-xl font-bold text-[var(--color-text-primary)]">Live OSCE</h3>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold text-steel-blue-400">
                Voice patient
              </span>
            </div>
            <p className="text-base text-slate-600 dark:text-[var(--color-text-secondary)] mb-3">
              Practice with a live voice simulated patient; rubric-based SOAP note grading and
              real-time feedback.
            </p>
            <div className="flex items-center gap-4">
              <span className="inline-flex items-center gap-1.5 text-xs text-[var(--color-text-muted)]">
                <Timer className="w-3.5 h-3.5" />
                <span className="font-medium">~20 minutes</span>
              </span>
              <span className="inline-flex items-center gap-1.5 text-xs text-[var(--color-text-muted)]">
                <Stethoscope className="w-3.5 h-3.5" />
                <span className="font-medium">Clinical Skills</span>
              </span>
            </div>
          </div>
        </div>

        <PrimaryButton
          variant="primary"
          size="md"
          icon={Play}
          iconRight={ChevronRight}
          onClick={onStart}
        >
          Start Encounter
        </PrimaryButton>
      </div>
    </GlassCard>
  );
};

// Hero Triple: Main Session | OSCE | Analytics — above the fold focal block
const HeroTriple: React.FC<{
  onStartSession: (settings?: SessionSettings) => void;
  onNavigateToSimulation?: (settings?: {
    initialFocus?: 'all' | 'growth' | 'flagged' | 'due';
  }) => void;
  onNavigateToDrillMode: (modeId: string) => void;
  streak: number;
  dueCount: number;
  accuracy: number | null;
  questionsToday: number;
  dueLabel: string;
  accuracyLabel: string;
  onOpenFullAnalytics: () => void;
}> = ({
  onStartSession,
  onNavigateToSimulation,
  onNavigateToDrillMode,
  streak,
  dueCount,
  accuracy,
  questionsToday,
  dueLabel,
  accuracyLabel,
  onOpenFullAnalytics,
}) => {
  const handleMainSession = () => {
    if (onNavigateToSimulation) {
      onNavigateToSimulation();
    } else {
      onStartSession(dueCount > 0 ? { focus: 'review' } : undefined);
    }
  };
  return (
    <section className="mb-6" aria-label="Quick actions: Main Session, OSCE, Analytics">
      <h2 className="sr-only">Quick actions</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Main Session */}
        <GlassCard variant="primary" hoverable className="flex flex-col">
          <div className="flex items-start gap-3 mb-3">
            <div className="p-2.5 rounded-xl bg-action-blue/20 shrink-0">
              <Brain className="w-6 h-6 text-action-blue" aria-hidden />
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-[var(--color-text-primary)]">Build Session</h3>
              <p className="text-sm text-slate-600 dark:text-[var(--color-text-muted)] mt-0.5">
                {dueCount > 0 ? 'Review due questions' : 'Start adaptive questions'}
              </p>
            </div>
          </div>
          <PrimaryButton
            variant="primary"
            size="md"
            icon={Play}
            className="mt-auto w-full focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] focus-visible:ring-offset-2"
            onClick={handleMainSession}
          >
            {dueCount > 0 ? 'Start review' : 'Start session'}
          </PrimaryButton>
        </GlassCard>

        {/* OSCE */}
        <GlassCard variant="info" hoverable className="flex flex-col">
          <div className="flex items-start gap-3 mb-3">
            <div className="p-2.5 rounded-xl bg-steel-blue-400/20 shrink-0">
              <MessageSquare className="w-6 h-6 text-steel-blue-500" aria-hidden />
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-[var(--color-text-primary)]">Live OSCE</h3>
              <p className="text-sm text-slate-600 dark:text-[var(--color-text-muted)] mt-0.5">
                Voice patient, SOAP grading
              </p>
            </div>
          </div>
          <PrimaryButton
            variant="primary"
            size="md"
            icon={Play}
            className="mt-auto w-full focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] focus-visible:ring-offset-2"
            onClick={() => onNavigateToDrillMode('patient_encounter')}
          >
            Start Encounter
          </PrimaryButton>
        </GlassCard>

        {/* Analytics */}
        <GlassCard variant="info" hoverable className="flex flex-col">
          <div className="flex items-start gap-3 mb-3">
            <div className="p-2.5 rounded-xl bg-sage-500/20 shrink-0">
              <BarChart3 className="w-6 h-6 text-sage-600 dark:text-sage-400" aria-hidden />
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-[var(--color-text-primary)]">Progress & Analytics</h3>
              <p className="text-sm text-slate-600 dark:text-[var(--color-text-muted)] mt-0.5">
                Streak {streak} · {dueLabel} {dueCount} · {accuracy !== null ? `${accuracy}%` : '—'}{' '}
                {accuracyLabel}
              </p>
            </div>
          </div>
          <PrimaryButton
            variant="secondary"
            size="md"
            icon={BarChart3}
            className="mt-auto w-full focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] focus-visible:ring-offset-2"
            onClick={onOpenFullAnalytics}
          >
            View full analytics
          </PrimaryButton>
        </GlassCard>
      </div>
    </section>
  );
};

// Quick Stats Bar (respects prefers-reduced-motion)
const QuickStatsBar: React.FC<{
  streak: number;
  dueCount: number;
  accuracy: number | null;
  questionsToday: number;
  /** "Module Accuracy" when Didactic with filtered systems, "Global Accuracy" otherwise */
  accuracyLabel?: string;
  /** "To Review" for students, "Maintenance Due" for Practicing PAs */
  dueLabel?: string;
}> = ({
  streak,
  dueCount,
  accuracy,
  questionsToday,
  accuracyLabel = 'Global Accuracy',
  dueLabel = 'To Review',
}) => {
  const prefersReducedMotion = useReducedMotion();
  const stats = [
    {
      label: 'Study Continuity',
      value: streak,
      icon: Zap,
      color: 'text-teal-600 dark:text-teal-400',
    },
    {
      label: dueLabel,
      value: dueCount,
      icon: AlertCircle,
      color: dueCount > 0 ? 'text-muted-amber' : 'text-[var(--color-text-muted)]',
    },
    {
      label: accuracyLabel,
      value: accuracy !== null ? `${accuracy}%` : 'Waiting for first session',
      icon: Target,
      color: 'text-sage-500',
    },
    { label: 'Today', value: questionsToday, icon: CheckCircle, color: 'text-action-blue' },
  ];
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
      {stats.map((stat, i) => {
        const isDueCard = stat.label === dueLabel;
        const hasDueItems = isDueCard && dueCount > 0;

        const animate = prefersReducedMotion
          ? { opacity: 1, y: 0 }
          : hasDueItems
            ? {
                opacity: 1,
                y: 0,
                scale: [1, 1.02, 1],
                borderColor: [
                  'var(--color-border)',
                  'rgba(20, 184, 166, 0.4)',
                  'var(--color-border)',
                ],
              }
            : { opacity: 1, y: 0 };
        const transition = prefersReducedMotion
          ? { duration: 0 }
          : hasDueItems
            ? {
                opacity: { delay: i * 0.05, duration: 0.3, ease: 'easeOut' as const },
                y: { delay: i * 0.05, duration: 0.3, ease: 'easeOut' as const },
                scale: {
                  delay: i * 0.05 + 0.3,
                  duration: 2,
                  repeat: Infinity,
                  repeatType: 'loop' as const,
                  ease: 'easeInOut',
                },
                borderColor: {
                  delay: i * 0.05 + 0.3,
                  duration: 2,
                  repeat: Infinity,
                  repeatType: 'loop' as const,
                  ease: 'easeInOut',
                },
              }
            : { delay: i * 0.05, duration: 0.3, ease: 'easeOut' as const };

        return (
          <motion.div
            key={stat.label}
            initial={prefersReducedMotion ? false : { opacity: 0, y: 10 }}
            animate={animate}
            transition={transition}
            className={`flex items-center gap-3 p-3 bg-[var(--color-bg-secondary)] rounded-xl border transition-colors ${
              hasDueItems
                ? 'border-data-provisional/30 hover:border-data-provisional/40'
                : 'border-[var(--color-border)] hover:border-[var(--color-border)]/60'
            }`}
          >
            <div className="p-2 rounded-xl bg-[var(--color-bg-primary)]">
              <stat.icon className={`w-5 h-5 ${stat.color}`} />
            </div>
            <div>
              <div className="text-lg font-bold text-[var(--color-text-primary)] data-nums">
                {stat.value}
              </div>
              <div className="kpi-label">{stat.label}</div>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
};

// Mode Card (respects prefers-reduced-motion; reflow-friendly for text scaling)
const ModeCard: React.FC<{
  mode: TrainingModeConfig;
  onSelect: () => void;
}> = ({ mode, onSelect }) => {
  const Icon = ICON_MAP[mode.iconName] || Target;
  const prefersReducedMotion = useReducedMotion();

  return (
    <motion.button
      variants={{
        initial: { opacity: 0, y: 10 },
        animate: { opacity: 1, y: 0 },
      }}
      transition={
        prefersReducedMotion ? { duration: 0 } : { type: 'spring', stiffness: 400, damping: 28 }
      }
      whileHover={prefersReducedMotion ? undefined : { y: -2, scale: 1.01 }}
      whileTap={prefersReducedMotion ? undefined : { scale: 0.98 }}
      onClick={onSelect}
      disabled={mode.isComingSoon}
      title={
        mode.isComingSoon
          ? `${mode.label} - Feature in development, available soon`
          : mode.description
      }
      aria-label={mode.isComingSoon ? `${mode.label} - Coming soon` : mode.label}
      className={`
        w-full text-left p-4 rounded-xl border transition-all duration-200 group min-h-0
        focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2
        ${
          mode.isComingSoon
            ? 'opacity-50 cursor-not-allowed bg-[var(--color-bg-tertiary)] border-dashed border-[var(--color-border)]'
            : 'bg-[var(--color-bg-primary)] border-[var(--color-border)] hover:border-[var(--color-accent)]/50 hover:shadow-lg shadow-md shadow-[var(--color-shadow-soft)]'
        }
      `}
    >
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-xl bg-[var(--color-bg-secondary)] group-hover:bg-[var(--color-accent)]/10 transition-colors duration-200 flex-shrink-0">
          <Icon className="w-5 h-5 text-[var(--color-text-secondary)] group-hover:text-[var(--color-accent)] transition-colors" />
        </div>
        <div className="flex-1 min-w-0 max-w-xl">
          <div className="flex items-center justify-between gap-2 mb-0.5">
            <h4 className="font-semibold text-[var(--color-text-primary)] break-words">
              {mode.label}
            </h4>
            {mode.isComingSoon && (
              <span className="text-xs text-[var(--color-text-muted)] bg-[var(--color-bg-secondary)] px-2 py-0.5 rounded-full flex-shrink-0">
                Soon
              </span>
            )}
          </div>
          <p className="text-[15px] text-[var(--color-text-secondary)] line-clamp-3">
            {mode.description}
          </p>
          {mode.estimatedMinutes && (
            <div className="flex items-center gap-1.5 mt-2 text-xs text-[var(--color-text-muted)]">
              <Timer className="w-3 h-3" />
              <span>~{mode.estimatedMinutes} min</span>
            </div>
          )}
        </div>
      </div>
    </motion.button>
  );
};

// Category Section
const CategorySection: React.FC<{
  category: TrainingCategory;
  modes: TrainingModeConfig[];
  onSelectMode: (mode: TrainingModeConfig) => void;
}> = ({ category, modes, onSelectMode }) => {
  const info = CATEGORY_INFO[category];
  const Icon = ICON_MAP[info.iconName] || Target;

  if (modes.length === 0) return null;

  return (
    <section className="mb-8">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 rounded-xl bg-[var(--color-bg-secondary)]">
          <Icon className="w-5 h-5 text-[var(--color-text-secondary)]" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-[var(--color-text-primary)]">{info.label}</h3>
          <p className="text-sm text-[var(--color-text-muted)]">{info.description}</p>
        </div>
      </div>

      <motion.div
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3"
        variants={{
          animate: { transition: { staggerChildren: 0.04, delayChildren: 0.02 } },
        }}
        initial="initial"
        animate="animate"
      >
        {modes.map((mode) => (
          <ModeCard key={mode.id} mode={mode} onSelect={() => onSelectMode(mode)} />
        ))}
      </motion.div>
    </section>
  );
};

// ============================================================================
// Residency Cockpit: Study by System (body map / system grid from Rolling 360)
// ============================================================================

function ResidencyCockpitSection({
  onNavigateToDrillWithSystem,
}: {
  onNavigateToDrillWithSystem: (modeId: string, system: string) => void;
}) {
  const { stats, isLoading } = useRolling360Stats();
  const weakestSet = useMemo(() => new Set(stats?.weakestSystems ?? []), [stats?.weakestSystems]);
  const weakestSystem = stats?.weakestSystems?.[0] ?? null;
  const hasData = (stats?.totalInWindow ?? 0) >= 5;
  const systemsWithData = Object.entries(stats?.systemStats ?? {}).filter(([, s]) => s.total >= 2);

  if (isLoading) return null;

  return (
    <section className="mb-6">
      <h3 className="text-lg font-bold text-[var(--color-text-primary)] mb-4 flex items-center gap-2">
        <Target className="w-5 h-5 text-[var(--color-text-muted)]" />
        Residency Cockpit
      </h3>

      <div className="flex flex-col lg:flex-row gap-6">
        {hasData && systemsWithData.length > 0 && stats?.systemStats && (
          <div className="flex-shrink-0">
            <BodyMapWidget
              systemStats={stats.systemStats}
              weakestSystems={stats.weakestSystems ?? []}
              onSystemClick={(s) => onNavigateToDrillWithSystem('system_drill', s)}
            />
          </div>
        )}
        <div className="flex-1 flex flex-col gap-4">
          <RoundsButton
            weakestSystem={weakestSystem}
            hasData={hasData}
            onStartRounds={(system) => {
              if (system) {
                onNavigateToDrillWithSystem('system_drill', system);
              } else {
                onNavigateToDrillWithSystem('system_drill', '');
              }
            }}
          />
          {systemsWithData.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {systemsWithData.slice(0, 12).map(([system, sysStats]) => {
                const isWeak = weakestSet.has(system);
                return (
                  <button
                    key={system}
                    type="button"
                    onClick={() => onNavigateToDrillWithSystem('system_drill', system)}
                    className={`
                      text-left p-4 rounded-xl border transition-all
                      bg-[var(--color-bg-primary)] border-[var(--color-border)]
                      hover:border-[var(--color-accent)]/50 hover:shadow-lg
                      ${isWeak ? 'ring-1 ring-[var(--color-accent)]/30' : ''}
                    `}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-[var(--color-text-primary)] truncate">
                        {system}
                      </span>
                      {isWeak && (
                        <span className="px-1.5 py-0.5 bg-[var(--color-accent)]/20 text-[var(--color-accent)] text-xs rounded">
                          Weak
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[var(--color-text-muted)]">
                      {sysStats.accuracy.toFixed(0)}% · {sysStats.total} q
                    </p>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export const CommandCenterHub: React.FC<CommandCenterHubProps> = ({
  performanceData,
  missedQuestions,
  flaggedQuestions,
  growthAreas,
  dueCount: propDueCount,
  examLabel = 'PANCE',
  isLoadingStats = false,
  onStartSession,
  onNavigateToDrillMode,
  onNavigateToDrillWithSystem,
  onNavigateToToolkit,
  onNavigateToGapAnalysis,
  onNavigateToClinicalProfile,
  onNavigateToIntegrations,
  onNavigateToSimulation,
  onNavigateToReference,
  onNavigateToMyLibrary,
  onNavigateToStudyCompanion,
  onNavigateToSrsFlashcards,
  onNavigateToCustomStudy,
  onNavigateToPearlDeck,
  onNavigateToClinicalEye,
  onNavigateToVisualizer,
  onOpenSettings,
  onNavigateToTutorChat,
  hasActiveSession = false,
  resumeContext,
  onResumeSession,
  initialStudyToolsTab,
}) => {
  const navigate = useNavigate();
  const { user } = useUser();
  const { showPANREContent, careerStage } = useUserContext();
  const { stats: rolling360Stats } = useRolling360Stats();
  const { stats: unifiedStats, isLoading: unifiedStatsLoading } = useUnifiedStats();

  // Quick Wins: Last session and welcome back state
  const [lastSession] = useState<LastSessionData | null>(() => getLastSession());
  const [showWelcomeBack, setShowWelcomeBack] = useState(() => getLastSession() !== null);

  // Handler: Resume last session
  const handleResumeLastSession = useCallback(() => {
    if (!lastSession) return;
    clearLastSession();
    setShowWelcomeBack(false);
    onStartSession(lastSession.settings);
  }, [lastSession, onStartSession]);

  // Handler: Dismiss welcome back card
  const handleDismissWelcomeBack = useCallback(() => {
    setShowWelcomeBack(false);
    // Optionally clear localStorage so it doesn't reappear
    clearLastSession();
  }, []);

  // Calculate curriculum progress for exam countdown
  const curriculumProgressPercent = useMemo(() => {
    if (!rolling360Stats) return 0;
    const totalSystems = Object.keys(ABBREVIATION_TO_TOPIC_MAP).length;
    const systemsWithGoodMastery = Object.values(rolling360Stats.systemStats || {}).filter(
      (s) => s.accuracy >= 0.7 && s.total >= 5
    ).length;
    return Math.round((systemsWithGoodMastery / totalSystems) * 100);
  }, [rolling360Stats]);

  // Sprint 2: Pull-to-refresh
  const [isRefreshing, setIsRefreshing] = useState(false);
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 600));
      // In production: trigger parent data reload
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  const pullToRefreshRef = usePullToRefresh(handleRefresh, {
    threshold: 80,
    enabled: true,
  });

  // Sprint 3: System stats for AI recommendation and progress ring
  const systemStatsForAI = useMemo(() => {
    if (!rolling360Stats?.systemStats) return [];
    return Object.entries(rolling360Stats.systemStats).map(([system, stats]) => ({
      system: system as SystemCode,
      name: ABBREVIATION_TO_TOPIC_MAP[system] || system,
      accuracy: stats.accuracy,
      totalAttempts: stats.total,
    }));
  }, [rolling360Stats]);

  // Sprint 3: System progress for Progress Ring detail
  const systemProgressData = useMemo(() => {
    if (!rolling360Stats?.systemStats) return [];
    return Object.entries(rolling360Stats.systemStats).map(([system, stats]) => ({
      system: system as SystemCode,
      name: ABBREVIATION_TO_TOPIC_MAP[system] || system,
      reviewed: stats.total,
      total: 100, // TODO: Get actual condition count per system from registry
      percent: stats.total >= 5 ? Math.min(stats.accuracy * 100, 100) : 0,
      accuracy: stats.accuracy,
    }));
  }, [rolling360Stats]);

  // Load user profile first (needed by other hooks)
  const [userProfile, setUserProfile] = useState(
    () => loadUserProfile() || { hasCompletedOnboarding: false }
  );

  useEffect(() => {
    const sync = () => setUserProfile(loadUserProfile() || { hasCompletedOnboarding: false });
    sync();
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, []);

  // Sprint 3: Days until exam for AI recommendation
  const daysUntilExam = useMemo(() => {
    if (!userProfile?.graduationDate) return null;
    const examDate = new Date(userProfile.graduationDate);
    const now = new Date();
    const diffTime = examDate.getTime() - now.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }, [userProfile]);

  // Map Rolling 360 system stats to CurriculumGrid progressData (system -> mastery %)
  const curriculumProgressData = useMemo(() => {
    const sys = rolling360Stats?.systemStats;
    if (!sys) return undefined;
    return Object.fromEntries(
      Object.entries(sys).map(([k, v]) => [k, Math.round(v.accuracy)])
    ) as Record<string, number>;
  }, [rolling360Stats?.systemStats]);
  // Load enabled systems from localStorage (updates when Settings modal changes them)
  const [enabledSystems, setEnabledSystems] = useState<Set<SystemCode>>(() => {
    const saved = localStorage.getItem('panceai_enabled_systems');
    if (saved) {
      try {
        return new Set(JSON.parse(saved) as SystemCode[]);
      } catch {
        return new Set(Object.keys(ABBREVIATION_TO_TOPIC_MAP) as SystemCode[]);
      }
    }
    return new Set(Object.keys(ABBREVIATION_TO_TOPIC_MAP) as SystemCode[]);
  });

  useEffect(() => {
    const handler = () => {
      const saved = localStorage.getItem('panceai_enabled_systems');
      if (saved) {
        try {
          setEnabledSystems(new Set(JSON.parse(saved) as SystemCode[]));
        } catch {
          /* ignore */
        }
      }
    };
    globalThis.addEventListener('panceai_enabled_systems_changed', handler);
    return () => globalThis.removeEventListener('panceai_enabled_systems_changed', handler);
  }, []);

  // Practicing PAs: default to all systems ON (they toggle OFF to exclude rarely practiced areas)
  useEffect(() => {
    if (careerStage !== 'practicing') return;
    const all = Object.keys(ABBREVIATION_TO_TOPIC_MAP) as SystemCode[];
    const saved = localStorage.getItem('panceai_enabled_systems');
    if (!saved || saved === '[]') {
      setEnabledSystems(new Set(all));
      localStorage.setItem('panceai_enabled_systems', JSON.stringify(all));
      window.dispatchEvent(new CustomEvent('panceai_enabled_systems_changed'));
    }
  }, [careerStage]);

  const handleToggleSystem = useCallback((system: SystemCode) => {
    setEnabledSystems((prev: Set<SystemCode>) => {
      const next = new Set(prev);
      if (next.has(system)) next.delete(system);
      else next.add(system);
      localStorage.setItem('panceai_enabled_systems', JSON.stringify(Array.from(next)));
      window.dispatchEvent(new CustomEvent('panceai_enabled_systems_changed'));
      return next;
    });
  }, []);

  const isClinicalStudent =
    careerStage === 'student' && userProfile?.yearInProgram === 'Clinical Year';
  const currentRotation = userProfile?.currentRotation;
  const eorTestDate = userProfile?.eorTestDate;

  const handleRotationChange = useCallback((rotation: ClinicalRotation) => {
    updateUserProfile({ currentRotation: rotation });
    setUserProfile((prev) => ({ ...prev, currentRotation: rotation }));
    const systems = getSystemsForRotation(rotation);
    setEnabledSystems(new Set(systems));
    localStorage.setItem('panceai_enabled_systems', JSON.stringify(systems));
    window.dispatchEvent(new CustomEvent('panceai_enabled_systems_changed'));
    // Persist for question service Clinical 60/40 (60% rotation / 40% background)
    localStorage.setItem('panceai_current_rotation', rotation);
    localStorage.setItem('panceai_year_in_program', 'Clinical Year');
  }, []);

  const handleEorTestDateChange = useCallback((date: string) => {
    updateUserProfile({ eorTestDate: date || undefined });
    setUserProfile((prev) => ({ ...prev, eorTestDate: date || undefined }));
  }, []);

  const [activeTab, setActiveTab] = useState<'training' | 'resources' | 'analytics'>(
    initialStudyToolsTab ?? 'analytics'
  );
  const studyToolsSectionRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (
      initialStudyToolsTab &&
      (initialStudyToolsTab === 'resources' ||
        initialStudyToolsTab === 'analytics' ||
        initialStudyToolsTab === 'training')
    ) {
      setActiveTab(initialStudyToolsTab);
    }
  }, [initialStudyToolsTab]);
  const handleOpenFullAnalytics = useCallback(() => {
    setActiveTab('analytics');
    navigate('/study?tab=analytics', { replace: true });
    // Defer scroll so React can commit the tab switch and the analytics panel is in the DOM
    const scrollToStudyTools = () => {
      studyToolsSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };
    requestAnimationFrame(() => {
      requestAnimationFrame(scrollToStudyTools);
    });
  }, [navigate]);
  const [showAdvancedAnalytics, setShowAdvancedAnalytics] = useState(false);
  const [studyFocusStep, setStudyFocusStep] = useState<'idle' | 'choose_focus'>('idle');
  const [showAllTools, setShowAllTools] = useState(false);

  // Calculate stats for the dashboard (accuracy null when no data - show "—" instead of 0%)
  const stats = useMemo(() => {
    // Use unified stats as primary source, fallback to legacy calculations if not available
    if (unifiedStats && !unifiedStatsLoading) {
      const globalAccuracy = unifiedStats.accuracy.global;
      const accuracy = globalAccuracy !== null ? Math.round(globalAccuracy * 100) : null;
      const streak = unifiedStats.recentActivity.streakDays;
      const dueCount = unifiedStats.questionCounts.dueForReview;
      const questionsToday = unifiedStats.questionCounts.today;
      return { streak, dueCount, accuracy, questionsToday };
    }

    // Fallback to legacy calculations (keeps existing behavior while unified stats load)
    const recent = performanceData.slice(-100);
    const correct = recent.filter((r) => r.isCorrect).length;
    const accuracy =
      recent.length > 0 ? Math.round((correct / recent.length) * 100) : (null as number | null);

    const todayRecords = (performanceData || []).filter((r) => {
      if (!r?.timestamp) return false;
      const date = new Date(r.timestamp);
      const today = new Date();
      return (
        date.getDate() === today.getDate() &&
        date.getMonth() === today.getMonth() &&
        date.getFullYear() === today.getFullYear()
      );
    });

    // Day streak (consecutive days studied) - single source of truth
    const { current: streak } = calculateDayStreak(performanceData || []);

    const dueCount =
      propDueCount ?? (flaggedQuestions?.length || 0) + (missedQuestions?.length || 0);

    return { streak, dueCount, accuracy, questionsToday: todayRecords.length };
  }, [performanceData, flaggedQuestions, missedQuestions, propDueCount, unifiedStats, unifiedStatsLoading]);

  // FSRS / spaced repetition schedule blocks for Gantt (today when dueCount > 0)
  const schedulerBlocks: ScheduleBlock[] = useMemo(() => {
    if (stats.dueCount <= 0) return [];
    const today = new Date().toISOString().slice(0, 10);
    return [
      {
        id: 'today-due',
        label: 'Review due',
        date: today,
        count: stats.dueCount,
      },
    ];
  }, [stats.dueCount]);

  // For Didactic users: sub-label showing enabled systems (e.g. "Testing: CV, PULM, GI Only")
  const enabledSystemsLabel = useMemo(() => {
    if (careerStage !== 'student') return null;
    const all = Object.keys(ABBREVIATION_TO_TOPIC_MAP) as SystemCode[];
    const enabled = all.filter((s) => enabledSystems.has(s));
    if (enabled.length === 0 || enabled.length === all.length) return null;
    return `Testing: ${enabled.slice(0, 5).join(', ')}${enabled.length > 5 ? '…' : ''} Only`;
  }, [careerStage, enabledSystems]);

  // Filter modes based on user context (PANCE vs PANRE; hide didactic-only for Practicing PAs)
  const filteredModes = useMemo(() => {
    const filterForContext = (modes: TrainingModeConfig[]) =>
      modes.filter((m) => {
        if (m.panreOnly && !showPANREContent) return false;
        if (m.didacticOnly && showPANREContent) return false;
        return true;
      });

    return {
      visual: filterForContext(VISUAL_DIAGNOSTICS_MODES),
      clinical: filterForContext(CLINICAL_SIMULATION_MODES),
      questions: filterForContext(QUESTION_PRACTICE_MODES),
      specialty: filterForContext(SPECIALTY_DRILL_MODES),
    };
  }, [showPANREContent]);

  const handleModeSelect = useCallback(
    (mode: TrainingModeConfig) => {
      if (mode.id === 'core_adaptive') {
        // Navigate to dedicated simulation page instead of opening modal
        if (onNavigateToSimulation) {
          onNavigateToSimulation();
        } else {
          onStartSession({ focus: 'all' });
        }
      } else {
        onNavigateToDrillMode(mode.id);
      }
    },
    [onNavigateToDrillMode, onStartSession, onNavigateToSimulation]
  );

  const handleNavigateToDrillModeWithSettings = (modeId: string, settings?: any) => {
    if (modeId === 'core_adaptive' || modeId === 'custom_practice') {
      onStartSession(settings);
    } else {
      onNavigateToDrillMode(modeId);
    }
  };

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  }, []);

  const prefersReducedMotion = useReducedMotion();
  const sectionEnter = prefersReducedMotion ? false : { opacity: 0, y: 16 };
  const sectionAnimate = prefersReducedMotion ? false : { opacity: 1, y: 0 };
  const sectionTransition = (delay: number) =>
    prefersReducedMotion
      ? { duration: 0 }
      : { duration: 0.3, ease: [0.32, 0.72, 0, 1] as const, delay };

  return (
    <>
      {/* Sprint 3: Progress Ring Widget (floating, persistent) */}
      {curriculumProgressPercent > 0 && systemProgressData.length > 0 && (
        <ProgressRingWidget
          percent={curriculumProgressPercent}
          systemProgress={systemProgressData}
          onSystemClick={(system) => onNavigateToDrillWithSystem?.('system_drill', system)}
        />
      )}

      <div ref={pullToRefreshRef} className="max-w-6xl mx-auto">
        {/* Refresh indicator */}
        {isRefreshing && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center justify-center py-4"
          >
            <div className="flex items-center gap-2 px-4 py-2 bg-[var(--color-accent)]/10 border border-[var(--color-accent)]/20 rounded-full">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
              >
                <RotateCcw className="w-4 h-4 text-[var(--color-accent)]" />
              </motion.div>
              <span className="text-sm font-medium text-[var(--color-accent)]">Refreshing...</span>
            </div>
          </motion.div>
        )}

        {/* Header */}
        <motion.div
          initial={sectionEnter}
          animate={sectionAnimate}
          transition={sectionTransition(0)}
          className="mb-6"
        >
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-[var(--color-text-primary)] truncate max-w-full">
            {greeting}, {user?.firstName || 'Student'}
          </h1>
          <p className="text-[var(--color-text-muted)] mt-1">
            Ready to advance your clinical knowledge?
          </p>
        </motion.div>

        {/* Welcome Back Card - shows last completed session (not same as active session resume) */}
        {!hasActiveSession && showWelcomeBack && lastSession && (
          <motion.div
            initial={sectionEnter}
            animate={sectionAnimate}
            transition={sectionTransition(0)}
            className="mb-6"
          >
            <WelcomeBackCard
              lastSession={lastSession}
              onResume={handleResumeLastSession}
              onDismiss={handleDismissWelcomeBack}
            />
          </motion.div>
        )}

        {/* Continue Learning (Zeigarnik) - above the fold when session in progress */}
        {hasActiveSession && onResumeSession && (
          <motion.div
            initial={sectionEnter}
            animate={sectionAnimate}
            transition={sectionTransition(0)}
            className="mb-6"
          >
            <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-4 md:p-5 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <h2 className="text-lg font-semibold text-[var(--color-text-primary)] flex items-center gap-2">
                    <RotateCcw className="w-5 h-5 text-[var(--color-accent)]" aria-hidden />
                    Continue Learning
                  </h2>
                  <p className="text-[var(--color-text-secondary)] text-sm mt-1">
                    {resumeContext?.remaining != null
                      ? `Resume question ${resumeContext.current} – ${resumeContext.remaining} remaining`
                      : 'Pick up where you left off.'}
                  </p>
                  {resumeContext?.total != null && resumeContext.total > 0 && (
                    <div className="mt-3 max-w-xs" role="group" aria-label="Session progress">
                      <progress
                        className="h-2 w-full rounded-full overflow-hidden [&::-webkit-progress-bar]:bg-[var(--color-bg-tertiary)] [&::-webkit-progress-value]:bg-[var(--color-accent)] [&::-moz-progress-bar]:bg-[var(--color-accent)]"
                        value={resumeContext.current}
                        max={resumeContext.total}
                        aria-label={`Question ${resumeContext.current} of ${resumeContext.total}`}
                      />
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={onResumeSession}
                  className="shrink-0 flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-semibold bg-[var(--color-accent)] text-[var(--color-text-inverse)] hover:opacity-90 transition-opacity focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg-primary)]"
                >
                  <Play className="w-4 h-4" aria-hidden />
                  Resume
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {/* Quick Wins: PANCE / EOR Countdown + Time-Box Buttons (for students) */}
        {careerStage === 'student' &&
          (userProfile?.graduationDate ||
            (eorTestDate && currentRotation && isEorRotation(currentRotation))) && (
            <motion.div
              initial={sectionEnter}
              animate={sectionAnimate}
              transition={sectionTransition(0)}
              className="mb-6 grid grid-cols-1 lg:grid-cols-3 gap-4"
            >
              {userProfile?.graduationDate && (
                <div
                  className={
                    eorTestDate && currentRotation && isEorRotation(currentRotation)
                      ? ''
                      : 'lg:col-span-2'
                  }
                >
                  <ExamCountdownCard
                    examDate={userProfile.graduationDate}
                    curriculumPercent={curriculumProgressPercent}
                    questionsAnswered={performanceData.length}
                  />
                </div>
              )}
              {eorTestDate && currentRotation && isEorRotation(currentRotation) && (
                <div className={userProfile?.graduationDate ? '' : 'lg:col-span-2'}>
                  <EorCountdownCard examDate={eorTestDate} rotation={currentRotation} />
                </div>
              )}
              <div>
                <TimeBoxButtons onStartSession={onStartSession} />
              </div>
            </motion.div>
          )}

        {/* Time-Box Buttons only (for users without exam date) */}
        {((!userProfile?.graduationDate &&
          !(eorTestDate && currentRotation && isEorRotation(currentRotation))) ||
          careerStage === 'practicing') && (
          <motion.div
            initial={sectionEnter}
            animate={sectionAnimate}
            transition={sectionTransition(0)}
            className="mb-6"
          >
            <TimeBoxButtons onStartSession={onStartSession} />
          </motion.div>
        )}

        {/* Hero Triple: Main Session | OSCE | Analytics — above the fold */}
        <motion.div
          initial={sectionEnter}
          animate={sectionAnimate}
          transition={sectionTransition(0.05)}
        >
          <HeroTriple
            onStartSession={onStartSession}
            onNavigateToSimulation={onNavigateToSimulation}
            onNavigateToDrillMode={onNavigateToDrillMode}
            streak={stats.streak}
            dueCount={stats.dueCount}
            accuracy={stats.accuracy}
            questionsToday={stats.questionsToday}
            dueLabel={careerStage === 'practicing' ? 'Maintenance Due' : TO_REVIEW_LABEL}
            accuracyLabel={
              careerStage === 'student' &&
              enabledSystems.size > 0 &&
              enabledSystems.size < Object.keys(ABBREVIATION_TO_TOPIC_MAP).length
                ? 'Module Accuracy'
                : 'Global Accuracy'
            }
            onOpenFullAnalytics={handleOpenFullAnalytics}
          />
        </motion.div>

        {/* Quick Stats - Section 1 (delay 0) */}
        <motion.div
          initial={sectionEnter}
          animate={sectionAnimate}
          transition={sectionTransition(0)}
          className="mb-6"
        >
          {isLoadingStats ? (
            <QuickStatsBarSkeleton />
          ) : (
            <QuickStatsBar
              streak={stats.streak}
              dueCount={stats.dueCount}
              accuracy={stats.accuracy}
              questionsToday={stats.questionsToday}
              accuracyLabel={
                careerStage === 'student' &&
                enabledSystems.size > 0 &&
                enabledSystems.size < Object.keys(ABBREVIATION_TO_TOPIC_MAP).length
                  ? 'Module Accuracy'
                  : 'Global Accuracy'
              }
              dueLabel={careerStage === 'practicing' ? 'Maintenance Due' : TO_REVIEW_LABEL}
            />
          )}
        </motion.div>

        {/* Circadian insight (when enough data) */}
        {performanceData.length >= 20 && (
          <motion.div
            initial={sectionEnter}
            animate={sectionAnimate}
            transition={sectionTransition(0)}
            className="mb-6"
          >
            <CircadianInsightCard performanceRecords={performanceData} className="max-w-xs" />
          </motion.div>
        )}

        {/* Core Adaptive Hero - main session (above the fold) */}
        <motion.div
          initial={sectionEnter}
          animate={sectionAnimate}
          transition={sectionTransition(0.1)}
        >
          <CoreAdaptiveHero
            onStart={() =>
              onNavigateToSimulation
                ? onNavigateToSimulation()
                : onStartSession({ focus: 'all', simulationStrict: true })
            }
            accuracy={stats.accuracy}
            questionsToday={stats.questionsToday}
            examLabel={examLabel}
            enabledSystemsLabel={enabledSystemsLabel}
            accuracyLabel={
              careerStage === 'student' &&
              enabledSystems.size > 0 &&
              enabledSystems.size < Object.keys(ABBREVIATION_TO_TOPIC_MAP).length
                ? 'Module Accuracy'
                : 'Global Accuracy'
            }
            growthAreas={growthAreas}
          />
        </motion.div>

        {/* OSCE Section - above the fold */}
        <motion.div
          initial={sectionEnter}
          animate={sectionAnimate}
          transition={sectionTransition(0.1)}
        >
          <OSCESection onStart={() => onNavigateToDrillMode('patient_encounter')} />
        </motion.div>

        {/* Recommended for you - Section 2 */}
        <motion.div
          initial={sectionEnter}
          animate={sectionAnimate}
          transition={sectionTransition(0.1)}
        >
          <h2 className="text-lg font-bold text-[var(--color-text-primary)] mb-3">
            Recommended for you
          </h2>
          <RecommendationFeed onNavigateToDrill={handleNavigateToDrillModeWithSettings} />
        </motion.div>

        {/* Residency Cockpit: Study by System (body map / system grid from Rolling 360) */}
        {onNavigateToDrillWithSystem && (
          <ResidencyCockpitSection onNavigateToDrillWithSystem={onNavigateToDrillWithSystem} />
        )}

        {/* Grand Rounds / Daily Question - Section 2 (delay 100ms) */}
        <motion.div
          initial={sectionEnter}
          animate={sectionAnimate}
          transition={sectionTransition(0.1)}
        >
          <GrandRoundsBanner
            onStart={() => onNavigateToDrillMode('grand_rounds')}
            isDidactic={careerStage === 'student' && userProfile?.yearInProgram !== 'Clinical Year'}
          />
        </motion.div>

        {/* Clinical Student: Current Rotation dropdown (presets systems) + EOR Test Date */}
        {isClinicalStudent && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 p-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)]"
          >
            <h3 className="font-bold text-[var(--color-text-primary)] mb-3 flex items-center gap-2">
              <GraduationCap className="w-5 h-5 text-[var(--color-accent)]" />
              Current Rotation
            </h3>
            <p className="text-sm text-[var(--color-text-muted)] mb-3">
              Selecting a rotation presets which systems you&apos;re tested on (e.g. Surgery = GI,
              CV, MSK; zero Psych).
            </p>
            <RotationSelector value={currentRotation} onChange={handleRotationChange} label="" />
            {currentRotation && isEorRotation(currentRotation) && (
              <div className="mt-4 pt-4 border-t border-[var(--color-border)]">
                <label className="block text-sm font-semibold text-[var(--color-text-primary)] mb-2">
                  EOR Test Date
                </label>
                <input
                  type="date"
                  value={eorTestDate ?? ''}
                  onChange={(e) => handleEorTestDateChange(e.target.value)}
                  className="w-full max-w-xs px-3 py-2 bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded-lg text-[var(--color-text-primary)] text-sm"
                  aria-label="EOR test date for current rotation"
                />
                <p className="text-xs text-[var(--color-text-muted)] mt-1">
                  Dashboard will show &quot;EOR Readiness&quot; until this date.
                </p>
              </div>
            )}
          </motion.div>
        )}

        {/* Current Curriculum - Section 3 (delay 200ms) */}
        {careerStage === 'student' &&
          enabledSystems.size >= 0 &&
          enabledSystems.size <= Object.keys(ABBREVIATION_TO_TOPIC_MAP).length && (
            <motion.div
              initial={sectionEnter}
              animate={sectionAnimate}
              transition={sectionTransition(0.2)}
              className="mb-6 p-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)]"
            >
              <div className="flex flex-col gap-3 mb-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-[var(--color-accent)]/10">
                    <Layers className="w-5 h-5 text-[var(--color-accent)]" />
                  </div>
                  <div>
                    <h3 className="font-bold text-[var(--color-text-primary)]">
                      Current Curriculum
                    </h3>
                    <p className="text-sm text-[var(--color-text-muted)]">
                      {enabledSystems.size === 0
                        ? 'Enable at least one system to test.'
                        : enabledSystems.size === Object.keys(ABBREVIATION_TO_TOPIC_MAP).length
                          ? 'All systems enabled.'
                          : `Testing: ${Array.from(enabledSystems).slice(0, 6).join(', ')}${enabledSystems.size > 6 ? ` +${enabledSystems.size - 6} more` : ''} only`}
                    </p>
                  </div>
                </div>
                {/* Unified toolbar: Enable All, Disable All, More options */}
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const all = new Set(Object.keys(ABBREVIATION_TO_TOPIC_MAP) as SystemCode[]);
                      setEnabledSystems(all);
                      localStorage.setItem(
                        'panceai_enabled_systems',
                        JSON.stringify(Array.from(all))
                      );
                      window.dispatchEvent(new CustomEvent('panceai_enabled_systems_changed'));
                    }}
                    className="px-3 py-1.5 text-xs font-medium bg-[var(--color-bg-primary)] hover:bg-[var(--color-border)] text-[var(--color-text-primary)] rounded-lg"
                  >
                    Enable All
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEnabledSystems(new Set());
                      localStorage.setItem('panceai_enabled_systems', JSON.stringify([]));
                      window.dispatchEvent(new CustomEvent('panceai_enabled_systems_changed'));
                    }}
                    className="px-3 py-1.5 text-xs font-medium bg-[var(--color-bg-primary)] hover:bg-[var(--color-border)] text-[var(--color-text-primary)] rounded-lg"
                  >
                    Disable All
                  </button>
                  {onOpenSettings && (
                    <button
                      type="button"
                      onClick={onOpenSettings}
                      title="More options"
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-[var(--color-bg-primary)] hover:bg-[var(--color-border)] text-[var(--color-text-primary)] rounded-lg"
                    >
                      <MoreHorizontal className="w-4 h-4" aria-hidden />
                      <span>More options</span>
                    </button>
                  )}
                </div>
              </div>
              <CurriculumGrid
                selectedSystems={enabledSystems}
                onSystemToggle={handleToggleSystem}
                growthAreas={growthAreas}
                progressData={curriculumProgressData}
              />
            </motion.div>
          )}

        {/* Custom Study Mode - System Chooser (Targeted Practice) */}
        {onNavigateToCustomStudy && (
          <GlassCard variant="primary" hoverable className="mb-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-start gap-4 flex-1">
                <div className="p-3 rounded-xl bg-action-blue/20 backdrop-blur-sm">
                  <Layers className="w-6 h-6 text-action-blue" />
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-xl font-bold text-[var(--color-text-primary)]">
                      Custom Study Builder
                    </h3>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-action-blue/10 text-action-blue border border-action-blue/20">
                      System Chooser
                    </span>
                  </div>
                  <p className="text-base text-[var(--color-text-secondary)] mb-3">
                    Build targeted sessions: choose specific organ systems, focus areas, and
                    customize difficulty
                  </p>
                  <div className="flex items-center gap-4">
                    <span className="inline-flex items-center gap-1.5 text-xs text-[var(--color-text-muted)]">
                      <Target className="w-3.5 h-3.5" />
                      <span className="font-medium">Multi-System Selection</span>
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-xs text-[var(--color-text-muted)]">
                      <Sparkles className="w-3.5 h-3.5" />
                      <span className="font-medium">Custom Focus</span>
                    </span>
                  </div>
                </div>
              </div>

              <PrimaryButton
                variant="secondary"
                size="md"
                icon={Play}
                iconRight={ChevronRight}
                onClick={onNavigateToCustomStudy}
              >
                Build Session
              </PrimaryButton>
            </div>
          </GlassCard>
        )}

        {/* PANRE-LA (Only for practicing PAs) */}
        {showPANREContent && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-deep-plum-500/10 to-deep-plum-400/10 border border-deep-plum-500/30 p-5 mb-6"
          >
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-deep-plum-500/20">
                  <GraduationCap className="w-6 h-6 text-deep-plum-500" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-[var(--color-text-primary)]">
                    PANRE-LA Simulator
                  </h3>
                  <p className="text-sm text-[var(--color-text-muted)]">
                    Longitudinal assessment format for recertification
                  </p>
                </div>
              </div>

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => onNavigateToDrillMode('panre_la')}
                className="flex items-center gap-2 px-4 py-2 bg-deep-plum-500 hover:bg-deep-plum-600 text-[var(--color-text-inverse)] font-medium rounded-lg transition-colors"
              >
                Start Practice
                <ChevronRight className="w-4 h-4" />
              </motion.button>
            </div>
          </motion.div>
        )}

        {/* Study Tools / Maintenance Section Header - Sticky below app header so it never overlaps sidebar */}
        <div
          ref={studyToolsSectionRef}
          id="study-tools-section"
          className="sticky z-20 bg-[var(--color-bg-primary)]/95 backdrop-blur border-b border-[var(--color-border)] -mx-4 px-4 pb-4 mb-6"
          style={{ top: 'var(--header-height, 4rem)' }}
        >
          <div className="mb-3 max-w-[1200px] mx-auto">
            <h2 className="text-lg font-bold text-[var(--color-text-primary)]">
              {careerStage === 'practicing' ? 'Maintenance & Reference' : 'Study Tools'}
            </h2>
            <p className="text-sm text-[var(--color-text-muted)]">
              {careerStage === 'practicing'
                ? 'Training modes, clinical resources, and progress'
                : 'Switch view: choose training modes, clinical resources, or progress &amp; analytics'}
            </p>
          </div>

          {/* Tab Navigation - switches content below (not scroll anchors) */}
          <div
            className="flex gap-4 overflow-x-auto -mx-1 px-1 border-b border-[var(--color-border)] w-full"
            role="tablist"
            aria-label="Study tools view"
          >
            {[
              { id: 'analytics' as const, label: 'Progress & Analytics', icon: BarChart3 },
              { id: 'training' as const, label: 'Training Modes', icon: Zap },
              { id: 'resources' as const, label: 'Clinical Resources', icon: BookOpen },
            ].map((tab) => {
              const isSelected = activeTab === tab.id;
              const className = `flex items-center gap-2 px-1 py-2 font-medium transition-all whitespace-nowrap border-b-2 bg-transparent ${
                isSelected
                  ? 'text-muted-amber-500 border-muted-amber-500'
                  : 'text-[var(--color-text-muted)] border-transparent hover:text-[var(--color-text-secondary)]'
              }`;

              const handleTabClick = () => {
                setActiveTab(tab.id);
                const search = tab.id === 'training' ? '' : `?tab=${tab.id}`;
                navigate(`/study${search}`, { replace: true });
              };
              return isSelected ? (
                <button
                  key={tab.id}
                  role="tab"
                  aria-selected="true"
                  aria-controls={`study-tools-panel-${tab.id}`}
                  id={`study-tools-tab-${tab.id}`}
                  onClick={handleTabClick}
                  className={className}
                >
                  <tab.icon className="w-4 h-4" strokeWidth={1.5} />
                  {tab.label}
                </button>
              ) : (
                <button
                  key={tab.id}
                  role="tab"
                  aria-selected="false"
                  aria-controls={`study-tools-panel-${tab.id}`}
                  id={`study-tools-tab-${tab.id}`}
                  onClick={handleTabClick}
                  className={className}
                >
                  <tab.icon className="w-4 h-4" strokeWidth={1.5} />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Tab panels: aligned to same grid as header/tabs (max-w 1200px) */}
        <div className="max-w-[1200px] mx-auto">
          <AnimatePresence mode="wait">
            {activeTab === 'training' && (
              <motion.div
                key="training"
                id="study-tools-panel-training"
                role="tabpanel"
                aria-labelledby="study-tools-tab-training"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
              >
                {/* Progressive disclosure: default = one CTA; "Study Now" opens outcome choice */}
                {studyFocusStep === 'idle' && !showAllTools && (
                  <div className="space-y-6">
                    <div className="text-center py-6">
                      <p className="text-[var(--color-text-secondary)] mb-6">
                        What do you want to do?
                      </p>
                      <PrimaryButton
                        size="lg"
                        icon={Play}
                        iconRight={ChevronRight}
                        onClick={() => setStudyFocusStep('choose_focus')}
                        hapticOnPress
                        className="gap-2"
                      >
                        Study Now
                      </PrimaryButton>
                    </div>
                    <div className="text-center">
                      <button
                        type="button"
                        onClick={() => setShowAllTools(true)}
                        className="text-sm text-[var(--color-accent)] hover:underline"
                      >
                        Browse all tools
                      </button>
                    </div>
                  </div>
                )}

                {/* Second step: "What do you want to focus on?" — grouped by outcome */}
                {studyFocusStep === 'choose_focus' && (
                  <div className="space-y-6">
                    <div className="flex items-center justify-between gap-4">
                      <h3 className="text-lg font-bold text-[var(--color-text-primary)]">
                        What do you want to focus on?
                      </h3>
                      <button
                        type="button"
                        onClick={() => setStudyFocusStep('idle')}
                        className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
                      >
                        Back
                      </button>
                    </div>

                    {/* Learn New Material */}
                    <section>
                      <div className="flex items-center gap-2 mb-3">
                        <BookOpen className="w-5 h-5 text-[var(--color-text-muted)]" />
                        <h4 className="font-semibold text-[var(--color-text-primary)]">
                          {STUDY_OUTCOME_GROUPS.learn.label}
                        </h4>
                      </div>
                      <p className="text-sm text-[var(--color-text-muted)] mb-3">
                        {STUDY_OUTCOME_GROUPS.learn.description}
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {STUDY_OUTCOME_GROUPS.learn.modeIds.map((id) => {
                          const mode = getModeById(id);
                          if (!mode || (mode.panreOnly && !showPANREContent)) return null;
                          return (
                            <ModeCard
                              key={mode.id}
                              mode={mode}
                              onSelect={() => {
                                handleModeSelect(mode);
                                setStudyFocusStep('idle');
                              }}
                            />
                          );
                        })}
                      </div>
                    </section>

                    {/* Test My Knowledge */}
                    <section>
                      <div className="flex items-center gap-2 mb-3">
                        <Target className="w-5 h-5 text-[var(--color-text-muted)]" />
                        <h4 className="font-semibold text-[var(--color-text-primary)]">
                          {STUDY_OUTCOME_GROUPS.test.label}
                        </h4>
                      </div>
                      <p className="text-sm text-[var(--color-text-muted)] mb-3">
                        {STUDY_OUTCOME_GROUPS.test.description}
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {STUDY_OUTCOME_GROUPS.test.modeIds.slice(0, 6).map((id) => {
                          const mode = getModeById(id);
                          if (!mode || mode.isComingSoon || (mode.panreOnly && !showPANREContent))
                            return null;
                          return (
                            <ModeCard
                              key={mode.id}
                              mode={mode}
                              onSelect={() => {
                                handleModeSelect(mode);
                                setStudyFocusStep('idle');
                              }}
                            />
                          );
                        })}
                      </div>
                      {STUDY_OUTCOME_GROUPS.test.modeIds.length > 6 && (
                        <button
                          type="button"
                          onClick={() => {
                            setShowAllTools(true);
                            setStudyFocusStep('idle');
                          }}
                          className="mt-2 text-sm text-[var(--color-accent)] hover:underline"
                        >
                          More options…
                        </button>
                      )}
                    </section>

                    {/* Fix My Weaknesses — fix.modeIds is intentionally empty; fix is handled by the weak-areas CTA only. */}
                    <section>
                      <div className="flex items-center gap-2 mb-3">
                        <AlertCircle className="w-5 h-5 text-[var(--color-text-muted)]" />
                        <h4 className="font-semibold text-[var(--color-text-primary)]">
                          {STUDY_OUTCOME_GROUPS.fix.label}
                        </h4>
                      </div>
                      <p className="text-sm text-[var(--color-text-muted)] mb-3">
                        {STUDY_OUTCOME_GROUPS.fix.description}
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          onStartSession(
                            growthAreas.length > 0
                              ? { focus: 'topic', topic: growthAreas[0] }
                              : { focus: 'incorrect' }
                          );
                          setStudyFocusStep('idle');
                        }}
                        className="w-full sm:w-auto text-left p-4 rounded-xl border-2 border-[var(--color-border)] bg-[var(--color-bg-primary)] hover:border-[var(--color-accent)]/50 hover:bg-[var(--color-bg-secondary)] transition-all group flex items-center gap-3"
                      >
                        <div className="p-2 rounded-lg bg-[var(--color-accent)]/10">
                          <Target className="w-5 h-5 text-[var(--color-accent)]" />
                        </div>
                        <div>
                          <span className="font-semibold text-[var(--color-text-primary)]">
                            Focus on my weak areas
                          </span>
                          <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                            {growthAreas.length > 0
                              ? `Start with ${growthAreas[0]} and related topics`
                              : 'Questions from your to-review list'}
                          </p>
                        </div>
                      </button>
                    </section>
                  </div>
                )}

                {/* Full list (progressive disclosure: "Browse all tools") */}
                {showAllTools && (
                  <div className="space-y-6">
                    <div className="flex items-center justify-between gap-4">
                      <h3 className="text-lg font-bold text-[var(--color-text-primary)]">
                        All study tools
                      </h3>
                      <button
                        type="button"
                        onClick={() => setShowAllTools(false)}
                        className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
                      >
                        Show less
                      </button>
                    </div>
                    <CategorySection
                      category="visual_diagnostics"
                      modes={filteredModes.visual}
                      onSelectMode={handleModeSelect}
                    />
                    <CategorySection
                      category="clinical_simulation"
                      modes={filteredModes.clinical}
                      onSelectMode={handleModeSelect}
                    />
                    <CategorySection
                      category="question_practice"
                      modes={filteredModes.questions}
                      onSelectMode={handleModeSelect}
                    />
                    <CategorySection
                      category="specialty_drills"
                      modes={filteredModes.specialty}
                      onSelectMode={handleModeSelect}
                    />
                  </div>
                )}
              </motion.div>
            )}

            {activeTab === 'resources' && (
              <motion.div
                key="resources"
                id="study-tools-panel-resources"
                role="tabpanel"
                aria-labelledby="study-tools-tab-resources"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="space-y-6"
              >
                <section>
                  <h3 className="text-lg font-bold text-[var(--color-text-primary)] mb-4 flex items-center gap-2">
                    <Calculator className="w-5 h-5 text-[var(--color-text-muted)]" />
                    Calculators & Risk Scores
                  </h3>
                  <div className="grid md:grid-cols-2 gap-4">
                    <button
                      onClick={onNavigateToToolkit}
                      className="w-full text-left p-5 bg-[var(--color-bg-primary)] rounded-xl border border-[var(--color-border)] hover:border-[var(--color-accent)]/50 hover:shadow-lg transition-all group"
                    >
                      <div className="flex items-start gap-4">
                        <div className="p-3 rounded-xl bg-[var(--color-bg-secondary)]">
                          <Target className="w-6 h-6 text-[var(--color-text-secondary)]" />
                        </div>
                        <div className="flex-1">
                          <h4 className="font-bold text-[var(--color-text-primary)]">
                            Clinical Calculators
                          </h4>
                          <p className="text-sm text-[var(--color-text-muted)] mt-1">
                            Wells, CURB-65, PERC, CHA₂DS₂-VASc, and more
                          </p>
                        </div>
                        <ChevronRight className="w-5 h-5 text-[var(--color-text-muted)] group-hover:translate-x-0.5 transition-transform" />
                      </div>
                    </button>
                    <button
                      onClick={onNavigateToToolkit}
                      className="w-full text-left p-5 bg-[var(--color-bg-primary)] rounded-xl border border-[var(--color-border)] hover:border-[var(--color-accent)]/50 hover:shadow-lg transition-all group"
                    >
                      <div className="flex items-start gap-4">
                        <div className="p-3 rounded-xl bg-[var(--color-bg-secondary)]">
                          <Beaker className="w-6 h-6 text-[var(--color-text-secondary)]" />
                        </div>
                        <div className="flex-1">
                          <h4 className="font-bold text-[var(--color-text-primary)]">
                            Lab Calculators
                          </h4>
                          <p className="text-sm text-[var(--color-text-muted)] mt-1">
                            GFR, Anion Gap, Corrected Na+, A-a Gradient
                          </p>
                        </div>
                      </div>
                    </button>
                  </div>
                </section>

                {/* Rapid Review (Pearl Deck) */}
                {onNavigateToPearlDeck && (
                  <section>
                    <h3 className="text-lg font-bold text-[var(--color-text-primary)] mb-4 flex items-center gap-2">
                      <Sparkles className="w-5 h-5 text-[var(--color-text-muted)]" />
                      High-Yield Review
                    </h3>
                    <button
                      onClick={onNavigateToPearlDeck}
                      className="w-full text-left p-5 bg-[var(--color-bg-secondary)] rounded-xl border border-[var(--color-border)] hover:border-[var(--color-accent)] hover:shadow-lg transition-all group focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg-primary)]"
                    >
                      <div className="flex items-start gap-4">
                        <div className="p-3 rounded-xl bg-[var(--color-accent)]/20">
                          <Sparkles className="w-6 h-6 text-[var(--color-accent)]" />
                        </div>
                        <div className="flex-1">
                          <h4 className="font-bold text-[var(--color-text-primary)]">
                            Rapid Review (Pearl Deck)
                          </h4>
                          <p className="text-sm text-[var(--color-text-secondary)] mt-1">
                            Study only your saved clinical pearls for high-yield review
                          </p>
                        </div>
                      </div>
                    </button>
                  </section>
                )}

                {/* AI-Powered Tools: Clinical Eye & Visualizer */}
                {(onNavigateToClinicalEye || onNavigateToVisualizer || onNavigateToTutorChat) && (
                  <section>
                    <h3 className="text-lg font-bold text-[var(--color-text-primary)] mb-4 flex items-center gap-2">
                      <Sparkles className="w-5 h-5 text-[var(--color-text-muted)]" />
                      AI-Powered Tools
                    </h3>
                    <div className="grid md:grid-cols-2 gap-4">
                      {onNavigateToClinicalEye && (
                        <button
                          onClick={onNavigateToClinicalEye}
                          className="w-full text-left p-5 bg-[var(--color-bg-primary)] rounded-xl border border-[var(--color-border)] hover:border-[var(--color-accent)]/50 hover:shadow-lg transition-all group"
                        >
                          <div className="flex items-start gap-4">
                            <div className="p-3 rounded-xl bg-[var(--color-bg-secondary)]">
                              <Eye className="w-6 h-6 text-[var(--color-text-secondary)]" />
                            </div>
                            <div className="flex-1">
                              <h4 className="font-bold text-[var(--color-text-primary)] flex items-center gap-2">
                                Clinical Eye
                                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-[var(--color-accent)]/20 text-[var(--color-accent)]">
                                  AI-powered
                                </span>
                              </h4>
                              <p className="text-sm text-[var(--color-text-muted)] mt-1">
                                Image analysis: upload ECGs or clinical images for AI explanations
                                and code-based measurements
                              </p>
                            </div>
                          </div>
                        </button>
                      )}
                      {onNavigateToVisualizer && (
                        <button
                          onClick={onNavigateToVisualizer}
                          className="w-full text-left p-5 bg-[var(--color-bg-primary)] rounded-xl border border-[var(--color-border)] hover:border-[var(--color-accent)]/50 hover:shadow-lg transition-all group"
                        >
                          <div className="flex items-start gap-4">
                            <div className="p-3 rounded-xl bg-[var(--color-bg-secondary)]">
                              <Image className="w-6 h-6 text-[var(--color-text-secondary)]" />
                            </div>
                            <div className="flex-1">
                              <h4 className="font-bold text-[var(--color-text-primary)] flex items-center gap-2">
                                Anatomy Visualizer
                                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-[var(--color-accent)]/20 text-[var(--color-accent)]">
                                  AI-powered
                                </span>
                              </h4>
                              <p className="text-sm text-[var(--color-text-muted)] mt-1">
                                Generate anatomy images and segment regions (Firefly + Gemini)
                              </p>
                            </div>
                          </div>
                        </button>
                      )}
                      {onNavigateToTutorChat && (
                        <button
                          onClick={onNavigateToTutorChat}
                          className="w-full text-left p-5 bg-[var(--color-bg-primary)] rounded-xl border border-[var(--color-border)] hover:border-[var(--color-accent)]/50 hover:shadow-lg transition-all group"
                        >
                          <div className="flex items-start gap-4">
                            <div className="p-3 rounded-xl bg-[var(--color-bg-secondary)]">
                              <MessageSquare className="w-6 h-6 text-[var(--color-text-secondary)]" />
                            </div>
                            <div className="flex-1">
                              <h4 className="font-bold text-[var(--color-text-primary)]">
                                Reasoning Tutor Chat
                              </h4>
                              <p className="text-sm text-[var(--color-text-muted)] mt-1">
                                Chat with a Gemini Tutor that uses your weak spots and active
                                Library to guide explanations
                              </p>
                            </div>
                          </div>
                        </button>
                      )}
                    </div>
                  </section>
                )}

                {/* Knowledge Base */}
                {onNavigateToReference && (
                  <section>
                    <h3 className="text-lg font-bold text-[var(--color-text-primary)] mb-4 flex items-center gap-2">
                      <Stethoscope className="w-5 h-5 text-[var(--color-text-muted)]" />
                      Knowledge Base
                    </h3>
                    <button
                      onClick={onNavigateToReference}
                      className="w-full text-left p-5 bg-[var(--color-bg-secondary)] rounded-xl border border-[var(--color-border)] hover:border-[var(--color-accent)] hover:shadow-lg transition-all group focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg-primary)]"
                    >
                      <div className="flex items-start gap-4">
                        <div className="p-3 rounded-xl bg-[var(--color-accent)]/20">
                          <BookOpen className="w-6 h-6 text-[var(--color-accent)]" />
                        </div>
                        <div className="flex-1">
                          <h4 className="font-bold text-[var(--color-text-primary)]">
                            Knowledge Base
                          </h4>
                          <p className="text-sm text-[var(--color-text-secondary)] mt-1">
                            Browse Anatomy, Labs, Drugs, ECG Patterns, Procedures, Physiology & more
                          </p>
                          <div className="flex flex-wrap gap-2 mt-3">
                            <span className="px-2 py-0.5 rounded-full text-xs bg-[var(--color-accent)]/20 text-[var(--color-accent)]">
                              300+ Anatomy
                            </span>
                            <span className="px-2 py-0.5 rounded-full text-xs bg-[var(--color-accent)]/20 text-[var(--color-accent)]">
                              200+ Labs
                            </span>
                            <span className="px-2 py-0.5 rounded-full text-xs bg-[var(--color-accent)]/20 text-[var(--color-accent)]">
                              1000+ Drugs
                            </span>
                            <span className="px-2 py-0.5 rounded-full text-xs bg-[var(--color-accent)]/20 text-[var(--color-accent)]">
                              50+ ECG
                            </span>
                          </div>
                        </div>
                      </div>
                    </button>
                  </section>
                )}

                {/* My Library - Upload PDFs, set active cache for Tutor */}
                {onNavigateToMyLibrary && (
                  <section>
                    <h3 className="text-lg font-bold text-[var(--color-text-primary)] mb-4 flex items-center gap-2">
                      <FolderTree className="w-5 h-5 text-[var(--color-text-muted)]" />
                      Knowledge
                    </h3>
                    <button
                      onClick={onNavigateToMyLibrary}
                      className="w-full text-left p-5 bg-[var(--color-bg-secondary)] rounded-xl border border-[var(--color-border)] hover:border-[var(--color-accent)] hover:shadow-lg transition-all group focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg-primary)]"
                    >
                      <div className="flex items-start gap-4">
                        <div className="p-3 rounded-xl bg-[var(--color-accent)]/20">
                          <Sparkles className="w-6 h-6 text-[var(--color-accent)]" />
                        </div>
                        <div className="flex-1">
                          <h4 className="font-bold text-[var(--color-text-primary)] flex items-center gap-2">
                            My Library
                            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-[var(--color-accent)]/20 text-[var(--color-accent)]">
                              Smarter tutor
                            </span>
                          </h4>
                          <p className="text-sm text-[var(--color-text-secondary)] mt-1">
                            Upload notes and PDFs so the Tutor uses your materials for personalized
                            explanations
                          </p>
                          <span className="inline-block mt-2 px-2 py-0.5 rounded-full text-xs bg-[var(--color-accent)]/20 text-[var(--color-accent)]">
                            Context caching
                          </span>
                        </div>
                      </div>
                    </button>

                    {onNavigateToStudyCompanion && (
                      <button
                        onClick={onNavigateToStudyCompanion}
                        className="mt-3 w-full text-left p-5 bg-[var(--color-bg-secondary)] rounded-xl border border-[var(--color-border)] hover:border-[var(--color-accent)] hover:shadow-lg transition-all group focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg-primary)]"
                      >
                        <div className="flex items-start gap-4">
                          <div className="p-3 rounded-xl bg-[var(--color-accent)]/20">
                            <MessageSquare className="w-6 h-6 text-[var(--color-accent)]" />
                          </div>
                          <div className="flex-1">
                            <h4 className="font-bold text-[var(--color-text-primary)] flex items-center gap-2">
                              Study Companion
                              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-[var(--color-accent)]/20 text-[var(--color-accent)]">
                                Citations
                              </span>
                            </h4>
                            <p className="text-sm text-[var(--color-text-secondary)] mt-1">
                              Chat with an approved textbook and see evidence highlighted directly
                              on the PDF
                            </p>
                            <span className="inline-block mt-2 px-2 py-0.5 rounded-full text-xs bg-[var(--color-accent)]/20 text-[var(--color-accent)]">
                              PDF + Tutor
                            </span>
                          </div>
                        </div>
                      </button>
                    )}
                    {onNavigateToSrsFlashcards && (
                      <button
                        onClick={onNavigateToSrsFlashcards}
                        className="mt-3 w-full text-left p-5 bg-[var(--color-bg-secondary)] rounded-xl border border-[var(--color-border)] hover:border-[var(--color-accent)] hover:shadow-lg transition-all group focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg-primary)]"
                      >
                        <div className="flex items-start gap-4">
                          <div className="p-3 rounded-xl bg-[var(--color-accent)]/20">
                            <Layers className="w-6 h-6 text-[var(--color-accent)]" />
                          </div>
                          <div className="flex-1">
                            <h4 className="font-bold text-[var(--color-text-primary)] flex items-center gap-2">
                              SRS Flashcards
                              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-[var(--color-accent)]/20 text-[var(--color-accent)]">
                                Mnemonics
                              </span>
                            </h4>
                            <p className="text-sm text-[var(--color-text-secondary)] mt-1">
                              Spaced repetition with variant cards; rate Hard to get an exaggerated
                              mnemonic image
                            </p>
                            <span className="inline-block mt-2 px-2 py-0.5 rounded-full text-xs bg-[var(--color-accent)]/20 text-[var(--color-accent)]">
                              FSRS + Firefly
                            </span>
                          </div>
                        </div>
                      </button>
                    )}
                  </section>
                )}
              </motion.div>
            )}

            {activeTab === 'analytics' && (
              <motion.div
                key="analytics"
                id="study-tools-panel-analytics"
                role="tabpanel"
                aria-labelledby="study-tools-tab-analytics"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="space-y-6"
              >
                {/* Research-Backed User-Friendly Stats */}
                <section>
                  <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                    <h3 className="text-lg font-bold text-[var(--color-text-primary)] flex items-center gap-2">
                      <BarChart3 className="w-5 h-5 text-action-blue" />
                      Your Learning Analytics
                    </h3>
                    <HighContrastDataToggle compact className="shrink-0" />
                  </div>
                  <Suspense fallback={<SkeletonLoader />}>
                    <UserFriendlyStatsDisplay />
                  </Suspense>
                </section>

                {/* Spaced repetition schedule (Gantt-style) */}
                <section>
                  <SmartSchedulerGantt blocks={schedulerBlocks} daysToShow={14} />
                </section>

                {/* Learning Profile - Comprehensive User Analytics */}
                <section>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold text-[var(--color-text-primary)] flex items-center gap-2">
                      <User className="w-5 h-5 text-[var(--color-text-muted)]" />
                      Detailed Learning Profile
                    </h3>
                    <button
                      onClick={() => setShowAdvancedAnalytics(!showAdvancedAnalytics)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                        showAdvancedAnalytics
                          ? 'bg-action-blue text-[var(--color-text-inverse)]'
                          : 'bg-[var(--color-surface)] text-[var(--color-text-secondary)] hover:bg-[var(--color-border)]'
                      }`}
                    >
                      {showAdvancedAnalytics ? '✦ Advanced View' : 'Switch to Advanced'}
                    </button>
                  </div>
                  {showAdvancedAnalytics ? (
                    <Suspense fallback={<SkeletonLoader />}>
                      <AdvancedLearningProfileDashboard />
                    </Suspense>
                  ) : (
                    <Suspense fallback={<SkeletonLoader />}>
                      <LearningProfileDashboard />
                    </Suspense>
                  )}
                </section>

                <section>
                  <h3 className="text-lg font-bold text-[var(--color-text-primary)] mb-4 flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-[var(--color-text-muted)]" />
                    Overview
                  </h3>

                  {/* Database-backed analytics (authenticated users) */}
                  <Suspense fallback={<SkeletonLoader />}>
                    <DatabaseAnalyticsDashboard />
                  </Suspense>

                  {/* Session-based analytics (local data) */}
                  <div className="mt-6">
                    <h4 className="text-sm font-medium text-[var(--color-text-muted)] mb-3">
                      Session Performance
                    </h4>
                    <Suspense fallback={<SkeletonLoader />}>
                      <AnalyticsDashboard performanceData={performanceData} />
                    </Suspense>
                  </div>

                  {/* Additional navigation to detailed views */}
                  <div className="grid md:grid-cols-2 gap-4 mt-6">
                    <button
                      onClick={onNavigateToGapAnalysis}
                      className="w-full text-left p-5 bg-[var(--color-bg-primary)] rounded-xl border border-[var(--color-border)] hover:border-[var(--color-accent)]/50 hover:shadow-lg transition-all group"
                    >
                      <div className="flex items-start gap-4">
                        <div className="p-3 rounded-xl bg-[var(--color-bg-secondary)]">
                          <Layers className="w-6 h-6 text-[var(--color-text-secondary)]" />
                        </div>
                        <div className="flex-1">
                          <h4 className="font-bold text-[var(--color-text-primary)]">
                            Competency Heatmap
                          </h4>
                          <p className="text-sm text-[var(--color-text-muted)] mt-1">
                            Visual mastery grid across organ systems
                          </p>
                        </div>
                      </div>
                    </button>
                    <button
                      onClick={onNavigateToGapAnalysis}
                      className="w-full text-left p-5 bg-[var(--color-bg-primary)] rounded-xl border border-[var(--color-border)] hover:border-[var(--color-accent)]/50 hover:shadow-lg transition-all group"
                    >
                      <div className="flex items-start gap-4">
                        <div className="p-3 rounded-xl bg-[var(--color-bg-secondary)]">
                          <Target className="w-6 h-6 text-[var(--color-text-secondary)]" />
                        </div>
                        <div className="flex-1">
                          <h4 className="font-bold text-[var(--color-text-primary)]">
                            Gap Analysis
                          </h4>
                          <p className="text-sm text-[var(--color-text-muted)] mt-1">
                            Identify high-yield focus areas
                          </p>
                        </div>
                      </div>
                    </button>
                    <button
                      onClick={onNavigateToClinicalProfile}
                      className="w-full text-left p-5 bg-[var(--color-bg-primary)] rounded-xl border border-[var(--color-border)] hover:border-[var(--color-accent)]/50 hover:shadow-lg transition-all group md:col-span-2"
                    >
                      <div className="flex items-start gap-4">
                        <div className="p-3 rounded-xl bg-[var(--color-bg-secondary)]">
                          <BarChart3 className="w-6 h-6 text-[var(--color-text-secondary)]" />
                        </div>
                        <div className="flex-1">
                          <h4 className="font-bold text-[var(--color-text-primary)]">
                            Clinical Profile
                          </h4>
                          <p className="text-sm text-[var(--color-text-muted)] mt-1">
                            Strengths, timing patterns, and diagnosis bias
                          </p>
                        </div>
                      </div>
                    </button>
                  </div>
                </section>

                {/* Growth Areas */}
                {growthAreas.length > 0 && (
                  <section>
                    <h3 className="text-lg font-bold text-[var(--color-text-primary)] mb-4 flex items-center gap-2">
                      <AlertCircle className="w-5 h-5 text-muted-amber" />
                      Priority Focus Areas
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {growthAreas.map((area) => (
                        <button
                          key={area}
                          onClick={() => onStartSession({ focus: 'topic', topic: area })}
                          className="px-4 py-2 bg-data-provisional/10 dark:bg-data-provisional/5 border border-data-provisional/30 dark:border-data-provisional/20 text-muted-amber rounded-lg hover:bg-data-provisional/20 dark:hover:bg-data-provisional/10 transition-colors"
                        >
                          {area}
                        </button>
                      ))}
                    </div>
                  </section>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </>
  );
};

export default CommandCenterHub;
