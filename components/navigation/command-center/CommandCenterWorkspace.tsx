import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '@clerk/clerk-react';
import {
  AlertCircle,
  BarChart3,
  BookOpen,
  Brain,
  Calculator,
  ChevronRight,
  Compass,
  Flame,
  FolderOpen,
  GraduationCap,
  Library,
  MessageSquare,
  Play,
  Sparkles,
  Stethoscope,
  Target,
  TrendingUp,
  Wand2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { RecommendationFeed } from '@/components/dashboard/RecommendationFeed';
import { CurriculumGrid } from '@/components/dashboard/CurriculumGrid';
import { WelcomeBackCard } from '@/components/dashboard/WelcomeBackCard';
import { ExamCountdownCard } from '@/components/dashboard/ExamCountdownCard';
import { EorCountdownCard } from '@/components/dashboard/EorCountdownCard';
import { TimeBoxButtons } from '@/components/dashboard/TimeBoxButtons';
import { RotationSelector } from '@/components/onboarding/RotationSelector';
import {
  WorkspaceHeroStrip,
  WorkspaceMetricCard,
  WorkspacePage,
  WorkspacePageHeader,
  WorkspaceReveal,
  WorkspaceSection,
  WorkspaceSplit,
  WorkspaceSurface,
} from '@/components/workspace';
import { useRolling360Stats } from '@/hooks/useRolling360Stats';
import { useUnifiedStats } from '@/hooks/useUnifiedStats';
import { useUserContext } from '@/hooks/useUserContext';
import { useUserProfile } from '@/hooks/useUserProfile';
import { useUserStats } from '@/hooks/useUserStats';
import { getLastSession, clearLastSession, type LastSessionData } from '@/lib/utils/sessionStorage';
import { loadUserProfile } from '@/services/analytics';
import { StorageKeys } from '@/lib/storage/storageRegistry';
import { calculateDayStreak } from '@/lib/dashboardUtils';
import { ABBREVIATION_TO_TOPIC_MAP } from '@/config/topic-map';
import {
  DEFAULT_SYSTEM_PROGRESS_TOTAL,
  getSystemsForRotation,
  isEorRotation,
} from '@/config/rotation-systems';
import { ROUTES } from '@/config/routes';
import { TO_REVIEW_LABEL } from '@/config/labels';
import type { ClinicalRotation, UserProfile, YearInProgram } from '@/types';
import type { PerformanceRecord, Question, SessionSettings, SystemCode } from '@/types';

export interface CommandCenterHubProps {
  performanceData: PerformanceRecord[];
  missedQuestions: Question[];
  flaggedQuestions: Question[];
  growthAreas: string[];
  dueCount?: number;
  examLabel?: string;
  isLoadingStats?: boolean;
  onStartSession: (settings?: SessionSettings) => void;
  onNavigateToDrillMode: (modeId: string) => void;
  onNavigateToDrillWithSystem?: (modeId: string, system: string) => void;
  onNavigateToToolkit: () => void;
  onNavigateToGapAnalysis: () => void;
  onNavigateToClinicalProfile?: () => void;
  onNavigateToIntegrations?: () => void;
  onNavigateToSimulation?: (settings?: {
    initialFocus?: 'all' | 'growth' | 'flagged' | 'due';
  }) => void;
  onNavigateToReference?: () => void;
  onNavigateToMyLibrary?: () => void;
  onNavigateToStudyCompanion?: () => void;
  onNavigateToSrsReview?: () => void;
  onNavigateToCustomStudy?: () => void;
  onNavigateToStudyPathDashboard?: () => void;
  onNavigateToPearlDeck?: () => void;
  onNavigateToClinicalEye?: () => void;
  onNavigateToVisualizer?: () => void;
  onOpenSettings?: () => void;
  onNavigateToTutorChat?: () => void;
  hasActiveSession?: boolean;
  resumeContext?: { current: number; total: number; remaining: number };
  onResumeSession?: () => void;
  initialStudyToolsTab?: 'training' | 'resources' | 'analytics';
}

function QuickLaunchCard({
  title,
  description,
  icon: Icon,
  accent,
  onClick,
  cta,
}: {
  title: string;
  description: string;
  icon: typeof Brain;
  accent: string;
  onClick: () => void;
  cta: string;
}) {
  return (
    <button type="button" onClick={onClick} className="h-full w-full text-left">
      <WorkspaceSurface
        accent={accent}
        role="action"
        className="h-full transition-transform duration-300 hover:translate-y-[-2px]"
      >
        <div className="flex h-full flex-col gap-4">
          <div
            className="flex h-11 w-11 items-center justify-center rounded-2xl border"
            style={{
              background: `color-mix(in srgb, ${accent} 14%, var(--color-bg-secondary))`,
              borderColor: 'color-mix(in srgb, var(--color-text-primary) 8%, transparent)',
            }}
          >
            <Icon className="h-5 w-5" style={{ color: accent }} aria-hidden="true" />
          </div>
          <div className="space-y-2">
            <h3 className="text-[1.05rem] font-semibold tracking-[-0.03em] text-[var(--color-text-primary)]">
              {title}
            </h3>
            <p className="text-sm leading-6 text-[var(--color-text-secondary)]">{description}</p>
          </div>
          <div className="mt-auto inline-flex items-center gap-2 text-sm font-medium" style={{ color: accent }}>
            {cta}
            <ChevronRight className="h-4 w-4" />
          </div>
        </div>
      </WorkspaceSurface>
    </button>
  );
}

export const CommandCenterWorkspace: React.FC<CommandCenterHubProps> = ({
  performanceData,
  missedQuestions,
  flaggedQuestions,
  growthAreas,
  dueCount: propDueCount,
  examLabel = 'PANCE',
  onStartSession,
  onNavigateToDrillMode,
  onNavigateToDrillWithSystem,
  onNavigateToToolkit,
  onNavigateToGapAnalysis,
  onNavigateToClinicalProfile,
  onNavigateToSimulation,
  onNavigateToReference,
  onNavigateToMyLibrary,
  onNavigateToStudyCompanion,
  onNavigateToSrsReview,
  onNavigateToCustomStudy,
  onNavigateToStudyPathDashboard,
  onNavigateToPearlDeck,
  onNavigateToClinicalEye,
  onNavigateToVisualizer,
  onOpenSettings,
  onNavigateToTutorChat,
  hasActiveSession = false,
  resumeContext,
  onResumeSession,
}) => {
  const navigate = useNavigate();
  const { user } = useUser();
  const { showPANREContent, careerStage } = useUserContext();
  const { stats: rolling360Stats } = useRolling360Stats();
  const { stats: unifiedStats, isLoading: unifiedStatsLoading } = useUnifiedStats();
  const { syncError } = useUserStats();
  const { profile: apiProfile, updateProfile } = useUserProfile();

  const [userProfile, setUserProfile] = useState<UserProfile>(
    () => loadUserProfile() || { hasCompletedOnboarding: false }
  );
  const [lastSession] = useState<LastSessionData | null>(() => getLastSession());
  const [showWelcomeBack, setShowWelcomeBack] = useState(() => getLastSession() !== null);
  const [dismissedSyncError, setDismissedSyncError] = useState<string | null>(null);

  useEffect(() => {
    if (!apiProfile) return;
    setUserProfile((previous) => ({
      ...previous,
      graduationDate: apiProfile.graduationDate ?? previous?.graduationDate,
      eorTestDate: apiProfile.eorTestDate ?? previous?.eorTestDate,
      rotationStartDate: apiProfile.rotationStartDate ?? previous?.rotationStartDate,
      rotationEndDate: apiProfile.rotationEndDate ?? previous?.rotationEndDate,
      specialty: apiProfile.specialty ?? previous?.specialty,
      currentRotation:
        (apiProfile.currentRotation as ClinicalRotation | null | undefined) ?? previous?.currentRotation,
      yearInProgram:
        (apiProfile.yearInProgram as YearInProgram | null | undefined) ?? previous?.yearInProgram,
    }));
  }, [
    apiProfile?.currentRotation,
    apiProfile?.eorTestDate,
    apiProfile?.graduationDate,
    apiProfile?.rotationEndDate,
    apiProfile?.rotationStartDate,
    apiProfile?.specialty,
    apiProfile?.yearInProgram,
  ]);

  useEffect(() => {
    const sync = () => setUserProfile(loadUserProfile() || { hasCompletedOnboarding: false });
    sync();
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, []);

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
      if (!saved) return;
      try {
        setEnabledSystems(new Set(JSON.parse(saved) as SystemCode[]));
      } catch {
        /* ignore malformed storage */
      }
    };
    globalThis.addEventListener('panceai_enabled_systems_changed', handler);
    return () => globalThis.removeEventListener('panceai_enabled_systems_changed', handler);
  }, []);

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
    setEnabledSystems((previous) => {
      const next = new Set(previous);
      if (next.has(system)) next.delete(system);
      else next.add(system);
      localStorage.setItem(StorageKeys.ENABLED_SYSTEMS, JSON.stringify(Array.from(next)));
      window.dispatchEvent(new CustomEvent('panceai_enabled_systems_changed'));
      return next;
    });
  }, []);

  const stats = useMemo(() => {
    if (unifiedStats && !unifiedStatsLoading) {
      const globalAccuracy = unifiedStats.accuracy.global;
      return {
        streak: unifiedStats.recentActivity.streakDays,
        dueCount: unifiedStats.questionCounts.dueForReview,
        accuracy: globalAccuracy !== null ? Math.round(globalAccuracy * 100) : null,
        questionsToday: unifiedStats.questionCounts.today,
      };
    }

    const recent = performanceData.slice(-100);
    const correct = recent.filter((record) => record.isCorrect).length;
    const accuracy =
      recent.length > 0 ? Math.round((correct / recent.length) * 100) : (null as number | null);
    const todayRecords = performanceData.filter((record) => {
      if (!record?.timestamp) return false;
      const date = new Date(record.timestamp);
      const today = new Date();
      return (
        date.getDate() === today.getDate() &&
        date.getMonth() === today.getMonth() &&
        date.getFullYear() === today.getFullYear()
      );
    });

    return {
      streak: calculateDayStreak(performanceData).current,
      dueCount:
        propDueCount ?? (flaggedQuestions?.length || 0) + (missedQuestions?.length || 0),
      accuracy,
      questionsToday: todayRecords.length,
    };
  }, [
    flaggedQuestions?.length,
    missedQuestions?.length,
    performanceData,
    propDueCount,
    unifiedStats,
    unifiedStatsLoading,
  ]);

  const dueCount = stats.dueCount;
  const weakestSystems = rolling360Stats?.weakestSystems ?? [];
  const weakestSystem = weakestSystems[0] ?? null;
  const currentRotation = userProfile?.currentRotation;
  const eorTestDate = userProfile?.eorTestDate;
  const isClinicalStudent =
    careerStage === 'student' && userProfile?.yearInProgram === 'Clinical Year';

  const curriculumProgressPercent = useMemo(() => {
    if (!rolling360Stats) return 0;
    const totalSystems = Object.keys(ABBREVIATION_TO_TOPIC_MAP).length;
    const systemsWithGoodMastery = Object.values(rolling360Stats.systemStats || {}).filter(
      (stat) => stat.accuracy >= 0.7 && stat.total >= 5
    ).length;
    return Math.round((systemsWithGoodMastery / totalSystems) * 100);
  }, [rolling360Stats]);

  const curriculumProgressData = useMemo(() => {
    const systems = rolling360Stats?.systemStats;
    if (!systems) return undefined;
    return Object.fromEntries(
      Object.entries(systems).map(([key, value]) => [key, Math.round(value.accuracy)])
    ) as Record<string, number>;
  }, [rolling360Stats?.systemStats]);

  const enabledSystemsLabel = useMemo(() => {
    if (careerStage !== 'student') return null;
    const all = Object.keys(ABBREVIATION_TO_TOPIC_MAP) as SystemCode[];
    const enabled = all.filter((system) => enabledSystems.has(system));
    if (enabled.length === 0 || enabled.length === all.length) return null;
    return `Current focus: ${enabled.slice(0, 5).join(', ')}${enabled.length > 5 ? '…' : ''}`;
  }, [careerStage, enabledSystems]);

  const handleRotationChange = useCallback(
    (rotation: ClinicalRotation) => {
      void updateProfile({ currentRotation: rotation });
      setUserProfile((previous) => ({ ...previous, currentRotation: rotation }));
      const systems = getSystemsForRotation(rotation);
      setEnabledSystems(new Set(systems));
      localStorage.setItem(StorageKeys.ENABLED_SYSTEMS, JSON.stringify(systems));
      window.dispatchEvent(new CustomEvent('panceai_enabled_systems_changed'));
      localStorage.setItem(StorageKeys.CURRENT_ROTATION, rotation);
      localStorage.setItem(StorageKeys.YEAR_IN_PROGRAM, 'Clinical Year');
    },
    [updateProfile]
  );

  const handleEorTestDateChange = useCallback(
    (date: string) => {
      void updateProfile({ eorTestDate: date || undefined });
      setUserProfile((previous) => ({ ...previous, eorTestDate: date || undefined }));
    },
    [updateProfile]
  );

  const handleResumeLastSession = useCallback(() => {
    if (!lastSession) return;
    clearLastSession();
    setShowWelcomeBack(false);
    onStartSession(lastSession.settings);
  }, [lastSession, onStartSession]);

  const handleNavigateToRecommendation = useCallback(
    (modeId: string, settings?: SessionSettings) => {
      if (modeId === 'core_adaptive' || modeId === 'custom_practice') {
        onStartSession(settings);
        return;
      }
      onNavigateToDrillMode(modeId);
    },
    [onNavigateToDrillMode, onStartSession]
  );

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  }, []);

  const primaryLaunch = () => {
    if (hasActiveSession && onResumeSession) {
      onResumeSession();
      return;
    }
    if (dueCount > 0 && onNavigateToSrsReview) {
      onNavigateToSrsReview();
      return;
    }
    if (onNavigateToSimulation) {
      onNavigateToSimulation();
      return;
    }
    onStartSession({ focus: 'all' });
  };

  const topFocusAreas = growthAreas.filter(Boolean).slice(0, 2);
  const heroTitle =
    hasActiveSession && onResumeSession
      ? 'Resume the session already in motion.'
      : dueCount > 0
        ? 'Clear what is already due before opening something new.'
        : 'Start one focused block, then let the rest wait.';
  const heroDescription =
    hasActiveSession && onResumeSession
      ? 'You already have momentum. Finish the in-progress session before switching contexts or opening another study lane.'
      : dueCount > 0
        ? 'Review has the highest payoff right now. Once the queue is under control, use adaptive practice or a short fallback route for new work.'
        : 'Nothing urgent is competing for attention. Use adaptive questions for the main block, or take the faster practice route if you only have a few minutes.';
  const decisionSupportCopy =
    dueCount > 0
      ? `Due review is the best next move. ${weakestSystem ? `${weakestSystem} is still the weakest signal once the queue is clear.` : 'Use practice afterward if you still have time.'}`
      : stats.questionsToday === 0
        ? 'If today has not started yet, use a short practice block to establish a real targeting signal before browsing deeper tools.'
        : weakestSystem
          ? `${weakestSystem} is the weakest recent signal. Use a shorter block when you need a targeted reset instead of a full session.`
          : 'Choose the block length that matches your available time and leave the secondary routes below the fold.';

  return (
    <WorkspacePage density="wide" mode="launch">
      {syncError && dismissedSyncError !== syncError ? (
        <WorkspaceReveal>
          <WorkspaceSurface accent="#a67f7f">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-2xl border border-[var(--color-data-provisional)]/25 bg-[var(--color-data-provisional)]/10">
                  <AlertCircle className="h-4 w-4 text-[var(--color-data-provisional)]" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-[var(--color-text-primary)]">
                    Sync paused
                  </h2>
                  <p className="mt-1 text-sm leading-6 text-[var(--color-text-secondary)]">
                    {syncError.includes('Authentication')
                      ? syncError
                      : 'Progress is still stored locally and will sync once the connection is stable again.'}
                  </p>
                </div>
              </div>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => setDismissedSyncError(syncError)}
              >
                Dismiss
              </Button>
            </div>
          </WorkspaceSurface>
        </WorkspaceReveal>
      ) : null}

      <WorkspaceReveal delay={0.02}>
        <WorkspacePageHeader
          meta={{
            badge: 'Study Command',
            badgeTone: 'gold',
            title: `${greeting}, ${user?.firstName || 'Student'}.`,
            subtitle:
              'Start the right next block, clear due work first, and keep the rest of the surface quiet until you need it.',
            status:
              dueCount > 0
                ? `${dueCount} item${dueCount === 1 ? '' : 's'} ready for review`
                : 'Nothing due right now',
            actionPosition: 'under-title',
            primaryAction: {
              label:
                hasActiveSession && onResumeSession
                  ? 'Resume session'
                  : dueCount > 0 && onNavigateToSrsReview
                    ? 'Start due review'
                    : 'Launch adaptive session',
              onClick: primaryLaunch,
            },
            secondaryActions: [
              {
                label: 'Open practice',
                onClick: () => navigate(ROUTES.PRACTICE),
              },
            ],
          }}
        />
      </WorkspaceReveal>

      {!hasActiveSession && showWelcomeBack && lastSession ? (
        <WorkspaceReveal delay={0.04}>
          <WelcomeBackCard
            lastSession={lastSession}
            onResume={handleResumeLastSession}
            onDismiss={() => {
              setShowWelcomeBack(false);
              clearLastSession();
            }}
          />
        </WorkspaceReveal>
      ) : null}

      {hasActiveSession && onResumeSession ? (
        <WorkspaceReveal delay={0.06}>
          <WorkspaceSurface accent="#c4b78a">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-[var(--color-accent)]">
                  Continue learning
                </p>
                <h2 className="mt-2 text-xl font-semibold text-[var(--color-text-primary)]">
                  Your last session is still in progress.
                </h2>
                <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                  {resumeContext?.remaining != null
                    ? `Resume question ${resumeContext.current} with ${resumeContext.remaining} remaining.`
                    : 'Jump back into the in-progress session from where you left off.'}
                </p>
              </div>
              <Button type="button" size="sm" variant="primary" onClick={onResumeSession}>
                <Play className="h-4 w-4" />
                Resume now
              </Button>
            </div>
          </WorkspaceSurface>
        </WorkspaceReveal>
      ) : null}

      <WorkspaceReveal delay={0.08}>
        <div className="grid gap-4 md:grid-cols-2">
          <WorkspaceMetricCard
            label={careerStage === 'practicing' ? 'Maintenance due' : TO_REVIEW_LABEL}
            value={dueCount}
            detail={
              dueCount > 0
                ? 'Clear this queue first so recall pressure stops compounding.'
                : 'No review debt is waiting right now. Start a fresh block instead.'
            }
            icon={Target}
            variant={dueCount > 0 ? 'alert' : 'guidance'}
            action={
              dueCount > 0 && onNavigateToSrsReview ? (
                <Button type="button" size="sm" variant="outline" onClick={onNavigateToSrsReview}>
                  Open review
                </Button>
              ) : undefined
            }
          />
          <WorkspaceMetricCard
            label="Momentum today"
            value={stats.questionsToday > 0 ? `${stats.questionsToday} answered` : 'Baseline not set'}
            detail={
              stats.questionsToday > 0
                ? `Recent accuracy ${stats.accuracy !== null ? `${stats.accuracy}%` : 'is still calibrating'}${stats.streak > 0 ? ` and ${stats.streak} study day${stats.streak === 1 ? '' : 's'} active.` : '.'}`
                : 'Answer 5 to 10 questions to create a real targeting signal for the next block.'
            }
            accent={stats.questionsToday > 0 ? '#728ba6' : '#9a7f9a'}
            icon={stats.questionsToday > 0 ? BarChart3 : Sparkles}
            variant={stats.questionsToday > 0 ? 'progress' : 'guidance'}
            action={
              stats.questionsToday === 0 ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => navigate(ROUTES.PRACTICE)}
                >
                  Open practice
                </Button>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => navigate(ROUTES.PROGRESS)}
                >
                  View progress
                </Button>
              )
            }
          />
        </div>
      </WorkspaceReveal>

      <WorkspaceReveal delay={0.12}>
        <WorkspaceHeroStrip tone="launch">
          <WorkspaceSplit className="items-start xl:grid-cols-[1.18fr_0.82fr]">
            <div className="space-y-5">
              <div className="space-y-3">
                <p className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-[var(--color-accent)]">
                  Next move
                </p>
                <h2 className="max-w-2xl text-3xl font-semibold tracking-[-0.045em] text-[var(--color-text-primary)] sm:text-4xl">
                  {heroTitle}
                </h2>
                <p className="max-w-2xl text-sm leading-7 text-[var(--color-text-secondary)] sm:text-base">
                  {heroDescription}
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div
                  className="rounded-[1.35rem] border p-4"
                  style={{
                    borderColor: 'color-mix(in srgb, var(--color-text-primary) 8%, transparent)',
                    background:
                      'color-mix(in srgb, var(--color-bg-secondary) 78%, var(--color-bg-primary) 22%)',
                  }}
                >
                  <p className="text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">
                    Why now
                  </p>
                  <p className="mt-2 text-sm leading-6 text-[var(--color-text-secondary)]">
                    {dueCount > 0
                      ? 'The review queue has the highest priority.'
                      : stats.questionsToday === 0
                        ? 'Today has no real baseline yet.'
                        : 'You have room for one focused study block.'}
                  </p>
                </div>
                <div
                  className="rounded-[1.35rem] border p-4"
                  style={{
                    borderColor: 'color-mix(in srgb, var(--color-text-primary) 8%, transparent)',
                    background:
                      'color-mix(in srgb, var(--color-bg-secondary) 78%, var(--color-bg-primary) 22%)',
                  }}
                >
                  <p className="text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">
                    Focus
                  </p>
                  <p className="mt-2 text-sm leading-6 text-[var(--color-text-secondary)]">
                    {topFocusAreas.length > 0
                      ? topFocusAreas.join(' • ')
                      : weakestSystem
                        ? `${weakestSystem} is the weakest recent signal.`
                        : 'No narrow weak-signal focus is established yet.'}
                  </p>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <QuickLaunchCard
                  title={dueCount > 0 ? 'Clear due review' : 'Launch adaptive questions'}
                  description={
                    dueCount > 0
                      ? 'Protect recall first, then return to new material once the queue is stable.'
                      : 'Run a mixed session tuned to current readiness and recall pressure.'
                  }
                  icon={dueCount > 0 ? Target : Brain}
                  accent="#c4b78a"
                  onClick={() => {
                    if (dueCount > 0 && onNavigateToSrsReview) {
                      onNavigateToSrsReview();
                      return;
                    }
                    if (onNavigateToSimulation) {
                      onNavigateToSimulation();
                      return;
                    }
                    onStartSession({ focus: 'all' });
                  }}
                  cta={dueCount > 0 ? 'Start review' : 'Start session'}
                />
                <QuickLaunchCard
                  title="Fallback practice route"
                  description={
                    stats.questionsToday === 0
                      ? 'Use the practice library to create a baseline quickly when today has not started yet.'
                      : 'Open practice mode when you want a searchable, shorter route instead of another dashboard pass.'
                  }
                  icon={stats.questionsToday === 0 ? Sparkles : Compass}
                  accent="#728ba6"
                  onClick={() => navigate(ROUTES.PRACTICE)}
                  cta="Open practice"
                />
              </div>
            </div>

            <div className="space-y-4">
              <WorkspaceSurface accent="#728ba6" role="reference">
                <div className="space-y-4">
                  <div>
                    <p className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-[var(--color-accent-secondary)]">
                      Decision support
                    </p>
                    <h3 className="mt-2 text-xl font-semibold text-[var(--color-text-primary)]">
                      Choose by time, not by guilt.
                    </h3>
                    <p className="mt-2 text-sm leading-6 text-[var(--color-text-secondary)]">
                      {decisionSupportCopy}
                    </p>
                  </div>
                  <TimeBoxButtons onStartSession={onStartSession} />
                </div>
              </WorkspaceSurface>

              {userProfile?.graduationDate ? (
                <ExamCountdownCard
                  examDate={userProfile.graduationDate}
                  curriculumPercent={curriculumProgressPercent}
                  questionsAnswered={performanceData.length}
                />
              ) : null}

              {eorTestDate && currentRotation && isEorRotation(currentRotation) ? (
                <EorCountdownCard examDate={eorTestDate} rotation={currentRotation} />
              ) : null}
            </div>
          </WorkspaceSplit>
        </WorkspaceHeroStrip>
      </WorkspaceReveal>

      <WorkspaceReveal delay={0.16}>
        <WorkspaceSection
          title="Recommended next"
          subtitle="Keep the high-signal recommendation in view so you can act without opening another analytics page."
        >
          <WorkspaceSurface accent="#c4b78a" role="action">
            <RecommendationFeed
              className="mb-0"
              onNavigateToDrill={handleNavigateToRecommendation}
            />
          </WorkspaceSurface>
        </WorkspaceSection>
      </WorkspaceReveal>

      <WorkspaceReveal delay={0.18}>
        <WorkspaceSection
          title="Companion tools"
          subtitle="Keep one reference route and a few supporting surfaces visible instead of a second full dashboard."
        >
          <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr_0.8fr]">
            <QuickLaunchCard
              title="Knowledge"
              description="Open reference content first when you need context, differentials, or drug anchors before another question block."
              icon={BookOpen}
              accent="#728ba6"
              onClick={() => (onNavigateToReference ? onNavigateToReference() : navigate(ROUTES.STUDY_KNOWLEDGE))}
              cta="Open knowledge"
            />
            <QuickLaunchCard
              title="Tools"
              description="Reach calculators and generators without leaving the same study surface."
              icon={Calculator}
              accent="#b39b6c"
              onClick={onNavigateToToolkit}
              cta="Open tools"
            />
            <QuickLaunchCard
              title="Tutor"
              description="Use profile-aware reasoning help when you need a challenge, not more browsing."
              icon={MessageSquare}
              accent="#9a7f9a"
              onClick={() => onNavigateToTutorChat?.()}
              cta="Open tutor"
            />
            <QuickLaunchCard
              title="My library"
              description="Ground study chat and reference work in your uploaded material."
              icon={Library}
              accent="#7a8f6e"
              onClick={() => onNavigateToMyLibrary?.()}
              cta="Manage library"
            />
            <QuickLaunchCard
              title="Study path"
              description="Review the adaptive plan when you want a longer horizon than today."
              icon={Compass}
              accent="#c4b78a"
              onClick={() => onNavigateToStudyPathDashboard?.()}
              cta="Open study path"
            />
          </div>
        </WorkspaceSection>
      </WorkspaceReveal>

      <WorkspaceReveal delay={0.2}>
        <WorkspaceSection
          title="Launch lanes"
          subtitle="Keep the main study routes visible so the home surface works as a command center rather than a static dashboard."
        >
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <QuickLaunchCard
              title="Due review"
              description="Run the variant review queue that protects forgetting curves first."
              icon={Target}
              accent="#c4b78a"
              onClick={() => onNavigateToSrsReview?.()}
              cta={dueCount > 0 ? `Review ${dueCount}` : 'Open queue'}
            />
            <QuickLaunchCard
              title="Grand Rounds"
              description="Drop into the daily challenge to stress-test reasoning outside your usual patterns."
              icon={Sparkles}
              accent="#9a7f9a"
              onClick={() => onNavigateToDrillMode('grand_rounds')}
              cta="Start challenge"
            />
            <QuickLaunchCard
              title="Gap analysis"
              description="See what is costing the most points and what should be repaired next."
              icon={TrendingUp}
              accent="#728ba6"
              onClick={onNavigateToGapAnalysis}
              cta="Open gaps"
            />
            <QuickLaunchCard
              title="Clinical profile"
              description="Inspect broader reasoning tendencies, timing patterns, and bias signals."
              icon={BarChart3}
              accent="#7a8f6e"
              onClick={() => onNavigateToClinicalProfile?.()}
              cta="Open profile"
            />
          </div>
        </WorkspaceSection>
      </WorkspaceReveal>

      {isClinicalStudent ? (
        <WorkspaceReveal delay={0.24}>
          <WorkspaceSection
            title="Clinical-year focus"
            subtitle="Preset the systems that matter for your current rotation and keep EOR timing visible in the same home workspace."
          >
            <WorkspaceSurface accent="#9a7f9a" className="space-y-6" role="reference">
              <div className="grid gap-6 lg:grid-cols-[0.7fr_1.3fr]">
                <WorkspaceSurface accent="#c4b78a" role="action" className="space-y-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-[var(--color-accent)]">
                        Rotation settings
                      </p>
                      <h3 className="mt-2 text-xl font-semibold text-[var(--color-text-primary)]">
                        Current curriculum focus
                      </h3>
                      <p className="mt-2 text-sm leading-6 text-[var(--color-text-secondary)]">
                        {enabledSystems.size === Object.keys(ABBREVIATION_TO_TOPIC_MAP).length
                          ? 'All systems are enabled right now.'
                          : enabledSystemsLabel ?? 'Choose a rotation to preset the systems that matter most right now.'}
                      </p>
                    </div>
                    {onOpenSettings ? (
                      <Button type="button" size="sm" variant="outline" onClick={onOpenSettings}>
                        More options
                      </Button>
                    ) : null}
                  </div>

                  <RotationSelector value={currentRotation} onChange={handleRotationChange} label="" />

                  {currentRotation && isEorRotation(currentRotation) ? (
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-[var(--color-text-primary)]">
                        EOR test date
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
                        onChange={(event) => handleEorTestDateChange(event.target.value)}
                        className="w-full max-w-xs rounded-2xl border px-4 py-3 text-sm text-[var(--color-text-primary)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
                        style={{
                          borderColor: 'color-mix(in srgb, var(--color-text-primary) 8%, transparent)',
                          background:
                            'color-mix(in srgb, var(--color-bg-secondary) 76%, var(--color-bg-primary) 24%)',
                        }}
                      />
                    </div>
                  ) : null}

                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        const all = new Set(Object.keys(ABBREVIATION_TO_TOPIC_MAP) as SystemCode[]);
                        setEnabledSystems(all);
                        localStorage.setItem(
                          StorageKeys.ENABLED_SYSTEMS,
                          JSON.stringify(Array.from(all))
                        );
                        window.dispatchEvent(new CustomEvent('panceai_enabled_systems_changed'));
                      }}
                    >
                      Enable all
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setEnabledSystems(new Set());
                        localStorage.setItem(StorageKeys.ENABLED_SYSTEMS, JSON.stringify([]));
                        window.dispatchEvent(new CustomEvent('panceai_enabled_systems_changed'));
                      }}
                    >
                      Disable all
                    </Button>
                  </div>
                </WorkspaceSurface>

                <div className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    <WorkspaceMetricCard
                      label="Mastery progress"
                      value={`${curriculumProgressPercent}%`}
                      detail="Systems with solid recent performance and enough volume."
                      accent="#c4b78a"
                      icon={Target}
                      variant="progress"
                    />
                    <WorkspaceMetricCard
                      label="Enabled systems"
                      value={enabledSystems.size}
                      detail="Systems currently included in the study pool."
                      accent="#728ba6"
                      icon={BookOpen}
                      variant="reference"
                    />
                    <WorkspaceMetricCard
                      label="Reference total"
                      value={DEFAULT_SYSTEM_PROGRESS_TOTAL}
                      detail="Baseline total used to normalize progress by system."
                      accent="#7a8f6e"
                      icon={GraduationCap}
                      variant="reference"
                    />
                  </div>
                  <WorkspaceSurface accent="#728ba6" role="reference" className="p-4">
                    <CurriculumGrid
                      selectedSystems={enabledSystems}
                      onSystemToggle={handleToggleSystem}
                      growthAreas={growthAreas}
                      progressData={curriculumProgressData}
                    />
                  </WorkspaceSurface>
                </div>
              </div>
            </WorkspaceSurface>
          </WorkspaceSection>
        </WorkspaceReveal>
      ) : null}

      {showPANREContent ? (
        <WorkspaceReveal delay={0.28}>
          <WorkspaceSection
            title="PANRE-LA"
            subtitle="Keep the longitudinal recertification format available directly from the main workspace."
          >
            <QuickLaunchCard
              title="PANRE-LA simulator"
              description="Practice in the longitudinal assessment format with a dedicated recertification workflow."
              icon={Wand2}
              accent="#9a7f9a"
              onClick={() => onNavigateToDrillMode('panre_la')}
              cta="Start practice"
            />
          </WorkspaceSection>
        </WorkspaceReveal>
      ) : null}

      <WorkspaceReveal delay={0.3}>
        <WorkspaceSection
          title="Specialized tools"
          subtitle="Keep less-frequent but valuable companion surfaces attached to the same home surface."
        >
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <QuickLaunchCard
              title="Custom study"
              description="Define a more intentional session when you need tighter control over the pool."
              icon={Brain}
              accent="#b39b6c"
              onClick={() => onNavigateToCustomStudy?.()}
              cta="Build session"
            />
            <QuickLaunchCard
              title="Pearl deck"
              description="Review saved pearls and rapid recall snippets without opening another navigation branch."
              icon={Sparkles}
              accent="#728ba6"
              onClick={() => onNavigateToPearlDeck?.()}
              cta="Open pearls"
            />
            <QuickLaunchCard
              title="Clinical Eye"
              description="Use the image-analysis companion for visual review and interpretation."
              icon={Target}
              accent="#7a8f6e"
              onClick={() => onNavigateToClinicalEye?.()}
              cta="Open Clinical Eye"
            />
            <QuickLaunchCard
              title="Visualizer"
              description="Jump into anatomy and image-oriented visual segmentation workflows."
              icon={Compass}
              accent="#9a7f9a"
              onClick={() => onNavigateToVisualizer?.()}
              cta="Open visualizer"
            />
          </div>
        </WorkspaceSection>
      </WorkspaceReveal>
    </WorkspacePage>
  );
};

export default CommandCenterWorkspace;
