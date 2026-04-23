/**
 * Admin API for CuratedPassage management.
 *
 * GET  /api/admin/curated-passages    - List curated passages (filter by condition/system)
 * POST /api/admin/curated-passages    - Create / update / delete a passage
 */

import { z } from 'zod';
import { adminAuthenticatedEndpoint } from '../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { createEndpointLogger } from '../_shared/secureLogger';
import { auditLog } from '../_shared/auditLog';

const CuratedPassageGetSchema = z.object({
  conditionId: z.string().optional(),
  system: z.string().optional(),
  limit: z.string().optional(),
});

const CuratedPassageMutationSchema = z.object({
  body: z.object({
    action: z.enum(['create', 'update', 'delete']),
    id: z.string().optional(),
    title: z.string().min(3).max(200).optional(),
    body: z.string().min(20).optional(),
    source: z.string().optional(),
    sourceUrl: z.string().url().optional(),
    license: z.string().optional(),
    systemCodes: z.array(z.string()).optional(),
    conditionIds: z.array(z.string()).optional(),
  }),
});

export const onRequestGet = adminAuthenticatedEndpoint(
  CuratedPassageGetSchema,
  async (context) => {
    const { env, auth, validated } = context;
    const logger = createEndpointLogger('/api/admin/curated-passages');
    const prisma = createEdgePrismaClient(env.DATABASE_URL);

    try {
      // withAdminRole() in adminAuthenticatedEndpoint already verified admin access.
      const adminUserId = (auth.metadata as any)?.dbUserId ?? auth.userId;

      const { conditionId, system } = validated;
      const limit = Math.min(Math.max(Number.parseInt(validated.limit || '50', 10), 1), 200);

      const where: {
        conditionIds?: { has: string };
        systemCodes?: { has: string };
      } = {};

      if (conditionId) {
        where.conditionIds = { has: conditionId };
      }

      if (system) {
        where.systemCodes = { has: system };
      }

      const passages = await prisma.curatedPassage.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
      });

      logger.info('Admin listed curated passages', {
        userId: adminUserId,
        count: passages.length,
      });

      return {
        data: { success: true, passages },
      };
    } catch (error) {
      logger.error('Error in curated passages admin GET', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw new Error('Failed to list curated passages');
    } finally {
      await safePrismaDisconnect(prisma);
    }
  },
  { source: 'query' }
);

export const onRequestPost = adminAuthenticatedEndpoint(
  CuratedPassageMutationSchema,
  async (context) => {
    const { env, auth, validated } = context;
    const logger = createEndpointLogger('/api/admin/curated-passages');
    const prisma = createEdgePrismaClient(env.DATABASE_URL);

    try {
      // withAdminRole() in adminAuthenticatedEndpoint already verified admin access.
      const adminUserId = (auth.metadata as any)?.dbUserId ?? auth.userId;

      const { action, id, title, body, source, sourceUrl, license, systemCodes, conditionIds } =
        validated.body;

      if (action === 'create') {
        if (!title || !body) {
          return {
            data: { error: 'title and body are required for create' },
            status: 400,
          };
        }
        if (!conditionIds || conditionIds.length === 0) {
          return {
            data: { error: 'At least one conditionId is required for create' },
            status: 400,
          };
        }

        const created = await prisma.curatedPassage.create({
          data: {
            id: crypto.randomUUID(),
            title,
            body,
            source: source ?? 'OpenStax',
            sourceUrl: sourceUrl ?? 'https://openstax.org',
            license: license ?? 'CC BY 4.0',
            systemCodes: systemCodes ?? [],
            conditionIds,
          },
        });

        logger.info('Curated passage created', {
          userId: adminUserId,
          passageId: created.id,
        });
        auditLog('admin_curated_passage_upsert', { userId: adminUserId, action: 'create', passageId: created.id });

        return { data: { success: true, passage: created } };
      }

      if (action === 'update') {
        if (!id) {
          return {
            data: { error: 'id is required for update' },
            status: 400,
          };
        }

        const updateData: Record<string, unknown> = {};
        if (title !== undefined) updateData.title = title;
        if (body !== undefined) updateData.body = body;
        if (source !== undefined) updateData.source = source;
        if (sourceUrl !== undefined) updateData.sourceUrl = sourceUrl;
        if (license !== undefined) updateData.license = license;
        if (systemCodes !== undefined) updateData.systemCodes = systemCodes;
        if (conditionIds !== undefined) updateData.conditionIds = conditionIds;

        const updated = await prisma.curatedPassage.update({
          where: { id },
          data: updateData,
        });

        logger.info('Curated passage updated', {
          userId: adminUserId,
          passageId: updated.id,
        });
        auditLog('admin_curated_passage_upsert', { userId: adminUserId, action: 'update', passageId: updated.id });

        return { data: { success: true, passage: updated } };
      }

      // delete
      if (!id) {
        return {
          data: { error: 'id is required for delete' },
          status: 400,
        };
      }

      await prisma.curatedPassage.delete({ where: { id } });

      logger.info('Curated passage deleted', {
        userId: adminUserId,
        passageId: id,
      });
      auditLog('admin_curated_passage_delete', { userId: adminUserId, passageId: id });

      return { data: { success: true, deleted: true } };
    } catch (error) {
      logger.error('Error in curated passages admin POST', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw new Error('Failed to modify curated passages');
    } finally {
      await safePrismaDisconnect(prisma);
    }
  }
);
