import { v4 as uuidv4 } from 'uuid';
import { Prisma } from '@prisma/client';
import { prisma } from '../prisma';
import { loadConditionData } from '../../services/conditionDataLoader';
import { generateSingleQuestion } from '../questionGenerator';

export interface GetQuestionsParams {
  system?: string;
  limit: number;
  difficulty?: string;
}

export interface QuestionDTO {
  id: string;
  vignette: string;
  question: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
  system: string;
  difficulty: string;
  source: string;
  tags?: string[];
}

const MAX_LIMIT = 50;

function clampLimit(limit: number): number {
  if (Number.isNaN(limit) || limit <= 0) return 1;
  return Math.min(limit, MAX_LIMIT);
}

function mapToDTO(record: any): QuestionDTO {
  return {
    id: record.id,
    vignette: record.vignette,
    question: record.question,
    options: Array.isArray(record.options) ? record.options : [],
    correctAnswer: record.correctAnswer,
    explanation:
      typeof record.explanation === 'string'
        ? record.explanation
        : JSON.stringify(record.explanation),
    system: record.system,
    difficulty: record.difficulty,
    source: record.source,
    tags: Array.isArray(record.tags) ? record.tags : undefined,
  };
}

function buildWhere(params: GetQuestionsParams): Prisma.QuestionWhereInput {
  const where: Prisma.QuestionWhereInput = {};
  if (params.system) {
    where.system = params.system;
  }
  if (params.difficulty) {
    where.difficulty = params.difficulty;
  }
  return where;
}

function buildExplanationText(explanation: any): string {
  if (!explanation) return '';
  if (typeof explanation === 'string') return explanation;
  if (typeof explanation === 'object') {
    const rationale = explanation.rationale || '';
    const incorrect = explanation.incorrect
      ? Object.entries(explanation.incorrect)
          .map(([key, value]) => `${key}: ${value}`)
          .join('\n')
      : '';
    return [rationale, incorrect].filter(Boolean).join('\n\n');
  }
  return String(explanation);
}

async function getRandomPublishedConditionId(system?: string): Promise<string | null> {
  const where: Prisma.MedicalContentWhereInput = {
    status: 'published',
    ...(system ? { system } : {}),
  };

  const total = await prisma.medicalContent.count({ where });
  if (total === 0) return null;

  const skip = Math.floor(Math.random() * total);
  const record = await prisma.medicalContent.findFirst({ where, skip });
  return record?.conditionId || null;
}

async function storeGeneratedQuestion(payload: {
  system?: string;
  difficulty?: string;
}): Promise<QuestionDTO | null> {
  const conditionId = await getRandomPublishedConditionId(payload.system);
  if (!conditionId) return null;

  const conditionData = await loadConditionData(conditionId);
  if (!conditionData) return null;

  const generated = await generateSingleQuestion(
    {
      condition: conditionData.condition,
      sections: {
        overview: conditionData.content.overview,
        etiology: conditionData.content.etiologyPathophysiology,
        clinicalPresentation: conditionData.content.clinicalPresentation,
        diagnostics: conditionData.content.diagnostics?.notes,
        treatment: Array.isArray(conditionData.content.treatment)
          ? conditionData.content.treatment.join('\n')
          : conditionData.content.treatment,
      },
    },
    'mcq'
  );

  if (!generated) return null;

  const explanationText = buildExplanationText(generated.explanation);

  const record = await prisma.question.create({
    data: {
      id: uuidv4(),
      vignette: generated.question,
      question: generated.question,
      options: generated.options || [],
      correctAnswer: generated.correctAnswer,
      explanation: explanationText,
      system: payload.system || conditionData.system,
      tags: generated.sourceSections || [],
      difficulty: payload.difficulty || 'medium',
      source: 'ai_generated',
      updatedAt: new Date(),
    },
  });

  return mapToDTO(record);
}

export async function getQuestions(
  params: GetQuestionsParams
): Promise<{ questions: QuestionDTO[]; total: number }> {
  const limit = clampLimit(params.limit);
  const where = buildWhere(params);

  const total = await prisma.question.count({ where });
  if (total === 0) {
    return { questions: [], total: 0 };
  }

  const maxSkip = Math.max(total - limit, 0);
  const skip = maxSkip > 0 ? Math.floor(Math.random() * (maxSkip + 1)) : 0;

  const records = await prisma.question.findMany({
    where,
    skip,
    take: limit,
  });

  return {
    questions: records.map(mapToDTO),
    total,
  };
}

export async function getQuestionsWithFallback(
  params: GetQuestionsParams
): Promise<{ questions: QuestionDTO[]; source: 'database' | 'ai_fallback'; total: number }> {
  const { questions, total } = await getQuestions(params);

  if (questions.length > 0) {
    return { questions, source: 'database', total };
  }

  // Only trigger fallback generation when zero questions exist for the filter
  const generated: QuestionDTO[] = [];
  for (let i = 0; i < clampLimit(params.limit); i++) {
    const created = await storeGeneratedQuestion(params);
    if (created) generated.push(created);
  }

  return { questions: generated, source: 'ai_fallback', total: generated.length };
}