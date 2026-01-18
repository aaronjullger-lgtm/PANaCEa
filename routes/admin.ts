/**
 * Admin Routes
 *
 * Handles administrative functions like content branch management,
 * media approvals, and admin stats.
 * Extracted from server.ts for modularity.
 */

import { Router, Request, Response } from 'express';
import { requireAdmin } from '../lib/middleware/adminAuth';
import { validateRequired } from '../lib/middleware/validation';
import { ApiError } from '../lib/errors/ApiError';
import { prisma } from '../lib/prisma';

const router = Router();

// Check admin access (for frontend validation)
router.get('/check-access', requireAdmin(), (req: Request, res: Response) => {
  res.json({ success: true, role: 'admin' });
});

// Admin Stats Endpoint
router.get('/stats', requireAdmin(), async (req: Request, res: Response) => {
  try {
    let stats = {
      totalUsers: 150,
      activeUsersToday: 78,
      totalStudySessions: 45230,
      averageAccuracy: 76.5,
    };

    if (process.env.DATABASE_URL) {
      const userCount = await prisma.user.count();
      const sessionCount = await prisma.performanceRecord.count();

      const correctCount = await prisma.performanceRecord.count({
        where: { isCorrect: true },
      });

      stats = {
        totalUsers: userCount,
        activeUsersToday: 0, // Need a session table or lastActive field
        totalStudySessions: sessionCount,
        averageAccuracy: sessionCount > 0 ? (correctCount / sessionCount) * 100 : 0,
      };
    }

    res.json({ success: true, data: stats });
  } catch (error) {
    console.error('Error fetching admin stats:', error);
    res.status(500).json({ error: 'Failed to fetch admin stats' });
  }
});

// Media Management (Pending/Approve/Stats)
router.get('/media/pending', requireAdmin(), async (req: Request, res: Response) => {
  try {
    const pendingHandler = await import('../functions/api/media/pending');
    await pendingHandler.default(req, res);
  } catch (error) {
    console.error('Error getting pending media:', error);
    res.status(500).json({ error: 'Failed to get pending media' });
  }
});

router.post('/media/approve', requireAdmin(), async (req: Request, res: Response) => {
  try {
    const approveHandler = await import('../functions/api/media/approve');
    await approveHandler.default(req, res);
  } catch (error) {
    console.error('Error approving media:', error);
    res.status(500).json({ error: 'Failed to approve media' });
  }
});

router.get('/media/stats', requireAdmin(), async (req: Request, res: Response) => {
  try {
    const statsHandler = await import('../functions/api/media/stats');
    await statsHandler.default(req, res);
  } catch (error) {
    console.error('Error getting media stats:', error);
    res.status(500).json({ error: 'Failed to get stats' });
  }
});

// Content Branching (Create Branch)
router.post(
  '/branches',
  requireAdmin(),
  validateRequired(['name', 'createdBy']),
  async (req: Request, res: Response) => {
    try {
      const { name, description, baseBranch, createdBy } = req.body;

      const { createBranch } = await import('../lib/services/contentBranchingService');

      const branchId = await createBranch({
        name,
        description,
        baseBranch,
        createdBy,
      });

      res.json({ success: true, branchId });
    } catch (error) {
      const apiError = error as ApiError;
      console.error('Failed to create branch:', apiError);
      res.status(500).json({
        success: false,
        error: apiError.message || 'Failed to create branch',
      });
    }
  }
);

// List Branches (Public/Auth-protected but not strictly Admin-only for read?
// Original code didn't have requireAdmin on GET /api/branches, but conceptually likely needed.
// Leaving it open as per original server.ts)
router.get('/branches', async (req: Request, res: Response) => {
  try {
    const { includeArchived } = req.query;

    const { listBranches } = await import('../lib/services/contentBranchingService');

    const branches = await listBranches(includeArchived === 'true');

    res.json({ success: true, branches });
  } catch (error) {
    console.error('Failed to list branches:', error);
    res.status(500).json({ success: false, error: 'Failed to list branches' });
  }
});

// Merge Branch
router.post(
  '/branches/:branchName/merge',
  requireAdmin(),
  validateRequired(['mergedBy']),
  async (req: Request, res: Response) => {
    try {
      const { branchName } = req.params;
      const { mergedBy, targetBranch } = req.body;

      const { mergeBranch } = await import('../lib/services/contentBranchingService');

      const result = await mergeBranch(branchName, mergedBy, targetBranch);

      res.json({ success: result.success, ...result });
    } catch (error) {
      const apiError = error as ApiError;
      console.error('Failed to merge branch:', apiError);
      res.status(500).json({
        success: false,
        error: apiError.message || 'Failed to merge branch',
      });
    }
  }
);

// Hybrid Content Engine / Staging Routes (Admin-only)

// Save to staging
router.post(
  '/staging',
  requireAdmin(),
  validateRequired(['questionData']),
  async (req: Request, res: Response) => {
    try {
      if (!process.env.DATABASE_URL) {
        return res.status(503).json({ success: false, error: 'Database not configured' });
      }

      const { saveToStaging } = await import('../services/stagingQuestionService');
      const question = await saveToStaging(req.body.questionData);

      res.json({ success: true, stagingQuestion: question });
    } catch (error) {
      console.error('Failed to save to staging:', error);
      res.status(500).json({ success: false, error: 'Failed to save to staging' });
    }
  }
);

// Adequacy check
router.post('/staging/:id/check', requireAdmin(), async (req: Request, res: Response) => {
  try {
    if (!process.env.DATABASE_URL) {
      return res.status(503).json({ success: false, error: 'Database not configured' });
    }

    const { runAdequacyCheck } = await import('../services/stagingQuestionService');
    const result = await runAdequacyCheck(req.params.id);

    res.json({ success: true, adequacyCheck: result });
  } catch (error) {
    console.error('Failed to run adequacy check:', error);
    res.status(500).json({ success: false, error: 'Failed to run adequacy check' });
  }
});

// Process staging queue
router.post('/staging/process', requireAdmin(), async (req: Request, res: Response) => {
  try {
    if (!process.env.DATABASE_URL) {
      return res.status(503).json({ success: false, error: 'Database not configured' });
    }

    const { processStagingQueue } = await import('../services/stagingQuestionService');
    const { limit = 10 } = req.body;
    const results = await processStagingQueue(limit);

    res.json({ success: true, results });
  } catch (error) {
    console.error('Failed to process staging queue:', error);
    res.status(500).json({ success: false, error: 'Failed to process staging queue' });
  }
});

// Staging stats (Public read? Original code didn't require admin)
router.get('/staging/stats', async (req: Request, res: Response) => {
  try {
    if (!process.env.DATABASE_URL) {
      return res.json({ success: true, stats: {} });
    }

    const { getStagingStats } = await import('../services/stagingQuestionService');
    const stats = await getStagingStats();

    res.json({ success: true, stats });
  } catch (error) {
    console.error('Failed to get staging stats:', error);
    res.status(500).json({ success: false, error: 'Failed to get staging stats' });
  }
});

export default router;
