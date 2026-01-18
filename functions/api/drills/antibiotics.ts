/**
 * Antibiotic Guidelines API Endpoint
 *
 * GET /api/drills/antibiotics
 *
 * Query params:
 *   - class: filter by organism class (Gram Positive|Gram Negative|Atypical|Fungal|Anaerobic)
 *
 * Returns antibiotic coverage guidelines from database for Bug-Drug drill mode.
 *
 * Security: Public endpoint with input validation (reference data doesn't require auth)
 * Sprint: Security Hardening Sprint 4
 */

import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { publicEndpoint, type ValidatedContext } from '../_shared/middleware';
import { antibioticQuerySchema } from '../_shared/zodSchemas';
import { logger } from '../_shared/secureLogger';
import type { z } from 'zod';

type AntibioticQuery = z.infer<typeof antibioticQuerySchema>;

/**
 * GET /api/drills/antibiotics
 * Returns antibiotic coverage guidelines with optional class filtering
 */
export const onRequestGet = publicEndpoint(
  antibioticQuerySchema,
  async (context: ValidatedContext<AntibioticQuery>) => {
    const prisma = createEdgePrismaClient(context.env.DATABASE_URL);

    try {
      const { class: classFilter } = context.validated;

      // Build query filter
      const where: Record<string, string> = {};
      if (classFilter) {
        where.class = classFilter;
      }

      // Fetch all matching guidelines
      const allGuidelines = await prisma.antibioticGuideline.findMany({
        where,
        select: {
          id: true,
          organism: true,
          class: true,
          effective: true,
          resistant: true,
          notes: true,
          description: true,
        },
      });

      if (allGuidelines.length === 0) {
        logger.info('No antibiotic guidelines found', { classFilter });
        return {
          status: 404,
          data: {
            error: 'No guidelines found',
            filters: { class: classFilter },
          },
        };
      }

      // Parse JSON fields (effective and resistant arrays)
      const parsedGuidelines = allGuidelines.map((guideline) => ({
        id: guideline.id,
        organism: guideline.organism,
        class: guideline.class,
        effective: Array.isArray(guideline.effective)
          ? guideline.effective
          : typeof guideline.effective === 'string'
            ? JSON.parse(guideline.effective)
            : [],
        resistant: Array.isArray(guideline.resistant)
          ? guideline.resistant
          : typeof guideline.resistant === 'string'
            ? JSON.parse(guideline.resistant)
            : [],
        notes: guideline.notes,
        description: guideline.description,
      }));

      logger.info('Antibiotic guidelines fetched', {
        count: parsedGuidelines.length,
        classFilter,
      });

      return {
        data: {
          guidelines: parsedGuidelines,
          total: parsedGuidelines.length,
        },
      };
    } catch (error) {
      logger.error('Antibiotic guidelines API error', error);
      throw error; // Let middleware handle error formatting
    } finally {
      await safePrismaDisconnect(prisma);
    }
  }
);