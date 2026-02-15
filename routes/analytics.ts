/**
 * Analytics Routes
 *
 * Handles analytics reporting (reactions, weakness patterns, confusion pairs)
 * and data retrieval (performance deltas).
 * Extracted from server.ts for modularity.
 */

import { v4 as uuidv4 } from 'uuid';
import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { requireAuth, AuthenticatedRequest } from '../lib/middleware/clerkAuth';
import { validateRequired, validateEnum } from '../lib/middleware/validation';
import crypto from 'crypto';

const router = Router();

// Store reaction to explanation helpfulness
router.post(
  '/reactions',
  validateRequired(['questionId', 'reaction']),
  validateEnum('reaction', ['helpful', 'not_helpful']),
  async (req: Request, res: Response) => {
    try {
      const { questionId, reaction, userId } = req.body;

      if (process.env.DATABASE_URL) {
        await prisma.explanationReaction.create({
          data: {
            id: uuidv4(),
            questionId,
            reaction,
            userId: userId || null,
          },
        });
      }

      res.json({ success: true });
    } catch (error) {
      console.error('Failed to store reaction:', error);
      res.status(500).json({ success: false, error: 'Failed to store reaction' });
    }
  }
);

// Track user weakness patterns
router.post(
  '/weakness',
  validateRequired(['conditionId', 'wasCorrect']),
  async (req: Request, res: Response) => {
    try {
      const { conditionId, wasCorrect, userId } = req.body;

      if (process.env.DATABASE_URL && userId) {
        await prisma.weaknessPattern.create({
          data: {
            id: uuidv4(),
            userId,
            conditionId,
            wasCorrect,
          },
        });
      }

      res.json({ success: true });
    } catch (error) {
      console.error('Failed to store weakness pattern:', error);
      res.status(500).json({ success: false, error: 'Failed to store weakness pattern' });
    }
  }
);

// Track diagnostic confusion patterns
router.post(
  '/confusion',
  validateRequired(['correctCondition', 'selectedCondition']),
  async (req: Request, res: Response) => {
    try {
      const { correctCondition, selectedCondition, userId } = req.body;

      if (process.env.DATABASE_URL) {
        // Update or create confusion pair
        const existingPair = await prisma.confusionPair.findUnique({
          where: {
            userId_realCondition_mistakenFor: {
              userId: userId || null,
              realCondition: correctCondition,
              mistakenFor: selectedCondition,
            },
          },
        });

        if (existingPair) {
          await prisma.confusionPair.update({
            where: { id: existingPair.id },
            data: {
              count: { increment: 1 },
              lastOccurrence: new Date(),
            },
          });
        } else {
          await prisma.confusionPair.create({
            data: {
              id: uuidv4(),
              userId: userId || null,
              realCondition: correctCondition,
              mistakenFor: selectedCondition,
              count: 1,
            },
          });
        }
      }

      res.json({ success: true });
    } catch (error) {
      console.error('Failed to store confusion pattern:', error);
      res.status(500).json({ success: false, error: 'Failed to store confusion pattern' });
    }
  }
);

// SOAP Note grading analytics
router.post('/soap-note', async (req: Request, res: Response) => {
  try {
    const { caseId, totalScore, breakdown, userId } = req.body;

    if (!caseId || typeof totalScore !== 'number' || !breakdown) {
      res.status(400).json({ success: false, error: 'Missing required analytics fields' });
      return;
    }

    if (process.env.DATABASE_URL) {
      try {
        // Optional: only persist if such a model exists in the schema (it should)
        // @ts-ignore - Ignoring potential type error if model missing in generated client
        if (prisma.soapNoteGradingEvent) {
          // @ts-ignore
          await prisma.soapNoteGradingEvent.create({
            data: {
              id: uuidv4(),
              userId: userId || null,
              caseId,
              totalScore,
              breakdown,
            },
          });
        }
      } catch (dbError) {
        console.warn('SOAP analytics DB persistence skipped:', dbError);
      }
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Failed to store SOAP grading analytics:', error);
    res.status(500).json({ success: false, error: 'Failed to store SOAP grading analytics' });
  }
});

/**
 * GET /performance-deltas
 * Computes performance deltas for a user compared to their cohort.
 */
router.get(
  '/performance-deltas',
  requireAuth,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const userId = req.auth?.userId;
      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const cohortId = req.query.cohortId as string | undefined;

      // Use dynamic import to avoid circular cycles if service imports routes (unlikely but safe)
      const { generatePeerComparison, getCohortBenchmarks } =
        await import('../lib/services/analyticsService');

      const peerComparison = await generatePeerComparison(userId, cohortId);

      let effectiveCohortId = cohortId;
      if (!effectiveCohortId) {
        const userCohort = await prisma.cohortMember.findFirst({
          where: { userId },
          select: { cohortId: true },
        });
        effectiveCohortId = userCohort?.cohortId || 'global';
      }

      const cohortBenchmarks = await getCohortBenchmarks(effectiveCohortId!);

      const p90Map = new Map<string, number>();
      for (const benchmark of cohortBenchmarks) {
        p90Map.set(benchmark.system, benchmark.p90Accuracy);
      }

      const totalAttempts = peerComparison.reduce((sum, item) => sum + item.totalQuestions, 0);
      const averagePercentile =
        peerComparison.length > 0
          ? peerComparison.reduce((sum, item) => sum + item.userPercentile, 0) /
            peerComparison.length
          : 0;

      const systems = peerComparison.map((item) => {
        const cohortP90 = p90Map.get(item.system) || item.cohortAverage;

        const cohortDelta = item.userAccuracy - item.cohortAverage;
        const topPerformerGap = cohortP90 - item.userAccuracy;
        const yieldScore = topPerformerGap * (item.totalQuestions / 10);
        const isInsufficientData = item.totalQuestions < 10;

        let status: 'strength' | 'average' | 'weakness' | 'critical';
        if (isInsufficientData) {
          status = cohortDelta >= 0 ? 'average' : 'weakness';
        } else if (cohortDelta >= 10) {
          status = 'strength';
        } else if (cohortDelta >= -5) {
          status = 'average';
        } else if (cohortDelta >= -15) {
          status = 'weakness';
        } else {
          status = 'critical';
        }

        return {
          name: item.system,
          accuracy: Math.round(item.userAccuracy * 10) / 10,
          cohortAverage: Math.round(item.cohortAverage * 10) / 10,
          cohortP90: Math.round(cohortP90 * 10) / 10,
          cohortDelta: Math.round(cohortDelta * 10) / 10,
          topPerformerGap: Math.round(topPerformerGap * 10) / 10,
          yieldScore: Math.round(yieldScore * 10) / 10,
          status,
          isInsufficientData,
        };
      });

      systems.sort((a, b) => b.yieldScore - a.yieldScore);

      res.json({
        success: true,
        data: {
          userTotalAttempts: totalAttempts,
          overallPercentile: Math.round(averagePercentile * 10) / 10,
          systems,
        },
      });
    } catch (error) {
      console.error('Failed to compute performance deltas:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to compute performance deltas',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

export default router;
