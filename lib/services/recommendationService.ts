import { v4 as uuidv4 } from 'uuid';
import type { Prisma } from '@prisma/client';
import { UserRole } from '@prisma/client';
import { prisma } from '../prisma';

export interface RecommendationContext {
  userId: string;
}

/**
 * Service to generate intelligent study recommendations based on user performance.
 */
export const recommendationService = {
  /**
   * Main entry point to generate recommendations for a user.
   * Orchestrates various checks (fading memory, weak areas, etc.) and persists them.
   */
  async generateRecommendations(userId: string) {
    // Ensure user exists in database (create if not exists)
    const dbUser = await prisma.user.upsert({
      where: { clerkId: userId },
      create: {
        clerkId: userId,
        email: '', // Will be updated by Clerk webhook later
        role: UserRole.USER,
        updatedAt: new Date(),
      },
      update: {}, // No-op if user already exists
    });

    const recommendations = [];

    // 1. Check for FSRS due cards (Fading Memory)
    const fadingMemory = await this.checkFadingMemories(dbUser.id);
    if (fadingMemory) recommendations.push(fadingMemory);

    // 2. Identify weak areas (accuracy < 70%)
    const weakAreas = await this.identifyWeakAreas(dbUser.id);
    recommendations.push(...weakAreas);

    // 3. Suggest new topics if user has bandwidth
    if (recommendations.length < 3) {
      const newTopics = await this.suggestNewTopics(dbUser.id);
      recommendations.push(...newTopics);
    }

    // Persist to DB, avoiding duplicates
    for (const rec of recommendations) {
      // Check if a similar pending recommendation exists to avoid noise
      const existing = await prisma.studyRecommendation.findFirst({
        where: {
          userId: dbUser.id,
          type: rec.type,
          topic: rec.topic,
          status: 'pending',
        },
      });

      if (!existing) {
        await prisma.studyRecommendation.create({
          data: {
            id: uuidv4(),
            userId: dbUser.id,
            type: rec.type,
            topic: rec.topic,
            reason: rec.reason,
            priority: rec.priority,
            status: 'pending',
            data: rec.data || {},
          },
        });
      }
    }

    return this.getPendingRecommendations(dbUser.id);
  },

  /**
   * Checks for items that are due for review according to FSRS.
   */
  async checkFadingMemories(userId: string) {
    const dueCount = await prisma.userProgress.count({
      where: {
        userId,
        nextReviewAt: {
          lte: new Date(), // Due now or in the past
        },
      },
    });

    if (dueCount > 0) {
      return {
        type: 'review',
        topic: 'Spaced Repetition',
        reason: `${dueCount} items are fading from your memory. Review them now to retain knowledge.`,
        priority: dueCount > 10 ? 'high' : 'medium',
        data: { count: dueCount },
      };
    }
    return null;
  },

  /**
   * Identifies conditions where the user is struggling (low accuracy).
   */
  async identifyWeakAreas(userId: string) {
    const weakItems = await prisma.userProgress.findMany({
      where: {
        userId,
        accuracy: { lt: 0.7 }, // Less than 70% accuracy
        totalAttempts: { gt: 3 }, // Minimum attempts to establish a pattern
        nextReviewAt: { not: null }, // Only active items
      },
      include: {
        MedicalContent: {
          select: {
            condition: true,
            system: true,
          },
        },
      },
      take: 2, // Limit to top 2 weak areas
    });

    return weakItems.map((item) => ({
      type: 'drill_session',
      topic: item.MedicalContent.condition,
      reason: `Accuracy is low (${Math.round(item.accuracy * 100)}%). A focused drill can help reinforce this topic.`,
      priority: 'high',
      data: { conditionId: item.conditionId },
    }));
  },

  /**
   * Suggests high-yield topics that the user hasn't started yet.
   */
  async suggestNewTopics(userId: string) {
    // Determine systems user has interacted with
    type UserProgressWithContent = Prisma.UserProgressGetPayload<{
      include: { MedicalContent: { select: { system: true } } };
    }>;

    const userSystems = (await prisma.userProgress.findMany({
      where: { userId },
      include: {
        MedicalContent: { select: { system: true } },
      },
      distinct: ['conditionId'],
    })) as UserProgressWithContent[];

    const studiedSystemNames = new Set(
      userSystems
        .filter(
          (u): u is UserProgressWithContent & { MedicalContent: { system: string } } =>
            u.MedicalContent !== null && typeof u.MedicalContent.system === 'string'
        )
        .map((u) => u.MedicalContent.system)
    );

    // Find a high yield condition (pance_yield is simulated here as logic, assuming we pick from published content)
    // For now, let's just pick a random published condition the user hasn't touched
    const existingIds = await prisma.userProgress.findMany({
      where: { userId },
      select: { conditionId: true },
    });
    const existingIdSet = new Set(existingIds.map((e) => e.conditionId));

    const candidate = await prisma.medicalContent.findFirst({
      where: {
        status: 'published',
        conditionId: { notIn: Array.from(existingIdSet) },
      },
      orderBy: {
        // Simple heuristic: alphabetical or arbitrary.
        // In a real app, use pance_yield desc
        condition: 'asc',
      },
    });

    if (candidate) {
      return [
        {
          type: 'new_topic',
          topic: candidate.condition,
          reason: 'Expand your knowledge base with this high-yield topic.',
          priority: 'low',
          data: { conditionId: candidate.conditionId },
        },
      ];
    }
    return [];
  },

  /**
   * Returns all pending recommendations for a user.
   */
  async getPendingRecommendations(userId: string) {
    return prisma.studyRecommendation.findMany({
      where: {
        userId,
        status: 'pending',
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  },

  /**
   * Dismisses a recommendation.
   */
  async dismissRecommendation(id: string, userId: string) {
    return prisma.studyRecommendation.update({
      where: { id, userId }, // Ensure ownership
      data: { status: 'dismissed' },
    });
  },
};
