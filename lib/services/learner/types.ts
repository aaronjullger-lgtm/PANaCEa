/**
 * Learner Agent — shared types and service contracts.
 *
 * The model layer may call these interfaces via tools; implementations
 * MUST remain deterministic and testable. FSRS math lives elsewhere.
 */

import type { StudyPlanTask } from '../studyPlanService';
import type { DailyStudyAllocation } from '../dailyStudyAllocatorService';

// ─── Correlation & observability ───────────────────────────────────────────

export interface LearnerCorrelationContext {
  correlationId: string;
  userId: string;
  agentInstanceId?: string;
  sessionId?: string;
  recommendationId?: string;
}

// ─── Context ───────────────────────────────────────────────────────────────

export interface LearnerProfileSnapshot {
  userId: string;
  examDate: string | null;
  currentRotation: string | null;
  rotationEndDate: string | null;
  trainingPhase: string | null;
  dailyGoal: number | null;
  sessionLengthMinutes: number | null;
  preferredSystems: string[];
}

export interface RotationContext {
  rotation: string | null;
  systemsInScope: string[];
  eorTestDate: string | null;
  rotationEndDate: string | null;
  daysRemaining: number | null;
}

export interface LearnerContext {
  profile: LearnerProfileSnapshot;
  rotation: RotationContext;
  allocation: DailyStudyAllocation | null;
  dueItemCounts: {
    overdueFsrs: number;
    dueTodayFsrs: number;
    pendingPlanTasks: number;
  };
  fetchedAt: string;
}

// ─── Due items ─────────────────────────────────────────────────────────────

export type DueItemKind = 'fsrs_review' | 'plan_task' | 'blueprint_gap';

export interface DueLearningItem {
  id: string;
  kind: DueItemKind;
  title: string;
  system?: string;
  conditionId?: string;
  dueAt: string | null;
  overdueHours: number;
  priorityScore: number;
  metadata?: Record<string, unknown>;
}

// ─── Next best action ──────────────────────────────────────────────────────

export type NextActionType =
  | 'fsrs_review_session'
  | 'targeted_drill'
  | 'main_readiness_session'
  | 'plan_task'
  | 'rest_day'
  | 'defer';

export interface NextBestAction {
  /** Stable id for telemetry; derived from ranking inputs */
  id: string;
  type: NextActionType;
  title: string;
  whyNow: string;
  /** Deterministic score used for ranking */
  score: number;
  estimatedMinutes: number;
  launchRoute: string;
  launchParams: Record<string, string>;
  /** Provenance for grounding — not model-generated */
  sources: Array<{
    type: 'fsrs' | 'study_plan' | 'allocator' | 'rotation' | 'blueprint';
    detail: string;
  }>;
  /** Full ranked list for transparency */
  alternates: Array<{ id: string; type: NextActionType; title: string; score: number }>;
  generatedAt: string;
}

export interface NextBestActionRequest {
  userId: string;
  now?: Date;
  /** Optional learner-stated objective (does not override ranking) */
  statedObjective?: string;
  /** Available study minutes today */
  availableMinutes?: number;
}

// ─── Assignments ───────────────────────────────────────────────────────────

export interface UpcomingAssignment {
  id: string;
  title: string;
  dueAt: string | null;
  status: string;
  mode: string;
  estimatedMinutes: number;
  rationale: string | null;
}

// ─── Progress ──────────────────────────────────────────────────────────────

export interface ProgressSummary {
  totalAttempts: number;
  overallAccuracy: number;
  dueToday: number;
  overdue: number;
  todayPlanProgress: {
    completedTasks: number;
    totalTasks: number;
    questionsAnswered: number;
    targetQuestions: number;
  } | null;
  weakestSystems: string[];
}

// ─── Session ───────────────────────────────────────────────────────────────

export interface StudySessionStartResult {
  sessionId: string;
  objective: string;
  recommendedAction: NextBestAction;
  startedAt: string;
}

export interface StudySessionCompleteInput {
  sessionId: string;
  questionsAnswered: number;
  accuracy: number;
  durationMinutes: number;
}

export interface StudySessionCompleteResult {
  sessionId: string;
  completedAt: string;
  progressSummary: ProgressSummary;
  nextAction: NextBestAction;
}

// ─── Grounded content ──────────────────────────────────────────────────────

export interface GroundedContentResult {
  query: string;
  items: Array<{
    sourceType: string;
    sourceId: string;
    title: string;
    excerpt: string;
    citationLabel: string;
    reviewStatus?: string;
  }>;
  retrievedAt: string;
}

// ─── Reminders ─────────────────────────────────────────────────────────────

export interface LearnerReminderInput {
  reminderId: string;
  message: string;
  scheduledAt: string;
  category: 'study' | 'review' | 'assignment';
}

export interface LearnerReminderResult {
  reminderId: string;
  scheduledAt: string;
  idempotent: boolean;
}

// ─── Plan constraints ──────────────────────────────────────────────────────

export interface StudyPlanConstraints {
  targetQuestionsPerDay?: number;
  focusSystems?: string[];
  examDate?: string;
  preserveCompleted?: boolean;
}

export interface StudyPlanRevisionRequest {
  userId: string;
  requestId: string;
  changeDescription: string;
  constraints?: StudyPlanConstraints;
}

/** Re-export plan task type for tools */
export type { StudyPlanTask };
