import { saveToStaging } from './staging-questions';

export type GeneratedQuestionPreview = Record<string, unknown>;

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? { ...(value as Record<string, unknown>) }
    : {};
}

function objectMetadata(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? { ...(value as Record<string, unknown>) }
    : {};
}

export function markGeneratedQuestionPreviewOnly(
  question: unknown,
  metadata: Record<string, unknown> = {}
): GeneratedQuestionPreview {
  const record = asRecord(question);
  const existingMetadata = objectMetadata(record.metadata);

  return {
    ...record,
    metadata: {
      ...existingMetadata,
      ...metadata,
      submissionReady: false,
      requiresApproval: true,
    },
    submissionReady: false,
    requiresApproval: true,
  };
}

export function getGeneratedQuestionStem(question: Record<string, unknown>): unknown {
  return question.question ?? question.stem ?? question.text;
}

export function normalizeGeneratedQuestionExplanation(
  question: Record<string, unknown>
): unknown {
  const explanation = question.explanation;
  if (typeof explanation === 'string') return explanation;
  if (explanation && typeof explanation === 'object' && !Array.isArray(explanation)) {
    const record = explanation as Record<string, unknown>;
    return record.rationale ?? record.text ?? explanation;
  }
  return question.rationale;
}

export async function stageGeneratedQuestionPreview(
  prisma: unknown,
  options: {
    question: unknown;
    metadata: Record<string, unknown>;
    system: string;
    subcategory?: string;
    difficulty?: unknown;
    questionText?: unknown;
    explanation?: unknown;
    extraStagingData?: Record<string, unknown>;
  }
): Promise<GeneratedQuestionPreview> {
  const record = asRecord(options.question);
  const preview = markGeneratedQuestionPreviewOnly(record, options.metadata);
  const previewMetadata = objectMetadata(preview.metadata);

  const staged = await saveToStaging(prisma, {
    ...preview,
    ...options.extraStagingData,
    question: options.questionText ?? getGeneratedQuestionStem(record),
    system: options.system,
    subcategory: options.subcategory,
    difficulty: options.difficulty ?? record.difficulty ?? 'medium',
    explanation: options.explanation ?? normalizeGeneratedQuestionExplanation(record),
    metadata: previewMetadata,
  });

  return {
    ...preview,
    metadata: {
      ...previewMetadata,
      stagingQuestionId: staged.id,
      persistence: 'staged_for_review',
    },
  };
}
