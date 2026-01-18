/**
 * SRS Analytics Summary API
 *
 * Provides comprehensive FSRS-based analytics data for the SRS Dashboard.
 * Fetches real user progress data from the database and computes statistics.
 *
 * @endpoint GET /api/analytics/srs-summary
 * @returns SRS analytics including stability distribution, retention rates, and trends
 */

import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { authenticatedEndpoint } from '../_shared/middleware';
import { srsSummaryQuerySchema } from '../_shared/zodSchemas';
import type { AuthenticatedContext, ValidatedContext } from '../_shared/middleware';

interface SRSAnalyticsSummary {
  // Core metrics
  totalCards: number;
  reviewsDue: number;
  avgStability: number;
  avgDifficulty: number;
  projectedRetention: number;

  // Distribution data
  stabilityDistribution: { range: string; count: number }[];
  stateDistribution: { state: string; count: number }[];

  // Per-system breakdown
  systemBreakdown: {
    system: string;
    cardCount: number;
    avgStability: number;
    avgDifficulty: number;
    reviewsDue: number;
  }[];

  // Recent activity
  recentReviews: number;
  recentNewCards: number;
  learningVelocity: number; // cards mastered per day

  // Trend data (last 7 days)
  stabilityTrend: { date: string; avgStability: number }[];
}

