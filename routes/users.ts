/**
 * User Routes
 *
 * Handles user profile, achievements, and simple performance listing.
 * Complements sync.ts and analytics.ts.
 */

import { v4 as uuidv4 } from 'uuid';
import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { requireAuth, AuthenticatedRequest } from '../lib/middleware/clerkAuth';
import crypto from 'crypto';

const router = Router();

// Get User Achievements
router.get('/achievements', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.auth?.userId;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    if (!process.env.DATABASE_URL) {
      res.json({ success: true, data: [] });
      return;
    }

    const user = await prisma.user.findUnique({ where: { clerkId: userId } });
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const achievements = await prisma.userAchievement.findMany({
      where: { userId: user.id },
    });

    res.json({ success: true, data: achievements });
  } catch (error) {
    console.error('Error fetching achievements:', error);
    res.status(500).json({ error: 'Failed to fetch achievements' });
  }
});

// Get Performance Records (Simple List)
router.get('/performance', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.auth?.userId;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    if (!process.env.DATABASE_URL) {
      res.json({ success: true, data: [] });
      return;
    }

    const user = await prisma.user.findUnique({ where: { clerkId: userId } });
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const records = await prisma.performanceRecord.findMany({
      where: { userId: user.id },
      orderBy: { timestamp: 'desc' },
      take: 1000,
    });

    // Convert BigInt to Number for JSON serialization
    const serializedRecords = records.map((r) => ({
      ...r,
      timestamp: Number(r.timestamp),
    }));

    res.json({ success: true, data: serializedRecords });
  } catch (error) {
    console.error('Error fetching performance:', error);
    res.status(500).json({ error: 'Failed to fetch performance' });
  }
});

// Post Single Performance Record
router.post('/performance', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.auth?.userId;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const record = req.body;

    if (!process.env.DATABASE_URL) {
      res.json({ success: true });
      return;
    }

    const user = await prisma.user.findUnique({ where: { clerkId: userId } });
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    await prisma.performanceRecord.create({
      data: {
        id: uuidv4(),
        userId: user.id,
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

    res.json({ success: true });
  } catch (error) {
    console.error('Error saving performance:', error);
    res.status(500).json({ error: 'Failed to save performance' });
  }
});

export default router;
