/**
 * Buzzwords Routes
 * 
 * Handles all buzzword-related API endpoints.
 * Extracted from server.ts for modularity.
 */

import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';

const router = Router();

// Get all buzzwords
router.get('/', async (req: Request, res: Response) => {
    try {
        const buzzwords = await prisma.buzzword.findMany({
            orderBy: { buzzword: 'asc' }
        });
        res.json(buzzwords);
    } catch (error) {
        console.error('Error fetching buzzwords:', error);
        res.status(500).json({ error: 'Failed to fetch buzzwords' });
    }
});

// Get random buzzwords
router.get('/random', async (req: Request, res: Response) => {
    try {
        const count = parseInt(req.query.count as string) || 10;

        const buzzwords = await prisma.$queryRaw`
      SELECT * FROM "Buzzword"
      ORDER BY RANDOM()
      LIMIT ${count}
    `;

        res.json(buzzwords);
    } catch (error) {
        console.error('Error fetching random buzzwords:', error);
        res.status(500).json({ error: 'Failed to fetch random buzzwords' });
    }
});

export default router;
