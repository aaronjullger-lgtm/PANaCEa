import type {
  BlueprintCell,
  DashboardGoal,
  MatrixItem,
  PlanProtocolStep,
  ReadinessPulse,
  ReviewCoverage,
  TodayCommand,
  TrustEvent,
} from '../model/DashboardContext';
import type { DashboardInsightCandidate } from '../model/widgetTypes';

export type GoalContextData = {
  goal: DashboardGoal;
  recommendedMinutes: number;
  loading: boolean;
  partialFailure: boolean;
};

export type TodayCommandData = TodayCommand & {
  onStart?: () => void;
  onStartShort?: () => void;
  onOpenFullPlan?: () => void;
  onOpenWhy?: () => void;
};

export type InsightStackData = {
  cards: DashboardInsightCandidate[];
  emptyMessage: string;
};

export type ReviewCoverageData = ReviewCoverage & {
  onOpenReview?: () => void;
};

export type ReadinessPulseData = ReadinessPulse & {
  onOpenProgress?: () => void;
};

export type ExamHorizonData = {
  label: string;
  daysToTarget: number;
  statusLabel: string;
};

export type LoadGuardrailData = {
  title: string;
  detail: string;
  loadIndex: number;
};

export type CatchUpPlanData = {
  title: string;
  detail: string;
  minutesPerDay: number;
  days: number;
};

export type MaintenanceRhythmData = {
  title: string;
  detail: string;
  cadenceLabel: string;
};

export type MasteryUrgencyMatrixData = {
  items: MatrixItem[];
};

export type BlueprintHeatmapData = {
  cells: BlueprintCell[];
};

export type PlanProtocolStripData = {
  steps: PlanProtocolStep[];
};

export type TrustTimelineData = {
  events: TrustEvent[];
};
