import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useUser, useAuth } from '@clerk/clerk-react';
import useSWR from 'swr';
import { calculateDayStreak } from '@/lib/dashboardUtils';
import { useUserStats } from '@/hooks/useUserStats';
import {
  Brain,
  TrendingUp,
  Flame,
  ArrowRight,
  Sparkles,
  Clock,
  Zap,
  Target,
  BarChart3,
  LayoutDashboard,
  AlertTriangle,
  BookOpen,
  ChevronDown,
  ChevronUp,
  Stethoscope,
} from 'lucide-react';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import DecayCurve from './charts/DecayCurve';
import StabilityPyramid from './charts/StabilityPyramid';
import AlgorithmStatusWidget from './AlgorithmStatusWidget';
import { ClinicalSkeleton } from '@/components/loading';
import DailyTriad from './DailyTriad';
import { ExamReadinessCard, SystemPerformanceWidget } from './Rolling360';
import { CalibrationQuadrantWidget } from './CalibrationQuadrantWidget';
import CalibrationChart from './CalibrationChart';
import { RetentionForecastCard } from './RetentionForecastCard';
import { StudyActionList, type StudyAction } from './StudyActionCard';
import { BlueprintProgressBar } from './BlueprintProgressBar';
import { BlueprintGapHeatmap } from './BlueprintGapHeatmap';
import { useBlueprintGaps } from '@/hooks/useBlueprintGaps';
import { ConfusionPairCard } from './ConfusionPairCard';
import { useConfusionPairs } from '@/hooks/useConfusionPairs';
import { ReviewCalendar } from './ReviewCalendar';
import { useReviewForecast } from '@/hooks/useReviewForecast';
import { InfoTooltip } from '@/components/ui/InfoTooltip';
import { TOOLTIP_STABILITY, TOOLTIP_MASTERY } from '@/lib/constants/copy';
import { RotationFocusCard } from './RotationFocusCard';
import { WellnessWidget } from './WellnessWidget';
import { computeWellnessState } from '@/hooks/useStudyWellness';
import { useUserProfile } from '@/hooks/useUserProfile';
import { useRecentSessions } from '@/hooks/useRecentSessions';
import { NCCPA_BLUEPRINT_WEIGHTS } from '@/lib/nccpa-question-weighting';
import { useResolvedBlueprint } from '@/hooks/useResolvedBlueprint';
import { getDashboardConfig, type DashboardConfig, type WidgetId } from '@/lib/services/dashboardPersonalization';

const DASHBOARD_VIEW_KEY = 'pancea_dashboard_view';

export type DashboardViewId = 'pilot' | 'data';

const DASHBOARD_VIEWS: Array<{
  id: DashboardViewId;
  label: string;
  shortLabel: string;
  icon: React.ElementType;
  subtitle: string;
}> = [
  {
    id: 'pilot',
    label: 'Today',
    shortLabel: 'Pilot',
    icon: Zap,
    subtitle: 'Action — Streak, due reviews, daily goal',
  },
  {
    id: 'data',
    label: 'Analytics',
    shortLabel: 'Data',
    icon: BarChart3,
    subtitle: 'Analysis — Radars, heatmaps, trends',
  },
];

// ============================================================================
// Types
// ============================================================================

interface RetentionData {
  dueCount: number;
  totalCards: number;
  decayCurveData: { day: number; retentionProb: number }[];
  stabilityBuckets: { bucket: string; count: number; color: string }[];
  lastTuned: string;
  tuningReason: string;
  adjustment: 'tighten' | 'loosen';
}

// ============================================================================
// Data Fetcher (auth-aware for /api/stats/retention)
// ============================================================================

function createRetentionFetcher(getToken: () => Promise<string | null>) {
  return async (url: string): Promise<RetentionData> => {
    const token = await getToken();
    if (!token) throw new Error('Not authenticated');
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error('Failed to fetch');
    const data = (await res.json()) as { data?: RetentionData };
    return data.data as RetentionData;
  };
}

// ============================================================================
// Quick Stat Card Component - Enhanced Design
// ============================================================================

interface QuickStatProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  trend?: { value: number; isPositive: boolean };
  accentColor: string;
  delay?: number;
}

