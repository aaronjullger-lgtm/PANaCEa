import { PrismaClient, QuestionProgress } from '@prisma/client';
import { calculatePriorityScore, isDueForReview } from './adaptiveQueue.js';
import { PrismaProgressModel, ProgressModel, QuestionWithProgress } from './progressModel.js';

export interface SelectedQuestion {
  question: QuestionWithProgress;
  priorityScore: number;
}

export interface QuestionEngineOptions {
  prisma?: PrismaClient;
  progressModel?: ProgressModel;
  now?: () => Date;
}

export class QuestionEngine {
  private readonly progressModel: ProgressModel;
  private readonly now: () => Date;

  constructor(options: QuestionEngineOptions = {}) {
    this.now = options.now ?? (() => new Date());
    if (options.progressModel) {
      this.progressModel = options.progressModel;
    } else if (options.prisma) {
      this.progressModel = new PrismaProgressModel(options.prisma);
    } else {
      throw new Error('A PrismaClient or ProgressModel must be provided.');
    }
  }

  async getNextQuestion(userId: string): Promise<SelectedQuestion | null> {
    const now = this.now();
    const questions = await this.progressModel.getQuestionsWithProgress(userId);

    const candidates = questions
      .map((question) => {
        const priorityScore = calculatePriorityScore({ question, progress: question.progress });
        return { question, priorityScore } as SelectedQuestion;
      })
      .filter((candidate) => isDueForReview(candidate.question.progress, now));

    if (candidates.length === 0) {
      return null;
    }

    candidates.sort((a, b) => b.priorityScore - a.priorityScore);
    const top = candidates[0];
    await this.progressModel.upsertQueueEntry(userId, top.question.id, top.priorityScore);
    return top;
  }

  async submitAnswer(userId: string, questionId: string, correct: boolean): Promise<QuestionProgress> {
    const now = this.now();
    const questions = await this.progressModel.getQuestionsWithProgress(userId);
    const question = questions.find((q) => q.id === questionId);

    if (!question) {
      throw new Error(`Question ${questionId} is not available for user ${userId}.`);
    }

    const progress = question.progress;
    const attempts = (progress?.attempts ?? 0) + 1;
    const correctCount = (progress?.correct ?? 0) + (correct ? 1 : 0);
    const streak = correct ? (progress?.streak ?? 0) + 1 : 0;
    const nextReview = this.calculateNextReview(streak, now);
    const updatedDifficulty = this.calculateDifficulty(question.difficulty, correct);

    await this.progressModel.updateQuestionDifficulty(questionId, updatedDifficulty);

    const updatedProgress: QuestionProgress = await this.progressModel.upsertProgress(userId, questionId, {
      attempts,
      correct: correctCount,
      streak,
      nextReview,
      lastAnswered: now,
    });

    const priorityScore = calculatePriorityScore({
      question: { ...question, difficulty: updatedDifficulty },
      progress: updatedProgress,
    });

    const progressWithWeight: QuestionProgress = await this.progressModel.upsertProgress(userId, questionId, {
      weight: priorityScore,
    });

    await this.progressModel.upsertQueueEntry(userId, questionId, priorityScore);

    return progressWithWeight;
  }

  private calculateDifficulty(currentDifficulty: number, correct: boolean): number {
    if (correct) {
      return Math.max(currentDifficulty - 0.05, 0.1);
    }
    return Math.min(currentDifficulty + 0.08, 1);
  }

  private calculateNextReview(streak: number, now: Date): Date {
    const hours = 1.5 ** streak;
    const millis = hours * 60 * 60 * 1000;
    return new Date(now.getTime() + millis);
  }
}
