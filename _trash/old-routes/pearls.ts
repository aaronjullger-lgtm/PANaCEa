/**
 * Clinical Pearls Routes
 *
 * Handles all clinical pearl-related API endpoints.
 * Extracted from server.ts for modularity.
 */

import { Router, Request, Response } from 'express';
import { validateRequired } from '../lib/middleware/validation';

const router = Router();

// Extract clinical pearl from explanation
router.post(
  '/extract',
  validateRequired(['questionId', 'explanation']),
  async (req: Request, res: Response): Promise<void> => {
    try {
      if (!process.env.DATABASE_URL) {
        res.status(503).json({ success: false, error: 'Database not configured' });
        return;
      }

      const { createClinicalPearl } = await import('../services/domain/clinicalPearlService');
      const { questionId, explanation, metadata } = req.body;
      if (typeof questionId !== 'string') {
        res.status(400).json({ success: false, error: 'questionId is required' });
        return;
      }
      const pearl = await createClinicalPearl(questionId, explanation, metadata);

      res.json({ success: true, pearl });
    } catch (error) {
      console.error('Failed to extract pearl:', error);
      res.status(500).json({ success: false, error: 'Failed to extract pearl' });
    }
  }
);

// Get daily pearl
router.get('/daily', async (req: Request, res: Response): Promise<void> => {
  try {
    if (!process.env.DATABASE_URL) {
      res.json({ success: true, pearl: null });
      return;
    }

    const { getDailyPearl } = await import('../services/domain/clinicalPearlService');
    const userId = req.query.userId as string | undefined;
    const pearl = await getDailyPearl(userId ?? '');

    res.json({ success: true, pearl });
  } catch (error) {
    console.error('Failed to get daily pearl:', error);
    res.status(500).json({ success: false, error: 'Failed to get daily pearl' });
  }
});

// Get user's pearls (Review My Pearls)
router.get('/user/:userId', async (req: Request, res: Response): Promise<void> => {
  try {
    if (!process.env.DATABASE_URL) {
      res.json({ success: true, pearls: [] });
      return;
    }

    const { getUserPearls } = await import('../services/domain/clinicalPearlService');
    const userId = req.params.userId;
    if (!userId) {
      res.status(400).json({ success: false, error: 'userId is required' });
      return;
    }
    const { limit = 20 } = req.query;
    const pearls = await getUserPearls(userId, Number(limit));

    res.json({ success: true, pearls });
  } catch (error) {
    console.error('Failed to get user pearls:', error);
    res.status(500).json({ success: false, error: 'Failed to get user pearls' });
  }
});

// Get user's favorite pearls
router.get('/user/:userId/favorites', async (req: Request, res: Response): Promise<void> => {
  try {
    if (!process.env.DATABASE_URL) {
      res.json({ success: true, pearls: [] });
      return;
    }

    const { getUserFavoritePearls } = await import('../services/domain/clinicalPearlService');
    const userId = req.params.userId;
    if (!userId) {
      res.status(400).json({ success: false, error: 'userId is required' });
      return;
    }
    const pearls = await getUserFavoritePearls(userId);

    res.json({ success: true, pearls });
  } catch (error) {
    console.error('Failed to get favorite pearls:', error);
    res.status(500).json({ success: false, error: 'Failed to get favorite pearls' });
  }
});

// Mark pearl as useful
router.post(
  '/:pearlId/useful',
  validateRequired(['userId']),
  async (req: Request, res: Response): Promise<void> => {
    try {
      if (!process.env.DATABASE_URL) {
        res.status(503).json({ success: false, error: 'Database not configured' });
        return;
      }

      const { markPearlUseful } = await import('../services/domain/clinicalPearlService');
      const pearlId = req.params.pearlId;
      const { userId, notes } = req.body;
      if (!pearlId || typeof userId !== 'string') {
        res.status(400).json({ success: false, error: 'pearlId and userId are required' });
        return;
      }
      await markPearlUseful(userId, pearlId, notes);

      res.json({ success: true });
    } catch (error) {
      console.error('Failed to mark pearl as useful:', error);
      res.status(500).json({ success: false, error: 'Failed to mark pearl as useful' });
    }
  }
);

// Search pearls
router.post('/search', async (req: Request, res: Response): Promise<void> => {
  try {
    if (!process.env.DATABASE_URL) {
      res.json({ success: true, pearls: [] });
      return;
    }

    const { searchPearls } = await import('../services/domain/clinicalPearlService');
    const pearls = await searchPearls(req.body);

    res.json({ success: true, pearls });
  } catch (error) {
    console.error('Failed to search pearls:', error);
    res.status(500).json({ success: false, error: 'Failed to search pearls' });
  }
});

// Get pearl statistics
router.get('/stats', async (req: Request, res: Response): Promise<void> => {
  try {
    if (!process.env.DATABASE_URL) {
      res.json({ success: true, stats: {} });
      return;
    }

    const { getPearlStats } = await import('../services/domain/clinicalPearlService');
    const stats = await getPearlStats();

    res.json({ success: true, stats });
  } catch (error) {
    console.error('Failed to get pearl stats:', error);
    res.status(500).json({ success: false, error: 'Failed to get pearl stats' });
  }
});

export default router;
