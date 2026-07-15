/**
 * PANaCEa Builder Agent — core types and status model.
 */

export const BUILDER_RUN_STATUSES = [
  'intake',
  'analyzing',
  'awaiting_plan_approval',
  'approved',
  'executing',
  'testing',
  'awaiting_pr_review',
  'revising',
  'awaiting_merge_approval',
  'completed',
  'failed',
  'canceled',
] as const;

export type BuilderRunStatus = (typeof BUILDER_RUN_STATUSES)[number];

export const TERMINAL_STATUSES: ReadonlySet<BuilderRunStatus> = new Set([
  'completed',
  'failed',
  'canceled',
]);

export type TaskSource =
  | 'idea'
  | 'audit'
  | 'bug'
  | 'sentry'
  | 'linear'
  | 'github'
  | 'manual';

export type ApprovalKind =
  | 'plan'
  | 'merge'
  | 'deploy'
  | 'infrastructure'
  | 'credentials';

export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'expired';

export interface PendingApproval {
  id: string;
  kind: ApprovalKind;
  status: ApprovalStatus;
  requestedAt: string;
  resolvedAt?: string;
  resolvedBy?: string;
  reason?: string;
  expiresAt?: string;
}

export interface ToolActivitySummary {
  tool: string;
  action: string;
  ok: boolean;
  durationMs: number;
  at: string;
  summary?: string;
}

export interface TestResultSummary {
  command: string;
  ok: boolean;
  exitCode: number;
  durationMs: number;
  outputPreview?: string;
}

export interface CiResultSummary {
  checkName: string;
  status: 'queued' | 'in_progress' | 'completed';
  conclusion?: 'success' | 'failure' | 'cancelled' | 'skipped';
  url?: string;
}

export interface BuilderRunState {
  runId: string;
  correlationId: string;
  requestingUser: string;
  workspaceId: string;
  taskSource: TaskSource;
  sourceId?: string;
  repository: string;
  baseBranch: string;
  objective: string;
  status: BuilderRunStatus;
  specRef?: string;
  planRef?: string;
  currentStep?: string;
  completedCheckpoints: string[];
  pendingApprovals: PendingApproval[];
  toolActivity: ToolActivitySummary[];
  testResults: TestResultSummary[];
  ciResults: CiResultSummary[];
  prUrl?: string;
  branchName?: string;
  artifacts: string[];
  retryCount: number;
  errorSummary?: string;
  dryRun: boolean;
  integrationStatus: Record<string, 'live' | 'mocked' | 'blocked'>;
  createdAt: string;
  updatedAt: string;
}

export interface IntakePayload {
  taskSource: TaskSource;
  sourceId?: string;
  objective: string;
  repository?: string;
  baseBranch?: string;
  requestingUser: string;
  workspaceId?: string;
  dryRun?: boolean;
  idempotencyKey?: string;
  metadata?: Record<string, unknown>;
}

export interface BuilderAgentEnv {
  BUILDER_AGENT_API_KEY: string;
  BUILDER_AGENT_WEBHOOK_SECRET?: string;
  BUILDER_AGENT_DRY_RUN?: string;
  BUILDER_AGENT_SANDBOX_ENABLED?: string;
  BUILDER_AGENT_DEFAULT_REPO?: string;
  BUILDER_AGENT_DEFAULT_BRANCH?: string;
  GITHUB_TOKEN?: string;
  LINEAR_API_KEY?: string;
  SENTRY_AUTH_TOKEN?: string;
  SENTRY_ORG?: string;
  CONTEXT7_API_KEY?: string;
  SENTRY_DSN?: string;
}

export function createInitialRunState(
  intake: IntakePayload,
  runId: string,
  correlationId: string,
  defaults: { repository: string; baseBranch: string; workspaceId: string }
): BuilderRunState {
  const now = new Date().toISOString();
  return {
    runId,
    correlationId,
    requestingUser: intake.requestingUser,
    workspaceId: intake.workspaceId ?? defaults.workspaceId,
    taskSource: intake.taskSource,
    sourceId: intake.sourceId,
    repository: intake.repository ?? defaults.repository,
    baseBranch: intake.baseBranch ?? defaults.baseBranch,
    objective: intake.objective,
    status: 'intake',
    completedCheckpoints: [],
    pendingApprovals: [],
    toolActivity: [],
    testResults: [],
    ciResults: [],
    artifacts: [],
    retryCount: 0,
    dryRun: intake.dryRun ?? false,
    integrationStatus: {},
    createdAt: now,
    updatedAt: now,
  };
}
