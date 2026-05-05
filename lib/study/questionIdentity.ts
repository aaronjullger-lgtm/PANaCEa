import type { Question } from '@/types';
import { resolveCorrectAnswerIndex as resolveAnswerIndexFromValue } from '../answerLetterMap';

const DERIVED_QUESTION_ID_PREFIX = 'localq_';

export type QuestionSource = 'question' | 'pre_generated' | 'staging' | 'seed' | 'generated';

export interface QuestionIdentity {
  canonicalQuestionId: string | null;
  sourceQuestionId: string;
  questionSource: QuestionSource;
}

export type LearningEventSessionType =
  | 'main'
  | 'drill'
  | 'targeted'
  | 'cram'
  | 'rapid_recall'
  | 'eor'
  | 'panre';

export type LearningEventProgressContext = 'READINESS' | 'TARGETED';

export interface LearningEventContext {
  userId: string;
  sessionId: string | null;
  planDate: string | null;
  taskId: string | null;
  sessionType: LearningEventSessionType;
  progressContext: LearningEventProgressContext;
}

type StudyQuestionCondition =
  | string
  | {
      id?: string | null;
      name?: string | null;
      system?: string | null;
    }
  | null
  | undefined;

export interface StudyQuestionLike {
  id?: string | null;
  questionId?: string | null;
  canonicalQuestionId?: string | null;
  sourceQuestionId?: string | null;
  questionSource?: QuestionSource | string | null;
  question?: string | null;
  stem?: string | null;
  vignette?: string | null;
  options?: unknown;
  answers?: unknown;
  correctAnswer?: string | number | null;
  answer?: string | number | null;
  correct_option?: string | number | null;
  correctChoice?: string | number | null;
  correctAnswerIndex?: number | null;
  correctIndex?: number | null;
  explanation?: string | null;
  rationale?: Question['rationale'] | null;
  topic?: string | null;
  category?: string | null;
  subcategory?: string | null;
  system?: string | null;
  difficulty?: string | null;
  conditionId?: string | null;
  medicalContentId?: string | null;
  condition?: StudyQuestionCondition;
  source?: string | null;
}

function stableHash(input: string): string {
  let hash = 2166136261;

  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0).toString(36);
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item ?? ''));
}

function resolveConditionName(condition: StudyQuestionCondition): string | undefined {
  if (!condition) return undefined;
  if (typeof condition === 'string') return condition;
  return condition.name ?? undefined;
}

function resolveConditionId(condition: StudyQuestionCondition): string | undefined {
  if (!condition || typeof condition === 'string') return undefined;
  return condition.id ?? undefined;
}

function resolveConditionSystem(condition: StudyQuestionCondition): string | undefined {
  if (!condition || typeof condition === 'string') return undefined;
  return condition.system ?? undefined;
}

export function getQuestionPrompt(question: StudyQuestionLike): string {
  return String(question.question ?? question.stem ?? '').trim();
}

export function getQuestionOptions(question: StudyQuestionLike): string[] {
  const explicitOptions = asStringArray(question.options);
  if (explicitOptions.length > 0) return explicitOptions;
  return asStringArray(question.answers);
}

export function resolveCorrectAnswerIndex(question: StudyQuestionLike): number {
  const numericIndex = question.correctAnswerIndex ?? question.correctIndex;
  const options = getQuestionOptions(question);

  if (
    typeof numericIndex === 'number' &&
    Number.isInteger(numericIndex) &&
    numericIndex >= 0 &&
    numericIndex < options.length
  ) {
    return numericIndex;
  }

  const rawAnswer =
    question.correctAnswer ?? question.answer ?? question.correct_option ?? question.correctChoice ?? null;
  const correctAnswer =
    typeof rawAnswer === 'number' ? String(rawAnswer) : typeof rawAnswer === 'string' ? rawAnswer.trim() : '';
  if (!correctAnswer) return -1;

  const resolved = resolveAnswerIndexFromValue(correctAnswer, options);
  return resolved ?? -1;
}

function buildQuestionFingerprint(question: StudyQuestionLike): string {
  const prompt = getQuestionPrompt(question);
  const vignette = String(question.vignette ?? '').trim();
  const options = getQuestionOptions(question).join('|');
  const conditionId = String(question.conditionId ?? resolveConditionId(question.condition) ?? '').trim();
  const conditionName = String(resolveConditionName(question.condition) ?? '').trim();
  const topic = String(question.topic ?? question.category ?? question.subcategory ?? '').trim();
  const system = String(question.system ?? resolveConditionSystem(question.condition) ?? '').trim();
  const correctAnswer = String(question.correctAnswer ?? '').trim();

  return [prompt, vignette, options, conditionId, conditionName, topic, system, correctAnswer].join(
    '::'
  );
}

