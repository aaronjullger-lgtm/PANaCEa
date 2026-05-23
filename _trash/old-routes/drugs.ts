/**
 * ============================================================================
 * ⚠️  LEGACY ROUTE - LOCAL DEVELOPMENT ONLY ⚠️
 * ============================================================================
 *
 * This Express route is for LOCAL DEVELOPMENT and TESTING only.
 *
 * PRODUCTION uses Cloudflare Pages Functions in /functions/api/
 *
 * See: CLOUDFLARE_FUNCTIONS_GUIDE.md for production deployment info.
 * ============================================================================
 */

import { Router, type Request, type Response } from 'express';
import { prisma } from '../lib/prisma';

const router = Router();

/**
 * GET /api/drugs or /api/drugs/all
 * Get all drugs or filtered by limit (same handler for CF parity)
 */
const getAllDrugs = async (req: Request, res: Response) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;

    const drugs = await prisma.drug.findMany({
      take: limit,
      orderBy: { genericName: 'asc' },
    });

    res.setHeader('Cache-Control', 'public, max-age=60');
    res.json(drugs);
  } catch (error) {
    console.error('Error fetching drugs:', error);
    res.status(500).json({
      error: 'Failed to fetch drugs from database',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

router.get('/', getAllDrugs);
router.get('/all', getAllDrugs);

/**
 * GET /api/drugs/random
 * Get random drugs for drill sessions
 */
router.get('/random', async (req, res) => {
  try {
    const count = parseInt(req.query.count as string, 10) || 10;

    // Get random drugs using SQL
    const drugs = await prisma.$queryRaw`
      SELECT * FROM "Drug"
      ORDER BY RANDOM()
      LIMIT ${count}
    `;

    res.json(drugs);
  } catch (error) {
    console.error('Error fetching random drugs:', error);
    res.status(500).json({
      error: 'Failed to fetch random drugs',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/drugs/search
 * Search drugs by name or class
 */
router.get('/search', async (req, res): Promise<void> => {
  try {
    const query = (req.query.q as string) || '';

    if (!query) {
      res.status(400).json({ error: 'Search query is required' });
      return;
    }

    const drugs = await prisma.drug.findMany({
      where: {
        OR: [
          { genericName: { contains: query, mode: 'insensitive' } },
          { brandName: { contains: query, mode: 'insensitive' } },
          { drugClass: { hasSome: [query] } },
        ],
      },
      take: 50,
      orderBy: { genericName: 'asc' },
    });

    res.json(drugs);
  } catch (error) {
    console.error('Error searching drugs:', error);
    res.status(500).json({
      error: 'Failed to search drugs',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
