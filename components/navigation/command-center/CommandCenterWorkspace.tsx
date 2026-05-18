import React, { useCallback, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTodayPlan, type TodayPlanData } from '@/hooks/useTodayPlan';
import { useUserProfile } from '@/hooks/useUserProfile';
import { useDashboardAnalytics } from '@/hooks/useDashboardAnalytics';
import { useStudyPlanLaunch, type StudyPlanLaunchTask } from '@/hooks/useStudyPlanLaunch';
import { ROUTES } from '@/config/routes';
import { normalizeDashboardSignals } from '@/components/dashboard/adaptive/engine/normalizeSignals';
import { AdaptiveDashboardPage } from '@/components/dashboard/adaptive/page/DashboardPage';
import type { PerformanceRecord, Question, SessionSettings, UserProfile } from '@/types';

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
  availableMinutes?: number;
}

function parseAvailableMinutes(search: string): number | null {
  const params = new URLSearchParams(search);
  const raw = params.get('minutes') ?? params.get('time');
  if (!raw) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

type TodayPlanTask = NonNullable<TodayPlanData['tasks']>[number];

function planDateFromTask(task: TodayPlanTask): string | null {
  const fromRoute = task.launchParams?.planDate;
  if (fromRoute) return fromRoute;
  const match = task.id.match(/^\d{4}-\d{2}-\d{2}/);
  return match?.[0] ?? null;
}

function isActionableTask(task: TodayPlanTask): boolean {
  return !['completed', 'skipped', 'rescheduled'].includes(task.status);
}

function selectTodayPlanLaunch(todayPlan: TodayPlanData | null): {
  planDate: string;
  task: StudyPlanLaunchTask;
} | null {
  if (!todayPlan?.tasks?.length) return null;
  const task = todayPlan.tasks.find(isActionableTask) ?? null;
  if (!task) return null;

  const planDate =
    todayPlan.planDate ??
    planDateFromTask(task) ??
    new Date().toISOString().slice(0, 10);

  return {
    planDate,
    task: {
      id: task.id,
      title: task.title,
      kind: task.kind,
      mode: task.mode,
      route: task.route,
      launchSettings: task.launchSettings,
      count: task.count,
      targetQuestions: task.targetQuestions,
      systems: task.systems,
      systemFilter: task.systemFilter,
      conditionIds: task.conditionIds,
      launchParams: task.launchParams,
    },
  };
}

export const CommandCenterWorkspace: React.FC<CommandCenterHubProps> = ({
  performanceData,
  growthAreas,
  dueCount: propDueCount = 0,
  examLabel = 'PANCE',
  isLoadingStats = false,
  availableMinutes,
  hasActiveSession = false,
  onResumeSession,
  onStartSession,
  onNavigateToSrsReview,
  onNavigateToStudyPathDashboard,
  onOpenSettings,
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { profile } = useUserProfile();
  const { data: todayPlan, isLoading: todayPlanLoading, error: todayPlanError } = useTodayPlan();
  const { launchTask: launchStudyPlanTask } = useStudyPlanLaunch();
  const {
    data: dashboardAnalytics,
    isLoading: dashboardAnalyticsLoading,
    error: dashboardAnalyticsError,
  } = useDashboardAnalytics();

  const dueCount = dashboardAnalytics?.overview.dueToday ?? propDueCount;
  const activeAvailableMinutes = availableMinutes ?? parseAvailableMinutes(location.search);
  const todayPlanLaunch = useMemo(() => selectTodayPlanLaunch(todayPlan), [todayPlan]);

  const startToday = useCallback(() => {
    if (hasActiveSession) {
      onResumeSession?.();
      return;
    }

    if (todayPlanLaunch) {
      void launchStudyPlanTask(todayPlanLaunch.planDate, todayPlanLaunch.task);
      return;
    }

    const lowData = (dashboardAnalytics?.overview.totalAttempts ?? performanceData.length) < 15;
    if (lowData) {
      onStartSession({ focus: 'all', count: 10, mode: 'standard' });
      return;
    }

    if (todayPlan?.targetedConditions?.[0]) {
      onStartSession({
        focus: 'topic',
        mode: 'standard',
        count: todayPlan.recommendedTargetedCount || 12,
        conditionName: todayPlan.targetedConditions[0],
      });
      return;
    }

    if (todayPlan?.mainSystems?.length) {
      onStartSession({
        focus: 'all',
        mode: 'standard',
        count: todayPlan.recommendedMainCount || todayPlan.recommendedTargetedCount || 14,
        systems: todayPlan.mainSystems,
      });
      return;
    }

    if (dueCount > 0 && onNavigateToSrsReview) {
      onNavigateToSrsReview();
      return;
    }

    onStartSession({ focus: 'all', count: activeAvailableMinutes != null && activeAvailableMinutes <= 15 ? 8 : 12, mode: 'standard' });
  }, [
    activeAvailableMinutes,
    dashboardAnalytics?.overview.totalAttempts,
    dueCount,
    hasActiveSession,
    launchStudyPlanTask,
    onNavigateToSrsReview,
    onResumeSession,
    onStartSession,
    performanceData.length,
    todayPlan,
    todayPlanLaunch,
  ]);

  const startShort = useCallback(() => {
    onStartSession({ focus: 'all', count: 8, mode: 'standard' });
  }, [onStartSession]);

  const context = useMemo(
    () =>
      normalizeDashboardSignals({
        performanceData,
        growthAreas,
        dueCount,
        examLabel,
        profile: profile as Partial<UserProfile> | null,
        todayPlan,
        todayPlanLoading,
        todayPlanError,
        dashboardAnalytics,
        dashboardAnalyticsLoading: dashboardAnalyticsLoading || isLoadingStats,
        dashboardAnalyticsError,
        availableMinutes: activeAvailableMinutes,
        hasActiveSession,
        actions: {
          onStartToday: startToday,
          onStartShort: startShort,
          onOpenFullPlan: onNavigateToStudyPathDashboard ?? (() => navigate(ROUTES.STUDY_PATH)),
          onOpenProgress: () => navigate(ROUTES.PROGRESS),
          onOpenReview: onNavigateToSrsReview ?? (() => navigate(ROUTES.PROGRESS)),
          onOpenPractice: () => navigate(ROUTES.PRACTICE),
          onStartSession,
          onOpenSettings,
        },
      }),
    [
      activeAvailableMinutes,
      dashboardAnalytics,
      dashboardAnalyticsError,
      dashboardAnalyticsLoading,
      dueCount,
      examLabel,
      growthAreas,
      hasActiveSession,
      isLoadingStats,
      navigate,
      onNavigateToSrsReview,
      onNavigateToStudyPathDashboard,
      onOpenSettings,
      onStartSession,
      performanceData,
      profile,
      startShort,
      startToday,
      todayPlan,
      todayPlanError,
      todayPlanLoading,
    ],
  );

  return <AdaptiveDashboardPage context={context} />;
};

export default CommandCenterWorkspace;