export function isDerivedQuestionId(id: string | null | undefined): boolean {
  return Boolean(id && id.startsWith(DERIVED_QUESTION_ID_PREFIX));
}

export function getStableQuestionId(question: StudyQuestionLike): string {
  const canonicalId =
    typeof question.questionId === 'string' && question.questionId.trim().length > 0
      ? question.questionId.trim()
      : typeof question.id === 'string' && question.id.trim().length > 0
        ? question.id.trim()
        : null;

  if (canonicalId) return canonicalId;

  return `${DERIVED_QUESTION_ID_PREFIX}${stableHash(buildQuestionFingerprint(question))}`;
}

export function getServerQuestionId(question: StudyQuestionLike): string | null {
  if (
    typeof question.canonicalQuestionId === 'string' &&
    question.canonicalQuestionId.trim().length > 0
  ) {
    return question.canonicalQuestionId.trim();
  }

  if (
    question.questionSource === 'pre_generated' ||
    question.questionSource === 'staging' ||
    question.questionSource === 'seed' ||
    question.questionSource === 'generated'
  ) {
    return null;
  }

  if (typeof question.questionId === 'string' && question.questionId.trim().length > 0) {
    return question.questionId.trim();
  }

  if (typeof question.id === 'string' && question.id.trim().length > 0 && !isDerivedQuestionId(question.id)) {
    return question.id.trim();
  }

  return null;
}

export function getQuestionIdentity(question: StudyQuestionLike): QuestionIdentity {
  const sourceQuestionId =
    typeof question.sourceQuestionId === 'string' && question.sourceQuestionId.trim().length > 0
      ? question.sourceQuestionId.trim()
      : getStableQuestionId(question);
  const explicitSource = question.questionSource;
  const questionSource: QuestionSource =
    explicitSource === 'question' ||
    explicitSource === 'pre_generated' ||
    explicitSource === 'staging' ||
    explicitSource === 'seed' ||
    explicitSource === 'generated'
      ? explicitSource
      : isDerivedQuestionId(sourceQuestionId)
        ? 'generated'
        : 'question';
  const explicitCanonicalId =
    typeof question.canonicalQuestionId === 'string' && question.canonicalQuestionId.trim().length > 0
      ? question.canonicalQuestionId.trim()
      : null;

  return {
    canonicalQuestionId:
      explicitCanonicalId ?? (questionSource === 'question' ? getServerQuestionId(question) : null),
    sourceQuestionId,
    questionSource,
  };
}

export function normalizeStudyQuestion<T extends StudyQuestionLike>(question: T): Question & T {
  const prompt = getQuestionPrompt(question);
  const options = getQuestionOptions(question);
  const canonicalId = getServerQuestionId(question);
  const stableId = canonicalId ?? getStableQuestionId(question);
  const conditionName = resolveConditionName(question.condition) ?? String(question.topic ?? '').trim();
  const conditionId = String(
    question.conditionId ?? question.medicalContentId ?? resolveConditionId(question.condition) ?? ''
  ).trim();
  const system = (question.system ?? resolveConditionSystem(question.condition) ?? undefined) as Question['system'];
  const correctAnswerIndex = resolveCorrectAnswerIndex(question);
  const rationale =
    question.rationale ??
    (typeof question.explanation === 'string' ? question.explanation : '');
  const topic =
    String(question.topic ?? resolveConditionName(question.condition) ?? question.category ?? question.subcategory ?? question.system ?? 'Unknown');

  return {
    ...question,
    id: stableId,
    questionId: canonicalId ?? undefined,
    question: prompt,
    options,
    answers: asStringArray(question.answers).length > 0 ? asStringArray(question.answers) : options,
    correctAnswerIndex,
    correctIndex: correctAnswerIndex,
    rationale,
    topic,
    system,
    conditionId,
    condition: conditionName || topic,
  } as Question & T;
}

export function normalizeStudyQuestions<T extends StudyQuestionLike>(questions: T[]): Array<Question & T> {
  return questions.map((question) => normalizeStudyQuestion(question));
}
