/**
 * API Endpoint: Get Pending Media
 * GET /api/media/pending
 * 
 * Retrieves media assets awaiting approval
 */

import type { Request, Response } from 'express';
import { getPendingMedia, getApprovalStats } from '../../../services/mediaApprovalService';

export default async function handler(req: Request, res: Response) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { category, limit, offset, includeStats } = req.query;

    const options = {
      category: category as string | undefined,
      limit: limit ? parseInt(limit as string) : 50,
      offset: offset ? parseInt(offset as string) : 0,
    };

    const result = await getPendingMedia(options);
    
    let stats;
    if (includeStats === 'true') {
      stats = await getApprovalStats();
    }

    return res.status(200).json({
      success: true,
      media: result.media,
      total: result.total,
      stats,
    });

  } catch (error) {
    console.error('Error fetching pending media:', error);
    return res.status(500).json({ 
      error: 'Failed to fetch pending media',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
