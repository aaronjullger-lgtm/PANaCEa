/**
 * API: POST /api/study/session-summary
 *
 * Returns a post-session distribution summary comparing how the just-completed
 * session's system distribution stacked up against the user's blueprint targets.
 *
 * Called after a study session ends to show the user a breakdown of:
 *   - Systems studied vs. blueprint targets
 *   - Rolling distribution health after this session
 *   - Recommendations for next session focus
 *
 * Request body: { sessionId: string }
 * Response: { sessionBreakdown, rollingHealth, recommendations }
 */

import { z } from 'zod';
import { authenticatedEndpoint, withCors } from '../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { createEndpointLogger } from '../_shared/secureLogger';
import {
  analyzeDistribution,
} from '../../../lib/services/antiGamingDistribution';

const SessionSummarySchema = z.object({
  body: z.object({
    sessionId: z.string().min(1),
  }),
});

export const onRequestOptions = withCors();

export const onRequestPost = authenticatedEndpoint(
  SessionSummarySchema,
  async (context) => {
    const { env, auth, validated } = context;
    const logger = createEndpointLogger('/api/study/session-summary');
    let prisma: ReturnType<typeof createEdgePrismaClient> | null = null;

    try {
      prisma = createEdgePrismaClient(env.DATABASE_URL);
      const { sessionId } = validated.body;

      // Resolve internal user ID
      const user = await prisma.user.findUniqueOrThrow({
        where: { clerkId: auth.userId },
        select: { id: true },
      });

      // Fetch the session and its reviews
      const session = await prisma.studySession.findUnique({
        where: { id: sessionId },
        select: {
          id: true,
          blueprintLabel: true,
          blueprintStage: true,
          blueprintExamTypes: true,
          totalQuestions: true,
          correctAnswers: true,
        },
      });

      if (!session) {
        return new Response(
          JSON.stringify({ error: 'Session not found' }),
          { status: 404, headers: { 'Content-Type': 'application/json' } }
        );
      }

      // Get reviews from this specific session
      const sessionReviews = await prisma.reviewLog.findMany({
        where: {
          userId: user.id,
          sessionId,
          review_type: 'real',
        },
        select: {
          system: true,
          wasCorrect: true,
          rating: true,
        },
      });

      // Build per-system breakdown for THIS session
      const sessionBreakdown: Record<string, {
        count: number;
        correct: number;
        accuracy: number;
        fraction: number;
      }> = {};

      const totalReviews = sessionReviews.length;

      for (const review of sessionReviews) {
        const sys = review.system ?? 'Unknown';
        if (!sessionBreakdown[sys]) {
          sessionBreakdown[sys] = { count: 0, correct: 0, accuracy: 0, fraction: 0 };
        }
        sessionBreakdown[sys].count += 1;
        if (review.wasCorrect) sessionBreakdown[sys].correct += 1;
      }

      // Calculate fractions and accuracy
      for (const sys of Object.keys(sessionBreakdown)) {
        const entry = sessionBreakdown[sys];
        if (!entry) continue;
        entry.fraction = totalReviews > 0 ? entry.count / totalReviews : 0;
        entry.accuracy = entry.count > 0 ? entry.correct / entry.count : 0;
      }

      // Get the blueprint weights that were active for this session
      // Use the session's stored exam types, or fall back to PANCE
      let blueprintWeights: Record<string, number> = {};
      const examType = session.blueprintExamTypes?.[0] ?? 'PANCE';

      const blueprintRows = await prisma.examBlueprintSystem.findMany({
        where: { examType },
        select: { system: true, targetPercent: true },
      });

      if (blueprintRows.length > 0) {
        for (const row of blueprintRows) {
          blueprintWeights[row.system] = row.targetPercent;
        }
      }

      // Get rolling distribution health AFTER this session
      const rollingHealth = Object.keys(blueprintWeights).length > 0
        ? await analyzeDistribution(prisma, user.id, blueprintWeights)
        : null;

      // Generate recommendations
      const recommendations: string[] = [];

      if (rollingHealth) {
        if (rollingHealth.underRepresented.length > 0) {
          recommendations.push(
            `Focus more on: ${rollingHealth.underRepresented.slice(0, 3).join(', ')}`
          );
        }
        if (rollingHealth.overRepresented.length > 0) {
          recommendations.push(
            `Ease up on: ${rollingHealth.overRepresented.slice(0, 3).join(', ')}`
          );
        }
        if (rollingHealth.isBalanced) {
          recommendations.push('Great balance! Keep up your current study pattern.');
        }
      }

      // Find weakest system by accuracy in this session (min 2 questions)
      const weakSystems = Object.entries(sessionBreakdown)
        .filter(([, v]) => v != null && v.count >= 2 && v.accuracy < 0.6)
        .sort((a, b) => a[1].accuracy - b[1].accuracy);

      if (weakSystems.length > 0) {
        recommendations.push(
          `Review ${weakSystems[0][0]} — ${Math.round(weakSystems[0][1].accuracy * 100)}% accuracy this session`
        );
      }

      logger.info('Session summary generated', {
        sessionId,
        totalReviews,
        systemCount: Object.keys(sessionBreakdown).length,
        rollingBalanced: rollingHealth?.isBalanced ?? null,
      });

      return new Response(
        JSON.stringify({
          sessionId,
          blueprintLabel: session.blueprintLabel,
          totalQuestions: session.totalQuestions,
          correctAnswers: session.correctAnswers,
          sessionBreakdown,
          rollingHealth: rollingHealth
            ? {
                isBalanced: rollingHealth.isBalanced,
                skewScore: rollingHealth.skewScore,
                windowSize: rollingHealth.windowSize,
                overRepresented: rollingHealth.overRepresented,
                underRepresented: rollingHealth.underRepresented,
              }
            : null,
          recommendations,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    } catch (err: any) {
      logger.error('Session summary failed', { error: err.message });
      return new Response(
        JSON.stringify({ error: err.message ?? 'Internal error' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    } finally {
      await safePrismaDisconnect(prisma);
    }
  }
);
