/**
 * Clinical Pearls API
 * POST /api/conditions/pearls - Save clinical pearls to MedicalContent table
 * GET /api/conditions/pearls?conditionId={id} - Fetch pearls for a condition
 * GET /api/conditions/pearls?system={system}&random=true - Random pearls for RapidRecallDrill
 */

import { authenticatedEndpoint } from '../_shared/middleware';
import {
  createEdgePrismaClient,
  safePrismaDisconnect,
  EdgePrismaClient,
} from '../_shared/prisma-edge';
import { createEndpointLogger } from '../_shared/secureLogger';
import { z } from 'zod';

// Schema for POST - Save pearls
const PostPearlsSchema = z.object({
  body: z.object({
    conditionId: z.string().min(1, 'Condition ID is required'),
    pearls: z.array(z.string().min(1)).min(1, 'At least one pearl is required').max(20),
  }),
});

// Schema for GET - Fetch pearls
const GetPearlsSchema = z.object({
  query: z.object({
    conditionId: z.string().optional(),
    system: z.string().optional(),
    random: z.enum(['true', 'false']).optional(),
  }),
});

/**
 * POST /api/conditions/pearls
 * Save clinical pearls to MedicalContent
 */
export const onRequestPost = authenticatedEndpoint(
  PostPearlsSchema,
  async ({ env, validated, auth }) => {
    const log = createEndpointLogger('/api/conditions/pearls', auth.userId);
    let prisma: EdgePrismaClient | null = null;

    try {
      const { conditionId, pearls } = validated.body;
      log.info('Saving pearls', { conditionId, pearlCount: pearls.length });

      prisma = createEdgePrismaClient(env.DATABASE_URL);

      // Fetch existing content
      const medicalContent = await prisma.medicalContent.findUnique({
        where: { id: conditionId },
        select: { content: true },
      });

      if (!medicalContent) {
        log.warn('Medical content not found', { conditionId });
        return { status: 404, error: 'Medical content not found' };
      }

      // Merge new pearls with existing ones (deduplicate)
      const content = medicalContent.content as Record<string, any>;
      const existingPearls = Array.isArray(content?.pearls) ? content.pearls : [];
      const allPearls = [...existingPearls, ...pearls];

      // Deduplicate pearls (case-insensitive comparison)
      const uniquePearls = allPearls.filter(
        (pearl, index, self) =>
          index === self.findIndex((p) => p.toLowerCase().trim() === pearl.toLowerCase().trim())
      );

      // Limit to 50 pearls per condition to prevent bloat
      const limitedPearls = uniquePearls.slice(0, 50);

      // Update MedicalContent with new pearls
      await prisma.medicalContent.update({
        where: { id: conditionId },
        data: {
          content: {
            ...content,
            pearls: limitedPearls,
          },
        },
      });

      log.info('Pearls saved successfully', {
        conditionId,
        totalPearls: limitedPearls.length,
        addedPearls: pearls.length,
      });

      return {
        success: true,
        totalPearls: limitedPearls.length,
        addedPearls: pearls.length,
      };
    } catch (error) {
      log.error('Error saving pearls', error);
      return { status: 500, error: 'Failed to save pearls' };
    } finally {
      await safePrismaDisconnect(prisma);
    }
  }
);

/**
 * GET /api/conditions/pearls
 * Fetch clinical pearls - either for a specific condition or random from a system
 */
export const onRequestGet = authenticatedEndpoint(
  GetPearlsSchema,
  async ({ env, validated, auth }) => {
    const log = createEndpointLogger('/api/conditions/pearls', auth.userId);
    let prisma: EdgePrismaClient | null = null;

    try {
      const { conditionId, system, random } = validated.query;
      const isRandom = random === 'true';

      prisma = createEdgePrismaClient(env.DATABASE_URL);

      // Case 1: Fetch pearls for a specific condition
      if (conditionId) {
        log.info('Fetching pearls for condition', { conditionId });

        const medicalContent = await prisma.medicalContent.findUnique({
          where: { id: conditionId },
          select: { content: true, condition: true },
        });

        if (!medicalContent) {
          log.warn('Medical content not found', { conditionId });
          return { status: 404, error: 'Medical content not found' };
        }

        const content = medicalContent.content as Record<string, any> | null;
        const pearls = Array.isArray(content?.pearls)
          ? content.pearls
          : Array.isArray(content?.clinicalPearls)
            ? content.clinicalPearls
            : [];

        return {
          conditionId,
          conditionName: medicalContent.condition,
          pearls,
          headers: { 'Cache-Control': 'public, max-age=3600' },
        };
      }

      // Case 2: Fetch random pearls for a system (RapidRecallDrill)
      if (system && isRandom) {
        log.info('Fetching random pearls for system', { system });

        // Fetch all conditions in the system that have pearls
        const conditions = await prisma.medicalContent.findMany({
          where: {
            system: system.toUpperCase(),
            status: 'published',
          },
          select: {
            id: true,
            condition: true,
            content: true,
          },
        });

        // Filter conditions that have pearls and flatten all pearls
        const allPearls: Array<{ conditionId: string; conditionName: string; pearl: string }> = [];

        for (const condition of conditions) {
          const content = condition.content as Record<string, any> | null;
          const pearls = Array.isArray(content?.pearls)
            ? content.pearls
            : Array.isArray(content?.clinicalPearls)
              ? content.clinicalPearls
              : [];

          for (const pearl of pearls) {
            allPearls.push({
              conditionId: condition.id,
              conditionName: condition.condition,
              pearl,
            });
          }
        }

        if (allPearls.length === 0) {
          return { pearls: [], message: 'No pearls found for this system' };
        }

        // Randomly select 10 pearls
        const shuffled = allPearls.sort(() => Math.random() - 0.5);
        const selectedPearls = shuffled.slice(0, 10);

        log.info('Random pearls retrieved', {
          system,
          totalAvailable: allPearls.length,
          selected: selectedPearls.length,
        });

        return {
          system,
          pearls: selectedPearls,
          totalAvailable: allPearls.length,
          headers: { 'Cache-Control': 'no-store' },
        };
      }

      log.warn('Invalid request parameters', { conditionId, system, random });
      return {
        status: 400,
        error: 'Invalid request: conditionId or system+random required',
      };
    } catch (error) {
      log.error('Error fetching pearls', error);
      return { status: 500, error: 'Failed to fetch pearls' };
    } finally {
      await safePrismaDisconnect(prisma);
    }
  }
);
