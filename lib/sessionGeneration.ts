/**
 * Shared helpers for launching, normalizing, and persisting generated study
 * sessions.
 *
 * This module is intentionally shared by the frontend hooks and the production
 * edge session endpoints so the session contract does not drift across layers.
 */

import type {
  SessionGenerateRequest,
  SessionGenerateResult,
  SessionMetadata,
  SessionPriorityBreakdown,
  StudySessionSnapshot,
} from './api/types/sessions';

export type SessionLaunchMode = 'mainSession' | 'review' | 'drill';

export interface NormalizedSessionQuestion {
  id: string;
  vignette?: string | null;
  question: string;
  options: string[];
  correctAnswer: string;
  correctAnswerIndex: number;
  explanation?: string | null;
  rationale: string;
  topic: string;
  system?: string;
  category?: string;
  subcategory?: string;
  conditionId: string;
  condition: string;
  difficulty?: 'easy' | 'medium' | 'hard';
  pearls: string[];
  source?: string;
  fromStaging?: boolean;
}

export interface NormalizedSessionGenerateResult {
  sessionId: string;
  questions: NormalizedSessionQuestion[];
  metadata: SessionGenerateResult['metadata'];
  questionIds: string[];
  priorityBreakdown: SessionPriorityBreakdown;
  initialDifficulty?: string;
}

export interface PersistedStudySessionRecord {
  id: string;
  totalQuestions: number;
  mode?: string;
  focus: 'all' | 'growth' | 'review' | 'topic';
  difficulty: string;
  systemsTargeted: string[];
  questionIds: string[];
  blueprintStage?: string;
  blueprintExamTypes: string[];
  blueprintLabel?: string;
  sessionType?: string;
}

export interface SessionRunnerSettings {
  mode: 'standard' | 'review';
  focus: 'all' | 'growth' | 'review' | 'topic';
  systems: string[];
  difficulty: string;
  count?: number;
  questionCount?: number;
  stage?: string;
}

type SessionQuestionInput = {
  id?: string | null;
  vignette?: string | null;
  question?: string | null;
  options?: unknown;
  correctAnswer?: string | null;
  correctAnswerIndex?: number | null;
  rationale?: unknown;
  explanation?: string | null;
  system?: string | null;
  category?: string | null;
  subcategory?: string | null;
  topic?: string | null;
  conditionId?: string | null;
  condition?: string | { name?: string | null; system?: string | null } | null;
  difficulty?: string | null;
  pearls?: string[] | null;
  source?: string | null;
  fromStaging?: boolean | null;
  tags?: string[] | null;
};

/**
 * Maps legacy frontend launch modes onto the live session-generation API modes.
 *
 * `drill` currently reuses the focused session lane until a dedicated drill
 * generator is wired through this launcher path.
 */
export function mapLaunchModeToSessionRequestMode(
  mode: SessionLaunchMode
): NonNullable<SessionGenerateRequest['mode']> {
  switch (mode) {
    case 'review':
      return 'review';
    case 'drill':
      return 'focused';
    case 'mainSession':
    default:
      return 'adaptive';
  }
}

export function buildLegacyPriorityBreakdown(
  metadata: Pick<SessionMetadata, 'dueReviewCount' | 'newCardCount'>,
  existing?: Partial<Record<keyof SessionPriorityBreakdown, number>> | null
): SessionPriorityBreakdown {
  const dueReviewCount = normalizeCount(existing?.A, metadata.dueReviewCount);
  const newCardCount = normalizeCount(existing?.C, metadata.newCardCount);

  return {
    A: dueReviewCount,
    B: normalizeCount(existing?.B, 0),
    C: newCardCount,
  };
}

