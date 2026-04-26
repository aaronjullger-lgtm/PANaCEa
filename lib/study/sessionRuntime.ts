import type { Question, SessionSettings } from '@/types';
import { createSessionsClient } from '@/lib/sdk/sessionsClient';
import type { ApiClient } from '@/lib/sdk/core';
import type {
  SessionGeneratePayload,
  SessionGenerateResult,
} from '@/lib/sdk';
import type { SessionMetadata } from '@/lib/api/types/sessions';
import { MAX_SESSION_SIZE } from '@/lib/constants/sessionDefaults';
import { getStableQuestionId, normalizeStudyQuestions } from './questionIdentity';

export type LegacySessionMode = 'mainSession' | 'review' | 'drill';

export interface GenerateStudySessionOptions extends Omit<Partial<SessionGeneratePayload>, 'mode'> {
  mode?: SessionGeneratePayload['mode'] | LegacySessionMode;
  adaptive?: boolean;
  onProgress?: (progress: StudySessionGenerationProgress) => void;
  maxBatchRequests?: number;
}

export interface StudySessionGenerationProgress {
  requestedQuestions: number;
  generatedQuestions: number;
  completedBatches: number;
  totalBatches: number;
  lastBatchSize: number;
}

export interface StudySessionRuntime {
  sessionId: string;
  mode: SessionGeneratePayload['mode'];
  questionIds: string[];
  questions: Question[];
  metadata: SessionMetadata;
  request: SessionGeneratePayload;
  createdAt: number;
  updatedAt: number;
}

export type StudySessionStatus = 'active' | 'paused' | 'completed' | 'abandoned';

export interface StudyAttemptRecord {
  id: string;
  sessionId: string | null;
  questionId: string;
  canonicalQuestionId?: string | null;
  questionNumber?: number;
  source: 'session' | 'drill';
  result: 'correct' | 'incorrect';
  selectedAnswer?: string;
  selectedAnswerIndex?: number;
  timeSpentMs: number;
  submittedAt: number;
  system?: string | null;
  conditionId?: string | null;
  syncState: 'queued' | 'synced' | 'local';
}

export interface StudySessionResponseRecord {
  id: string;
  sessionId: string;
  questionId: string;
  canonicalQuestionId?: string | null;
  questionNumber: number;
  questionIndex: number;
  result: 'correct' | 'incorrect';
  selectedAnswer?: string;
  selectedAnswerIndex?: number;
  timeSpentMs: number;
  submittedAt: number;
  system?: string | null;
  conditionId?: string | null;
  syncState: 'queued' | 'synced' | 'local';
}

export interface StudySessionProgressRecord {
  sessionId: string;
  status: StudySessionStatus;
  startedAt: number;
  lastActiveAt: number;
  pausedAt: number | null;
  completedAt: number | null;
  currentQuestionIndex: number;
  questionNumber: number;
  responses: StudySessionResponseRecord[];
}

export interface StudySessionSummaryRecord {
  sessionId: string;
  timestamp: number;
  mode: SessionSettings['mode'] | string;
  questionsCompleted: number;
  questionsCorrect: number;
  accuracy: number;
  durationMs: number;
}

export interface StudySessionHistoryRecord {
  sessionId: string;
  runtime: StudySessionRuntime;
  progress: StudySessionProgressRecord;
  summary: StudySessionSummaryRecord;
  reviewQuestionIds: string[];
}

export interface GeneratedStudySession {
  sessionId: string;
  mode: string;
  questionIds: string[];
  questions: Question[];
  priorityBreakdown: {
    A: number;
    B: number;
    C: number;
  };
  deficitsAddressed: Array<{
    system: string;
    deficitPercent: number;
  }>;
  interleavingEnforced: boolean;
  message: string;
  initialDifficulty?: string;
  metadata: SessionMetadata;
}

export interface CreateStudySessionRuntimeFromQuestionsOptions {
  sessionId: string;
  questions: unknown[];
  request?: Partial<SessionGeneratePayload>;
  metadata?: Partial<SessionMetadata>;
  mode?: SessionGeneratePayload['mode'];
}

function normalizeRequestedMode(
  options: GenerateStudySessionOptions
): SessionGeneratePayload['mode'] {
  switch (options.mode) {
    case 'mainSession':
      return 'adaptive';
    case 'review':
      return 'review';
    case 'drill':
      return 'focused';
    default:
      return options.mode ?? 'adaptive';
  }
}

