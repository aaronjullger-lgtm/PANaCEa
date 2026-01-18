import { Router, Response } from 'express';
import { requireAuth, AuthenticatedRequest } from '../lib/middleware/clerkAuth';
import { recommendationService } from '../lib/services/recommendationService';

const router = Router();

// Get (and generate) recommendations
router.get('/', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const recommendations = await recommendationService.generateRecommendations(req.auth.userId);
    res.json(recommendations);
  } catch (error) {
    console.error('Error fetching recommendations:', error);
    res.status(500).json({ error: 'Failed to fetch recommendations' });
  }
});

// Explicit generate trigger
router.post('/generate', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const recommendations = await recommendationService.generateRecommendations(req.auth.userId);
    res.json(recommendations);
  } catch (error) {
    console.error('Error generating recommendations:', error);
    res.status(500).json({ error: 'Failed to generate recommendations' });
  }
});

// Dismiss recommendation
router.patch('/:id/dismiss', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    await recommendationService.dismissRecommendation(id, req.auth.userId);
    res.json({ success: true });
  } catch (error) {
    console.error('Error dismissing recommendation:', error);
    res.status(500).json({ error: 'Failed to dismiss recommendation' });
  }
});

export default router;
