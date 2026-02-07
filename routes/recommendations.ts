import { Router, Response } from 'express';
import { requireAuth, AuthenticatedRequest } from '../lib/middleware/clerkAuth';
import { recommendationService } from '../lib/services/recommendationService';

const router = Router();

// Get (and generate) recommendations
router.get('/', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.auth?.userId;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const recommendations = await recommendationService.generateRecommendations(userId);
    res.json(recommendations);
  } catch (error) {
    console.error('Error fetching recommendations:', error);
    res.status(500).json({ error: 'Failed to fetch recommendations' });
  }
});

// Explicit generate trigger
router.post('/generate', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.auth?.userId;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const recommendations = await recommendationService.generateRecommendations(userId);
    res.json(recommendations);
  } catch (error) {
    console.error('Error generating recommendations:', error);
    res.status(500).json({ error: 'Failed to generate recommendations' });
  }
});

// Dismiss recommendation
router.patch('/:id/dismiss', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const id = req.params.id;
    const userId = req.auth?.userId;
    if (!id || !userId) {
      res.status(401).json({ error: 'Unauthorized or missing id' });
      return;
    }
    await recommendationService.dismissRecommendation(id, userId);
    res.json({ success: true });
  } catch (error) {
    console.error('Error dismissing recommendation:', error);
    res.status(500).json({ error: 'Failed to dismiss recommendation' });
  }
});

export default router;