export function normalizeSessionGeneratePayload(
  options: GenerateStudySessionOptions = {}
): SessionGeneratePayload {
  const mode = normalizeRequestedMode(options);
  const systems = options.systems?.filter(Boolean);

  return {
    mode,
    size: options.size ?? 20,
    systems: systems?.length ? systems : undefined,
    system: options.system ?? systems?.[0],
    subcategory: options.subcategory,
    conditionId: options.conditionId,
    boostSystems: options.boostSystems,
    suppressSystems: options.suppressSystems,
    perSystemCaps: options.perSystemCaps,
    blueprintWeights: options.blueprintWeights,
    blueprintStage: options.blueprintStage,
    blueprintExamTypes: options.blueprintExamTypes,
    blueprintLabel: options.blueprintLabel,
    urgencyMultiplier: options.urgencyMultiplier,
    gatedSystems: options.gatedSystems,
    initialDifficulty: options.initialDifficulty,
    sessionLane:
      options.sessionLane ??
      (options.mode === 'drill' ? 'drill' : undefined),
    eorDeadline: options.eorDeadline,
  };
}

export function createStudySessionProgress(
  sessionId: string,
  overrides: Partial<StudySessionProgressRecord> = {}
): StudySessionProgressRecord {
  const now = Date.now();
  return {
    sessionId,
    status: 'active',
    startedAt: now,
    lastActiveAt: now,
    pausedAt: null,
    completedAt: null,
    currentQuestionIndex: 0,
    questionNumber: 1,
    responses: [],
    ...overrides,
  };
}

export function getReviewQuestionIds(
  progress: Pick<StudySessionProgressRecord, 'responses'>
): string[] {
  const ids = new Set<string>();
  for (const response of progress.responses) {
    if (response.result === 'incorrect') {
      ids.add(response.questionId);
    }
  }
  return Array.from(ids);
}

export function buildStudyReviewQueue(
  runtime: Pick<StudySessionRuntime, 'questions'>,
  progress: Pick<StudySessionProgressRecord, 'responses'>
): Question[] {
  const reviewIds = new Set(getReviewQuestionIds(progress));
  return runtime.questions.filter((question) => reviewIds.has(question.id));
}

export function createStudySessionRuntimeFromQuestions(
  options: CreateStudySessionRuntimeFromQuestionsOptions
): StudySessionRuntime {
  const questions = normalizeStudyQuestions(options.questions as any[]);
  const request: SessionGeneratePayload = {
    mode: options.request?.mode ?? options.mode ?? 'adaptive',
    size: options.request?.size ?? questions.length,
    systems: options.request?.systems,
    system: options.request?.system,
    subcategory: options.request?.subcategory,
    conditionId: options.request?.conditionId,
    boostSystems: options.request?.boostSystems,
    suppressSystems: options.request?.suppressSystems,
    perSystemCaps: options.request?.perSystemCaps,
    blueprintWeights: options.request?.blueprintWeights,
    blueprintStage: options.request?.blueprintStage,
    blueprintExamTypes: options.request?.blueprintExamTypes,
    blueprintLabel: options.request?.blueprintLabel,
    urgencyMultiplier: options.request?.urgencyMultiplier,
    gatedSystems: options.request?.gatedSystems,
    initialDifficulty: options.request?.initialDifficulty,
    sessionLane: options.request?.sessionLane,
    eorDeadline: options.request?.eorDeadline,
  };
  const createdAt = Date.now();

  return {
    sessionId: options.sessionId,
    mode: request.mode,
    questionIds: questions.map((question) => question.id),
    questions,
    metadata: {
      dueReviewCount: options.metadata?.dueReviewCount ?? 0,
      newCardCount: options.metadata?.newCardCount ?? questions.length,
      systemDistribution:
        options.metadata?.systemDistribution ??
        questions.reduce<Record<string, number>>((distribution, question) => {
          const system = question.system ?? 'Unknown';
          distribution[system] = (distribution[system] ?? 0) + 1;
          return distribution;
        }, {}),
      estimatedMinutes:
        options.metadata?.estimatedMinutes ?? Math.ceil((questions.length * 90) / 60),
      mode: options.metadata?.mode ?? request.mode,
      blueprintStage: options.metadata?.blueprintStage ?? request.blueprintStage,
      learnerPhase: options.metadata?.learnerPhase,
      source: options.metadata?.source ?? 'on_demand',
      adaptiveVersion: options.metadata?.adaptiveVersion,
      selectionMix:
        options.metadata?.selectionMix ?? {
          dueReviewCount: options.metadata?.dueReviewCount ?? 0,
          resurfacedCount: 0,
          newCardCount: options.metadata?.newCardCount ?? questions.length,
        },
    },
    request,
    createdAt,
    updatedAt: createdAt,
  };
}