const QuickStat: React.FC<QuickStatProps> = ({
  icon,
  label,
  value,
  trend,
  accentColor,
  delay = 0,
}) => {
  const prefersReducedMotion = useReducedMotion();
  return (
  <motion.div
    initial={prefersReducedMotion ? false : { y: 20 }}
    animate={{ y: 0 }}
    transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.4, delay, ease: 'easeOut' }}
    className="group relative bg-[var(--color-bg-secondary)] backdrop-blur-sm rounded-xl p-6 shadow-sm transition-all duration-300"
  >
    {/* Gradient accent line */}
    <div
      className={`absolute top-0 left-6 right-6 h-0.5 ${accentColor} rounded-full opacity-60 group-hover:opacity-100 transition-opacity`}
    />

    <div className="flex items-center justify-between">
      <div className="flex items-center gap-4">
        <div
          className="p-3 rounded-lg bg-[var(--color-bg-tertiary)]"
        >
          {icon}
        </div>
        <div>
          <p className="text-sm font-medium text-[var(--color-text-secondary)] mb-0.5">{label}</p>
          <p className="text-xl sm:text-2xl font-bold text-[var(--color-text-primary)] tracking-tight tabular-nums">
            {value}
          </p>
        </div>
      </div>
      {trend && (
        <div
          className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${
            trend.isPositive
              ? 'bg-[var(--color-data-pass)]/20 text-[var(--color-data-pass)]'
              : 'bg-[var(--color-data-fail)]/20 text-[var(--color-data-fail)]'
          }`}
        >
          <TrendingUp className={`w-3 h-3 ${!trend.isPositive && 'rotate-180'}`} />
          {trend.value}%
        </div>
      )}
    </div>
  </motion.div>
  );
};

// ============================================================================
// Section Header Component
// ============================================================================

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
}

const SectionHeader: React.FC<SectionHeaderProps> = ({ title, subtitle, icon, action }) => (
  <div className="flex items-center justify-between mb-5">
    <div className="flex items-center gap-3">
      {icon && (
        <div className="p-2 bg-[var(--color-accent)]/10 dark:bg-[var(--color-accent)]/20 rounded-lg">
          {icon}
        </div>
      )}
      <div>
        <h2 className="text-xl font-bold text-[var(--color-text-primary)]">{title}</h2>
        {subtitle && <p className="text-sm text-[var(--color-text-secondary)]">{subtitle}</p>}
      </div>
    </div>
    {action}
  </div>
);

// ============================================================================
// Main Dashboard Component
// ============================================================================

interface DashboardPageProps {
  onNavigate?: (view: string) => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({ onNavigate }) => {
  const navigate = useNavigate();
  const { user } = useUser();
  const { getToken } = useAuth();
  const { performanceData } = useUserStats();
  const { profile: userProfile } = useUserProfile();
  const { sessions: recentSessions } = useRecentSessions();
  const { data: blueprintGaps } = useBlueprintGaps();
  const { data: confusionPairsData } = useConfusionPairs(5);
  const { data: reviewForecast } = useReviewForecast();
  const { stage } = useResolvedBlueprint();
  const dashboardConfig = useMemo(() => getDashboardConfig(stage), [stage]);
  const prefersReducedMotion = useReducedMotion();
  const retentionFetcher = useCallback(
    async (url: string) => {
      const token = await getToken();
      return createRetentionFetcher(() => Promise.resolve(token))(url);
    },
    [getToken]
  );
  const { data, error, isLoading, mutate } = useSWR<RetentionData>(
    user ? '/api/stats/retention' : null,
    retentionFetcher
  );

  const [view, setView] = useState<DashboardViewId>(() => {
    if (typeof window === 'undefined') return 'pilot';
    const stored = localStorage.getItem(DASHBOARD_VIEW_KEY);
    return stored === 'data' ? 'data' : 'pilot';
  });

  useEffect(() => {
    try {
      localStorage.setItem(DASHBOARD_VIEW_KEY, view);
    } catch {
      // ignore
    }
  }, [view]);

  // Widget visibility helper — driven by learner stage
  const showWidget = useCallback(
    (widget: WidgetId) =>
      dashboardConfig.pilotWidgets.includes(widget) ||
      dashboardConfig.dataWidgets.includes(widget),
    [dashboardConfig]
  );

  const showPilotWidget = useCallback(
    (widget: WidgetId) => dashboardConfig.pilotWidgets.includes(widget),
    [dashboardConfig]
  );

  const showDataWidget = useCallback(
    (widget: WidgetId) => dashboardConfig.dataWidgets.includes(widget),
    [dashboardConfig]
  );

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 18) return 'Good Afternoon';
    return 'Good Evening';
  };

  const handleNavigation = (path: string) => {
    if (onNavigate) {
      onNavigate(path);
    } else {
      navigate(path);
    }
  };

  const currentStreak = useMemo(() => {
    const { current } = calculateDayStreak(performanceData ?? []);
    return current;
  }, [performanceData]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[var(--color-bg-primary)] to-[var(--color-bg-secondary)] p-4 md:p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          <ClinicalSkeleton variant="compact" lines={2} className="w-1/3 mb-4 min-h-[80px]" />

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <ClinicalSkeleton variant="compact" lines={3} className="min-h-[120px]" />
            <ClinicalSkeleton variant="compact" lines={3} className="min-h-[120px]" />
            <ClinicalSkeleton variant="compact" lines={3} className="min-h-[120px]" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ClinicalSkeleton lines={8} className="min-h-[320px]" />
            <ClinicalSkeleton lines={8} className="min-h-[320px]" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    const isOffline = !navigator.onLine;

    return (
      <div className="min-h-screen bg-gradient-to-b from-[var(--color-bg-primary)] to-[var(--color-bg-secondary)] flex items-center justify-center px-4">
        <motion.div
          initial={prefersReducedMotion ? false : { y: 20 }}
          animate={{ y: 0 }}
          transition={prefersReducedMotion ? { duration: 0 } : undefined}
          className="text-center bg-[var(--color-bg-secondary)] rounded-xl p-8 shadow-sm max-w-md"
        >
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[var(--color-data-fail)]/20 flex items-center justify-center">
            <Zap className="w-8 h-8 text-[var(--color-data-fail)]" />
          </div>
          <p className="text-[var(--color-text-primary)] font-semibold mb-2">
            {isOffline ? 'No Internet Connection' : 'Dashboard Unavailable'}
          </p>
          <p className="text-[var(--color-text-secondary)] text-sm mb-4">
            {isOffline
              ? 'Check your connection and try again.'
              : 'Unable to load your study data. Please try again.'}
          </p>
          <button
            onClick={() => mutate()}
            className="px-6 py-2.5 bg-[var(--color-accent)] hover:opacity-90 text-white font-medium rounded-lg transition-opacity focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2"
          >
            {isOffline ? 'Check Connection & Retry' : 'Retry'}
          </button>
        </motion.div>
      </div>
    );
  }

  const totalCardsLearned = data.totalCards || 0;

  // Derive system-level accuracy from performance data for blueprint progress & rotation card
  const systemAccuracy = useMemo(() => {
    const stats: Record<string, { correct: number; total: number }> = {};
    if (performanceData) {
      for (const entry of performanceData) {
        const e = entry as { system?: string; isCorrect?: boolean };
        const sys = e.system;
        if (sys) {
          if (!stats[sys]) stats[sys] = { correct: 0, total: 0 };
          stats[sys].total += 1;
          if (e.isCorrect) stats[sys].correct += 1;
        }
      }
    }
    // Convert to 0-1 accuracy; require ≥3 attempts for a meaningful ratio
    const accuracy: Record<string, number> = {};
    for (const [sys, s] of Object.entries(stats)) {
      accuracy[sys] = s.total >= 3 ? s.correct / s.total : 0;
    }
    return accuracy;
  }, [performanceData]);

  // Keep a simple count for BlueprintProgressBar (coverage, not accuracy)
  const systemCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    if (performanceData) {
      for (const entry of performanceData) {
        const sys = (entry as { system?: string }).system;
        if (sys) {
          counts[sys] = (counts[sys] || 0) + 1;
        }
      }
    }
    return counts;
  }, [performanceData]);

  // Compute rotation week from rotationStartDate
  const rotationWeek = useMemo(() => {
    if (!userProfile?.rotationStartDate) return undefined;
    const start = new Date(userProfile.rotationStartDate);
    const now = new Date();
    const diffMs = now.getTime() - start.getTime();
    if (diffMs < 0) return 1; // hasn't started yet
    return Math.floor(diffMs / (7 * 86400000)) + 1;
  }, [userProfile?.rotationStartDate]);

  // Compute wellness state from real session history
  const wellnessState = useMemo(
    () => computeWellnessState(recentSessions, 0),
    [recentSessions]
  );

  // Build prioritized study actions from retention data
  const studyActions = useMemo<StudyAction[]>(() => {
    const actions: StudyAction[] = [];
    const dueCount = data.dueCount || 0;

    if (dueCount > 0) {
      actions.push({
        id: 'due-reviews',
        priority: dueCount > 50 ? 'critical' : dueCount > 20 ? 'high' : 'medium',
        title: dueCount > 50 ? 'Overdue Reviews' : 'Reviews Due',
        subtitle: `${dueCount} card${dueCount !== 1 ? 's' : ''} ready for review`,
        count: dueCount,
        route: '/study/main-session',
        icon: <Brain className="w-5 h-5" />,
        accentColor: dueCount > 50 ? 'var(--color-data-fail)' : 'var(--color-accent)',
      });
    }

    // Streak maintenance action
    if (currentStreak > 0) {
      actions.push({
        id: 'streak-keeper',
        priority: 'low',
        title: `Keep your ${currentStreak}-day streak`,
        subtitle: 'Complete at least 10 cards today',
        route: '/study/main-session',
        icon: <Flame className="w-5 h-5" />,
        accentColor: 'var(--color-data-provisional)',
      });
    }

    // Quick drill suggestion
    actions.push({
      id: 'quick-drill',
      priority: 'medium',
      title: 'Quick Drill',
      subtitle: 'Targeted practice on high-yield topics',
      route: '/drills',
      icon: <Zap className="w-5 h-5" />,
      accentColor: 'var(--color-accent)',
    });

    // OSCE practice
    actions.push({
      id: 'osce-practice',
      priority: 'low',
      title: 'Patient Encounter',
      subtitle: 'Practice clinical reasoning with a simulated patient',
      route: '/modes/simulation',
      icon: <Stethoscope className="w-5 h-5" />,
      accentColor: 'var(--color-data-pass)',
    });

    return actions;
  }, [data.dueCount, currentStreak]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-[var(--color-bg-primary)] via-[var(--color-bg-primary)] to-[var(--color-bg-secondary)] p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* ===== HEADER SECTION - Enhanced with gradient text ===== */}
        <motion.div
          initial={prefersReducedMotion ? false : { y: -20 }}
          animate={{ y: 0 }}
          transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.5, ease: 'easeOut' }}
          className="pt-2"
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2.5 rounded-lg bg-[var(--color-accent)]/15">
              <Target className="w-6 h-6 text-[var(--color-text-inverse)]" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-[var(--color-text-primary)] truncate max-w-full">
                {getGreeting()},{' '}
                <span className="bg-[var(--color-accent)] bg-clip-text text-transparent">
                  {user?.firstName || 'Student'}
                </span>
              </h1>
              <p className="text-[var(--color-text-secondary)] text-sm md:text-base">
                {dashboardConfig.greetingSuffix}
              </p>
            </div>
          </div>
        </motion.div>

        {/* ===== DASHBOARD VIEW TABS ===== */}
        <div role="tablist" aria-label="Dashboard views" className="flex gap-1 p-1 rounded-xl bg-[var(--color-bg-tertiary)]">
          {DASHBOARD_VIEWS.map((v) => {
            const Icon = v.icon;
            const isActive = view === v.id;
            return (
              <button
                key={v.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                aria-controls={`tabpanel-${v.id}`}
                id={`tab-${v.id}`}
                onClick={() => setView(v.id)}
                className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-lg text-sm font-medium transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 ${
                  isActive
                    ? 'bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] shadow-sm'
                    : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)]/50'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span className="hidden sm:inline">{v.label}</span>
                <span className="sm:hidden">{v.shortLabel}</span>
              </button>
            );
          })}
        </div>

        <AnimatePresence mode="wait">
          {view === 'pilot' && (
            <motion.div
              key="pilot"
              role="tabpanel"
              id="tabpanel-pilot"
              aria-labelledby="tab-pilot"
              initial={prefersReducedMotion ? false : { y: 8 }}
              animate={{ y: 0 }}
              exit={prefersReducedMotion ? { opacity: 0 } : { y: -8 }}
              transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.2 }}
              className="space-y-6"
            >
              {/* Quick Stats Row */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {dashboardConfig.showStreakPressure && (
                  <QuickStat
                    icon={<Flame className="w-5 h-5 text-[var(--color-data-provisional)]" />}
                    label="Day Streak"
                    value={currentStreak}
                    trend={currentStreak > 0 ? { value: currentStreak, isPositive: true } : undefined}
                    accentColor="bg-gradient-to-r from-[var(--color-data-provisional)] to-[var(--color-data-provisional)]"
                    delay={0}
                  />
                )}
                <QuickStat
                  icon={<Brain className="w-5 h-5 text-[var(--color-accent)]" />}
                  label="Due Reviews"
                  value={data.dueCount || 0}
                  accentColor="bg-[var(--color-accent)]"
                  delay={0.05}
                />
                <QuickStat
                  icon={<Target className="w-5 h-5 text-[var(--color-data-pass)]" />}
                  label="Cards Learned"
                  value={totalCardsLearned}
                  accentColor="bg-gradient-to-r from-[var(--color-data-pass)] to-[var(--color-data-pass)]"
                  delay={0.1}
                />
              </div>

              {/* Study Actions — "What should I do right now?" */}
              {/* Review Forecast Calendar — 7-day SRS load visualization */}
              {reviewForecast && (
                <ReviewCalendar
                  overdue={reviewForecast.overdue}
                  today={reviewForecast.today}
                  forecast={reviewForecast.forecast}
                  totalActive={reviewForecast.totalActive}
                />
              )}

              <SectionHeader
                title="What To Study"
                subtitle="Prioritized actions based on your FSRS schedule"
                icon={<Stethoscope className="w-5 h-5 text-[var(--color-accent)]" />}
              />
              <StudyActionList actions={studyActions} />

              {/* Blueprint Progress — shown for late-didactic, clinical, and PANCE */}
              {dashboardConfig.showBlueprintGaps && (
                <>
                  <BlueprintProgressBar
                    systemCounts={systemCounts}
                    targetWeights={NCCPA_BLUEPRINT_WEIGHTS}
                    totalAnswered={totalCardsLearned}
                  />
                  {blueprintGaps && (
                    <BlueprintGapHeatmap data={blueprintGaps} />
                  )}
                </>
              )}

              {/* Confusion Pairs — conditions the student frequently confuses */}
              {confusionPairsData && confusionPairsData.confusionPairs.length > 0 && (
                <ConfusionPairCard
                  pairs={confusionPairsData.confusionPairs}
                  onDrillPair={(correctId, selectedId) => {
                    handleNavigation(`/study/drill/contrastive?conditionA=${correctId}&conditionB=${selectedId}`);
                  }}
                />
              )}

              {/* Rotation Focus + Wellness — stage-aware layout */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {dashboardConfig.showRotationContext && (
                  <RotationFocusCard
                    rotationName={userProfile?.currentRotation ?? undefined}
                    rotationWeek={rotationWeek}
                    eorDate={userProfile?.eorTestDate ?? undefined}
                    onStartDrill={(system) => handleNavigation(`/study/main-session?system=${system}`)}
                    systemPerformance={systemAccuracy}
                  />
                )}
                {showPilotWidget('wellness_status') && (
                  <WellnessWidget signal={wellnessState.signal} />
                )}
              </div>

              {/* Exam Readiness + Retention Forecast */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {(dashboardConfig.showPanceCountdown || dashboardConfig.showEorCountdown) && (
                  <ExamReadinessCard />
                )}
                {showPilotWidget('retention_forecast') && (
                  <RetentionForecastCard
                    dueCount={data.dueCount}
                    decayCurveData={data.decayCurveData}
                    onStartReview={() => handleNavigation('/study/main-session')}
                  />
                )}
              </div>

              {/* Daily Practice */}
              <SectionHeader
                title="Daily Practice"
                subtitle="Quick drills to sharpen your skills"
                icon={<Zap className="w-5 h-5 text-[var(--color-accent)]" />}
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <button
                  onClick={() => handleNavigation('/modes/rapid-recall')}
                  className="group relative bg-[var(--color-bg-secondary)] backdrop-blur-sm rounded-xl p-6 shadow-sm hover:bg-[var(--color-bg-tertiary)]/50 hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 w-full text-left overflow-hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2"
                >
                  <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[var(--color-data-provisional)] to-[var(--color-data-provisional)] opacity-0 group-hover:opacity-100 transition-opacity" />
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-2.5 rounded-lg bg-[var(--color-data-provisional)]/15">
                      <Clock className="w-5 h-5 text-[var(--color-text-inverse)]" aria-hidden="true" />
                    </div>
                    <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">
                      Rapid Recall
                    </h3>
                  </div>
                  <p className="text-sm text-[var(--color-text-secondary)] mb-4">
                    Quick-fire questions to test your speed
                  </p>
                  <div className="flex items-center text-[var(--color-data-provisional)] text-sm font-semibold group-hover:gap-2 transition-all">
                    Start Drill
                    <ArrowRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" aria-hidden="true" />
                  </div>
                </button>
                <DailyTriad />
              </div>
            </motion.div>
          )}

          {view === 'data' && (
            <motion.div
              key="data"
              role="tabpanel"
              id="tabpanel-data"
              aria-labelledby="tab-data"
              initial={prefersReducedMotion ? false : { y: 8 }}
              animate={{ y: 0 }}
              exit={prefersReducedMotion ? { opacity: 0 } : { y: -8 }}
              transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.2 }}
              className="space-y-6"
            >
              {/* System Performance + Calibration — stage-aware */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {showDataWidget('system_performance') && (
                  <SystemPerformanceWidget maxSystems={5} />
                )}
                {dashboardConfig.showCalibrationQuadrant && showDataWidget('calibration_quadrant') && (
                  <CalibrationQuadrantWidget className="w-full" />
                )}
                {showDataWidget('calibration_chart') && (
                  <CalibrationChart />
                )}
              </div>

              {/* Memory Health — decay + stability */}
              <div className="flex items-center gap-1.5">
                <SectionHeader
                  title="Memory Health"
                  subtitle="Retention and stability over time"
                  icon={<TrendingUp className="w-5 h-5 text-[var(--color-accent)]" />}
                />
                <InfoTooltip text={TOOLTIP_STABILITY} />
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {showDataWidget('decay_curve') && (
                  <div className="bg-[var(--color-bg-secondary)] backdrop-blur-sm rounded-xl p-6 shadow-sm">
                    <DecayCurve data={data.decayCurveData} />
                  </div>
                )}
                {showDataWidget('stability_pyramid') && (
                  <div className="bg-[var(--color-bg-secondary)] backdrop-blur-sm rounded-xl p-6 shadow-sm">
                    <StabilityPyramid data={data.stabilityBuckets} />
                  </div>
                )}
              </div>

              {/* Algorithm Status — only for advanced stages */}
              {showDataWidget('algorithm_status') && (
                <AlgorithmStatusWidget
                  lastTuned={new Date(data.lastTuned)}
                  reason={data.tuningReason}
                  adjustment={data.adjustment}
                />
              )}

              {/* Link to full analytics */}
              <div className="flex justify-center pt-2">
                <button
                  type="button"
                  onClick={() => handleNavigation('/progress')}
                  className="flex items-center gap-2 text-sm font-medium text-[var(--color-accent)] hover:underline"
                >
                  <LayoutDashboard className="w-4 h-4" />
                  Open full analytics (radars, heatmaps, trends)
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default DashboardPage;
