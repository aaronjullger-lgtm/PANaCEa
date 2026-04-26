import type { Prisma, PrismaClient } from '@prisma/client';

type ReviewQuestion = {
  id: string;
  questionData: unknown;
  conditionId: string | null;
  medicalContentId?: string | null;
  system?: string | null;
  difficulty?: string | null;
  questionType?: string | null;
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
 * Priority:
 * 1) PreGeneratedQuestion (legacy drill/default source)
 * 2) Question (main session DB source)
 * 3) Latest QuestionAttempt fallback (for ephemeral ids like seed/generated session ids)
 */
export async function resolveReviewQuestion(
  prisma: ReviewQuestionPrisma,
  params: {
    userId: string;
    questionId: string;
    selectedAnswer: string;
  }
): Promise<ResolveReviewQuestionResult> {
  const { userId, questionId, selectedAnswer } = params;

  const preGenerated = await prisma.preGeneratedQuestion.findUnique({
    where: { id: questionId },
    select: {
      id: true,
      questionData: true,
      conditionId: true,
      medicalContentId: true,
      system: true,
      difficulty: true,
      questionType: true,
    },
  } as Prisma.PreGeneratedQuestionFindUniqueArgs);

  if (preGenerated) {
    return { question: preGenerated, source: 'pre_generated' };
  }

  const mainQuestion = await prisma.question.findUnique({
    where: { id: questionId },
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
  } as Prisma.QuestionFindUniqueArgs);

  if (mainQuestion) {
    return {
      question: {
        id: mainQuestion.id,
        conditionId: mainQuestion.conditionId,
        medicalContentId: mainQuestion.medicalContentId,
        system: mainQuestion.system,
        difficulty: mainQuestion.difficulty,
        questionType: mainQuestion.taskType ?? 'mcq',
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
    where: { userId, questionId },
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