function mergeSystemDistribution(
  left: Record<string, number>,
  right: Record<string, number>
): Record<string, number> {
  const merged = { ...left };
  for (const [system, count] of Object.entries(right)) {
    merged[system] = (merged[system] ?? 0) + count;
  }
  return merged;
}

function mergeMetadata(
  base: SessionMetadata | null,
  next: SessionMetadata,
  requestMode: SessionGeneratePayload['mode']
): SessionMetadata {
  if (!base) {
    return {
      ...next,
      mode: requestMode,
    };
  }

  return {
    dueReviewCount: base.dueReviewCount + next.dueReviewCount,
    newCardCount: base.newCardCount + next.newCardCount,
    systemDistribution: mergeSystemDistribution(base.systemDistribution, next.systemDistribution),
    estimatedMinutes: base.estimatedMinutes + next.estimatedMinutes,
    mode: requestMode,
    blueprintStage: next.blueprintStage ?? base.blueprintStage,
    learnerPhase: next.learnerPhase ?? base.learnerPhase,
    source: base.source === next.source ? base.source : 'mixed',
    adaptiveVersion: next.adaptiveVersion ?? base.adaptiveVersion,
    selectionMix:
      base.selectionMix || next.selectionMix
        ? {
            dueReviewCount:
              (base.selectionMix?.dueReviewCount ?? base.dueReviewCount) +
              (next.selectionMix?.dueReviewCount ?? next.dueReviewCount),
            resurfacedCount:
              (base.selectionMix?.resurfacedCount ?? 0) +
              (next.selectionMix?.resurfacedCount ?? 0),
            newCardCount:
              (base.selectionMix?.newCardCount ?? base.newCardCount) +
              (next.selectionMix?.newCardCount ?? next.newCardCount),
          }
        : undefined,
  };
}

async function generateLargeStudySession(
  api: ApiClient,
  payload: SessionGeneratePayload,
  options: GenerateStudySessionOptions
): Promise<{ generatedSession: GeneratedStudySession; runtime: StudySessionRuntime }> {
  const sessions = createSessionsClient(api);
  const requestedQuestions = payload.size ?? MAX_SESSION_SIZE;
  const totalBatches = Math.ceil(requestedQuestions / MAX_SESSION_SIZE);
  const maxBatchRequests = options.maxBatchRequests ?? totalBatches + 2;
  const seenQuestionIds = new Set<string>();
  const mergedQuestions: Question[] = [];
  let mergedMetadata: SessionMetadata | null = null;
  let primarySessionId: string | null = null;
  let lastInitialDifficulty: string | undefined;
  let completedBatches = 0;
  let noGrowthBatches = 0;

  for (let batchIndex = 0; batchIndex < maxBatchRequests; batchIndex += 1) {
    const remainingQuestions = requestedQuestions - mergedQuestions.length;
    if (remainingQuestions <= 0) break;

    const batchPayload: SessionGeneratePayload = {
      ...payload,
      size: Math.min(remainingQuestions, MAX_SESSION_SIZE),
    };

    const result = await sessions.generate(batchPayload);
    const { generatedSession } = normalizeGeneratedStudySession(result, batchPayload);
    primarySessionId ??= generatedSession.sessionId;
    mergedMetadata = mergeMetadata(mergedMetadata, generatedSession.metadata, payload.mode);
    lastInitialDifficulty = generatedSession.initialDifficulty ?? lastInitialDifficulty;

    let addedThisBatch = 0;
    for (const question of generatedSession.questions) {
      const stableQuestionId = getStableQuestionId(question);
      if (seenQuestionIds.has(stableQuestionId)) continue;
      seenQuestionIds.add(stableQuestionId);
      mergedQuestions.push(question);
      addedThisBatch += 1;
      if (mergedQuestions.length >= requestedQuestions) break;
    }

    completedBatches += 1;
    options.onProgress?.({
      requestedQuestions,
      generatedQuestions: mergedQuestions.length,
      completedBatches,
      totalBatches,
      lastBatchSize: generatedSession.questions.length,
    });

    if (addedThisBatch === 0) {
      noGrowthBatches += 1;
      if (noGrowthBatches >= 2) break;
    } else {
      noGrowthBatches = 0;
    }
  }

  if (!primarySessionId || mergedQuestions.length < requestedQuestions || !mergedMetadata) {
    throw new Error(
      `Unable to build a ${requestedQuestions}-question session. Generated ${mergedQuestions.length} unique questions.`
    );
  }

  const createdAt = Date.now();
  const questions = mergedQuestions.slice(0, requestedQuestions);
  const questionIds = questions.map((question) => question.id);
  const runtime: StudySessionRuntime = {
    sessionId: primarySessionId,
    mode: payload.mode,
    questionIds,
    questions,
    metadata: mergedMetadata,
    request: payload,
    createdAt,
    updatedAt: createdAt,
  };

  return {
    runtime,
    generatedSession: {
      sessionId: primarySessionId,
      mode: payload.mode,
      questionIds,
      questions,
      priorityBreakdown: buildPriorityBreakdown(mergedMetadata),
      deficitsAddressed: [],
      interleavingEnforced: questions.length > 1,
      message: `${questions.length}-question ${payload.mode} session ready`,
      initialDifficulty: lastInitialDifficulty ?? payload.initialDifficulty,
      metadata: mergedMetadata,
    },
  };
}

