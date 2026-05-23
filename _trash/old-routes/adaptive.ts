/**
 * Adaptive Learning Router
 *
 * Public API for accessing:
 * - Smart Recommendations
 * - User Strength Profile (Knowledge Graph)
 */

import { Router, Request, Response } from 'express';
import { requireAuth } from '../lib/middleware/clerkAuth';
import {
  generateRecommendations,
  getNextBestAction,
  getUserStrengthProfile,
} from '../lib/services/adaptiveLearning';
import { prisma } from '../lib/prisma';

const router = Router();

/**
 * GET /api/adaptive/recommendations
 * Generates and returns current study recommendations
 */
router.get('/recommendations', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.auth?.userId;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const result = await generateRecommendations(userId);
    res.json(result);
  } catch (error) {
    console.error('Error in adaptive recommendations:', error);
    res.status(500).json({ error: 'Failed to generate recommendations' });
  }
});

/**
 * GET /api/adaptive/next-action
 * Quick endpoint for "Just tell me what to do" button
 */
router.get('/next-action', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.auth?.userId;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const action = await getNextBestAction(userId);
    res.json({ action });
  } catch (error) {
    console.error('Error in next-action:', error);
    res.status(500).json({ error: 'Failed to determine next action' });
  }
});

/**
 * GET /api/adaptive/profile
 * Returns the raw strength profile for visualization
 */
router.get('/profile', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.auth?.userId;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const profile = await getUserStrengthProfile(userId);
    res.json({ profile });
  } catch (error) {
    console.error('Error fetching profile:', error);
    res.status(500).json({ error: 'Failed to fetch learning profile' });
  }
});

/**
 * POST /api/adaptive/feedback
 * Log user feedback on a recommendation (e.g. "Too easy", "Not now")
 */
router.post('/feedback', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.auth?.userId;
    const { recommendationId, action } = req.body; // action: 'completed' | 'dismissed'

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    await prisma.studyRecommendation.updateMany({
      where: { id: recommendationId, userId },
      data: {
        status: action === 'dismissed' ? 'dismissed' : 'completed',
        completedAt: new Date(),
      },
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Error handling feedback:', error);
    res.status(500).json({ error: 'Failed to record feedback' });
  }
});

export default router;
