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
  async (req: Request, res: Response) => {
    try {
      if (!process.env.DATABASE_URL) {
        return res.status(503).json({ success: false, error: 'Database not configured' });
      }

      const { createClinicalPearl } = await import('../services/clinicalPearlService');
      const { questionId, explanation, metadata } = req.body;
      const pearl = await createClinicalPearl(questionId, explanation, metadata);

      res.json({ success: true, pearl });
    } catch (error) {
      console.error('Failed to extract pearl:', error);
      res.status(500).json({ success: false, error: 'Failed to extract pearl' });
    }
  }
);

// Get daily pearl
router.get('/daily', async (req: Request, res: Response) => {
  try {
    if (!process.env.DATABASE_URL) {
      return res.json({ success: true, pearl: null });
    }

    const { getDailyPearl } = await import('../services/clinicalPearlService');
    const { userId } = req.query;
    const pearl = await getDailyPearl(userId as string);

    res.json({ success: true, pearl });
  } catch (error) {
    console.error('Failed to get daily pearl:', error);
    res.status(500).json({ success: false, error: 'Failed to get daily pearl' });
  }
});

// Get user's pearls (Review My Pearls)
router.get('/user/:userId', async (req: Request, res: Response) => {
  try {
    if (!process.env.DATABASE_URL) {
      return res.json({ success: true, pearls: [] });
    }

    const { getUserPearls } = await import('../services/clinicalPearlService');
    const { userId } = req.params;
    const { limit = 20 } = req.query;
    const pearls = await getUserPearls(userId, Number(limit));

    res.json({ success: true, pearls });
  } catch (error) {
    console.error('Failed to get user pearls:', error);
    res.status(500).json({ success: false, error: 'Failed to get user pearls' });
  }
});

// Get user's favorite pearls
router.get('/user/:userId/favorites', async (req: Request, res: Response) => {
  try {
    if (!process.env.DATABASE_URL) {
      return res.json({ success: true, pearls: [] });
    }

    const { getUserFavoritePearls } = await import('../services/clinicalPearlService');
    const { userId } = req.params;
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
  async (req: Request, res: Response) => {
    try {
      if (!process.env.DATABASE_URL) {
        return res.status(503).json({ success: false, error: 'Database not configured' });
      }

      const { markPearlUseful } = await import('../services/clinicalPearlService');
      const { pearlId } = req.params;
      const { userId, notes } = req.body;
      await markPearlUseful(userId, pearlId, notes);

      res.json({ success: true });
    } catch (error) {
      console.error('Failed to mark pearl as useful:', error);
      res.status(500).json({ success: false, error: 'Failed to mark pearl as useful' });
    }
  }
);

// Search pearls
router.post('/search', async (req: Request, res: Response) => {
  try {
    if (!process.env.DATABASE_URL) {
      return res.json({ success: true, pearls: [] });
    }

    const { searchPearls } = await import('../services/clinicalPearlService');
    const pearls = await searchPearls(req.body);

    res.json({ success: true, pearls });
  } catch (error) {
    console.error('Failed to search pearls:', error);
    res.status(500).json({ success: false, error: 'Failed to search pearls' });
  }
});

// Get pearl statistics
router.get('/stats', async (req: Request, res: Response) => {
  try {
    if (!process.env.DATABASE_URL) {
      return res.json({ success: true, stats: {} });
    }

    const { getPearlStats } = await import('../services/clinicalPearlService');
    const stats = await getPearlStats();

    res.json({ success: true, stats });
  } catch (error) {
    console.error('Failed to get pearl stats:', error);
    res.status(500).json({ success: false, error: 'Failed to get pearl stats' });
  }
});

export default router;
