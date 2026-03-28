'use client';

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { GlassCard } from '@/components/ui/GlassCard';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { RecommendationFeed } from '@/components/dashboard/RecommendationFeed';
import { useUser } from '@clerk/clerk-react';
import {
  Brain,
  Stethoscope,
  BarChart3,
  Calculator,
  TrendingUp,
  ChevronRight,
  Play,
  Timer,
  GraduationCap,
  Layers,
  MessageSquare,
  Trophy,
  Sparkles,
  MoreHorizontal,
  RotateCcw,
  AlertCircle,
  X,
} from 'lucide-react';
import { StorageKeys } from '@/lib/storage/storageRegistry';
import type { PerformanceRecord, Question, SessionSettings, SystemCode } from '@/types';
import type { ClinicalRotation } from '@/types';
import { loadUserProfile } from '@/services/analytics';
import { useUserProfile } from '@/hooks/useUserProfile';
import { getSystemsForRotation, isEorRotation, DEFAULT_SYSTEM_PROGRESS_TOTAL } from '@/config/rotation-systems';
import { RotationSelector } from '@/components/onboarding/RotationSelector';
import { TO_REVIEW_LABEL } from '@/config/labels';
import { useUserContext } from '@/hooks/useUserContext';
import { useRolling360Stats } from '@/hooks/useRolling360Stats';
import { useUnifiedStats } from '@/hooks/useUnifiedStats';
import { useUserStats } from '@/hooks/useUserStats';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { calculateDayStreak } from '@/lib/dashboardUtils';
import { QuickStatsBarSkeleton } from '@/components/loading';
import { ABBREVIATION_TO_TOPIC_MAP } from '@/src/constants';
import { CurriculumGrid } from '@/components/dashboard/CurriculumGrid';
import { getLastSession, clearLastSession, type LastSessionData } from '@/lib/utils/sessionStorage';
import { WelcomeBackCard } from '@/components/dashboard/WelcomeBackCard';
import { ExamCountdownCard } from '@/components/dashboard/ExamCountdownCard';
import { EorCountdownCard } from '@/components/dashboard/EorCountdownCard';
import { CircadianInsightCard } from '@/components/dashboard/CircadianInsightCard';
import { TimeBoxButtons } from '@/components/dashboard/TimeBoxButtons';
import { ProgressRingWidget } from '@/components/dashboard/ProgressRingWidget';
import { usePullToRefresh } from '@/hooks/useSwipeGestures';
import {
  GrandRoundsBanner,
  CoreAdaptiveHero,
  QuickStatsBar,
} from './hub';

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
  /** Due Review: variant PANCE MCQ questions scheduled by implicit FSRS */
  onNavigateToSrsReview?: () => void;
  onNavigateToCustomStudy?: () => void;
  /** Dynamic Study Path Optimizer dashboard */
  onNavigateToStudyPathDashboard?: () => void;
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

// ============================================================================
// Subcomponents
// ============================================================================

