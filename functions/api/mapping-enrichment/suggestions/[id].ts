/**
 * PUT /api/mapping-enrichment/suggestions/:id
 * Update a mapping suggestion status (APPROVED, REJECTED, IGNORED)
 * Creates a SystemMapping entry if APPROVED.
 * Admin role required.
 */

import { z } from 'zod';
import { authenticatedEndpoint, withCors } from '../../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../../_shared/prisma-edge';
import { createEndpointLogger } from '../../_shared/secureLogger';

const UpdateSuggestionSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Suggestion ID is required'),
  }),
  body: z.object({
    status: z.enum(['APPROVED', 'REJECTED', 'IGNORED']),
    rationale: z.string().optional(),
  }),
});

export const onRequestOptions = withCors();

export const onRequestPut = authenticatedEndpoint(
  UpdateSuggestionSchema,
  async (context) => {
    const { env, auth, validated } = context;
    const { id } = validated.params;
    const { status, rationale } = validated.body;
    const logger = createEndpointLogger('/api/mapping-enrichment/suggestions/[id]');

    let prisma = null;
    try {
      prisma = createEdgePrismaClient(env.DATABASE_URL);

      // 1. Check admin role
      const user = await prisma.user.findUnique({
        where: { clerkId: auth.userId },
        select: { role: true, id: true },
      });

      if (user?.role !== 'ADMIN' && user?.role !== 'SUPERADMIN') {
        logger.warn('Non-admin attempted to update mapping suggestion', {
          userId: auth.userId,
          role: user?.role,
        });
        return {
          data: { error: 'Admin access required' },
          status: 403,
        };
      }

      // 2. Fetch the suggestion with taxonomy details
      const suggestion = await prisma.mappingSuggestion.findUnique({
        where: { id },
        include: {
          taxonomy: {
            select: {
              name: true,
              description: true,
            },
          },
        },
      });

      if (!suggestion) {
        return {
          data: { error: 'Mapping suggestion not found' },
          status: 404,
        };
      }

      // 3. Validate current status (allow updates only from PENDING?)
      // We'll allow any status transition but log if already reviewed.
      if (suggestion.status !== 'PENDING') {
        logger.info('Mapping suggestion already reviewed', {
          suggestionId: id,
          previousStatus: suggestion.status,
          newStatus: status,
        });
      }

      // 4. Update suggestion status
      const updatedSuggestion = await prisma.mappingSuggestion.update({
        where: { id },
        data: {
          status,
          reviewedBy: user.id,
          reviewedAt: new Date(),
        },
      });

      // 5. Create audit log
      await prisma.mappingAuditLog.create({
        data: {
          taxonomyCode: suggestion.taxonomyCode,
          systemCode: suggestion.suggestedSystemCode,
          action: status as any, // MappingAuditAction enum matches status
          userId: user.id,
          rationale,
          previousSystemCode: null, // not applicable for new mapping
        },
      });

      // 6. If approved, create SystemMapping entry
      let systemMapping = null;
      if (status === 'APPROVED') {
        // Check if mapping already exists for this taxonomyCode and systemCode
        const existingMapping = await prisma.systemMapping.findFirst({
          where: {
            taxonomyCode: suggestion.taxonomyCode,
            subcategory: 'General', // default subcategory
          },
        });

        if (existingMapping) {
          logger.warn('System mapping already exists for taxonomy', {
            taxonomyCode: suggestion.taxonomyCode,
            mappingId: existingMapping.id,
          });
          // Optionally update? For now, we'll skip creation.
          systemMapping = existingMapping;
        } else {
          // Create a new mapping with default values
          systemMapping = await prisma.systemMapping.create({
            data: {
              taxonomyCode: suggestion.taxonomyCode,
              subcategory: 'General',
              canonicalName: suggestion.taxonomyName,
              aliases: [],
              searchKeywords: [],
              parentCategory: null,
              blueprintTags: [],
            },
          });
          logger.info('Created new SystemMapping', {
            mappingId: systemMapping.id,
            taxonomyCode: systemMapping.taxonomyCode,
            subcategory: systemMapping.subcategory,
          });
        }
      }

      // 7. Return updated suggestion with possibly created mapping
      return {
        data: {
          suggestion: updatedSuggestion,
          systemMapping,
        },
        status: 200,
      };
    } catch (error) {
      logger.error('Failed to update mapping suggestion', { error, suggestionId: id, userId: auth.userId });
      return {
        data: { error: 'Internal server error' },
        status: 500,
      };
    } finally {
      await safePrismaDisconnect(prisma);
    }
  }
);