export function normalizeSessionQuestion(input: SessionQuestionInput): NormalizedSessionQuestion {
  const conditionName = extractConditionName(input);
  const system = normalizeNullableString(input.system) ?? extractConditionSystem(input.condition);
  const topic =
    normalizeNullableString(input.topic) ??
    conditionName ??
    system ??
    'General';
  const options = normalizeOptions(input.options);
  const correctAnswerIndex = deriveCorrectAnswerIndex(input.correctAnswerIndex, input.correctAnswer, options);
  const normalizedCorrectAnswer = normalizeNullableString(input.correctAnswer);
  const conditionId =
    normalizeNullableString(input.conditionId) ??
    slugifyIdentifier(conditionName ?? topic ?? system ?? input.id ?? 'unknown');
  const rationale = normalizeRationale(input.rationale, input.explanation);

  return {
    id: normalizeNullableString(input.id) ?? '',
    vignette: normalizeNullableString(input.vignette),
    question:
      normalizeNullableString(input.question) ??
      normalizeNullableString(input.vignette) ??
      '',
    options,
    correctAnswer:
      options[correctAnswerIndex] ??
      normalizedCorrectAnswer ??
      '',
    correctAnswerIndex,
    explanation: normalizeNullableString(input.explanation),
    rationale,
    topic,
    system: system ?? undefined,
    category: normalizeNullableString(input.category) ?? undefined,
    subcategory:
      normalizeNullableString(input.subcategory) ??
      normalizeNullableString(input.category) ??
      undefined,
    conditionId,
    condition: conditionName ?? topic,
    difficulty: normalizeDifficulty(input.difficulty),
    pearls: Array.isArray(input.pearls) ? input.pearls.filter(isNonEmptyString) : [],
    source: normalizeNullableString(input.source) ?? undefined,
    fromStaging: input.fromStaging === true ? true : undefined,
  };
}

export function normalizeSessionGenerateResult(
  result: SessionGenerateResult
): NormalizedSessionGenerateResult {
  const normalizedQuestions = result.questions.map((question) =>
    normalizeSessionQuestion(question as SessionQuestionInput)
  );

  return {
    ...result,
    questions: normalizedQuestions,
    questionIds: normalizeQuestionIds(result.questionIds, normalizedQuestions),
    priorityBreakdown: buildLegacyPriorityBreakdown(
      result.metadata,
      result.priorityBreakdown ?? undefined
    ),
  };
}

export function deriveStoredSessionFocus(
  mode: SessionGenerateRequest['mode'] | string | null | undefined
): PersistedStudySessionRecord['focus'] {
  switch (mode) {
    case 'review':
      return 'review';
    case 'focused':
      return 'growth';
    case 'system':
    case 'subcategory':
    case 'condition':
      return 'topic';
    case 'adaptive':
    default:
      return 'all';
  }
}

export function buildGeneratedStudySessionRecord(input: {
  request: Pick<
    SessionGenerateRequest,
    | 'mode'
    | 'initialDifficulty'
    | 'systems'
    | 'system'
    | 'blueprintStage'
    | 'blueprintExamTypes'
    | 'blueprintLabel'
    | 'sessionLane'
  >;
  result: Pick<NormalizedSessionGenerateResult, 'sessionId' | 'questionIds' | 'questions' | 'metadata'>;
}): PersistedStudySessionRecord {
  const systemsTargeted = deriveSystemsTargeted(
    input.request.systems,
    input.request.system,
    input.result.metadata.systemDistribution
  );

  return {
    id: input.result.sessionId,
    totalQuestions: input.result.questions.length,
    mode: input.request.mode ?? input.result.metadata.mode,
    focus: deriveStoredSessionFocus(input.request.mode ?? input.result.metadata.mode),
    difficulty: normalizeNullableString(input.request.initialDifficulty) ?? 'adaptive',
    systemsTargeted,
    questionIds: input.result.questionIds,
    blueprintStage: normalizeNullableString(input.request.blueprintStage) ?? undefined,
    blueprintExamTypes: Array.isArray(input.request.blueprintExamTypes)
      ? input.request.blueprintExamTypes.filter(isNonEmptyString)
      : [],
    blueprintLabel: normalizeNullableString(input.request.blueprintLabel) ?? undefined,
    sessionType: normalizeNullableString(input.request.sessionLane) ?? undefined,
  };
}

