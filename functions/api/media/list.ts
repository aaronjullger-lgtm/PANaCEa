/**
 * API Endpoint: List Media
 * GET /api/media/list
 * 
 * Lists media assets with optional filtering
 */

import type { Request, Response } from 'express';
import { 
  getMediaByCategory, 
  getMediaByCondition, 
  searchMediaByTags 
} from '../../../services/mediaStorageService';

export default async function handler(req: Request, res: Response) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { category, conditionId, tags } = req.query;

    let media;

    if (conditionId && typeof conditionId === 'string') {
      // Get media for specific condition
      media = await getMediaByCondition(conditionId);
    } else if (category && typeof category === 'string') {
      // Get media by category
      media = await getMediaByCategory(category as any);
    } else if (tags) {
      // Search by tags
      const tagArray = typeof tags === 'string' ? tags.split(',') : [];
      media = await searchMediaByTags(tagArray);
    } else {
      return res.status(400).json({ 
        error: 'Please provide category, conditionId, or tags parameter' 
      });
    }

    return res.status(200).json({
      success: true,
      media,
      count: media.length,
    });
  } catch (error) {
    console.error('Error listing media:', error);
    return res.status(500).json({ 
      error: 'Failed to list media',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
