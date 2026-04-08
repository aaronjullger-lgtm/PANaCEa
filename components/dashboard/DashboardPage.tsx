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
} from '@/components/ui/icons';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import DecayCurve from './charts/DecayCurve';
import StabilityPyramid from './charts/StabilityPyramid';
import AlgorithmStatusWidget from './AlgorithmStatusWidget';
import { ClinicalSkeleton } from '@/components/loading';
import DailyTriad from './DailyTriad';
import { ExamReadinessCard, SystemPerformanceWidget } from './Rolling360';
import { CalibrationQuadrantWidget } from './CalibrationQuadrantWidget';
import CalibrationChart from './CalibrationChart';
import { MetacognitiveMirror } from './metacognitive';
import { DrillRecommendationCard } from './DrillRecommendationCard';
import { RetentionForecastCard } from './RetentionForecastCard';
import { StudyActionList, type StudyAction } from './StudyActionCard';
import { TodayPlanCard } from './TodayPlanCard';
import { useTodayPlan } from '@/hooks/useTodayPlan';
import { RatingHealthCard } from './RatingHealthCard';
import { useRatingAudit } from '@/hooks/useRatingAudit';
import { BlueprintProgressBar } from './BlueprintProgressBar';
import { BlueprintGapHeatmap } from './BlueprintGapHeatmap';
import { useBlueprintGaps } from '@/hooks/useBlueprintGaps';
import { ConfusionPairCard } from './ConfusionPairCard';
import { ConfusionGraph } from './ConfusionGraph';
import { useConfusionPairs } from '@/hooks/useConfusionPairs';
import { ReviewCalendar } from './ReviewCalendar';
import { useReviewForecast } from '@/hooks/useReviewForecast';
import { InfoTooltip } from '@/components/ui/InfoTooltip';
import { TOOLTIP_STABILITY, TOOLTIP_MASTERY } from '@/lib/constants/copy';
import { RotationFocusCard } from './RotationFocusCard';
import { WellnessWidget } from './WellnessWidget';
import { computeWellnessState } from '@/hooks/useStudyWellness';
import { useUserProfile } from '@/hooks/useUserProfile';
import { loadUserProfile } from '@/services/analytics/userProfileService';
import { useRecentSessions } from '@/hooks/useRecentSessions';
import { NCCPA_BLUEPRINT_WEIGHTS } from '@/lib/nccpa-question-weighting';
import { useResolvedBlueprint } from '@/hooks/useResolvedBlueprint';
import { useDatabaseStats } from '@/hooks/useDatabaseStats';

