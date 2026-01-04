/**
 * API Endpoint: Search Educational Resources
 * GET /api/resources/search
 * 
 * Search for educational resources by query and filters
 */

import type { Request, Response } from 'express';
import { searchResources } from '../../../services/educationalResourceService';

export default async function handler(req: Request, res: Response) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { q, resourceType, systemCode } = req.query;

    if (!q || typeof q !== 'string') {
      return res.status(400).json({ 
        error: 'Query parameter "q" is required' 
      });
    }

    const filters: any = {};
    if (resourceType) filters.resourceType = resourceType;
    if (systemCode) filters.systemCode = systemCode;

    const resources = await searchResources(q, filters);

    return res.status(200).json({
      success: true,
      resources,
      count: resources.length,
    });

  } catch (error) {
    console.error('Error searching resources:', error);
    return res.status(500).json({ 
      error: 'Failed to search resources',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
