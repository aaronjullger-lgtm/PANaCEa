import { PrismaClient, LearningQueueEntry, Question, QuestionProgress } from '@prisma/client';

export interface QuestionWithProgress extends Question {
  progress?: QuestionProgress;
}

export interface ProgressModel {
  getQuestionsWithProgress(userId: string): Promise<QuestionWithProgress[]>;
  upsertProgress(
    userId: string,
    questionId: string,
    updates: Partial<QuestionProgress>,
  ): Promise<QuestionProgress>;
  updateQuestionDifficulty(questionId: string, difficulty: number): Promise<Question>;
  upsertQueueEntry(userId: string, questionId: string, priorityScore: number): Promise<LearningQueueEntry>;
}

export class PrismaProgressModel implements ProgressModel {
  constructor(private readonly prisma: PrismaClient) {}

  async getQuestionsWithProgress(userId: string): Promise<QuestionWithProgress[]> {
    const questions = await this.prisma.question.findMany({
      include: {
        progress: {
          where: { userId },
        },
      },
    });

    return questions.map((question) => ({
      ...question,
      progress: question.progress[0],
    }));
  }

  async upsertProgress(
    userId: string,
    questionId: string,
    updates: Partial<QuestionProgress>,
  ): Promise<QuestionProgress> {
    return this.prisma.questionProgress.upsert({
      where: { userId_questionId: { userId, questionId } },
      update: { ...updates },
      create: {
        userId,
        questionId,
        attempts: updates.attempts ?? 0,
        correct: updates.correct ?? 0,
        streak: updates.streak ?? 0,
        weight: updates.weight ?? 1,
        nextReview: updates.nextReview ?? null,
        lastAnswered: updates.lastAnswered ?? null,
      },
    });
  }

  async updateQuestionDifficulty(questionId: string, difficulty: number): Promise<Question> {
    return this.prisma.question.update({
      where: { id: questionId },
      data: { difficulty },
    });
  }

  async upsertQueueEntry(
    userId: string,
    questionId: string,
    priorityScore: number,
  ): Promise<LearningQueueEntry> {
    return this.prisma.learningQueueEntry.upsert({
      where: { userId_questionId: { userId, questionId } },
      update: { priorityScore },
      create: { userId, questionId, priorityScore },
    });
  }
}
