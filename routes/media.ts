/**
 * Media Management Routes
 * 
 * Handles media upload approval, status checking, and statistics.
 */

import { Router, Request, Response } from 'express';
import { requireAdmin } from '../../lib/middleware/adminAuth';

const router = Router();

// Get pending media for review
router.get('/pending', requireAdmin(), async (req: Request, res: Response) => {
    try {
        const { getPendingMedia } = await import('../../lib/services/mediaReviewService');
        const media = await getPendingMedia();
        res.json({ success: true, media });
    } catch (error) {
        console.error('Failed to get pending media:', error);
        res.status(500).json({ success: false, error: 'Failed to get pending media' });
    }
});

// Approve/Reject media
router.post('/approve', requireAdmin(), async (req: Request, res: Response) => {
    try {
        const { mediaId, approved, rejectionReason, reviewedBy } = req.body;
        const { reviewMedia } = await import('../../lib/services/mediaReviewService');

        await reviewMedia(mediaId, approved, reviewedBy, rejectionReason);
        res.json({ success: true });
    } catch (error) {
        console.error('Failed to review media:', error);
        res.status(500).json({ success: false, error: 'Failed to review media' });
    }
});

// Get media statistics
router.get('/stats', requireAdmin(), async (req: Request, res: Response) => {
    try {
        const { getMediaStats } = await import('../../lib/services/mediaReviewService');
        const stats = await getMediaStats();
        res.json({ success: true, stats });
    } catch (error) {
        console.error('Failed to get media stats:', error);
        res.status(500).json({ success: false, error: 'Failed to get media stats' });
    }
});

export default router;
