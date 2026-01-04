/**
 * API Endpoint: Get Resources for Condition
 * GET /api/resources/condition/:conditionId
 * 
 * Retrieves educational resources linked to a specific condition
 */

import type { Request, Response } from 'express';
import { getResourcesForCondition } from '../../../../services/educationalResourceService';

export default async function handler(req: Request, res: Response) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { conditionId } = req.params;
    const { limit } = req.query;

    if (!conditionId) {
      return res.status(400).json({ 
        error: 'Condition ID is required' 
      });
    }

    const resources = await getResourcesForCondition(
      conditionId,
      limit ? parseInt(limit as string) : 10
    );

    return res.status(200).json({
      success: true,
      resources,
      count: resources.length,
    });

  } catch (error) {
    console.error('Error fetching resources for condition:', error);
    return res.status(500).json({ 
      error: 'Failed to fetch resources',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
