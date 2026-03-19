/**
 * POST /api/mapping-enrichment/bulk-approve
 * Bulk update mapping suggestion statuses (APPROVED, REJECTED, IGNORED)
 * Creates SystemMapping entries for approved suggestions.
 * Admin role required.
 */

import { z } from 'zod';
import { authenticatedEndpoint, withCors } from '../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { createEndpointLogger } from '../_shared/secureLogger';
import { clearContentCache } from '../../../services/conditionContentService';

const BulkApproveSchema = z.object({
  body: z.object({
    suggestionIds: z.array(z.string().min(1)).min(1, 'At least one suggestion ID is required'),
    status: z.enum(['APPROVED', 'REJECTED', 'IGNORED']),
    rationale: z.string().optional(),
  }),
});

export const onRequestOptions = withCors();

export const onRequestPost = authenticatedEndpoint(
  BulkApproveSchema,
  async (context) => {
    const { env, auth, validated } = context;
    const { suggestionIds, status, rationale } = validated.body;
    const logger = createEndpointLogger('/api/mapping-enrichment/bulk-approve');

    let prisma = null;
    try {
      prisma = createEdgePrismaClient(env.DATABASE_URL);

      // 1. Check admin role
      const user = await prisma.user.findUnique({
        where: { clerkId: auth.userId },
        select: { role: true, id: true },
      });

      if (user?.role !== 'ADMIN' && user?.role !== 'SUPERADMIN') {
        logger.warn('Non-admin attempted bulk update of mapping suggestions', {
          userId: auth.userId,
          role: user?.role,
        });
        return {
          data: { error: 'Admin access required' },
          status: 403,
        };
      }

      // 2. Fetch all suggestions with taxonomy details
      const suggestions = await prisma.mappingSuggestion.findMany({
        where: { id: { in: suggestionIds } },
        include: {
          taxonomy: {
            select: {
              name: true,
              description: true,
            },
          },
        },
      });

      // 3. Validate all IDs exist
      const foundIds = suggestions.map(s => s.id);
      const missingIds = suggestionIds.filter(id => !foundIds.includes(id));
      if (missingIds.length > 0) {
        return {
          data: { error: 'Some suggestion IDs not found', missingIds },
          status: 404,
        };
      }

      // 4. Process in a transaction
      const results = await prisma.$transaction(async (tx) => {
        const updatedSuggestions = [];
        const createdMappings = [];
        const auditLogs = [];

        for (const suggestion of suggestions) {
          // Update suggestion status
          const updatedSuggestion = await tx.mappingSuggestion.update({
            where: { id: suggestion.id },
            data: {
              status,
              reviewedBy: user.id,
              reviewedAt: new Date(),
            },
          });
          updatedSuggestions.push(updatedSuggestion);

          // Create audit log
          const auditLog = await tx.mappingAuditLog.create({
            data: {
              taxonomyCode: suggestion.taxonomyCode,
              systemCode: suggestion.suggestedSystemCode,
              action: status as any,
              userId: user.id,
              rationale,
              previousSystemCode: null,
            },
          });
          auditLogs.push(auditLog);

          // If approved, create SystemMapping entry (if not already exists)
          if (status === 'APPROVED') {
            const existingMapping = await tx.systemMapping.findFirst({
              where: {
                taxonomyCode: suggestion.taxonomyCode,
                subcategory: 'General',
              },
            });

            if (!existingMapping) {
              const systemMapping = await tx.systemMapping.create({
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
              createdMappings.push(systemMapping);
            } else {
              // Mapping already exists, we can skip or log
              logger.info('System mapping already exists for taxonomy', {
                taxonomyCode: suggestion.taxonomyCode,
                mappingId: existingMapping.id,
              });
            }
          }
        }

        return { updatedSuggestions, createdMappings, auditLogs };
      });

      // 5. Log success
      logger.info('Bulk suggestion update completed', {
        count: suggestions.length,
        status,
        userId: auth.userId,
        createdMappings: results.createdMappings.length,
      });

      // 6. Invalidate content cache to reflect mapping changes
      clearContentCache();

      // 7. Return summary
      return {
        data: {
          updatedCount: results.updatedSuggestions.length,
          createdMappingCount: results.createdMappings.length,
          suggestions: results.updatedSuggestions,
          systemMappings: results.createdMappings,
        },
        status: 200,
      };
    } catch (error) {
      logger.error('Failed to bulk update mapping suggestions', {
        error,
        userId: auth.userId,
        suggestionIds,
      });
      return {
        data: { error: 'Internal server error' },
        status: 500,
      };
    } finally {
      await safePrismaDisconnect(prisma);
    }
  }
);