export function buildSessionSettingsFromSnapshot(
  snapshot: StudySessionSnapshot | null | undefined,
  fallbackSystems: string[] = []
): SessionRunnerSettings {
  const focus =
    normalizeStoredFocus(snapshot?.focus) ??
    deriveStoredSessionFocus(normalizeNullableString(snapshot?.mode));
  const systems = dedupeStrings([
    ...(snapshot?.systemsTargeted ?? []),
    ...fallbackSystems,
  ]);

  return {
    mode: normalizeNullableString(snapshot?.mode) === 'review' ? 'review' : 'standard',
    focus,
    systems,
    difficulty: normalizeNullableString(snapshot?.difficulty) ?? 'adaptive',
    count: normalizePositiveInteger(snapshot?.totalQuestions) ?? undefined,
    questionCount: normalizePositiveInteger(snapshot?.totalQuestions) ?? undefined,
    stage: normalizeNullableString(snapshot?.blueprintStage) ?? undefined,
  };
}

export function buildSessionModeLabel(
  snapshot: StudySessionSnapshot | null | undefined
): string {
  switch (normalizeNullableString(snapshot?.mode)) {
    case 'review':
      return 'Practice \u2192 Review Session';
    case 'focused':
      return 'Practice \u2192 Focus Session';
    case 'system':
    case 'subcategory':
    case 'condition':
      return 'Practice \u2192 Targeted Session';
    default:
      return 'Practice \u2192 Session';
  }
}

function normalizeQuestionIds(
  questionIds: SessionGenerateResult['questionIds'],
  questions: Array<Pick<NormalizedSessionQuestion, 'id'>>
): string[] {
  if (Array.isArray(questionIds) && questionIds.every((id) => typeof id === 'string')) {
    return questionIds;
  }

  return questions
    .map((question) => question.id)
    .filter((id): id is string => typeof id === 'string' && id.length > 0);
}

function normalizeOptions(options: unknown): string[] {
  if (!Array.isArray(options)) {
    return [];
  }

  return options
    .map((option) => {
      if (typeof option === 'string') {
        return option;
      }
      if (option && typeof option === 'object' && 'text' in option) {
        return normalizeNullableString((option as { text?: unknown }).text) ?? '';
      }
      return '';
    })
    .filter(isNonEmptyString);
}

/**
 * Resolve the correct answer index from either a pre-computed numeric index or
 * a raw correctAnswer string. Patient-safety critical: when input is unresolvable
 * we return -1 rather than silently defaulting to 0 (option A). Returning -1
 * means user selections (0..N-1) will never match, so the question is scored
 * as always-wrong and the bug surfaces in analytics instead of penalizing /
 * rewarding the student incorrectly.
 *
 * Callers downstream that index into `options[correctAnswerIndex]` must guard
 * against -1.
 */
