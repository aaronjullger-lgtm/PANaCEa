import type { SessionSettings } from '@/types';

export type StudyPlanTargetKind = 'pance' | 'eor' | 'custom' | 'none';
export type StudyPlanStatus = 'pending' | 'in_progress' | 'completed' | 'skipped';
export type StudyPlanTaskStatus = 'pending' | 'in_progress' | 'completed' | 'skipped' | 'rescheduled';
export type StudyPlanTaskKind = 'main' | 'targeted' | 'review' | 'content' | 'rest';

export interface StudyPlanSettings {
  dailyMinutesLimit: number;
  dailyQuestionGoal: number;
  preferredDays: number[];
  focusAreas: string[];
  excludeAreas: string[];
  targetRetention: number;
  maxSessionsPerDay: number;
  /** Hours before a regenerated plan is considered stale and eligible for regeneration. Default 12. */
  planRefreshHours: number;
}

export interface StudyPlanTarget {
  kind: StudyPlanTargetKind;
  label: string;
  examDate: string | null;
  currentRotation: string | null;
}

export interface StudyPlanTask {
  id: string;
  kind: StudyPlanTaskKind;
  status: StudyPlanTaskStatus;
  title: string;
  description: string;
  reason: string;
  systems: string[];
  conditionIds: string[];
  reviewCardIds?: string[];
  estimatedMinutes: number;
  targetQuestions: number;
  launchSettings: SessionSettings;
  route: string;
  startedAt?: string | null;
  completedAt?: string | null;
  skippedAt?: string | null;
  actualQuestionsAnswered?: number | null;
  actualDurationMinutes?: number | null;
  actualAccuracy?: number | null;
  linkedSessionId?: string | null;
}

export interface StudyPlanDayProgress {
  questionsAnswered: number;
  questionsTarget: number;
  percentComplete: number;
  durationMinutes: number | null;
  estimatedDurationMinutes: number;
  accuracy: number | null;
}

export interface StudyPlanDay {
  id: string;
  planDate: string;
  status: StudyPlanStatus;
  title: string;
  summary: string;
  recommendedModes: string[];
  targetSystemFocus: string[];
  targetQuestionsCount: number;
  estimatedTimeMinutes: number;
  progress: StudyPlanDayProgress;
  tasks: StudyPlanTask[];
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface StudyPlanOverview {
  totalDays: number;
  completedDays: number;
  inProgressDays: number;
  pendingDays: number;
  completionPercent: number;
  totalTargetQuestions: number;
  totalCompletedQuestions: number;
}

export interface StudyPlanCurrentData {
  state: 'ready' | 'needs-target' | 'empty';
  target: StudyPlanTarget;
  settings: StudyPlanSettings;
  days: StudyPlanDay[];
  today: StudyPlanDay | null;
  overview: StudyPlanOverview;
  generatedAt: string | null;
}

export interface StudyPlanCurrentResponse {
  data: StudyPlanCurrentData;
}

export interface StudyPlanProgressInput {
  planDate: string;
  taskId: string;
  action: 'start' | 'complete' | 'skip';
  actualQuestionsAnswered?: number;
  actualDurationMinutes?: number;
  actualAccuracy?: number;
  linkedSessionId?: string;
}
