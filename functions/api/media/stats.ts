/**
 * API Endpoint: Media Statistics
 * GET /api/media/stats
 * 
 * Returns statistics about media approval workflow
 */

import type { Request, Response } from 'express';
import { getApprovalStats } from '../../../services/mediaApprovalService';

export default async function handler(req: Request, res: Response) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const stats = await getApprovalStats();

    return res.status(200).json({
      success: true,
      stats,
    });

  } catch (error) {
    console.error('Error fetching media stats:', error);
    return res.status(500).json({ 
      error: 'Failed to fetch statistics',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