// OSCE Section (Standalone Feature)
const OSCESection: React.FC<{ onStart: () => void }> = ({ onStart }) => {
  return (
    <GlassCard variant="info" hoverable className="mb-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-start gap-4 flex-1">
          <div className="p-3 rounded-xl bg-[var(--color-category-practice)]/20 backdrop-blur-sm">
            <MessageSquare className="w-6 h-6 text-[var(--color-category-practice)]" />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-xl font-bold text-[var(--color-text-primary)]">Live OSCE</h3>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold text-[var(--color-category-practice)]">
                Voice patient
              </span>
            </div>
            <p className="text-base text-[var(--color-text-secondary)] mb-3">
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
            <div className="p-2.5 rounded-xl bg-[var(--color-accent)]/20 shrink-0">
              <Brain className="w-6 h-6 text-[var(--color-accent)]" aria-hidden />
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-[var(--color-text-primary)]">Build Session</h3>
              <p className="text-sm text-[var(--color-text-muted)] mt-0.5">
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
            <div className="p-2.5 rounded-xl bg-[var(--color-category-practice)]/20 shrink-0">
              <MessageSquare className="w-6 h-6 text-[var(--color-category-practice)]" aria-hidden />
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-[var(--color-text-primary)]">Live OSCE</h3>
              <p className="text-sm text-[var(--color-text-muted)] mt-0.5">
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
            <div className="p-2.5 rounded-xl bg-[var(--color-category-toolkit)]/20 shrink-0">
              <BarChart3 className="w-6 h-6 text-[var(--color-category-toolkit)]" aria-hidden />
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-[var(--color-text-primary)]">Progress & Analytics</h3>
              <p className="text-sm text-[var(--color-text-muted)] mt-0.5">
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
  onNavigateToSrsReview,
  onNavigateToCustomStudy,
  onNavigateToPearlDeck,
  onNavigateToStudyPathDashboard,
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
  const { syncError } = useUserStats();

  // Track which sync errors have been dismissed by the user
  const [dismissedSyncError, setDismissedSyncError] = useState<string | null>(null);

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
      total: DEFAULT_SYSTEM_PROGRESS_TOTAL,
      percent: stats.total >= 5 ? Math.min(stats.accuracy * 100, 100) : 0,
      accuracy: stats.accuracy,
    }));
  }, [rolling360Stats]);

  // Load user profile first (needed by other hooks)
  const [userProfile, setUserProfile] = useState(
    () => loadUserProfile() || { hasCompletedOnboarding: false }
  );

  const { profile: apiProfile, updateProfile } = useUserProfile();

  // When API profile loads, merge EOR/rotation fields into local state so API is source of truth
  useEffect(() => {
    if (!apiProfile) return;
    setUserProfile((prev) => ({
      ...prev,
      eorTestDate: apiProfile.eorTestDate ?? prev?.eorTestDate,
      rotationStartDate: apiProfile.rotationStartDate ?? prev?.rotationStartDate,
      rotationEndDate: apiProfile.rotationEndDate ?? prev?.rotationEndDate,
      currentRotation: apiProfile.currentRotation ?? prev?.currentRotation,
      yearInProgram: apiProfile.yearInProgram ?? prev?.yearInProgram,
    }));
  }, [apiProfile?.eorTestDate, apiProfile?.rotationStartDate, apiProfile?.rotationEndDate, apiProfile?.currentRotation, apiProfile?.yearInProgram]);

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
    const saved = localStorage.getItem(StorageKeys.ENABLED_SYSTEMS);
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
      const saved = localStorage.getItem(StorageKeys.ENABLED_SYSTEMS);
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
    const saved = localStorage.getItem(StorageKeys.ENABLED_SYSTEMS);
    if (!saved || saved === '[]') {
      setEnabledSystems(new Set(all));
      localStorage.setItem(StorageKeys.ENABLED_SYSTEMS, JSON.stringify(all));
      window.dispatchEvent(new CustomEvent('panceai_enabled_systems_changed'));
    }
  }, [careerStage]);

  const handleToggleSystem = useCallback((system: SystemCode) => {
    setEnabledSystems((prev: Set<SystemCode>) => {
      const next = new Set(prev);
      if (next.has(system)) next.delete(system);
      else next.add(system);
      localStorage.setItem(StorageKeys.ENABLED_SYSTEMS, JSON.stringify(Array.from(next)));
      window.dispatchEvent(new CustomEvent('panceai_enabled_systems_changed'));
      return next;
    });
  }, []);

  const isClinicalStudent =
    careerStage === 'student' && userProfile?.yearInProgram === 'Clinical Year';
  const currentRotation = userProfile?.currentRotation;
  const eorTestDate = userProfile?.eorTestDate;

  const handleRotationChange = useCallback((rotation: ClinicalRotation) => {
    updateProfile({ currentRotation: rotation });
    setUserProfile((prev) => ({ ...prev, currentRotation: rotation }));
    const systems = getSystemsForRotation(rotation);
    setEnabledSystems(new Set(systems));
    localStorage.setItem(StorageKeys.ENABLED_SYSTEMS, JSON.stringify(systems));
    window.dispatchEvent(new CustomEvent('panceai_enabled_systems_changed'));
    // Persist for question service Clinical 60/40 (60% rotation / 40% background)
    localStorage.setItem(StorageKeys.CURRENT_ROTATION, rotation);
    localStorage.setItem(StorageKeys.YEAR_IN_PROGRAM, 'Clinical Year');
  }, []);

  const handleEorTestDateChange = useCallback((date: string) => {
    // EOR/rotation dates persisted via updateProfile (API) when signed in; server is source of truth
    updateProfile({ eorTestDate: date || undefined });
    setUserProfile((prev) => ({ ...prev, eorTestDate: date || undefined }));
  }, []);



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

  // For Didactic users: sub-label showing enabled systems (e.g. "Testing: CV, PULM, GI Only")
  const enabledSystemsLabel = useMemo(() => {
    if (careerStage !== 'student') return null;
    const all = Object.keys(ABBREVIATION_TO_TOPIC_MAP) as SystemCode[];
    const enabled = all.filter((s) => enabledSystems.has(s));
    if (enabled.length === 0 || enabled.length === all.length) return null;
    return `Testing: ${enabled.slice(0, 5).join(', ')}${enabled.length > 5 ? '…' : ''} Only`;
  }, [careerStage, enabledSystems]);

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
  // NOTE: opacity removed from initial — Framer Motion animations can stall (especially
  // in dev/StrictMode), leaving sections invisible. y-transform alone gives a smooth entrance.
  const sectionEnter = prefersReducedMotion ? false : { y: 16 };
  const sectionAnimate = prefersReducedMotion ? false : { y: 0 };
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

      <div ref={pullToRefreshRef} className="mx-auto" style={{ maxWidth: 'var(--content-max-width, 72rem)' }}>
        {/* Refresh indicator */}
        {isRefreshing && (
          <motion.div
            initial={{ y: -20 }}
            animate={{ y: 0 }}
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

        {/* Sync Error Banner — show user-friendly message, hide raw HTTP codes */}
        {syncError && dismissedSyncError !== syncError && (
          <motion.div
            initial={{ y: -20 }}
            animate={{ y: 0 }}
            exit={{ y: -20 }}
            className="mb-4 flex items-start gap-3 p-4 rounded-lg border border-data-provisional/50 bg-data-provisional/10"
          >
            <AlertCircle className="w-5 h-5 flex-shrink-0 text-data-provisional mt-0.5" />
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-1">
                Unable to sync
              </h3>
              <p className="text-sm text-[var(--color-text-secondary)]">
                {syncError.includes('Authentication')
                  ? syncError
                  : 'Your progress is saved locally and will sync when the connection is restored.'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setDismissedSyncError(syncError)}
              className="flex-shrink-0 p-1 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors rounded-md hover:bg-[var(--color-bg-tertiary)]"
              aria-label="Dismiss error"
            >
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}

        {/* Header with Status Chips */}
        <motion.div
          initial={sectionEnter}
          animate={sectionAnimate}
          transition={sectionTransition(0)}
          className="mb-6"
        >
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-[var(--color-text-primary)] truncate max-w-full">
            {greeting}, {user?.firstName || 'Student'}
          </h1>

          {/* Status chips row */}
          <div className="flex flex-wrap gap-2 mt-3">
            {/* Due Count Chip */}
            {(propDueCount ?? 0) > 0 && (
              <button
                type="button"
                onClick={onNavigateToSrsReview}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-data-fail/10 border border-data-fail/30 text-sm font-medium hover:bg-data-fail/20 transition-colors cursor-pointer"
                title="Open Due Review — variant PANCE questions"
              >
                <span className="text-data-fail">{propDueCount}</span>
                <span className="text-[var(--color-text-secondary)]">due</span>
              </button>
            )}

            {/* Flagged Count Chip */}
            {flaggedQuestions.length > 0 && (
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-data-provisional/10 border border-data-provisional/30 text-sm font-medium">
                <span className="text-data-provisional">{flaggedQuestions.length}</span>
                <span className="text-[var(--color-text-secondary)]">flagged</span>
              </div>
            )}

            {/* Growth Areas Chips */}
            {growthAreas.length > 0 && (
              <>
                <span className="text-[var(--color-text-muted)] text-sm font-medium">Focus on:</span>
                {growthAreas.slice(0, 3).map((area) => (
                  <div
                    key={area}
                    className="inline-flex items-center px-3 py-1.5 rounded-full bg-[var(--color-accent)]/10 border border-[var(--color-accent)]/30 text-sm font-medium text-[var(--color-accent)]"
                  >
                    {area}
                  </div>
                ))}
              </>
            )}
          </div>

          <p className="text-[var(--color-text-muted)] mt-3">
            Ready to advance your clinical knowledge?
          </p>
        </motion.div>

        {/* Getting started — first actions after onboarding when little or no activity */}
        {userProfile?.hasCompletedOnboarding &&
          performanceData.length < 5 &&
          !hasActiveSession && (
            <motion.div
              initial={sectionEnter}
              animate={sectionAnimate}
              transition={sectionTransition(0)}
              className="mb-6"
            >
              <div className="rounded-2xl border border-[var(--color-accent)]/30 bg-[var(--color-accent)]/5 p-4 md:p-5 shadow-sm">
                <h2 className="text-lg font-semibold text-[var(--color-text-primary)] flex items-center gap-2 mb-2">
                  <Sparkles className="w-5 h-5 text-[var(--color-accent)]" aria-hidden />
                  Getting started
                </h2>
                <p className="text-sm text-[var(--color-text-muted)] mb-4">
                  Start your first practice session or try today&apos;s daily challenge.
                </p>
                <div className="flex flex-wrap gap-3">
                  {onNavigateToSimulation && (
                    <button
                      type="button"
                      onClick={() => onNavigateToSimulation()}
                      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium bg-[var(--color-accent)] text-[var(--color-btn-primary-text)] hover:opacity-90 min-h-[44px]"
                    >
                      <Play className="w-4 h-4" aria-hidden />
                      Start practice session
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => onNavigateToDrillMode('grand_rounds')}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium border border-[var(--color-border)] bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] hover:bg-[var(--color-bg-secondary)] min-h-[44px]"
                  >
                    <Trophy className="w-4 h-4" aria-hidden />
                    Try today&apos;s Grand Rounds
                  </button>
                  <button
                    type="button"
                    onClick={onNavigateToToolkit}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium border border-[var(--color-border)] bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] hover:bg-[var(--color-bg-secondary)] min-h-[44px]"
                  >
                    <Calculator className="w-4 h-4" aria-hidden />
                    Explore the Toolkit
                  </button>
                </div>
              </div>
            </motion.div>
          )}

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

        {/* Daily Challenge Card - Grand Rounds once-daily challenge */}
        {!hasActiveSession && (
          <motion.div
            initial={sectionEnter}
            animate={sectionAnimate}
            transition={sectionTransition(0)}
            className="mb-6"
          >
            <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-4 md:p-5 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <h2 className="text-lg font-semibold text-[var(--color-text-primary)] flex items-center gap-2">
                      <Trophy className="w-5 h-5 text-[var(--color-accent)]" aria-hidden />
                      Daily Challenge
                    </h2>
                    {performanceData.length > 0 && performanceData[performanceData.length - 1].timestamp >= Date.now() - 86400000 && (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-data-success/20 text-data-success">
                        Completed today
                      </span>
                    )}
                  </div>
                  <p className="text-[var(--color-text-secondary)] text-sm">
                    Try today&apos;s Grand Rounds challenge to expand your clinical knowledge.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onNavigateToDrillMode('grand_rounds')}
                  className="shrink-0 flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-semibold bg-[var(--color-accent)] text-[var(--color-text-inverse)] hover:opacity-90 transition-opacity focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg-primary)] min-h-[44px]"
                >
                  <Play className="w-4 h-4" aria-hidden />
                  {performanceData.length > 0 && performanceData[performanceData.length - 1].timestamp >= Date.now() - 86400000 ? 'View Results' : 'Start Challenge'}
                </button>
              </div>
            </div>
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
                  className="shrink-0 flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-semibold bg-[var(--color-accent)] text-[var(--color-text-inverse)] hover:opacity-90 transition-opacity focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg-primary)] min-h-[44px]"
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
                <div
                  className={`eor-accent ${userProfile?.graduationDate ? '' : 'lg:col-span-2'}`}
                >
                  <EorCountdownCard examDate={eorTestDate} rotation={currentRotation} />
                </div>
              )}
              <div>
                <TimeBoxButtons onStartSession={onStartSession} />
              </div>
            </motion.div>
          )}

        {/* Time-Box Buttons only (for users who didn't get them in the countdown section above) */}
        {!(careerStage === 'student' &&
          (userProfile?.graduationDate ||
            (eorTestDate && currentRotation && isEorRotation(currentRotation)))) && (
          <motion.div
            initial={sectionEnter}
            animate={sectionAnimate}
            transition={sectionTransition(0)}
            className="mb-6"
          >
            <TimeBoxButtons onStartSession={onStartSession} />
          </motion.div>
        )}



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

        {/* Dynamic Study Path Optimizer - Section 2 (delay 100ms) */}
        <motion.div
          initial={sectionEnter}
          animate={sectionAnimate}
          transition={sectionTransition(0.1)}
        >
          <div className="mb-6 p-5 rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-[var(--color-accent)]/10">
                  <TrendingUp className="w-6 h-6 text-[var(--color-accent)]" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-[var(--color-text-primary)]">
                    Dynamic Study Path Optimizer
                  </h3>
                  <p className="text-sm text-[var(--color-text-muted)]">
                    AI‑powered study planner that adapts to your progress, fatigue, and exam timeline.
                    View, accept, or regenerate personalized study plans.
                  </p>
                </div>
              </div>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={onNavigateToStudyPathDashboard}
                className="flex items-center gap-2 px-4 py-2 bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] hover:bg-[var(--color-accent)] active:bg-[var(--color-accent)]/80 font-medium rounded-lg transition-colors"
              >
                Open Dashboard
                <ChevronRight className="w-4 h-4" />
              </motion.button>
            </div>
          </div>
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
            initial={{ y: 4 }}
            animate={{ y: 0 }}
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
                  value={
                    eorTestDate
                      ? eorTestDate.includes('T')
                        ? eorTestDate.split('T')[0]
                        : eorTestDate
                      : ''
                  }
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
                        StorageKeys.ENABLED_SYSTEMS,
                        JSON.stringify(Array.from(all))
                      );
                      window.dispatchEvent(new CustomEvent('panceai_enabled_systems_changed'));
                    }}
                    className="px-3 py-1.5 text-xs font-medium bg-[var(--color-bg-primary)] hover:bg-[var(--color-border)] text-[var(--color-text-primary)] rounded-lg min-h-[44px]"
                  >
                    Enable All
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEnabledSystems(new Set());
                      localStorage.setItem(StorageKeys.ENABLED_SYSTEMS, JSON.stringify([]));
                      window.dispatchEvent(new CustomEvent('panceai_enabled_systems_changed'));
                    }}
                    className="px-3 py-1.5 text-xs font-medium bg-[var(--color-bg-primary)] hover:bg-[var(--color-border)] text-[var(--color-text-primary)] rounded-lg min-h-[44px]"
                  >
                    Disable All
                  </button>
                  {onOpenSettings && (
                    <button
                      type="button"
                      onClick={onOpenSettings}
                      title="More options"
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-[var(--color-bg-primary)] hover:bg-[var(--color-border)] text-[var(--color-text-primary)] rounded-lg min-h-[44px]"
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



        {/* PANRE-LA (Only for practicing PAs) */}
        {showPANREContent && (
          <motion.div
            initial={{ y: 20 }}
            animate={{ y: 0 }}
            className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[var(--color-category-simulation)]/10 to-[var(--color-category-simulation)]/10 border border-[var(--color-category-simulation)]/30 p-5 mb-6"
          >
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-[var(--color-category-simulation)]/20">
                  <GraduationCap className="w-6 h-6 text-[var(--color-category-simulation)]" />
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
                className="flex items-center gap-2 px-4 py-2 bg-[var(--color-category-simulation)] hover:brightness-90 text-[var(--color-text-inverse)] font-medium rounded-lg transition-colors"
              >
                Start Practice
                <ChevronRight className="w-4 h-4" />
              </motion.button>
            </div>
          </motion.div>
        )}
      </div>
    </>
  );
};

export default CommandCenterHub;
