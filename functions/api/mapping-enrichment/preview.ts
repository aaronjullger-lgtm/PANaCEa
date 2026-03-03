/**
 * POST /api/mapping-enrichment/preview
 * Simulate blueprint coverage impact of mapping changes.
 * Returns before/after compliance summaries for taxonomy mappings.
 * Admin role required.
 */

import { z } from 'zod';
import { authenticatedEndpoint, withCors } from '../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { createEndpointLogger } from '../_shared/secureLogger';
import { simulateMappingImpact, MappingChange } from '@/services/domain/mappingEnrichment/previewService';
import { logAuditEventServer } from '@/services/domain/audit/mappingAuditLogger';

const PreviewSchema = z.object({
  body: z.object({
    changes: z.array(
      z.object({
        taxonomyCode: z.string().min(1, 'Taxonomy code is required'),
        systemCode: z.string().min(1, 'System code is required'),
        previousSystemCode: z.string().optional(),
      })
    ).optional(),
    suggestionIds: z.array(z.string().cuid()).optional(),
  }).refine((data) => (data.changes?.length ?? 0) > 0 || (data.suggestionIds?.length ?? 0) > 0, {
    message: 'Either changes or suggestionIds must be provided',
  }),
});

export const onRequestOptions = withCors();

export const onRequestPost = authenticatedEndpoint(
  PreviewSchema,
  async (context) => {
    const { env, auth, validated } = context;
    const { changes, suggestionIds } = validated.body;
    const logger = createEndpointLogger('/api/mapping-enrichment/preview');

    let prisma = null;
    try {
      prisma = createEdgePrismaClient(env.DATABASE_URL);

      // Optionally check admin role (same as bulk-approve)
      const user = await prisma.user.findUnique({
        where: { clerkId: auth.userId },
        select: { role: true, id: true },
      });

      if (user?.role !== 'ADMIN' && user?.role !== 'SUPERADMIN') {
        logger.warn('Non-admin attempted mapping preview', {
          userId: auth.userId,
          role: user?.role,
        });
        return {
          data: { error: 'Admin access required' },
          status: 403,
        };
      }

      let mappingChanges: MappingChange[] = [];

      if (changes && changes.length > 0) {
        mappingChanges = changes as MappingChange[];
      } else if (suggestionIds && suggestionIds.length > 0) {
        // Fetch suggestions from database
        const suggestions = await prisma.mappingSuggestion.findMany({
          where: { id: { in: suggestionIds } },
          select: {
            taxonomyCode: true,
            suggestedSystemCode: true,
          },
        });

        if (suggestions.length === 0) {
          return {
            data: { error: 'No suggestions found with the provided IDs' },
            status: 404,
          };
        }

        mappingChanges = suggestions.map((s) => ({
          taxonomyCode: s.taxonomyCode,
          systemCode: s.suggestedSystemCode,
          // previousSystemCode will be determined by the preview service
        }));
      } else {
        // Should never happen due to Zod refinement
        return {
          data: { error: 'Invalid request: no changes or suggestionIds provided' },
          status: 400,
        };
      }

      // Log preview action for each taxonomy
      for (const change of mappingChanges) {
        await logAuditEventServer(prisma, {
          taxonomyCode: change.taxonomyCode,
          systemCode: change.systemCode,
          previousSystemCode: change.previousSystemCode,
          action: 'PREVIEW',
          userId: user.id,
          rationale: 'Preview of mapping impact',
          metadata: { previewId: 'generated' },
        });
      }

      // Call preview service
      const result = await simulateMappingImpact(mappingChanges, env.DATABASE_URL);

      return {
        data: result,
        status: 200,
      };
    } catch (error) {
      logger.error('Mapping preview failed', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      return {
        data: { error: 'Failed to compute preview', details: error instanceof Error ? error.message : String(error) },
        status: 500,
      };
    } finally {
      if (prisma) {
        await safePrismaDisconnect(prisma);
      }
    }
  }
);