// Lazy-loaded heavy chart — @nivo/calendar (~15-20 KB)
const StudyHeatmap = React.lazy(() => import('@/components/charts/StudyHeatmap'));
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
    initial={prefersReducedMotion ? false : { y: 12, opacity: 0 }}
    animate={{ y: 0, opacity: 1 }}
    transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.4, delay, ease: [0.16, 1, 0.3, 1] }}
    className="card-stat group"
    style={{ '--stat-accent': accentColor } as React.CSSProperties}
  >
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3.5">
        <div
          className="p-2.5 rounded-xl transition-colors duration-200"
          style={{
            background: `color-mix(in srgb, ${accentColor} 10%, var(--color-bg-tertiary) 90%)`,
          }}
        >
          {icon}
        </div>
        <div>
          <p className="text-overline uppercase text-[var(--color-text-muted)] mb-1">{label}</p>
          <p className="text-2xl sm:text-3xl font-semibold text-[var(--color-text-primary)] tracking-heading tabular-nums leading-none">
            {value}
          </p>
        </div>
      </div>
      {trend && (
        <div
          className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold backdrop-blur-xs ${
            trend.isPositive
              ? 'bg-[var(--color-data-pass)]/12 text-[var(--color-data-pass)]'
              : 'bg-[var(--color-data-fail)]/12 text-[var(--color-data-fail)]'
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
  <div className="flex items-center justify-between mb-4 pt-3">
    <div className="flex items-center gap-3">
      {icon && (
        <div
          className="p-2 rounded-xl"
          style={{
            background: 'color-mix(in srgb, var(--color-accent) 8%, var(--color-bg-tertiary) 92%)',
          }}
        >
          <span className="text-[var(--color-accent)]">
            {icon}
          </span>
        </div>
      )}
      <div>
        <h2 className="text-h3 text-[var(--color-text-primary)]">{title}</h2>
        {subtitle && <p className="text-caption text-[var(--color-text-muted)] mt-0.5">{subtitle}</p>}
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
  const { profile: apiUserProfile } = useUserProfile();
  // Merge API profile (authoritative) with localStorage cache (instant).
  // LocalStorage is always populated by mergeEorFieldsFromApi after first API load,
  // so the RotationFocusCard shows immediately without waiting for the network.
  const localCachedProfile = useMemo(() => loadUserProfile(), []);
  const userProfile = useMemo(() => {
    if (apiUserProfile) return apiUserProfile;
    // Seed from localStorage while API is loading
    if (localCachedProfile) {
      return {
        currentRotation: localCachedProfile.currentRotation ?? null,
        eorTestDate: localCachedProfile.eorTestDate ?? null,
        rotationStartDate: localCachedProfile.rotationStartDate ?? null,
        rotationEndDate: localCachedProfile.rotationEndDate ?? null,
        yearInProgram: localCachedProfile.yearInProgram ?? null,
      } as Partial<typeof apiUserProfile> as typeof apiUserProfile;
    }
    return null;
  }, [apiUserProfile, localCachedProfile]);
  const { sessions: recentSessions } = useRecentSessions();
  const { stats: dbStats } = useDatabaseStats();
  const { data: blueprintGaps } = useBlueprintGaps();
  const { data: confusionPairsData } = useConfusionPairs(5);
  const { data: reviewForecast } = useReviewForecast();
  const { stage } = useResolvedBlueprint();
  const dashboardConfig = useMemo(() => getDashboardConfig(stage), [stage]);
  const { data: todayPlan, isLoading: todayPlanLoading, error: todayPlanError, refresh: refreshTodayPlan } = useTodayPlan();
  const { data: ratingAudit, isLoading: ratingAuditLoading, error: ratingAuditError, refresh: refreshRatingAudit } = useRatingAudit();
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
    // Prefer server-side streak — authoritative across devices and sessions
    if (dbStats?.overall.currentStreak !== undefined) return dbStats.overall.currentStreak;
    // Fallback: compute streak from localStorage performance history
    const { current } = calculateDayStreak(performanceData ?? []);
    return current;
  }, [dbStats, performanceData]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[var(--color-bg-primary)] py-6 px-4 md:px-6">
        <div className="max-w-7xl mx-auto space-y-8">
          <ClinicalSkeleton variant="compact" lines={2} className="w-1/3 min-h-[60px]" />

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <ClinicalSkeleton variant="compact" lines={3} className="min-h-[100px]" />
            <ClinicalSkeleton variant="compact" lines={3} className="min-h-[100px]" />
            <ClinicalSkeleton variant="compact" lines={3} className="min-h-[100px]" />
          </div>

          <ClinicalSkeleton variant="compact" lines={4} className="min-h-[140px]" />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <ClinicalSkeleton lines={8} className="min-h-[280px]" />
            <ClinicalSkeleton lines={8} className="min-h-[280px]" />
          </div>
        </div>
      </div>
    );
  }

  // Graceful degradation: show dashboard with fallback data instead of blocking error screen
  const hasRetentionError = !!error || !data;
  const safeData: RetentionData = data ?? {
    dueCount: 0,
    totalCards: 0,
    decayCurveData: [],
    stabilityBuckets: [],
    lastTuned: '',
    tuningReason: '',
    adjustment: 'tighten',
  };

  // Prefer DB's unique questions seen (cross-device authoritative); fallback to retention endpoint count
  const totalCardsLearned = dbStats?.overall.questionsSeenCount ?? safeData.totalCards ?? 0;

  // Derive system-level accuracy for blueprint progress & rotation card.
  // Prefer DB-sourced accuracy (server-side, cross-device); fallback to localStorage.
  const systemAccuracy = useMemo(() => {
    if (dbStats?.bySystems && Object.keys(dbStats.bySystems).length > 0) {
      const accuracy: Record<string, number> = {};
      for (const [sys, s] of Object.entries(dbStats.bySystems)) {
        // require ≥3 attempts for a meaningful ratio (same threshold as localStorage path)
        // DB accuracy is 0-100; normalize to 0-1 for RotationFocusCard
        if (s.total >= 3) accuracy[sys] = Math.max(0, Math.min(1, s.accuracy / 100));
      }
      if (Object.keys(accuracy).length > 0) return accuracy;
    }
    // Fallback: compute from localStorage performanceData
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
  }, [dbStats, performanceData]);

  // Simple attempt counts per system for BlueprintProgressBar (coverage, not accuracy).
  // Prefer DB totals (cross-device); fallback to localStorage.
  const systemCounts = useMemo(() => {
    if (dbStats?.bySystems && Object.keys(dbStats.bySystems).length > 0) {
      const counts: Record<string, number> = {};
      for (const [sys, s] of Object.entries(dbStats.bySystems)) {
        counts[sys] = s.total;
      }
      return counts;
    }
    // Fallback: count from localStorage performanceData
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
  }, [dbStats, performanceData]);

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
    const dueCount = safeData.dueCount || 0;

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
  }, [safeData.dueCount, currentStreak]);

  return (
    <div className="min-h-screen py-5 px-4 md:py-6 md:px-6">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* ===== API STATUS BANNER — non-blocking degraded notice ===== */}
        {hasRetentionError && (
          <motion.div
            initial={{ y: -8, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="flex items-center gap-3 px-4 py-3 rounded-xl border border-[var(--color-data-provisional)]/30 bg-[var(--color-data-provisional)]/8"
          >
            <AlertTriangle className="w-4 h-4 text-[var(--color-data-provisional)] shrink-0" />
            <p className="text-sm text-[var(--color-text-secondary)] flex-1">
              {!navigator.onLine
                ? 'You\'re offline. Showing cached data.'
                : 'Some analytics are temporarily unavailable. Core features still work.'}
            </p>
            <button
              onClick={() => mutate()}
              className="text-xs font-semibold text-[var(--color-accent)] hover:underline shrink-0"
            >
              Retry
            </button>
          </motion.div>
        )}

        {/* ===== HEADER SECTION - Cinematic greeting with premium typography ===== */}
        <motion.div
          initial={prefersReducedMotion ? false : { y: -10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="pt-4 pb-2"
        >
          <h1 className="text-h1 text-[var(--color-text-primary)] truncate max-w-full" style={{ letterSpacing: '-0.025em' }}>
            {getGreeting()},{' '}
            <span className="font-bold">
              {user?.firstName || 'Student'}
            </span>
          </h1>
          <p className="text-[var(--color-text-muted)] text-body-lg mt-1.5">
            {dashboardConfig.greetingSuffix}
          </p>
        </motion.div>

        {/* ===== DASHBOARD VIEW TABS ===== */}
        <div
          role="tablist"
          aria-label="Dashboard views"
          className="inline-flex gap-1 p-1 rounded-xl"
          style={{ backgroundColor: 'var(--color-bg-tertiary)', boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.04)' }}
        >
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
                className={`relative flex items-center justify-center gap-1.5 py-2 px-5 rounded-lg text-[13px] font-medium transition-all duration-200 ease-premium focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-1 ${
                  isActive
                    ? 'bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)]'
                    : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]'
                }`}
                style={isActive ? { boxShadow: '0 0 0 1px rgba(59, 130, 246, 0.06), 0 2px 6px -1px rgba(0,0,0,0.06)' } : undefined}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
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
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {dashboardConfig.showStreakPressure && (
                  <QuickStat
                    icon={<Flame className="w-5 h-5 text-[var(--color-data-provisional)]" />}
                    label="Day Streak"
                    value={currentStreak}
                    trend={currentStreak > 0 ? { value: currentStreak, isPositive: true } : undefined}
                    accentColor="var(--color-data-provisional)"
                    delay={0}
                  />
                )}
                <QuickStat
                  icon={<Brain className="w-5 h-5 text-[var(--color-accent)]" />}
                  label="Due Reviews"
                  value={safeData.dueCount || 0}
                  accentColor="var(--color-accent)"
                  delay={0.05}
                />
                <QuickStat
                  icon={<Target className="w-5 h-5 text-[var(--color-data-pass)]" />}
                  label="Cards Learned"
                  value={totalCardsLearned}
                  accentColor="var(--color-data-pass)"
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

              {/* Study Activity Heatmap — GitHub-style year view (lazy-loaded) */}
              {/* TODO: Wire to real daily activity data from /api/analytics/daily-activity */}
              <div className="card-cinematic p-5">
                <h3 className="text-caption font-semibold uppercase tracking-widest text-[var(--color-text-muted)] mb-3">Study Activity</h3>
                <React.Suspense fallback={<div className="h-[180px] animate-pulse bg-[var(--color-bg-tertiary)] rounded-lg" />}>
                  <StudyHeatmap
                    data={[]}
                    height={180}
                  />
                </React.Suspense>
              </div>

              {/* Today's Plan — allocator-driven MAIN vs TARGETED split */}
              <TodayPlanCard
                data={todayPlan}
                isLoading={todayPlanLoading}
                error={todayPlanError}
                onRefresh={refreshTodayPlan}
                onStartMain={(systems) => {
                  const params = systems?.length ? `?systems=${systems.join(',')}` : '';
                  handleNavigation(`/study/main-session${params}`);
                }}
                onStartTargeted={(conditions) => {
                  const params = conditions?.length ? `?conditions=${conditions.join(',')}` : '';
                  handleNavigation(`/study/targeted-session${params}`);
                }}
              />

              {/* Fallback study actions for quick-access */}
              <SectionHeader
                title="Quick Actions"
                subtitle="Other ways to study"
                icon={<Stethoscope className="w-4 h-4" />}
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

              {/* Confusion Network Graph — interactive force-directed visualization */}
              <ConfusionGraph maxPairs={20} />

              {/* Rotation Focus + Wellness — stage-aware layout */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
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
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {(dashboardConfig.showPanceCountdown || dashboardConfig.showEorCountdown) && (
                  <ExamReadinessCard />
                )}
                {showPilotWidget('retention_forecast') && !hasRetentionError && (
                  <RetentionForecastCard
                    dueCount={safeData.dueCount}
                    decayCurveData={safeData.decayCurveData}
                    onStartReview={() => handleNavigation('/study/main-session')}
                  />
                )}
              </div>

              {/* Daily Practice */}
              <SectionHeader
                title="Daily Practice"
                subtitle="Quick drills to sharpen your skills"
                icon={<Zap className="w-4 h-4" />}
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <button
                  onClick={() => handleNavigation('/modes/rapid-recall')}
                  className="card-cinematic group relative p-5 w-full text-left overflow-hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2"
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div
                      className="p-2.5 rounded-xl transition-colors duration-200"
                      style={{
                        background: 'color-mix(in srgb, var(--color-accent) 10%, var(--color-bg-tertiary) 90%)',
                      }}
                    >
                      <Clock className="w-4 h-4 text-[var(--color-accent)]" aria-hidden="true" />
                    </div>
                    <h3 className="text-body font-semibold text-[var(--color-text-primary)]">
                      Rapid Recall
                    </h3>
                  </div>
                  <p className="text-caption text-[var(--color-text-muted)] mb-3.5 leading-relaxed">
                    Quick-fire questions to test your speed
                  </p>
                  <div className="flex items-center text-[var(--color-accent)] text-caption font-semibold group-hover:gap-1.5 transition-all duration-200 ease-premium">
                    Start Drill
                    <ArrowRight className="w-3.5 h-3.5 ml-1 group-hover:translate-x-1 transition-transform duration-200 ease-premium" aria-hidden="true" />
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
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
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

              {/* Rating Health — Again/Good distribution audit */}
              <RatingHealthCard
                data={ratingAudit}
                isLoading={ratingAuditLoading}
                error={ratingAuditError}
                onRefresh={refreshRatingAudit}
              />

              {/* Memory Health — decay + stability */}
              <SectionHeader
                title="Memory Health"
                subtitle="Retention and stability over time"
                icon={<TrendingUp className="w-4 h-4" />}
                action={<InfoTooltip text={TOOLTIP_STABILITY} />}
              />
              {!hasRetentionError && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                  {showDataWidget('decay_curve') && (
                    <div className="card-cinematic p-5">
                      <DecayCurve data={safeData.decayCurveData} />
                    </div>
                  )}
                  {showDataWidget('stability_pyramid') && (
                    <div className="card-cinematic p-5">
                      <StabilityPyramid data={safeData.stabilityBuckets} />
                    </div>
                  )}
                </div>
              )}

              {/* Metacognitive Mirror — behavioral self-awareness */}
              <MetacognitiveMirror days={30} />

              {/* Personalized Drill Recommendations */}
              <DrillRecommendationCard days={60} />

              {/* Algorithm Status — only for advanced stages */}
              {showDataWidget('algorithm_status') && !hasRetentionError && safeData.lastTuned && (
                <AlgorithmStatusWidget
                  lastTuned={new Date(safeData.lastTuned)}
                  reason={safeData.tuningReason}
                  adjustment={safeData.adjustment}
                />
              )}

              {/* Link to full analytics */}
              <div className="flex justify-center pt-6 pb-3">
                <button
                  type="button"
                  onClick={() => handleNavigation('/progress')}
                  className="group flex items-center gap-2 px-5 py-2.5 rounded-xl text-caption font-semibold text-[var(--color-text-muted)] hover:text-[var(--color-accent)] transition-all duration-200 ease-premium hover:bg-[var(--color-accent)]/5"
                >
                  <LayoutDashboard className="w-3.5 h-3.5" />
                  View full analytics
                  <ArrowRight className="w-3 h-3 opacity-0 -ml-1 group-hover:opacity-100 group-hover:ml-0 transition-all duration-200 ease-premium" />
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
