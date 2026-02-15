/**
 * Admin API for CuratedPassage management.
 *
 * GET  /api/admin/curated-passages    - List curated passages (filter by condition/system)
 * POST /api/admin/curated-passages    - Create / update / delete a passage
 */

import { z } from 'zod';
import { authenticatedEndpoint, withCors } from '../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { createEndpointLogger } from '../_shared/secureLogger';
import { isAdmin, type UserRole } from '../_shared/rbac';

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

export const onRequestOptions = withCors();

export const onRequestGet = authenticatedEndpoint(
  CuratedPassageGetSchema,
  async (context) => {
    const { env, auth, validated } = context;
    const logger = createEndpointLogger('/api/admin/curated-passages');
    const prisma = createEdgePrismaClient(env.DATABASE_URL);

    try {
      const user = await prisma.user.findUnique({
        where: { clerkId: auth.userId },
        select: { role: true, id: true },
      });

      const role = String(user?.role).toLowerCase() as UserRole | undefined;

      if (!user || !role || !isAdmin(role)) {
        logger.warn('Non-admin attempted to access curated passages admin GET', {
          userId: auth.userId,
          role: user?.role,
        });

        return {
          data: { error: 'Admin access required' },
          status: 403,
        };
      }

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
        userId: user.id,
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

export const onRequestPost = authenticatedEndpoint(
  CuratedPassageMutationSchema,
  async (context) => {
    const { env, auth, validated } = context;
    const logger = createEndpointLogger('/api/admin/curated-passages');
    const prisma = createEdgePrismaClient(env.DATABASE_URL);

    try {
      const user = await prisma.user.findUnique({
        where: { clerkId: auth.userId },
        select: { role: true, id: true },
      });

      const role = String(user?.role).toLowerCase() as UserRole | undefined;

      if (!user || !role || !isAdmin(role)) {
        logger.warn('Non-admin attempted to modify curated passages', {
          userId: auth.userId,
          role: user?.role,
        });

        return {
          data: { error: 'Admin access required' },
          status: 403,
        };
      }

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
          userId: user.id,
          passageId: created.id,
        });

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
          userId: user.id,
          passageId: updated.id,
        });

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
        userId: user.id,
        passageId: id,
      });

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
