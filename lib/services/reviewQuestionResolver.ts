import type { Prisma, PrismaClient } from '@prisma/client';
import {
  withProductionPregeneratedSafety,
  withProductionQuestionSafety,
} from './questionServingSafety';

type ReviewQuestion = {
  id: string;
  questionData: unknown;
  conditionId: string | null;
  medicalContentId?: string | null;
  system?: string | null;
  difficulty?: string | null;
  questionType?: string | null;
  canonicalQuestionId?: string | null;
  sourceQuestionId: string;
  questionSource: 'question' | 'pre_generated' | 'generated';
};

type ResolveReviewQuestionResult = {
  question: ReviewQuestion | null;
  source: 'pre_generated' | 'main_question' | 'question_attempt' | 'missing';
};

type ReviewQuestionPrisma = Pick<
  PrismaClient,
  'preGeneratedQuestion' | 'question' | 'questionAttempt'
>;

export const PLACEHOLDER_CORRECT_ANSWER = '__correct_answer__';

/**
 * Resolve a review question for submit-review APIs regardless of original source.
 */
export async function resolveReviewQuestion(
  prisma: ReviewQuestionPrisma,
  params: {
    userId: string;
    questionId: string;
    canonicalQuestionId?: string | null;
    sourceQuestionId?: string | null;
    questionSource?: 'question' | 'pre_generated' | 'staging' | 'seed' | 'generated' | string | null;
    selectedAnswer: string;
  }
): Promise<ResolveReviewQuestionResult> {
  const { userId, questionId, selectedAnswer } = params;
  const sourceQuestionId =
    typeof params.sourceQuestionId === 'string' && params.sourceQuestionId.trim()
      ? params.sourceQuestionId.trim()
      : questionId;
  const canonicalQuestionId =
    typeof params.canonicalQuestionId === 'string' && params.canonicalQuestionId.trim()
      ? params.canonicalQuestionId.trim()
      : params.questionSource === 'question'
        ? questionId
        : null;
  const preferCanonicalQuestion = params.questionSource === 'question' && canonicalQuestionId;

  const preGenerated = preferCanonicalQuestion
    ? null
    : await prisma.preGeneratedQuestion.findFirst({
        where: withProductionPregeneratedSafety({ id: sourceQuestionId }),
        select: {
          id: true,
          questionData: true,
          conditionId: true,
          medicalContentId: true,
          system: true,
          difficulty: true,
          questionType: true,
        },
      } as Prisma.PreGeneratedQuestionFindFirstArgs);

  if (preGenerated) {
    return {
      question: {
        ...preGenerated,
        canonicalQuestionId: null,
        sourceQuestionId: preGenerated.id,
        questionSource: 'pre_generated',
      },
      source: 'pre_generated',
    };
  }

  const mainQuestion = await prisma.question.findFirst({
    where: withProductionQuestionSafety({ id: canonicalQuestionId ?? questionId }),
    select: {
      id: true,
      vignette: true,
      question: true,
      options: true,
      correctAnswer: true,
      explanation: true,
      conditionId: true,
      medicalContentId: true,
      system: true,
      difficulty: true,
      taskType: true,
    },
  } as Prisma.QuestionFindFirstArgs);

  if (mainQuestion) {
    return {
      question: {
        id: mainQuestion.id,
        conditionId: mainQuestion.conditionId,
        medicalContentId: mainQuestion.medicalContentId,
        system: mainQuestion.system,
        difficulty: mainQuestion.difficulty,
        questionType: mainQuestion.taskType ?? 'mcq',
        canonicalQuestionId: mainQuestion.id,
        sourceQuestionId: mainQuestion.id,
        questionSource: 'question',
        questionData: {
          vignette: mainQuestion.vignette,
          question: mainQuestion.question,
          options: mainQuestion.options,
          correctAnswer: mainQuestion.correctAnswer,
          explanation: mainQuestion.explanation,
        },
      },
      source: 'main_question',
    };
  }

  const recentAttempt = await prisma.questionAttempt.findFirst({
    where: { userId, questionId: sourceQuestionId },
    orderBy: { createdAt: 'desc' },
    select: {
      wasCorrect: true,
      conditionId: true,
      medicalContentId: true,
      system: true,
    },
  } as Prisma.QuestionAttemptFindFirstArgs);

  if (recentAttempt) {
    const syntheticCorrectAnswer = recentAttempt.wasCorrect
      ? selectedAnswer
      : PLACEHOLDER_CORRECT_ANSWER;
    const incorrectOption =
      selectedAnswer === PLACEHOLDER_CORRECT_ANSWER ? '__selected_answer__' : selectedAnswer;
    return {
      question: {
        id: questionId,
        conditionId: recentAttempt.conditionId,
        medicalContentId: recentAttempt.medicalContentId,
        system: recentAttempt.system,
        difficulty: null,
        questionType: 'mcq',
        canonicalQuestionId: null,
        sourceQuestionId,
        questionSource: 'generated',
        questionData: {
          question: '',
          options: [incorrectOption, PLACEHOLDER_CORRECT_ANSWER],
          correctAnswer: syntheticCorrectAnswer,
          explanation: '',
        },
      },
      source: 'question_attempt',
    };
  }

  return { question: null, source: 'missing' };
}
