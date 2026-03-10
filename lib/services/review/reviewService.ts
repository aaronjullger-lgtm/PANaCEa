import { createEdgePrismaClient } from '../../../functions/api/_shared/prisma-edge';
import { ContentService } from '../content/contentService';
import { normalizeOptionsToArray } from '../../utils/questionDataNormalizer';

// JsonValue type for Prisma JSON fields
type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

// Interfaces moved from review.ts to be used in the service
interface DBQuestion {
  id: string;
  vignette: string;
  options: JsonValue;
  correctAnswerIndex: number;
  rationale: string;
  system: string;
  condition: string | null;
  conditionId: string | null;
  difficulty: string | null;
}

export interface ReviewQuestion {
  id: string;
  question: string;
  options: string[];
  correctAnswerIndex: number;
  rationale: string;
  system: string;
  condition?: string;
  conditionId?: string;
  difficulty?: string;
  reviewReason: 'srs_due' | 'flagged' | 'missed' | 'weak_area';
  priority: number;
  lastSeen?: Date;
  nextDue?: Date;
  accuracy?: number;
}

export class ReviewService {
  private prisma: ReturnType<typeof createEdgePrismaClient>;
  private contentService: ContentService;
  private userId: string;

  constructor(databaseUrl: string, userId: string) {
    this.prisma = createEdgePrismaClient(databaseUrl);
    this.contentService = new ContentService(databaseUrl);
    this.userId = userId;
  }

  public async getReviewQuestions(
    mode: string,
    limit: number,
    system: string | null
  ): Promise<ReviewQuestion[]> {
    const reviewQuestions: ReviewQuestion[] = [];

    // 1. SRS Due Questions
    if (mode === 'all' || mode === 'srs') {
      const srsQuestions = await this.getSRSDueQuestions(system, limit);
      reviewQuestions.push(...srsQuestions);
    }

    // 2. Flagged Questions
    if (mode === 'all' || mode === 'flagged') {
      const flaggedQuestions = await this.getFlaggedQuestions(system, limit);
      reviewQuestions.push(...flaggedQuestions);
    }

    // 3. Missed Questions
    if (mode === 'all' || mode === 'missed') {
      const missedQuestions = await this.getMissedQuestions(system, limit);
      reviewQuestions.push(...missedQuestions);
    }

    // 4. Weak Area Questions
    if (mode === 'all' || mode === 'weak') {
      const weakQuestions = await this.getWeakAreaQuestions(system, limit);
      reviewQuestions.push(...weakQuestions);
    }

    return this.deduplicateAndSort(reviewQuestions).slice(0, limit);
  }

