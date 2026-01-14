/**
 * Content Branching Routes
 * 
 * Handles content branching, merging, and version control operations.
 */

import { Router, Request, Response } from 'express';
import { requireAdmin } from '../../lib/middleware/adminAuth';
import { validateRequired } from '../../lib/middleware/validation';

const router = Router();

interface ApiError extends Error {
    message: string;
    code?: string;
    status?: number;
}

// Create content branch
// Security: Admin-only - content branch management is a privileged operation
router.post('/',
    requireAdmin(),
    validateRequired(['name', 'createdBy']),
    async (req: Request, res: Response) => {
        try {
            const { name, description, baseBranch, createdBy } = req.body;

            const { createBranch } = await import('../../lib/services/contentBranchingService');

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
                error: apiError.message || 'Failed to create branch'
            });
        }
    }
);

// List branches
router.get('/', async (req: Request, res: Response) => {
    try {
        const { includeArchived } = req.query;

        const { listBranches } = await import('../../lib/services/contentBranchingService');

        const branches = await listBranches(includeArchived === 'true');

        res.json({ success: true, branches });
    } catch (error) {
        console.error('Failed to list branches:', error);
        res.status(500).json({ success: false, error: 'Failed to list branches' });
    }
});

// Merge branch
// Security: Admin-only - branch merging is a privileged operation
router.post('/:branchName/merge',
    requireAdmin(),
    validateRequired(['mergedBy']),
    async (req: Request, res: Response) => {
        try {
            const { branchName } = req.params;
            const { mergedBy, targetBranch } = req.body;

            const { mergeBranch } = await import('../../lib/services/contentBranchingService');

            const result = await mergeBranch(branchName, mergedBy, targetBranch);

            res.json({ success: result.success, ...result });
        } catch (error) {
            const apiError = error as ApiError;
            console.error('Failed to merge branch:', apiError);
            res.status(500).json({
                success: false,
                error: apiError.message || 'Failed to merge branch'
            });
        }
    }
);

export default router;