function deriveCorrectAnswerIndex(
  correctAnswerIndex: number | null | undefined,
  correctAnswer: string | null | undefined,
  options: string[]
): number {
  const maxIndex = options.length > 0 ? options.length - 1 : 0;

  if (typeof correctAnswerIndex === 'number' && Number.isFinite(correctAnswerIndex) && correctAnswerIndex >= 0) {
    return Math.min(Math.round(correctAnswerIndex), maxIndex);
  }

  const normalizedCorrectAnswer = normalizeNullableString(correctAnswer);
  if (!normalizedCorrectAnswer || options.length === 0) {
    console.error(
      '[sessionGeneration] Cannot resolve correctAnswerIndex: missing correctAnswer or empty options array',
      { correctAnswer, optionsLength: options.length }
    );
    return -1;
  }

  const letterMatch = normalizedCorrectAnswer.trim().match(/^[A-E]$/i);
  if (letterMatch) {
    const letterIdx = letterMatch[0]!.toUpperCase().charCodeAt(0) - 65;
    if (letterIdx >= 0 && letterIdx <= maxIndex) {
      return letterIdx;
    }
  }

  const directMatchIndex = options.findIndex(
    (option) => option.trim().toLowerCase() === normalizedCorrectAnswer.trim().toLowerCase()
  );
  if (directMatchIndex >= 0) {
    return directMatchIndex;
  }

  const includesMatchIndex = options.findIndex((option) =>
    option.trim().toLowerCase().includes(normalizedCorrectAnswer.trim().toLowerCase())
  );
  if (includesMatchIndex >= 0) {
    return includesMatchIndex;
  }

  // Patient-safety: do NOT silently fall back to 0 — that would mark wrong
  // answers as right (or vice versa) without any signal to the student or
  // admin. Return -1 so the question always scores as incorrect until the
  // underlying data issue is fixed.
  console.error(
    '[sessionGeneration] correctAnswer unresolvable — cannot match letter, index, or option text',
    { correctAnswer: normalizedCorrectAnswer, options }
  );
  return -1;
}

function normalizeRationale(rationale: unknown, explanation?: string | null): string {
  if (typeof rationale === 'string' && rationale.trim().length > 0) {
    return rationale;
  }

  if (rationale && typeof rationale === 'object') {
    try {
      return JSON.stringify(rationale);
    } catch {
      return normalizeNullableString(explanation) ?? '';
    }
  }

  return normalizeNullableString(explanation) ?? '';
}

function normalizeDifficulty(
  difficulty: string | null | undefined
): 'easy' | 'medium' | 'hard' | undefined {
  switch (normalizeNullableString(difficulty)?.toLowerCase()) {
    case 'easy':
      return 'easy';
    case 'medium':
      return 'medium';
    case 'hard':
      return 'hard';
    default:
      return undefined;
  }
}

function extractConditionName(
  input: Pick<SessionQuestionInput, 'condition' | 'topic' | 'tags'>
): string | null {
  if (typeof input.condition === 'string') {
    return normalizeNullableString(input.condition);
  }

  if (input.condition && typeof input.condition === 'object') {
    return normalizeNullableString(input.condition.name);
  }

  if (Array.isArray(input.tags) && input.tags.length > 0) {
    return normalizeNullableString(input.tags[0]);
  }

  return normalizeNullableString(input.topic);
}

function extractConditionSystem(
  condition: SessionQuestionInput['condition']
): string | null {
  if (condition && typeof condition === 'object') {
    return normalizeNullableString(condition.system);
  }

  return null;
}

function deriveSystemsTargeted(
  explicitSystems: string[] | undefined,
  explicitSystem: string | undefined,
  systemDistribution: Record<string, number>
): string[] {
  if (Array.isArray(explicitSystems) && explicitSystems.length > 0) {
    return dedupeStrings(explicitSystems);
  }

  if (typeof explicitSystem === 'string' && explicitSystem.length > 0) {
    return [explicitSystem];
  }

  return dedupeStrings(Object.keys(systemDistribution));
}

function dedupeStrings(values: string[]): string[] {
  return Array.from(
    new Set(values.filter((value): value is string => typeof value === 'string' && value.trim().length > 0))
  );
}

function normalizePositiveInteger(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.round(value) : null;
}

function normalizeNullableString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

function normalizeStoredFocus(
  focus: string | null | undefined
): SessionRunnerSettings['focus'] | null {
  switch (normalizeNullableString(focus)) {
    case 'all':
      return 'all';
    case 'growth':
      return 'growth';
    case 'review':
      return 'review';
    case 'topic':
      return 'topic';
    default:
      return null;
  }
}

function normalizeCount(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : fallback;
}

function slugifyIdentifier(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'unknown';
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}
