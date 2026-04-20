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
import { authenticatedEndpoint, withCors } from '../_shared/middleware';
import { resolveUserId } from '../_shared/user-resolver';
import { retrievability } from '../../../lib/fsrs-retrievability';
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

export const onRequestOptions = withCors();

export const onRequestGet = authenticatedEndpoint(
  srsSummaryQuerySchema,
  async (context: AuthenticatedContext & ValidatedContext<Record<string, unknown>>) => {
    const prisma = createEdgePrismaClient(context.env.DATABASE_URL);

    try {
      const now = new Date();
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      const userId = await resolveUserId(prisma, context.auth.userId);
      if (!userId) {
        return {
          status: 404,
          data: { error: 'User not found - must be synced from Clerk webhook first' },
        };
      }

      // Fetch user progress data (UserProgress has lastReviewAt/nextReviewAt; FSRS S/D/state in fsrsCard/fsrsParams JSON)
      const progressData = await prisma.userProgress.findMany({
        where: { userId },
        select: {
          id: true,
          fsrsCard: true,
          fsrsParams: true,
          lastReviewAt: true,
          nextReviewAt: true,
          totalAttempts: true,
          createdAt: true,
          MedicalContent: {
            select: {
              system: true,
              condition: true,
            },
          },
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

      // Helper to read S/D/state from FSRS JSON
      const getFsrsValues = (card: (typeof progressData)[0]) => {
        const params = card.fsrsParams as { S?: number; D?: number; state?: number } | null;
        const fc = card.fsrsCard as { s?: number; d?: number; state?: number } | null;
        return {
          stability: params?.S ?? fc?.s ?? 0,
          difficulty: params?.D ?? fc?.d ?? 5,
          state: params?.state ?? fc?.state ?? 0,
        };
      };

      // Process each card
      for (const card of progressData) {
        const { stability, difficulty, state } = getFsrsValues(card);

        totalStability += stability;
        totalDifficulty += difficulty;

        // Check if review is due
        if (card.nextReviewAt && new Date(card.nextReviewAt) <= now) {
          reviewsDue++;
        }

        // Count new cards in last 7 days
        if (card.createdAt && new Date(card.createdAt) >= sevenDaysAgo) {
          recentNewCards++;
        }

        // State distribution (clamp to valid range so out-of-spec values don't silently become 'new')
        const stateNames = ['new', 'learning', 'review', 'relearning'];
        const clampedState = Math.max(0, Math.min(state, stateNames.length - 1));
        const stateName = stateNames[clampedState] ?? 'unknown';
        stateCounts[stateName] = (stateCounts[stateName] ?? 0) + 1;

        // Stability distribution
        for (const bucket of stabilityBuckets) {
          if (stability >= bucket.min && stability < bucket.max) {
            bucket.count++;
            break;
          }
        }

        // System breakdown
        const system = card.MedicalContent?.system || 'Unknown';
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
        if (card.nextReviewAt && new Date(card.nextReviewAt) <= now) {
          systemMap[system].reviewsDue++;
        }
      }

      // Calculate averages
      const avgStability = totalCards > 0 ? totalStability / totalCards : 0;
      const avgDifficulty = totalCards > 0 ? totalDifficulty / totalCards : 5;

      // Calculate projected retention using the canonical FSRS v6 formula
      // R(t) = (1 + FACTOR * t / S) ^ DECAY — same formula as fsrs-retrievability.ts
      const retentionSum = progressData.reduce((sum: number, card: (typeof progressData)[0]) => {
        const { stability: s } = getFsrsValues(card);
        const lastReview = card.lastReviewAt ? new Date(card.lastReviewAt) : now;
        const daysSinceReview = (now.getTime() - lastReview.getTime()) / (1000 * 60 * 60 * 24);
        return sum + retrievability(daysSinceReview, s || 1);
      }, 0);
      const projectedRetention = totalCards > 0 ? (retentionSum / totalCards) * 100 : 0;

      // Recent reviews count (cards reviewed in last 7 days)
      const recentReviews = progressData.filter(
        (card: (typeof progressData)[0]) =>
          card.lastReviewAt && new Date(card.lastReviewAt) >= sevenDaysAgo
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

      // Build per-day stability trend from actual FSRS stability values on UserProgress.
      // Group cards by the date their lastReviewAt falls in the last 7 days.
      // Days with no reviews get avgStability = 0 (honest: no data that day).
      const stabilityTrend: { date: string; avgStability: number }[] = [];
      const dayMap = new Map<string, { total: number; count: number }>();

      for (let i = 0; i < 7; i++) {
        const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
        const dateStr = date.toISOString().split('T')[0]!;
        dayMap.set(dateStr, { total: 0, count: 0 });
      }

      for (const card of progressData) {
        if (!card.lastReviewAt) continue;
        const dateStr = new Date(card.lastReviewAt).toISOString().split('T')[0]!;
        if (!dayMap.has(dateStr)) continue;
        const { stability } = getFsrsValues(card);
        if (stability <= 0) continue;
        const entry = dayMap.get(dateStr)!;
        entry.total += stability;
        entry.count++;
      }

      // Only include days that have actual review data — omitting days with no reviews
      // is honest; emitting 0 would look like stability crashed to zero in the chart.
      for (const [date, data] of Array.from(dayMap.entries()).reverse()) {
        if (data.count > 0) {
          stabilityTrend.push({
            date,
            avgStability: Math.round((data.total / data.count) * 10) / 10,
          });
        }
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