  private async getSRSDueQuestions(
    system: string | null,
    limit: number
  ): Promise<ReviewQuestion[]> {
    const now = new Date();

    const srsItems = await this.prisma.sRSItem.findMany({
      where: {
        userId: this.userId,
        dueDate: { lte: now },
      },
      orderBy: [{ dueDate: 'asc' }, { easiness: 'asc' }],
      take: limit * 2,
    });

    if (srsItems.length === 0) {
      return [];
    }

    const originalQuestionIds = srsItems.map((item: { questionId: string }) => item.questionId);
    const originalQuestions = await this.prisma.question.findMany({
      where: { id: { in: originalQuestionIds } },
      select: { id: true, conditionId: true, system: true, Condition: { select: { name: true } } },
    });

    interface QuestionConditionInfo {
      conditionId: string | null;
      condition: string | null;
      system: string;
    }

    const questionConditionMap = new Map<string, QuestionConditionInfo>(
      originalQuestions.map((q) => [
        q.id,
        {
          conditionId: q.conditionId,
          condition: q.Condition?.name ?? null,
          system: q.system,
        },
      ])
    );

    const seenHistory = await this.prisma.userQuestionSeen.findMany({
      where: { userId: this.userId },
      select: { questionId: true },
    });
    const seenIds = new Set(seenHistory.map((h: { questionId: string }) => h.questionId));

    const conditionGroups = new Map<string, (typeof srsItems)[0]>();
    for (const item of srsItems) {
      const questionInfo = questionConditionMap.get(item.questionId);
      if (!questionInfo?.conditionId) continue;
      if (system && questionInfo.system !== system) continue;

      if (!conditionGroups.has(questionInfo.conditionId)) {
        conditionGroups.set(questionInfo.conditionId, item);
      }
    }

    const reviewQuestions: ReviewQuestion[] = [];
    const conditionIds = Array.from(conditionGroups.keys()).slice(0, limit);

    for (const conditionId of conditionIds) {
      const srsItem = conditionGroups.get(conditionId)!;
      const originalInfo = questionConditionMap.get(srsItem.questionId);

      // Exclude the original question so we only show variants (same concept, different question)
      const excludeIds = Array.from(seenIds);
      if (!excludeIds.includes(srsItem.questionId)) {
        excludeIds.push(srsItem.questionId);
      }

      // Fetch multiple candidates and randomly select one for variety
      const poolCandidates = await this.prisma.preGeneratedQuestion.findMany({
        where: {
          conditionId,
          id: { notIn: excludeIds },
          ...(system ? { system } : {}),
        },
        take: 5, // Get up to 5 candidates
      });

      // Randomly select one from the candidates
      const freshFromPool =
        poolCandidates.length > 0
          ? poolCandidates[Math.floor(Math.random() * poolCandidates.length)]
          : null;

      if (freshFromPool) {
        const data = freshFromPool.questionData as Record<string, unknown>;
        const optionsData = data.options || data.answers || data.choices;
        const options = Array.isArray(optionsData) ? (optionsData as string[]) : [];

        const daysOverdue = Math.max(
          0,
          (now.getTime() - srsItem.dueDate.getTime()) / (1000 * 60 * 60 * 24)
        );

        reviewQuestions.push({
          id: freshFromPool.id,
          question: (data.question || data.vignette || '') as string,
          options,
          correctAnswerIndex: (data.correctAnswerIndex ?? 0) as number,
          rationale: (data.explanation || data.rationale || '') as string,
          system: freshFromPool.system || 'General',
          condition: (data.condition || originalInfo?.condition) as string | undefined,
          conditionId,
          difficulty: freshFromPool.difficulty,
          reviewReason: 'srs_due' as const,
          priority: Math.min(100, 50 + daysOverdue * 10),
          lastSeen: srsItem.lastReviewed,
          nextDue: srsItem.dueDate,
          srsItemId: srsItem.id,
        } as ReviewQuestion & { srsItemId: string });

        seenIds.add(freshFromPool.id);
        continue;
      }

      // Also randomize main question selection for variety; exclude original
      const mainCandidates = (await this.prisma.question.findMany({
        where: {
          conditionId,
          id: { notIn: excludeIds },
          ...(system ? { system } : {}),
        },
        take: 5,
      })) as unknown as DBQuestion[];

      const freshFromMain =
        mainCandidates.length > 0
          ? mainCandidates[Math.floor(Math.random() * mainCandidates.length)]
          : null;

      if (freshFromMain) {
        const daysOverdue = Math.max(
          0,
          (now.getTime() - srsItem.dueDate.getTime()) / (1000 * 60 * 60 * 24)
        );

        reviewQuestions.push({
          id: freshFromMain.id,
          question: freshFromMain.vignette,
          options: freshFromMain.options as string[],
          correctAnswerIndex: freshFromMain.correctAnswerIndex,
          rationale: freshFromMain.rationale,
          system: freshFromMain.system,
          condition: freshFromMain.condition ?? undefined,
          conditionId,
          difficulty: freshFromMain.difficulty ?? undefined,
          reviewReason: 'srs_due' as const,
          priority: Math.min(100, 50 + daysOverdue * 10),
          lastSeen: srsItem.lastReviewed,
          nextDue: srsItem.dueDate,
          srsItemId: srsItem.id,
        } as ReviewQuestion & { srsItemId: string });

        seenIds.add(freshFromMain.id);
        continue;
      }

      // No variant available: skip this due item (never show the original)
    }

    return reviewQuestions;
  }

  private async getFlaggedQuestions(
    system: string | null,
    limit: number
  ): Promise<ReviewQuestion[]> {
    const savedQuestions = await this.prisma.savedQuestion.findMany({
      where: {
        userId: this.userId,
        type: 'flagged',
      },
      orderBy: { updatedAt: 'desc' },
      take: limit,
    });

    const questionIds = savedQuestions.map((sq) => sq.questionId);
    const questions =
      questionIds.length > 0
        ? ((await this.prisma.question.findMany({
            where: {
              id: { in: questionIds },
              ...(system ? { system } : {}),
            },
          })) as unknown as DBQuestion[])
        : [];

    const questionMap = new Map(questions.map((q) => [q.id, q as DBQuestion]));

    return savedQuestions
      .filter((sq) => questionMap.has(sq.questionId))
      .map((sq: { questionId: string; updatedAt: Date }) => {
        const q = questionMap.get(sq.questionId)!;
        return {
          id: q.id,
          question: q.vignette,
          options: q.options as string[],
          correctAnswerIndex: q.correctAnswerIndex,
          rationale: q.rationale,
          system: q.system,
          condition: q.condition ?? undefined,
          conditionId: q.conditionId ?? undefined,
          difficulty: q.difficulty ?? undefined,
          reviewReason: 'flagged' as const,
          priority: 80,
          lastSeen: sq.updatedAt,
        };
      });
  }

