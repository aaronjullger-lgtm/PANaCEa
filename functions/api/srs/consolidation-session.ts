/**
 * POST /api/srs/consolidation-session
 *
 * Generates a pre-sleep consolidation session for the authenticated user.
 * Selects cards from the user's due pool that maximize sleep-dependent
 * memory consolidation (Mazza et al., 2016).
 *
 * Priority order:
 *   1. Cards failed earlier today (reactivation before sleep)
 *   2. Cards learned today (first sleep consolidation)
 *   3. Cards approaching due date
 *   4. Cards near FSRS R threshold (efficient retrieval practice)
 *
 * Request body:
 *   { maxCards?: number, maxMinutes?: number }
 *
 * Response:
 *   { cardIds: string[], summary: { ... }, isViable: boolean }
 *
 * @see lib/services/consolidationSessionService.ts — Pure computation
 * @see prisma/migrations/20260407220000_add_consolidation_session
 */

import { z } from 'zod';
import { authenticatedEndpoint, type AuthenticatedContext, type ValidatedContext } from '../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';

// ─── Inline types/constants (Edge can't import from lib/) ────────

const DEFAULT_MAX_CARDS = 16;
const DEFAULT_MAX_MINUTES = 15;
const SECONDS_PER_CARD = 45;
const MIN_RETRIEVABILITY = 0.40;
const MAX_RETRIEVABILITY = 0.95;
const MAX_DIFFICULTY = 8.0;
const APPROACHING_DUE_DAYS = 3;

type ConsolidationReason = 'failed_today' | 'learned_today' | 'approaching_due' | 'threshold_review';

const PRIORITY_WEIGHTS: Record<ConsolidationReason, number> = {
  failed_today: 100,
  learned_today: 80,
  approaching_due: 60,
  threshold_review: 40,
};

// ─── Schema ──────────────────────────────────────────────────────

const ConsolidationSessionSchema = z.object({
  body: z.object({
    maxCards: z.number().min(3).max(30).optional(),
    maxMinutes: z.number().min(5).max(30).optional(),
  }),
});

type ConsolidationSessionBody = z.infer<typeof ConsolidationSessionSchema>;

// ─── Handler ─────────────────────────────────────────────────────

