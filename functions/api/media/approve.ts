/**
 * API Endpoint: Approve Media
 * POST /api/media/approve
 * 
 * Approves or rejects media assets in the approval workflow
 */

import type { Request, Response } from 'express';
import { approveMedia, rejectMedia, batchApproveMedia } from '../../../services/mediaApprovalService';

export default async function handler(req: Request, res: Response) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { action, mediaId, mediaIds, approvedBy, rejectionReason } = req.body;

    // Validate required fields
    if (!action || !approvedBy) {
      return res.status(400).json({ 
        error: 'Missing required fields: action and approvedBy are required' 
      });
    }

    // Handle single media approval/rejection
    if (action === 'approve' && mediaId) {
      await approveMedia({ 
        mediaId, 
        status: 'approved', 
        approvedBy 
      });
      
      return res.status(200).json({
        success: true,
        message: 'Media approved successfully',
      });
    }

    if (action === 'reject' && mediaId) {
      await rejectMedia({ 
        mediaId, 
        status: 'rejected', 
        approvedBy,
        rejectionReason 
      });
      
      return res.status(200).json({
        success: true,
        message: 'Media rejected',
      });
    }

    // Handle batch approval
    if (action === 'batch-approve' && mediaIds && Array.isArray(mediaIds)) {
      const result = await batchApproveMedia(mediaIds, approvedBy);
      
      return res.status(200).json({
        success: true,
        message: `Approved ${result.approved} of ${mediaIds.length} media assets`,
        approved: result.approved,
        failed: result.failed,
      });
    }

    return res.status(400).json({ 
      error: 'Invalid action or missing parameters' 
    });

  } catch (error) {
    console.error('Error processing media approval:', error);
    return res.status(500).json({ 
      error: 'Failed to process approval',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