  private async getMissedQuestions(
    system: string | null,
    limit: number
  ): Promise<ReviewQuestion[]> {
    const recentMissed = await this.prisma.questionAttempt.findMany({
      where: {
        userId: this.userId,
        wasCorrect: false,
        ...(system ? { system } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: limit * 2, // Fetch more to account for duplicates
    });

    // Get unique question IDs
    const seenIds = new Set<string>();
    const uniqueAttempts = recentMissed
      .filter((a: { questionId: string }) => {
        if (seenIds.has(a.questionId)) return false;
        seenIds.add(a.questionId);
        return true;
      })
      .slice(0, limit);

    const questionIds = uniqueAttempts.map((a) => a.questionId);
    const questions =
      questionIds.length > 0
        ? ((await this.prisma.question.findMany({
            where: { id: { in: questionIds } },
          })) as unknown as DBQuestion[])
        : [];

    const questionMap = new Map(questions.map((q) => [q.id, q as DBQuestion]));

    return uniqueAttempts
      .filter((a) => questionMap.has(a.questionId))
      .map((a: { questionId: string; createdAt: Date }) => {
        const q = questionMap.get(a.questionId)!;
        return {
          id: q.id,
          question: q.vignette,
          options: q.options as string[],
          correctAnswerIndex: q.correctAnswerIndex,
          rationale: q.rationale,
          system: q.system,
          condition: q.condition ?? undefined,
          conditionId: q.conditionId ?? undefined,
          difficulty: q.difficulty ?? undefined,
          reviewReason: 'missed' as const,
          priority: 70,
          lastSeen: a.createdAt,
        };
      });
  }

  private async getWeakAreaQuestions(
    system: string | null,
    limit: number
  ): Promise<ReviewQuestion[]> {
    const attempts = await this.prisma.questionAttempt.findMany({
      where: { userId: this.userId },
      select: {
        system: true,
        conditionId: true,
        wasCorrect: true,
      },
    });

    // Group by system
    const systemStats = new Map<string, { correct: number; total: number }>();
    for (const a of attempts) {
      if (!a.system) continue;
      if (!systemStats.has(a.system)) {
        systemStats.set(a.system, { correct: 0, total: 0 });
      }
      const stats = systemStats.get(a.system)!;
      stats.total++;
      if (a.wasCorrect) stats.correct++;
    }

    // Find weak systems (< 60% accuracy with >= 5 attempts)
    const weakSystems: string[] = [];
    for (const [sys, stats] of systemStats) {
      if (stats.total >= 5 && stats.correct / stats.total < 0.6) {
        weakSystems.push(sys);
      }
    }

    if (weakSystems.length === 0) {
      return [];
    }

    // Get questions from weak systems that user hasn't mastered
    const questions = (await this.prisma.question.findMany({
      where: {
        system: { in: weakSystems },
        ...(system ? { system } : {}),
      },
      take: limit,
      orderBy: { id: 'asc' },
    })) as unknown as DBQuestion[];

    return questions.map((q: DBQuestion) => {
      const stats = systemStats.get(q.system);
      const accuracy = stats ? (stats.correct / stats.total) * 100 : 50;

      return {
        id: q.id,
        question: q.vignette,
        options: normalizeOptionsToArray(q.options),
        correctAnswerIndex: q.correctAnswerIndex,
        rationale: q.rationale,
        system: q.system,
        condition: q.condition ?? undefined,
        conditionId: q.conditionId ?? undefined,
        difficulty: q.difficulty ?? undefined,
        reviewReason: 'weak_area' as const,
        priority: Math.round(60 - accuracy * 0.5), // Lower accuracy = higher priority
        accuracy,
      };
    });
  }

  private deduplicateAndSort(questions: ReviewQuestion[]): ReviewQuestion[] {
    const seen = new Map<string, ReviewQuestion>();
    for (const q of questions) {
      if (!seen.has(q.id) || q.priority > seen.get(q.id)!.priority) {
        seen.set(q.id, q);
      }
    }
    return Array.from(seen.values()).sort((a, b) => b.priority - a.priority);
  }

  public async disconnect() {
    await this.prisma.$disconnect();
    await this.contentService.disconnect();
  }
}