export const onRequestPost = authenticatedEndpoint(
  ConsolidationSessionSchema,
  async (context: AuthenticatedContext & ValidatedContext<ConsolidationSessionBody>) => {
    const userId = context.auth.userId;
    const { maxCards = DEFAULT_MAX_CARDS, maxMinutes = DEFAULT_MAX_MINUTES } = context.validated.body;
    const prisma = createEdgePrismaClient(context.env.DATABASE_URL as string);

    try {
      // Step 1: Get user preferences for session duration override
      const prefs = await prisma.userPreferences.findUnique({
        where: { userId },
        select: { consolidationMinutes: true },
      });

      const sessionMinutes = prefs?.consolidationMinutes ?? maxMinutes;

      // Step 2: Get today's start-of-day for "today" queries
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      // Step 3: Fetch cards with FSRS state — due or recently reviewed
      // We need UserProgress for retrievability + recent QuestionAttempts for today's activity
      const [userProgressRows, todayAttempts] = await Promise.all([
        // Cards with FSRS state (reviewed at least once)
        prisma.userProgress.findMany({
          where: {
            userId,
            nextReview: { lte: new Date(Date.now() + APPROACHING_DUE_DAYS * 24 * 60 * 60 * 1000) },
          },
          select: {
            questionId: true,
            stability: true,
            difficulty: true,
            retrievability: true,
            lastReviewed: true,
            nextReview: true,
            system: true,
          },
          take: 500, // Cap to avoid memory issues
          orderBy: { nextReview: 'asc' },
        }),
        // Today's attempts (for failed_today / learned_today classification)
        prisma.questionAttempt.findMany({
          where: {
            userId,
            createdAt: { gte: todayStart },
          },
          select: {
            questionId: true,
            isCorrect: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
        }),
      ]);

      if (userProgressRows.length === 0) {
        return {
          data: {
            cardIds: [],
            summary: { totalCards: 0, estimatedMinutes: 0, isViable: false, reasonBreakdown: {} },
            isViable: false,
            message: 'No cards with FSRS history available for consolidation.',
          },
        };
      }

      // Step 4: Build today's activity maps
      const failedTodaySet = new Set<string>();
      const reviewedTodaySet = new Set<string>();
      const firstSeenToday = new Set<string>();

      for (const attempt of todayAttempts) {
        reviewedTodaySet.add(attempt.questionId);
        if (!attempt.isCorrect) failedTodaySet.add(attempt.questionId);
      }

      // Cards where lastReviewed is today and they didn't exist before today → "learned today"
      for (const row of userProgressRows) {
        if (row.lastReviewed && row.lastReviewed >= todayStart) {
          // Rough heuristic: if stability is low (<2 days) and reviewed today, likely new learning
          if ((row.stability ?? 0) < 2) {
            firstSeenToday.add(row.questionId);
          }
        }
      }

      // Step 5: Build candidates and score them
      const now = new Date();
      const candidates: Array<{
        cardId: string;
        reason: ConsolidationReason;
        priority: number;
        retrievability: number;
        domain?: string;
      }> = [];

      for (const row of userProgressRows) {
        const r = row.retrievability ?? 0;
        const d = row.difficulty ?? 5;
        const cardId = row.questionId;

        const isFailed = failedTodaySet.has(cardId);
        const isLearned = firstSeenToday.has(cardId);
        const isReviewed = reviewedTodaySet.has(cardId);

        // Eligibility filter
        if (isFailed) {
          if (d > MAX_DIFFICULTY) continue;
        } else if (isLearned) {
          if (d > MAX_DIFFICULTY || r < MIN_RETRIEVABILITY) continue;
        } else {
          if (r < MIN_RETRIEVABILITY || r > MAX_RETRIEVABILITY || d > MAX_DIFFICULTY) continue;
        }

        // Classify reason
        let reason: ConsolidationReason;
        if (isFailed) reason = 'failed_today';
        else if (isLearned) reason = 'learned_today';
        else {
          const daysUntilDue = row.nextReview
            ? (row.nextReview.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
            : Infinity;
          reason = daysUntilDue <= APPROACHING_DUE_DAYS ? 'approaching_due' : 'threshold_review';
        }

        // Compute priority
        let priority = PRIORITY_WEIGHTS[reason];
        if (r >= 0.85 && r <= 0.95) priority += 10; // Sweet spot bonus
        if (isReviewed && reason !== 'failed_today') priority += 5;

        const daysUntilDue = row.nextReview
          ? (row.nextReview.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
          : Infinity;
        if (daysUntilDue <= 1) priority += 15;
        else if (daysUntilDue <= 2) priority += 8;

        candidates.push({
          cardId,
          reason,
          priority,
          retrievability: r,
          domain: row.system ?? undefined,
        });
      }

      // Step 6: Sort by priority desc, then by R ascending (harder = more benefit)
      candidates.sort((a, b) => {
        if (b.priority !== a.priority) return b.priority - a.priority;
        return a.retrievability - b.retrievability;
      });

      // Step 7: Cap by card count and session duration
      const maxByDuration = Math.floor((sessionMinutes * 60) / SECONDS_PER_CARD);
      const limit = Math.min(maxCards, maxByDuration);

      // Step 8: Domain interleaving
      const selected: typeof candidates = [];
      const remaining = [...candidates];
      let lastDomain: string | undefined;

      while (selected.length < limit && remaining.length > 0) {
        let bestIdx = -1;
        if (lastDomain) {
          bestIdx = remaining.findIndex(c => c.domain !== lastDomain);
        }
        if (bestIdx === -1) bestIdx = 0;

        const picked = remaining.splice(bestIdx, 1)[0]!;
        selected.push(picked);
        lastDomain = picked.domain;
      }

      // Step 9: Build summary
      const reasonBreakdown: Record<string, number> = {};
      let totalR = 0;
      const domains = new Set<string>();

      for (const card of selected) {
        reasonBreakdown[card.reason] = (reasonBreakdown[card.reason] ?? 0) + 1;
        totalR += card.retrievability;
        if (card.domain) domains.add(card.domain);
      }

      return {
        data: {
          cardIds: selected.map(c => c.cardId),
          summary: {
            totalCards: selected.length,
            estimatedMinutes: Math.ceil((selected.length * SECONDS_PER_CARD) / 60),
            reasonBreakdown,
            averageRetrievability: selected.length > 0
              ? Math.round((totalR / selected.length) * 1000) / 1000
              : 0,
            uniqueDomains: domains.size,
            isViable: selected.length >= 3,
          },
          isViable: selected.length >= 3,
        },
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Consolidation session generation failed';
      return { status: 500, error: message };
    } finally {
      await safePrismaDisconnect(prisma);
    }
  },
  { requestsPerMinute: 30 }
);
