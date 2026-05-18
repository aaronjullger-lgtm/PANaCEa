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
  correctAnswerIndex?: number;
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

type PrismaWithCanonicalMirror = {
  question?: {
    upsert?(args: unknown): Promise<unknown> | unknown;
    createMany?(args: unknown): Promise<unknown> | unknown;
  };
  questionAnswerChoice?: {
    upsert?(args: unknown): Promise<unknown> | unknown;
    deleteMany?(args: unknown): Promise<unknown> | unknown;
  };
  questionExplanation?: {
    upsert?(args: unknown): Promise<unknown> | unknown;
  };
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
      return (
        firstString(
          optionRecord.text,
          optionRecord.label,
          optionRecord.value,
          optionRecord.answer
        ) ?? ''
      );
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

function resolveCorrectAnswerDetails(
  questionData: Record<string, unknown>,
  options: string[]
): { answer: string; index: number | null } | null {
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
    return { answer: options[numericIndex] ?? '', index: numericIndex };
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
  return resolvedIndex !== null
    ? { answer: options[resolvedIndex] ?? '', index: resolvedIndex }
    : null;
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
  const answerOptions = normalizeOptions(
    questionData.options ?? questionData.answers ?? questionData.choices
  );
  const question = firstString(
    questionData.question,
    questionData.stem,
    questionData.text,
    questionData.vignette
  );
  const correctAnswer = resolveCorrectAnswerDetails(questionData, answerOptions);

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
  const generatedAt = normalizeDate(
    input.generatedAt ?? (questionData.generatedAt as Date | string | null | undefined)
  );

  return {
    id: input.id,
    vignette: firstString(questionData.vignette, questionData.stem, question) ?? question,
    question,
    options: answerOptions,
    correctAnswer: correctAnswer.answer,
    correctAnswerIndex: correctAnswer.index ?? undefined,
    explanation: normalizeExplanation(questionData.explanation ?? questionData.rationale),
    system:
      firstString(input.system, questionData.system, metadata.system, provenance.taxonomyCode) ??
      'General',
    difficulty: firstString(input.difficulty, questionData.difficulty) ?? 'medium',
    source: options.source ?? 'pre_generated_identity_mirror',
    conditionId: safeConditionId,
    medicalContentId: medicalContentId ?? undefined,
    category: firstString(
      questionData.category,
      questionData.subcategory,
      metadata.subcategory,
      provenance.subcategory
    ),
    topic: firstString(
      questionData.topic,
      questionData.conditionName,
      metadata.conditionName,
      provenance.conditionName
    ),
    generatedAt,
    lifecycleStatus: 'ACTIVE',
    qaStatus: 'APPROVED',
    humanReviewed: options.humanReviewed ?? true,
    updatedAt: new Date(),
  };
}

function buildAnswerChoiceRows(data: CanonicalQuestionMirrorData) {
  const correctAnswer = data.correctAnswer.trim().toLowerCase();
  const keyedCorrectIndex =
    typeof data.correctAnswerIndex === 'number' &&
    Number.isInteger(data.correctAnswerIndex) &&
    data.correctAnswerIndex >= 0 &&
    data.correctAnswerIndex < data.options.length
      ? data.correctAnswerIndex
      : null;
  const firstCorrectIndex =
    keyedCorrectIndex ??
    data.options.findIndex((choiceText) => choiceText.trim().toLowerCase() === correctAnswer);

  return data.options.map((choiceText, index) => {
    const choiceKey = String.fromCharCode(65 + index);
    const normalizedChoice = choiceText.trim().toLowerCase();

    return {
      questionId: data.id,
      choiceKey,
      choiceText,
      isCorrect:
        firstCorrectIndex >= 0 ? index === firstCorrectIndex : normalizedChoice === correctAnswer,
      displayOrder: index,
    };
  });
}

function toQuestionRowData(data: CanonicalQuestionMirrorData) {
  const { correctAnswerIndex: _correctAnswerIndex, ...row } = data;
  return row;
}

async function syncCanonicalQuestionRelations(
  prisma: PrismaWithCanonicalMirror,
  data: CanonicalQuestionMirrorData
): Promise<void> {
  const choices = buildAnswerChoiceRows(data);

  if (prisma.questionAnswerChoice?.deleteMany) {
    await prisma.questionAnswerChoice.deleteMany({
      where: {
        questionId: data.id,
        choiceKey: { notIn: choices.map((choice) => choice.choiceKey) },
      },
    });
  }

  if (prisma.questionAnswerChoice?.upsert) {
    await Promise.all(
      choices.map((choice) =>
        prisma.questionAnswerChoice!.upsert!({
          where: {
            questionId_choiceKey: {
              questionId: choice.questionId,
              choiceKey: choice.choiceKey,
            },
          },
          create: choice,
          update: {
            choiceText: choice.choiceText,
            isCorrect: choice.isCorrect,
            displayOrder: choice.displayOrder,
          },
        })
      )
    );
  }

  if (data.explanation.trim() && prisma.questionExplanation?.upsert) {
    await prisma.questionExplanation.upsert({
      where: {
        questionId_explanationType_version: {
          questionId: data.id,
          explanationType: 'CORRECT_RATIONALE',
          version: 1,
        },
      },
      create: {
        questionId: data.id,
        explanationType: 'CORRECT_RATIONALE',
        title: 'Correct rationale',
        body: data.explanation,
        version: 1,
        isActive: true,
      },
      update: {
        title: 'Correct rationale',
        body: data.explanation,
        isActive: true,
      },
    });
  }
}

export async function upsertCanonicalQuestionMirror(
  prisma: PrismaWithCanonicalMirror,
  input: CanonicalQuestionMirrorInput,
  options: CanonicalQuestionMirrorOptions = {}
): Promise<string | null> {
  const data = buildCanonicalQuestionMirrorData(input, options);
  if (!data || !prisma.question?.upsert) return null;
  const createData = toQuestionRowData(data);
  const { id, ...updateData } = createData;

  await prisma.question.upsert({
    where: { id },
    create: createData,
    update: updateData,
  });

  await syncCanonicalQuestionRelations(prisma, data);

  return id;
}

export async function createCanonicalQuestionMirrors(
  prisma: PrismaWithCanonicalMirror,
  inputs: CanonicalQuestionMirrorInput[],
  options: CanonicalQuestionMirrorOptions = {}
): Promise<Set<string>> {
  const rows = inputs
    .map((input) => buildCanonicalQuestionMirrorData(input, options))
    .filter((row): row is CanonicalQuestionMirrorData => row !== null);

  if (rows.length === 0 || !prisma.question?.createMany) return new Set();

  await prisma.question.createMany({
    data: rows.map(toQuestionRowData),
    skipDuplicates: true,
  });
  for (const row of rows) {
    await syncCanonicalQuestionRelations(prisma, row);
  }

  return new Set(rows.map((row) => row.id));
}
