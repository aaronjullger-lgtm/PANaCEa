/**
 * Labs Routes
 *
 * Handles all lab-related API endpoints (lab tests, lab cases).
 * Extracted from server.ts for modularity.
 */

import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';

const router = Router();

// Lab Tests
router.get('/tests', async (req: Request, res: Response) => {
  try {
    const tests = await prisma.labTest.findMany({
      orderBy: { name: 'asc' },
    });
    res.json(tests);
  } catch (error) {
    console.error('Error fetching lab tests:', error);
    res.status(500).json({ error: 'Failed to fetch lab tests' });
  }
});

// Lab Cases
router.get('/cases', async (req: Request, res: Response) => {
  try {
    const cases = await prisma.labCase.findMany();
    res.json(cases);
  } catch (error) {
    console.error('Error fetching lab cases:', error);
    res.status(500).json({ error: 'Failed to fetch lab cases' });
  }
});

// Random Lab Cases
router.get('/cases/random', async (req: Request, res: Response) => {
  try {
    const count = parseInt(req.query.count as string) || 1;

    const cases = await prisma.$queryRaw`
      SELECT * FROM "LabCase"
      ORDER BY RANDOM()
      LIMIT ${count}
    `;

    res.json(cases);
  } catch (error) {
    console.error('Error fetching random lab cases:', error);
    res.status(500).json({ error: 'Failed to fetch random lab cases' });
  }
});

export default router;