function buildPriorityBreakdown(metadata: SessionMetadata): { A: number; B: number; C: number } {
  return {
    A: metadata.dueReviewCount,
    B: metadata.newCardCount,
    C: 0,
  };
}

function buildSessionMessage(result: SessionGenerateResult, request: SessionGeneratePayload): string {
  const count = result.questions.length;
  return `${count}-question ${request.mode} session ready`;
}

export function normalizeGeneratedStudySession(
  result: SessionGenerateResult,
  request: SessionGeneratePayload
): { generatedSession: GeneratedStudySession; runtime: StudySessionRuntime } {
  const normalizedQuestions = normalizeStudyQuestions(result.questions ?? []);
  const metadata: SessionMetadata = {
    dueReviewCount: result.metadata?.dueReviewCount ?? 0,
    newCardCount: result.metadata?.newCardCount ?? 0,
    systemDistribution: result.metadata?.systemDistribution ?? {},
    estimatedMinutes: result.metadata?.estimatedMinutes ?? 0,
    mode: result.metadata?.mode ?? request.mode ?? 'adaptive',
    blueprintStage: result.metadata?.blueprintStage ?? request.blueprintStage,
    learnerPhase: result.metadata?.learnerPhase,
    source: result.metadata?.source ?? 'on_demand',
    adaptiveVersion: result.metadata?.adaptiveVersion,
    selectionMix:
      result.metadata?.selectionMix ??
      (result.metadata
        ? {
            dueReviewCount: result.metadata.dueReviewCount ?? 0,
            resurfacedCount: 0,
            newCardCount: result.metadata.newCardCount ?? 0,
          }
        : undefined),
  };
  const questionIds = normalizedQuestions.map((question) => question.id);
  const createdAt = Date.now();

  const runtime: StudySessionRuntime = {
    sessionId: result.sessionId,
    mode: request.mode ?? 'adaptive',
    questionIds,
    questions: normalizedQuestions,
    metadata,
    request,
    createdAt,
    updatedAt: createdAt,
  };

  return {
    runtime,
    generatedSession: {
      sessionId: result.sessionId,
      mode: runtime.mode,
      questionIds,
      questions: normalizedQuestions,
      priorityBreakdown: result.priorityBreakdown ?? buildPriorityBreakdown(metadata),
      deficitsAddressed: [],
      interleavingEnforced: normalizedQuestions.length > 1,
      message: buildSessionMessage(result, request),
      initialDifficulty: result.initialDifficulty ?? request.initialDifficulty,
      metadata,
    },
  };
}

export async function generateStudySession(
  api: ApiClient,
  options: GenerateStudySessionOptions = {}
): Promise<{ generatedSession: GeneratedStudySession; runtime: StudySessionRuntime }> {
  const payload = normalizeSessionGeneratePayload(options);
  if ((payload.size ?? 0) > MAX_SESSION_SIZE) {
    return generateLargeStudySession(api, payload, options);
  }
  const sessions = createSessionsClient(api);
  const result = await sessions.generate(payload);
  return normalizeGeneratedStudySession(result, payload);
}

export interface SessionQuestionsResult {
  questions: Question[];
}

export function normalizeSessionQuestionsResult(payload: unknown): SessionQuestionsResult {
  const root =
    typeof payload === 'object' && payload !== null && 'data' in payload
      ? (payload as { data?: unknown }).data
      : payload;

  const questions =
    typeof root === 'object' && root !== null && 'questions' in root
      ? (root as { questions?: unknown }).questions
      : undefined;

  return {
    questions: Array.isArray(questions) ? normalizeStudyQuestions(questions as any[]) : [],
  };
}