export const onRequestGet = authenticatedEndpoint(
  srsSummaryQuerySchema,
  async (context: AuthenticatedContext & ValidatedContext<{}>) => {
    const prisma = createEdgePrismaClient(context.env.DATABASE_URL);

    try {
      const userId = context.auth.userId;
      const now = new Date();
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      // Fetch user progress data
      const progressData = await prisma.userProgress.findMany({
        where: { userId },
        select: {
          id: true,
          stability: true,
          difficulty: true,
          lastReviewDate: true,
          nextReviewDate: true,
          reviewCount: true,
          state: true,
          createdAt: true,
          medicalContent: {
            select: {
              system: true,
              name: true,
            },
          },
        },
      });

      // Fetch recent session analytics for trend data
      const recentSessions = await prisma.sessionAnalytics.findMany({
        where: {
          userId,
          startedAt: { gte: sevenDaysAgo },
        },
        orderBy: { startedAt: 'asc' },
        select: {
          startedAt: true,
          totalQuestions: true,
          correctAnswers: true,
        },
      });

      // Calculate core metrics
      const totalCards = progressData.length;
      let totalStability = 0;
      let totalDifficulty = 0;
      let reviewsDue = 0;
      let recentNewCards = 0;

      // State counts
      const stateCounts: Record<string, number> = {
        new: 0,
        learning: 0,
        review: 0,
        relearning: 0,
      };

      // Stability distribution buckets (0-10, 10-30, 30-60, 60-90, 90+ days)
      const stabilityBuckets = [
        { range: '0-10 days', min: 0, max: 10, count: 0 },
        { range: '10-30 days', min: 10, max: 30, count: 0 },
        { range: '30-60 days', min: 30, max: 60, count: 0 },
        { range: '60-90 days', min: 60, max: 90, count: 0 },
        { range: '90+ days', min: 90, max: Infinity, count: 0 },
      ];

      // System breakdown map
      const systemMap: Record<
        string,
        {
          cardCount: number;
          totalStability: number;
          totalDifficulty: number;
          reviewsDue: number;
        }
      > = {};

      // Process each card
      for (const card of progressData) {
        const stability = card.stability || 0;
        const difficulty = card.difficulty || 5;
        const state = card.state || 0;

        totalStability += stability;
        totalDifficulty += difficulty;

        // Check if review is due
        if (card.nextReviewDate && new Date(card.nextReviewDate) <= now) {
          reviewsDue++;
        }

        // Count new cards in last 7 days
        if (card.createdAt && new Date(card.createdAt) >= sevenDaysAgo) {
          recentNewCards++;
        }

        // State distribution
        const stateNames = ['new', 'learning', 'review', 'relearning'];
        const stateName = stateNames[state] || 'new';
        stateCounts[stateName] = (stateCounts[stateName] || 0) + 1;

        // Stability distribution
        for (const bucket of stabilityBuckets) {
          if (stability >= bucket.min && stability < bucket.max) {
            bucket.count++;
            break;
          }
        }

        // System breakdown
        const system = card.medicalContent?.system || 'Unknown';
        if (!systemMap[system]) {
          systemMap[system] = {
            cardCount: 0,
            totalStability: 0,
            totalDifficulty: 0,
            reviewsDue: 0,
          };
        }
        systemMap[system].cardCount++;
        systemMap[system].totalStability += stability;
        systemMap[system].totalDifficulty += difficulty;
        if (card.nextReviewDate && new Date(card.nextReviewDate) <= now) {
          systemMap[system].reviewsDue++;
        }
      }

      // Calculate averages
      const avgStability = totalCards > 0 ? totalStability / totalCards : 0;
      const avgDifficulty = totalCards > 0 ? totalDifficulty / totalCards : 5;

      // Calculate projected retention using FSRS formula
      // R = (1 + t/S)^-1 where t is days since review, S is stability
      const retentionSum = progressData.reduce((sum, card) => {
        const stability = card.stability || 1;
        const lastReview = card.lastReviewDate ? new Date(card.lastReviewDate) : now;
        const daysSinceReview = (now.getTime() - lastReview.getTime()) / (1000 * 60 * 60 * 24);
        const retention = Math.pow(1 + daysSinceReview / stability, -1);
        return sum + retention;
      }, 0);
      const projectedRetention = totalCards > 0 ? (retentionSum / totalCards) * 100 : 0;

      // Recent reviews count (cards reviewed in last 7 days)
      const recentReviews = progressData.filter(
        (card) => card.lastReviewDate && new Date(card.lastReviewDate) >= sevenDaysAgo
      ).length;

      // Learning velocity (cards reaching review state per day)
      const learningVelocity = recentReviews > 0 ? recentReviews / 7 : 0;

      // Format system breakdown
      const systemBreakdown = Object.entries(systemMap)
        .map(([system, data]) => ({
          system,
          cardCount: data.cardCount,
          avgStability:
            data.cardCount > 0 ? Math.round((data.totalStability / data.cardCount) * 10) / 10 : 0,
          avgDifficulty:
            data.cardCount > 0 ? Math.round((data.totalDifficulty / data.cardCount) * 10) / 10 : 5,
          reviewsDue: data.reviewsDue,
        }))
        .sort((a, b) => b.cardCount - a.cardCount)
        .slice(0, 10); // Top 10 systems

      // Calculate stability trend from session data
      const stabilityTrend: { date: string; avgStability: number }[] = [];
      const dayMap = new Map<string, { total: number; count: number }>();

      for (let i = 0; i < 7; i++) {
        const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
        const dateStr = date.toISOString().split('T')[0];
        dayMap.set(dateStr, { total: 0, count: 0 });
      }

      // Use session data to estimate stability growth
      for (const session of recentSessions) {
        const dateStr = new Date(session.startedAt).toISOString().split('T')[0];
        if (dayMap.has(dateStr) && session.totalQuestions > 0) {
          const entry = dayMap.get(dateStr)!;
          // Estimate stability increase based on correct answers
          const accuracy = session.correctAnswers / session.totalQuestions;
          entry.total += accuracy * avgStability * (1 + accuracy * 0.1);
          entry.count++;
        }
      }

      // Fill in stability trend
      for (const [date, data] of Array.from(dayMap.entries()).reverse()) {
        stabilityTrend.push({
          date,
          avgStability:
            data.count > 0
              ? Math.round((data.total / data.count) * 10) / 10
              : Math.round(avgStability * 10) / 10,
        });
      }

      const summary: SRSAnalyticsSummary = {
        totalCards,
        reviewsDue,
        avgStability: Math.round(avgStability * 10) / 10,
        avgDifficulty: Math.round(avgDifficulty * 10) / 10,
        projectedRetention: Math.round(projectedRetention * 10) / 10,

        stabilityDistribution: stabilityBuckets.map((b) => ({
          range: b.range,
          count: b.count,
        })),

        stateDistribution: Object.entries(stateCounts).map(([state, count]) => ({
          state,
          count,
        })),

        systemBreakdown,
        recentReviews,
        recentNewCards,
        learningVelocity: Math.round(learningVelocity * 10) / 10,
        stabilityTrend,
      };

      return {
        status: 200,
        data: summary,
      };
    } finally {
      await safePrismaDisconnect(prisma);
    }
  }
);