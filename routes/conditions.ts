/**
 * Conditions Routes
 *
 * Handles all condition-related API endpoints.
 * Extracted from server.ts for modularity.
 */

import { Router, Response } from 'express';
import { prisma } from '../lib/prisma';
import { requireAuth, AuthenticatedRequest } from '../lib/middleware/clerkAuth';

const router = Router();

// Get extended condition details (Anatomy, Special Tests)
router.get(
  '/:identifier/extended',
  requireAuth,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { identifier } = req.params;

      // 1. Try direct ID match (UUID)
      let condition = await prisma.condition.findUnique({
        where: { id: identifier },
        include: {
          AnatomyStructure: true,
          SpecialTest: true,
          MediaAsset: true,
        },
      });

      // 2. If not found, try name match (exact)
      if (!condition) {
        const conditions = (await prisma.condition.findMany({
          where: {
            name: {
              equals: identifier.replace(/-/g, ' '),
              mode: 'insensitive',
            },
          },
          include: {
            AnatomyStructure: true,
            SpecialTest: true,
            MediaAsset: true,
          },
        })) as any;

        if (conditions.length > 0) {
          condition = conditions[0];
        }
      }

      // 3. If still not found, try searching with the raw identifier
      if (!condition) {
        const conditions = (await prisma.condition.findMany({
          where: {
            name: {
              equals: identifier,
              mode: 'insensitive',
            },
          },
          include: {
            AnatomyStructure: true,
            SpecialTest: true,
            MediaAsset: true,
          },
        })) as any;
        if (conditions.length > 0) {
          condition = conditions[0];
        }
      }

      if (!condition) {
        return res.status(404).json({ error: 'Condition not found' });
      }

      res.json(condition);
    } catch (error) {
      console.error('Error fetching extended condition details:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// Get all conditions from database (Registry replacement)
// Lightweight conditions endpoint - Returns only essential fields for registry
router.get('/', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const conditions = await prisma.condition.findMany({
      where: {
        status: 'published',
      },
      select: {
        id: true,
        name: true,
        system: true,
        subcategory: true,
      },
      orderBy: {
        name: 'asc',
      },
    });

    res.json(conditions);
  } catch (error) {
    console.error('[Conditions API] Error fetching conditions:', error);
    res.status(500).json({
      error: 'Failed to fetch conditions',
    });
  }
});

export default router;
