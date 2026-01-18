/**
 * Sync Routes
 *
 * Handles data synchronization between client and server (offline support).
 * Extracted from server.ts for modularity.
 */

import { Router, Response } from 'express';
import { prisma } from '../lib/prisma';
import { requireAuth, AuthenticatedRequest } from '../lib/middleware/clerkAuth';
import crypto from 'crypto';

const router = Router();

// API sync endpoint with authentication
// GET: Fetch user data (PerformanceRecords, SRSItems, SavedQuestions)
router.get('/', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.auth.userId;

    if (!process.env.DATABASE_URL) {
      return res.json({
        success: true,
        data: { performanceRecords: [], srsItems: [], savedQuestions: [] },
      });
    }

    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
    });

    if (!user) {
      return res.status(404).json({ error: 'User profile not found' });
    }

    const [performanceRecords, srsItems, savedQuestions] = await Promise.all([
      prisma.performanceRecord.findMany({ where: { userId: user.id } }),
      prisma.sRSItem.findMany({ where: { userId: user.id } }),
      prisma.savedQuestion.findMany({ where: { userId: user.id } }),
    ]);

    // Convert BigInt to Number for JSON serialization
    const serializedPerformance = performanceRecords.map((r) => ({
      ...r,
      timestamp: Number(r.timestamp),
    }));

    res.json({
      success: true,
      data: {
        performanceRecords: serializedPerformance,
        srsItems,
        savedQuestions,
      },
    });
  } catch (error) {
    console.error('Sync GET error:', error);
    res.status(500).json({ error: 'Internal server error during sync' });
  }
});

// POST: Push local changes to server (PerformanceRecords, SRSItems, SavedQuestions)
router.post('/', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.auth.userId;
    const { performanceRecords, srsItems, savedQuestions } = req.body;

    if (!process.env.DATABASE_URL) {
      return res.json({ success: true, message: 'Sync acknowledged (No DB configured)' });
    }

    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
    });

    if (!user) {
      return res.status(404).json({ error: 'User profile not found. Please log in again.' });
    }

    const internalUserId = user.id;

    await prisma.$transaction(async (tx) => {
      // 1. Sync Performance Records
      if (performanceRecords && Array.isArray(performanceRecords)) {
        for (const record of performanceRecords) {
          // Deduplication: Check if record exists by timestamp + conditionId
          const existing = await tx.performanceRecord.findFirst({
            where: {
              userId: internalUserId,
              timestamp: record.timestamp,
              conditionName: record.conditionName,
            },
          });

          if (!existing) {
            await tx.performanceRecord.create({
              data: {
                id: crypto.randomUUID(),
                userId: internalUserId,
                topic: record.topic,
                system: record.system,
                focus: record.focus,
                difficulty: record.difficulty,
                isCorrect: record.isCorrect,
                timestamp: record.timestamp,
                questionWordCount: record.questionWordCount,
                errorTag: record.errorTag,
                subcategoryName: record.subcategoryName,
                conditionName: record.conditionName,
              },
            });
          }
        }
      }

      // 2. Sync SRS Items
      if (srsItems && Array.isArray(srsItems)) {
        for (const item of srsItems) {
          const now = new Date();
          await tx.sRSItem.upsert({
            where: {
              userId_questionId: {
                userId: internalUserId,
                questionId: item.questionId,
              },
            },
            update: {
              interval: item.interval,
              repetition: item.repetition,
              easiness: item.easiness,
              dueDate: new Date(item.dueDate),
              lastReviewed: new Date(item.lastReviewed),
              quality: item.quality,
              difficulty: item.difficulty,
              stabilityScore: item.stabilityScore,
              fsrsStability: item.fsrsStability,
              fsrsDifficulty: item.fsrsDifficulty,
              fsrsState: item.fsrsState,
              fsrsLastReview: item.fsrsLastReview ? new Date(item.fsrsLastReview) : null,
              updatedAt: now,
            },
            create: {
              id: item.id || crypto.randomUUID(),
              userId: internalUserId,
              questionId: item.questionId,
              interval: item.interval,
              repetition: item.repetition,
              easiness: item.easiness,
              dueDate: new Date(item.dueDate),
              lastReviewed: new Date(item.lastReviewed),
              quality: item.quality,
              difficulty: item.difficulty,
              stabilityScore: item.stabilityScore,
              fsrsStability: item.fsrsStability,
              fsrsDifficulty: item.fsrsDifficulty,
              fsrsState: item.fsrsState,
              fsrsLastReview: item.fsrsLastReview ? new Date(item.fsrsLastReview) : null,
              updatedAt: now,
            },
          });
        }
      }

      // 3. Sync Saved Questions
      if (savedQuestions && Array.isArray(savedQuestions)) {
        for (const sq of savedQuestions) {
          const now = new Date();
          await tx.savedQuestion.upsert({
            where: {
              userId_questionId_type: {
                userId: internalUserId,
                questionId: sq.questionId,
                type: sq.type,
              },
            },
            update: {
              questionText: sq.questionText,
              correctAnswer: sq.correctAnswer,
              explanation: sq.explanation,
              topic: sq.topic,
              system: sq.system,
              userNote: sq.userNote,
              repetitionLevel: sq.repetitionLevel,
              nextReviewDate: sq.nextReviewDate,
              updatedAt: now,
            },
            create: {
              id: sq.id || crypto.randomUUID(),
              userId: internalUserId,
              questionId: sq.questionId,
              type: sq.type,
              questionText: sq.questionText,
              correctAnswer: sq.correctAnswer,
              explanation: sq.explanation,
              topic: sq.topic,
              system: sq.system,
              userNote: sq.userNote,
              repetitionLevel: sq.repetitionLevel,
              nextReviewDate: sq.nextReviewDate,
              updatedAt: now,
            },
          });
        }
      }
    });

    res.json({
      success: true,
      message: 'Data synced successfully',
    });
  } catch (error) {
    console.error('Sync error:', error);
    res.status(500).json({ error: 'Sync failed' });
  }
});

export default router;
