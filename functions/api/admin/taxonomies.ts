// functions/api/admin/taxonomies.ts
// Admin CRUD endpoints for MedicalTaxonomy

import { z } from 'zod';
import { adminAuthenticatedEndpoint, withCors } from '../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { createEndpointLogger } from '../_shared/secureLogger';
import { auditLog } from '../_shared/auditLog';

const TaxonomySchema = z.object({
  code: z.string().min(2).max(10),
  name: z.string().min(2).max(100),
  description: z.string().optional(),
  weight: z.number().min(0).max(1).optional(),
  isActive: z.boolean().optional(),
});

const UpdateTaxonomySchema = TaxonomySchema.partial().omit({ code: true });

export const onRequestOptions = withCors();

/**
 * GET /api/admin/taxonomies
 * List all taxonomies (with optional pagination)
 */
export const onRequestGet = adminAuthenticatedEndpoint(
  z.object({
    query: z.object({
      page: z.string().optional(),
      limit: z.string().optional(),
      activeOnly: z.string().optional(),
    }),
  }),
  async (context) => {
    const { env, auth, query } = context;
    const logger = createEndpointLogger('/api/admin/taxonomies');
    const prisma = createEdgePrismaClient(env.DATABASE_URL);

    try {
      // Check admin role
      const user = await prisma.user.findUnique({
        where: { clerkId: auth.userId },
        select: { role: true, id: true },
      });

      if (user?.role !== 'ADMIN' && user?.role !== 'SUPERADMIN') {
        logger.warn('Non-admin attempted to access taxonomies', {
          userId: auth.userId,
          role: user?.role,
        });
        return {
          data: { error: 'Admin access required' },
          status: 403,
        };
      }

      const activeOnly = query.activeOnly === 'true';
      const page = query.page ? parseInt(query.page, 10) : 1;
      const limit = query.limit ? parseInt(query.limit, 10) : 50;
      const skip = (page - 1) * limit;

      const where = activeOnly ? { isActive: true } : {};

      const [taxonomies, total] = await Promise.all([
        prisma.medicalTaxonomy.findMany({
          where,
          skip,
          take: limit,
          orderBy: { code: 'asc' },
        }),
        prisma.medicalTaxonomy.count({ where }),
      ]);

      return {
        data: {
          taxonomies,
          pagination: {
            page,
            limit,
            total,
            pages: Math.ceil(total / limit),
          },
        },
        status: 200,
      };
    } catch (error) {
      logger.error('Failed to fetch taxonomies', { error, userId: auth.userId });
      return {
        data: { error: 'Internal server error' },
        status: 500,
      };
    } finally {
      await safePrismaDisconnect(prisma);
    }
  }
);

/**
 * POST /api/admin/taxonomies
 * Create a new taxonomy
 */
export const onRequestPost = adminAuthenticatedEndpoint(
  z.object({
    body: TaxonomySchema,
  }),
  async (context) => {
    const { env, auth, body } = context;
    const logger = createEndpointLogger('/api/admin/taxonomies');
    const prisma = createEdgePrismaClient(env.DATABASE_URL);

    try {
      const user = await prisma.user.findUnique({
        where: { clerkId: auth.userId },
        select: { role: true, id: true },
      });

      if (user?.role !== 'ADMIN' && user?.role !== 'SUPERADMIN') {
        logger.warn('Non-admin attempted to create taxonomy', {
          userId: auth.userId,
          role: user?.role,
        });
        return {
          data: { error: 'Admin access required' },
          status: 403,
        };
      }

      const existing = await prisma.medicalTaxonomy.findUnique({
        where: { code: body.code },
      });

      if (existing) {
        return {
          data: { error: 'Taxonomy with this code already exists' },
          status: 409,
        };
      }

      const taxonomy = await prisma.medicalTaxonomy.create({
        data: {
          ...body,
          weight: body.weight ?? 0,
          isActive: body.isActive ?? true,
        },
      });

      logger.info('Taxonomy created', { code: taxonomy.code, userId: auth.userId });
      auditLog('admin_taxonomy_create', { userId: auth.userId, code: taxonomy.code });
      return {
        data: taxonomy,
        status: 201,
      };
    } catch (error) {
      logger.error('Failed to create taxonomy', { error, userId: auth.userId });
      return {
        data: { error: 'Internal server error' },
        status: 500,
      };
    } finally {
      await safePrismaDisconnect(prisma);
    }
  }
);

