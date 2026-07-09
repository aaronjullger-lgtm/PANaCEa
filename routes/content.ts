/**
 * Content Routes
 *
 * Handles all medical content-related API endpoints.
 * Extracted from server.ts for modularity.
 */

import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { requireAuth, AuthenticatedRequest } from '../lib/middleware/clerkAuth';

const router = Router();

// Get all medical content (Replacement for static JSON file)
// Public endpoint to allow loading content before auth
router.get('/all', async (req: Request, res: Response): Promise<void> => {
  try {
    const allContent = await prisma.medicalContent.findMany({
      where: { status: 'published' },
    });

    // Transform to map format expected by frontend
    const contentMap: Record<string, unknown> = {};
    allContent.forEach((item) => {
      contentMap[item.conditionId] = {
        conditionId: item.conditionId,
        condition: item.condition,
        system: item.system,
        subcategory: item.subcategory,
        overview: item.overview,
        etiologyPathophysiology:
          [
            item.etiology ? `**Etiology**\n\n${item.etiology}` : null,
            item.pathophysiology ? `**Pathophysiology**\n\n${item.pathophysiology}` : null,
          ]
            .filter(Boolean)
            .join('\n\n') || undefined,
        etiology: item.etiology,
        pathophysiology: item.pathophysiology,
        epidemiology: item.epidemiology,
        symptoms: item.symptoms && item.symptoms.length > 0 ? item.symptoms : undefined,
        physicalExam:
          item.physicalExam && item.physicalExam.length > 0 ? item.physicalExam : undefined,
        examFindings:
          item.physicalExam && item.physicalExam.length > 0 ? item.physicalExam : undefined,
        riskFactors: item.riskFactors && item.riskFactors.length > 0 ? item.riskFactors : undefined,
        complications:
          item.complications && item.complications.length > 0 ? item.complications : undefined,
        differentialDiagnosis:
          item.differentialDiagnosis && item.differentialDiagnosis.length > 0
            ? item.differentialDiagnosis
            : undefined,
        diagnostics: item.diagnostics,
        treatment: item.treatment,
        prognosis: item.prognosis,
        buzzwords: item.buzzwords && item.buzzwords.length > 0 ? item.buzzwords : undefined,
      };
    });

    res.json(contentMap);
  } catch (error) {
    console.error('Error fetching all content:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    if (errorMessage.includes('connect') || errorMessage.includes('ECONNREFUSED')) {
      res.status(503).json({
        error: 'Database unavailable',
        message:
          'Unable to connect to database. Please ensure DATABASE_URL is configured and the database is accessible.',
        details: errorMessage,
      });
      return;
    }

    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to fetch medical content from database',
      details: process.env.NODE_ENV === 'development' ? errorMessage : undefined, // pragma: allowlist secret
    });
  }
});

// Single Condition Content Endpoint
router.get(
  '/condition/:conditionId',
  requireAuth,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { conditionId } = req.params;

      if (!conditionId || typeof conditionId !== 'string' || conditionId.trim() === '') {
        res.status(400).json({
          error: 'Invalid request',
          message: 'conditionId parameter is required and must be a valid string',
        });
        return;
      }

      const sanitizedId = conditionId.trim().replace(/[<>"'`;]/g, '');

      const content = await prisma.medicalContent.findFirst({
        where: {
          OR: [
            { conditionId: { equals: sanitizedId, mode: 'insensitive' } },
            { condition: { equals: sanitizedId, mode: 'insensitive' } },
          ],
          status: 'published',
        },
      });

      if (!content) {
        res.status(404).json({
          error: 'Content not found',
          message: `No published medical content found for condition: ${sanitizedId}`,
          conditionId: sanitizedId,
        });
        return;
      }

      res.json(content);
    } catch (error) {
      console.error('[Content API] Error fetching condition:', {
        conditionId: req.params.conditionId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to fetch medical content. Please try again later.',
      });
    }
  }
);

// Alias route for simpler frontend access
router.get(
  '/:conditionId',
  requireAuth,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { conditionId } = req.params;

      if (!conditionId || typeof conditionId !== 'string' || conditionId.trim() === '') {
        res.status(400).json({
          error: 'Invalid request',
          message: 'conditionId parameter is required and must be a valid string',
        });
        return;
      }

      const sanitizedId = conditionId.trim().replace(/[<>"'`;]/g, '');

      const content = await prisma.medicalContent.findFirst({
        where: {
          OR: [
            { conditionId: { equals: sanitizedId, mode: 'insensitive' } },
            { condition: { equals: sanitizedId, mode: 'insensitive' } },
          ],
          status: 'published',
        },
      });

      if (!content) {
        res.status(404).json({
          error: 'Content not found',
          message: `No published medical content found for condition: ${sanitizedId}`,
          conditionId: sanitizedId,
        });
        return;
      }

      res.json(content);
    } catch (error) {
      console.error('[Content API] Error fetching condition:', {
        conditionId: req.params.conditionId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to fetch medical content. Please try again later.',
      });
    }
  }
);

// Content Search Endpoint
router.get('/search', async (req: Request, res: Response): Promise<void> => {
  try {
    const { q, system, limit = 30 } = req.query;

    if (!q) {
      res.status(400).json({ error: 'Query parameter "q" is required' });
      return;
    }

    const query = String(q);

    type WhereClause = {
      status: string;
      OR: Array<{
        condition?: { contains: string; mode: 'insensitive' };
        overview?: { contains: string; mode: 'insensitive' };
      }>;
      AND?: Array<{
        OR: Array<{
          system?: string;
          relatedSystems?: { has: string };
        }>;
      }>;
    };

    const where: WhereClause = {
      status: 'published',
      OR: [
        { condition: { contains: query, mode: 'insensitive' } },
        { overview: { contains: query, mode: 'insensitive' } },
      ],
    };

    if (system) {
      where.AND = [
        {
          OR: [{ system: String(system) }, { relatedSystems: { has: String(system) } }],
        },
      ];
    }

    const results = await prisma.medicalContent.findMany({
      where,
      take: Number(limit),
      select: {
        conditionId: true,
        condition: true,
        system: true,
        subcategory: true,
        overview: true,
      },
      orderBy: { condition: 'asc' },
    });

    res.json({ results, count: results.length });
  } catch (error) {
    console.error('Error searching content:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
