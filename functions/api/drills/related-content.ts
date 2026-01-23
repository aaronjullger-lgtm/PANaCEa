/**
 * API Endpoint: /api/drills/related-content
 *
 * Returns related reference content based on question category and tags.
 * Used by the EnhancedFeedbackPanel to show relevant deep-dive material.
 */

import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import {
  authenticatedEndpoint,
  AuthenticatedContext,
  ValidatedContext,
} from '../_shared/middleware';
import { relatedContentSchema } from '../_shared/zodSchemas';
import { z } from 'zod';

type RelatedContentQuery = z.infer<typeof relatedContentSchema>;

/**
 * POST /api/drills/related-content
 * Fetches related reference content for enhanced feedback panel
 *
 * Body params:
 * - category: Content category (physiology, anatomy, lab, ecg, procedure, finding)
 * - tags: Array of search tags (optional)
 * - conceptId: Specific concept ID to fetch (optional)
 * - limit: Maximum results (default: 5)
 */
export const onRequestPost = authenticatedEndpoint(
  relatedContentSchema,
  async (context: AuthenticatedContext & ValidatedContext<RelatedContentQuery>) => {
    const { category, tags, conceptId, limit } = context.validated;
    const prisma = createEdgePrismaClient(context.env.DATABASE_URL);

    try {
      let relatedContent: any = null;
      let relatedItems: any[] = [];

      switch (category) {
        case 'physiology': {
          // Fetch physiology concepts
          if (conceptId) {
            // Try to find by ID or name match
            relatedContent = await prisma.physiologyConcept.findFirst({
              where: {
                OR: [
                  { id: conceptId },
                  { name: { contains: conceptId, mode: 'insensitive' } },
                  { category: { contains: conceptId, mode: 'insensitive' } },
                ],
              },
            });
          }

          // Also fetch related by tags/category
          if (tags && tags.length > 0) {
            relatedItems = await prisma.physiologyConcept.findMany({
              where: {
                OR: tags.map((tag) => ({
                  OR: [
                    { name: { contains: tag, mode: 'insensitive' } },
                    { category: { contains: tag, mode: 'insensitive' } },
                    { description: { contains: tag, mode: 'insensitive' } },
                  ],
                })),
              },
              take: limit,
              orderBy: { panceYield: 'desc' },
            });
          }
          break;
        }

        case 'anatomy': {
          if (conceptId) {
            relatedContent = await prisma.anatomyStructure.findFirst({
              where: {
                OR: [
                  { id: conceptId },
                  { name: { contains: conceptId, mode: 'insensitive' } },
                  { region: { contains: conceptId, mode: 'insensitive' } },
                ],
              },
            });
          }

          if (tags && tags.length > 0) {
            relatedItems = await prisma.anatomyStructure.findMany({
              where: {
                OR: tags.map((tag) => ({
                  OR: [
                    { name: { contains: tag, mode: 'insensitive' } },
                    { region: { contains: tag, mode: 'insensitive' } },
                    { system: { contains: tag, mode: 'insensitive' } },
                  ],
                })),
              },
              take: limit,
              orderBy: { panceYield: 'desc' },
            });
          }
          break;
        }

        case 'lab': {
          if (conceptId) {
            relatedContent = await prisma.labTest.findFirst({
              where: {
                OR: [
                  { id: conceptId },
                  { name: { contains: conceptId, mode: 'insensitive' } },
                  { abbreviation: { contains: conceptId, mode: 'insensitive' } },
                ],
              },
            });
          }

          if (tags && tags.length > 0) {
            relatedItems = await prisma.labTest.findMany({
              where: {
                OR: tags.map((tag) => ({
                  OR: [
                    { name: { contains: tag, mode: 'insensitive' } },
                    { abbreviation: { contains: tag, mode: 'insensitive' } },
                    { category: { contains: tag, mode: 'insensitive' } },
                  ],
                })),
              },
              take: limit,
              orderBy: { panceYield: 'desc' },
            });
          }
          break;
        }

        case 'ecg': {
          if (conceptId) {
            relatedContent = await prisma.ecgPattern.findFirst({
              where: {
                OR: [{ id: conceptId }, { name: { contains: conceptId, mode: 'insensitive' } }],
              },
            });
          }

          if (tags && tags.length > 0) {
            relatedItems = await prisma.ecgPattern.findMany({
              where: {
                OR: tags.map((tag) => ({
                  OR: [
                    { name: { contains: tag, mode: 'insensitive' } },
                    { category: { contains: tag, mode: 'insensitive' } },
                    { rhythm: { contains: tag, mode: 'insensitive' } },
                  ],
                })),
              },
              take: limit,
              orderBy: { panceYield: 'desc' },
            });
          }
          break;
        }

        case 'procedure': {
          if (conceptId) {
            relatedContent = await prisma.procedure.findFirst({
              where: {
                OR: [{ id: conceptId }, { name: { contains: conceptId, mode: 'insensitive' } }],
              },
            });
          }

          if (tags && tags.length > 0) {
            relatedItems = await prisma.procedure.findMany({
              where: {
                OR: tags.map((tag) => ({
                  OR: [
                    { name: { contains: tag, mode: 'insensitive' } },
                    { category: { contains: tag, mode: 'insensitive' } },
                    { type: { contains: tag, mode: 'insensitive' } },
                  ],
                })),
              },
              take: limit,
              orderBy: { panceYield: 'desc' },
            });
          }
          break;
        }

        case 'finding': {
          if (conceptId) {
            relatedContent = await prisma.physicalExamFinding.findFirst({
              where: {
                OR: [{ id: conceptId }, { name: { contains: conceptId, mode: 'insensitive' } }],
              },
            });
          }

          if (tags && tags.length > 0) {
            relatedItems = await prisma.physicalExamFinding.findMany({
              where: {
                OR: tags.map((tag) => ({
                  OR: [
                    { name: { contains: tag, mode: 'insensitive' } },
                    { system: { contains: tag, mode: 'insensitive' } },
                  ],
                })),
              },
              take: limit,
              orderBy: { panceYield: 'desc' },
            });
          }
          break;
        }
      }

      // Filter out duplicates from relatedItems
      if (relatedContent && relatedItems.length > 0) {
        relatedItems = relatedItems.filter((item) => item.id !== relatedContent.id);
      }

      return {
        data: {
          success: true,
          data: {
            primary: relatedContent,
            related: relatedItems,
          },
        },
      };
    } finally {
      await safePrismaDisconnect(prisma);
    }
  }
);
