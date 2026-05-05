import type { TodayPlanData } from '@/hooks/useTodayPlan';
import type { DashboardAnalyticsModel } from '@/lib/dashboard/realStudyAnalytics';
import type { PerformanceRecord, SessionSettings, UserProfile } from '@/types';
import type { DashboardInsightCandidate, DashboardMode } from './widgetTypes';

export type GoalStatus = 'on_pace' | 'catch_up' | 'behind' | 'calibrating' | 'comfortable';
export type EvidenceConfidence = 'low' | 'medium' | 'high';

export type DashboardActions = {
  onStartToday?: () => void;
  onStartShort?: () => void;
  onOpenFullPlan?: () => void;
  onOpenProgress?: () => void;
  onOpenReview?: () => void;
  onOpenPractice?: () => void;
  onStartSession?: (settings?: SessionSettings) => void;
};

export type DashboardGoal = {
  label: string;
  mode: DashboardMode;
  baseMode: Extract<DashboardMode, 'pance' | 'eor' | 'didactic' | 'panre'>;
  daysToTarget: number | null;
  status: GoalStatus;
  statusLabel: string;
  targetLabel: string;
  syncedLabel: string;
};

export type TodayCommand = {
  title: string;
  subtitle: string;
  durationMinutes: number;
  questionCount: number;
  reviewCount: number;
  expectedLiftRange: [number, number] | null;
  expectedLiftLabel: string;
  reasonChips: string[];
  primaryCtaLabel: string;
  secondaryLinks: Array<{ label: string; action: 'short' | 'full_plan' | 'why' }>;
  handledSignalIds: string[];
  stale: boolean;
};

export type ReviewCoverageDay = {
  label: string;
  stable: number;
  danger: number;
  overdue: number;
  scheduled: number;
};

export type ReviewCoverage = {
  stable: number;
  danger: number;
  overdue: number;
  coveredDanger: number;
  coveredOverdue: number;
  plannedReviewCount: number;
  coverageSource: 'plan_tasks' | 'none' | 'unknown';
  days: ReviewCoverageDay[];
  summary: string;
};

export type ReadinessPulse = {
  available: boolean;
  status: Exclude<GoalStatus, 'comfortable'> | 'unavailable';
  statusLabel: string;
  points: number[];
  confidenceLow: number[];
  confidenceHigh: number[];
  target: number | null;
  confidence: EvidenceConfidence;
  summary: string;
};

export type MatrixItem = {
  id: string;
  label: string;
  urgency: number;
  mastery: number;
  weight: number;
  trend: 'up' | 'flat' | 'down';
  isTodayTarget: boolean;
  attribution: string;
};

export type BlueprintCell = {
  id: string;
  system: string;
  subsection: string;
  mastery: number | null;
  urgency: number;
  isTodayTarget?: boolean;
};

export type PlanProtocolStep = {
  id: string;
  label: string;
  minutes: number;
  kind: 'warmup' | 'focus' | 'confusion' | 'transfer' | 'review' | 'wrapup';
  attribution: string;
};

export type TrustEvent = {
  id: string;
  when: string;
  title: string;
  detail: string;
};

export type DashboardUserState = {
  dataMaturity: number;
  loadIndex: number;
  lowData: boolean;
  overloaded: boolean;
  behind: boolean;
  ahead: boolean;
  panre: boolean;
  noReviewDebt: boolean;
};

export type DashboardDataState = {
  loading: boolean;
  partialFailure: boolean;
  empty: boolean;
  staleRecommendation: boolean;
  warnings: string[];
};

export type DashboardContext = {
  mode: DashboardMode;
  goal: DashboardGoal;
  userState: DashboardUserState;
  dataState: DashboardDataState;
  today: TodayCommand;
  reviewCoverage: ReviewCoverage;
  readiness: ReadinessPulse;
  insights: DashboardInsightCandidate[];
  matrix: MatrixItem[];
  blueprintHeatmap: BlueprintCell[];
  planProtocol: PlanProtocolStep[];
  trustTimeline: TrustEvent[];
  raw: {
    performanceData: PerformanceRecord[];
    growthAreas: string[];
    dueCount: number;
    examLabel: string;
    profile: Partial<UserProfile> | null;
    todayPlan: TodayPlanData | null;
    todayPlanError: string | null;
    dashboardAnalytics: DashboardAnalyticsModel | null;
  };
  actions: DashboardActions;
};
