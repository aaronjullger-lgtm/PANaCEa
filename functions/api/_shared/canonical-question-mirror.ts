import { resolveCorrectAnswerIndex as resolveAnswerIndexFromValue } from '../../../lib/answerLetterMap';

export type CanonicalQuestionMirrorInput = {
  id: string;
  questionData: unknown;
  system?: string | null;
  difficulty?: string | null;
  conditionId?: string | null;
  medicalContentId?: string | null;
  generatedAt?: Date | string | null;
};

export type CanonicalQuestionMirrorOptions = {
  source?: string;
  humanReviewed?: boolean;
};

export type CanonicalQuestionMirrorData = {
  id: string;
  vignette: string;
  question: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
  system: string;
  difficulty: string;
  source: string;
  conditionId?: string;
  medicalContentId?: string;
  category?: string | null;
  topic?: string | null;
  generatedAt?: Date;
  lifecycleStatus: 'ACTIVE';
  qaStatus: 'APPROVED';
  humanReviewed: boolean;
  updatedAt: Date;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function firstString(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  }
  return null;
}

function normalizeOptions(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((option) => {
      if (typeof option === 'string' || typeof option === 'number') {
        return String(option).trim();
      }
      const optionRecord = asRecord(option);
      return firstString(optionRecord.text, optionRecord.label, optionRecord.value, optionRecord.answer) ?? '';
    })
    .filter(Boolean);
}

function normalizeExplanation(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  const record = asRecord(value);
  return (
    firstString(record.rationale, record.explanation, record.summary, record.text) ??
    (Object.keys(record).length > 0 ? JSON.stringify(record) : '')
  );
}

function resolveCorrectAnswer(questionData: Record<string, unknown>, options: string[]): string | null {
  const numericIndex =
    typeof questionData.correctAnswerIndex === 'number'
      ? questionData.correctAnswerIndex
      : typeof questionData.correctIndex === 'number'
        ? questionData.correctIndex
        : null;

  if (
    numericIndex !== null &&
    Number.isInteger(numericIndex) &&
    numericIndex >= 0 &&
    numericIndex < options.length
  ) {
    return options[numericIndex] ?? null;
  }

  const rawAnswer = firstString(
    questionData.correctAnswer,
    questionData.answer,
    questionData.correct_option,
    questionData.correctChoice,
    questionData.correctAnswerIndex,
    questionData.correctIndex
  );
  if (!rawAnswer) return null;

  const resolvedIndex = resolveAnswerIndexFromValue(rawAnswer, options);
  return resolvedIndex !== null ? (options[resolvedIndex] ?? null) : null;
}

function normalizeDate(value: Date | string | null | undefined): Date | undefined {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? undefined : parsed;
  }
  return undefined;
}

export function buildCanonicalQuestionMirrorData(
  input: CanonicalQuestionMirrorInput,
  options: CanonicalQuestionMirrorOptions = {}
): CanonicalQuestionMirrorData | null {
  const questionData = asRecord(input.questionData);
  const metadata = asRecord(questionData.metadata);
  const provenance = asRecord(questionData.provenance);
  const answerOptions = normalizeOptions(questionData.options ?? questionData.answers ?? questionData.choices);
  const question = firstString(questionData.question, questionData.stem, questionData.text, questionData.vignette);
  const correctAnswer = resolveCorrectAnswer(questionData, answerOptions);

  if (!input.id || !question || answerOptions.length < 2 || !correctAnswer) {
    return null;
  }

  const medicalContentId = firstString(
    input.medicalContentId,
    questionData.medicalContentId,
    metadata.medicalContentId,
    provenance.medicalContentId
  );
  const conditionId = firstString(
    input.conditionId,
    questionData.conditionId,
    metadata.conditionId,
    provenance.conditionId
  );
  const safeConditionId = conditionId && conditionId !== medicalContentId ? conditionId : undefined;
  const generatedAt = normalizeDate(input.generatedAt ?? (questionData.generatedAt as Date | string | null | undefined));

  return {
    id: input.id,
    vignette: firstString(questionData.vignette, questionData.stem, question) ?? question,
    question,
    options: answerOptions,
    correctAnswer,
    explanation: normalizeExplanation(questionData.explanation ?? questionData.rationale),
    system: firstString(input.system, questionData.system, metadata.system, provenance.taxonomyCode) ?? 'General',
    difficulty: firstString(input.difficulty, questionData.difficulty) ?? 'medium',
    source: options.source ?? 'pre_generated_identity_mirror',
    conditionId: safeConditionId,
    medicalContentId: medicalContentId ?? undefined,
    category: firstString(questionData.category, questionData.subcategory, metadata.subcategory, provenance.subcategory),
    topic: firstString(questionData.topic, questionData.conditionName, metadata.conditionName, provenance.conditionName),
    generatedAt,
    lifecycleStatus: 'ACTIVE',
    qaStatus: 'APPROVED',
    humanReviewed: options.humanReviewed ?? true,
    updatedAt: new Date(),
  };
}

export async function upsertCanonicalQuestionMirror(
  prisma: { question?: { upsert?(args: unknown): Promise<unknown> | unknown } },
  input: CanonicalQuestionMirrorInput,
  options: CanonicalQuestionMirrorOptions = {}
): Promise<string | null> {
  const data = buildCanonicalQuestionMirrorData(input, options);
  if (!data || !prisma.question?.upsert) return null;
  const { id, ...updateData } = data;

  await prisma.question.upsert({
    where: { id },
    create: data,
    update: updateData,
  });

  return id;
}

export async function createCanonicalQuestionMirrors(
  prisma: { question?: { createMany?(args: unknown): Promise<unknown> | unknown } },
  inputs: CanonicalQuestionMirrorInput[],
  options: CanonicalQuestionMirrorOptions = {}
): Promise<Set<string>> {
  const rows = inputs
    .map((input) => buildCanonicalQuestionMirrorData(input, options))
    .filter((row): row is CanonicalQuestionMirrorData => row !== null);

  if (rows.length === 0 || !prisma.question?.createMany) return new Set();

  await prisma.question.createMany({
    data: rows,
    skipDuplicates: true,
  });

  return new Set(rows.map((row) => row.id));
}