/**
 * PUT /api/admin/taxonomies/:code
 * Update a taxonomy
 */
export const onRequestPut = adminAuthenticatedEndpoint(
  z.object({
    params: z.object({ code: z.string() }),
    body: UpdateTaxonomySchema,
  }),
  async (context) => {
    const { env, auth, params, body } = context;
    const logger = createEndpointLogger('/api/admin/taxonomies');
    const prisma = createEdgePrismaClient(env.DATABASE_URL);

    try {
      const user = await prisma.user.findUnique({
        where: { clerkId: auth.userId },
        select: { role: true, id: true },
      });

      if (user?.role !== 'ADMIN' && user?.role !== 'SUPERADMIN') {
        logger.warn('Non-admin attempted to update taxonomy', {
          userId: auth.userId,
          role: user?.role,
        });
        return {
          data: { error: 'Admin access required' },
          status: 403,
        };
      }

      const taxonomy = await prisma.medicalTaxonomy.findUnique({
        where: { code: params.code },
      });

      if (!taxonomy) {
        return {
          data: { error: 'Taxonomy not found' },
          status: 404,
        };
      }

      const updated = await prisma.medicalTaxonomy.update({
        where: { code: params.code },
        data: body,
      });

      logger.info('Taxonomy updated', { code: updated.code, userId: auth.userId });
      auditLog('admin_taxonomy_update', { userId: auth.userId, code: updated.code });
      return {
        data: updated,
        status: 200,
      };
    } catch (error) {
      logger.error('Failed to update taxonomy', { error, userId: auth.userId });
      return {
        data: { error: 'Internal server error' },
        status: 500,
      };
    } finally {
      await safePrismaDisconnect(prisma);
    }
  }
);

/**
 * DELETE /api/admin/taxonomies/:code
 * Soft delete (set isActive = false) or hard delete based on query param
 */
export const onRequestDelete = adminAuthenticatedEndpoint(
  z.object({
    params: z.object({ code: z.string() }),
    query: z.object({ hard: z.string().optional() }),
  }),
  async (context) => {
    const { env, auth, params, query } = context;
    const logger = createEndpointLogger('/api/admin/taxonomies');
    const prisma = createEdgePrismaClient(env.DATABASE_URL);

    try {
      const user = await prisma.user.findUnique({
        where: { clerkId: auth.userId },
        select: { role: true, id: true },
      });

      if (user?.role !== 'ADMIN' && user?.role !== 'SUPERADMIN') {
        logger.warn('Non-admin attempted to delete taxonomy', {
          userId: auth.userId,
          role: user?.role,
        });
        return {
          data: { error: 'Admin access required' },
          status: 403,
        };
      }

      const taxonomy = await prisma.medicalTaxonomy.findUnique({
        where: { code: params.code },
      });

      if (!taxonomy) {
        return {
          data: { error: 'Taxonomy not found' },
          status: 404,
        };
      }

      if (query.hard === 'true') {
        // Hard delete (cascade will delete related SystemMapping due to onDelete: Cascade)
        await prisma.medicalTaxonomy.delete({
          where: { code: params.code },
        });
        logger.info('Taxonomy hard deleted', { code: params.code, userId: auth.userId });
        auditLog('admin_taxonomy_delete', { userId: auth.userId, code: params.code, mode: 'hard' });
      } else {
        // Soft delete
        await prisma.medicalTaxonomy.update({
          where: { code: params.code },
          data: { isActive: false },
        });
        logger.info('Taxonomy soft deleted', { code: params.code, userId: auth.userId });
        auditLog('admin_taxonomy_delete', { userId: auth.userId, code: params.code, mode: 'soft' });
      }

      return {
        data: { success: true },
        status: 200,
      };
    } catch (error) {
      logger.error('Failed to delete taxonomy', { error, userId: auth.userId });
      return {
        data: { error: 'Internal server error' },
        status: 500,
      };
    } finally {
      await safePrismaDisconnect(prisma);
    }
  }
);