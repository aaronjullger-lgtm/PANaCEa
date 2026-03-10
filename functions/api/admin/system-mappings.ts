// functions/api/admin/system-mappings.ts
// Admin CRUD endpoints for SystemMapping

import { z } from 'zod';
import { adminAuthenticatedEndpoint, withCors } from '../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { createEndpointLogger } from '../_shared/secureLogger';
import { clearContentCache } from '../../../services/conditionContentService';

const SystemMappingSchema = z.object({
  taxonomyCode: z.string().min(2).max(10),
  subcategory: z.string().min(1).max(100),
  canonicalName: z.string().min(1).max(200),
  aliases: z.array(z.string()).optional(),
  searchKeywords: z.array(z.string()).optional(),
  parentCategory: z.string().optional(),
  blueprintTags: z.array(z.string()).optional(),
});

const UpdateSystemMappingSchema = SystemMappingSchema.partial().omit({ taxonomyCode: true, subcategory: true });

export const onRequestOptions = withCors();

/**
 * GET /api/admin/system-mappings
 * List system mappings with optional filtering
 */
export const onRequestGet = adminAuthenticatedEndpoint(
  z.object({
    query: z.object({
      taxonomyCode: z.string().optional(),
      page: z.string().optional(),
      limit: z.string().optional(),
      search: z.string().optional(),
    }),
  }),
  async (context) => {
    const { env, auth, query } = context;
    const logger = createEndpointLogger('/api/admin/system-mappings');
    const prisma = createEdgePrismaClient(env.DATABASE_URL);

    try {
      // Check admin role
      const user = await prisma.user.findUnique({
        where: { clerkId: auth.userId },
        select: { role: true, id: true },
      });

      if (user?.role !== 'ADMIN' && user?.role !== 'SUPERADMIN') {
        logger.warn('Non-admin attempted to access system mappings', {
          userId: auth.userId,
          role: user?.role,
        });
        return {
          data: { error: 'Admin access required' },
          status: 403,
        };
      }

      const page = query.page ? parseInt(query.page, 10) : 1;
      const limit = query.limit ? parseInt(query.limit, 10) : 100;
      const skip = (page - 1) * limit;

      const where: any = {};
      if (query.taxonomyCode) where.taxonomyCode = query.taxonomyCode;
      if (query.search) {
        where.OR = [
          { subcategory: { contains: query.search, mode: 'insensitive' } },
          { canonicalName: { contains: query.search, mode: 'insensitive' } },
          { aliases: { has: query.search } },
        ];
      }

      const [mappings, total] = await Promise.all([
        prisma.systemMapping.findMany({
          where,
          skip,
          take: limit,
          orderBy: [{ taxonomyCode: 'asc' }, { subcategory: 'asc' }],
          include: {
            taxonomy: {
              select: { name: true, weight: true },
            },
          },
        }),
        prisma.systemMapping.count({ where }),
      ]);

      return {
        data: {
          mappings,
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
      logger.error('Failed to fetch system mappings', { error, userId: auth.userId });
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
 * POST /api/admin/system-mappings
 * Create a new system mapping
 */
export const onRequestPost = adminAuthenticatedEndpoint(
  z.object({
    body: SystemMappingSchema,
  }),
  async (context) => {
    const { env, auth, body } = context;
    const logger = createEndpointLogger('/api/admin/system-mappings');
    const prisma = createEdgePrismaClient(env.DATABASE_URL);

    try {
      const user = await prisma.user.findUnique({
        where: { clerkId: auth.userId },
        select: { role: true, id: true },
      });

      if (user?.role !== 'ADMIN' && user?.role !== 'SUPERADMIN') {
        logger.warn('Non-admin attempted to create system mapping', {
          userId: auth.userId,
          role: user?.role,
        });
        return {
          data: { error: 'Admin access required' },
          status: 403,
        };
      }

      // Verify taxonomy exists
      const taxonomy = await prisma.medicalTaxonomy.findUnique({
        where: { code: body.taxonomyCode },
      });

      if (!taxonomy) {
        return {
          data: { error: 'Taxonomy not found' },
          status: 404,
        };
      }

      const existing = await prisma.systemMapping.findUnique({
        where: {
          taxonomyCode_subcategory: {
            taxonomyCode: body.taxonomyCode,
            subcategory: body.subcategory,
          },
        },
      });

      if (existing) {
        return {
          data: { error: 'System mapping with this taxonomy and subcategory already exists' },
          status: 409,
        };
      }

      const mapping = await prisma.systemMapping.create({
        data: {
          ...body,
          aliases: body.aliases ?? [],
          searchKeywords: body.searchKeywords ?? [],
          blueprintTags: body.blueprintTags ?? [],
        },
      });

      logger.info('System mapping created', {
        taxonomyCode: mapping.taxonomyCode,
        subcategory: mapping.subcategory,
        userId: auth.userId,
      });

      // Invalidate content cache to reflect mapping changes
      clearContentCache();

      return {
        data: mapping,
        status: 201,
      };
    } catch (error) {
      logger.error('Failed to create system mapping', { error, userId: auth.userId });
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
 * PUT /api/admin/system-mappings/:taxonomyCode/:subcategory
 * Update a system mapping
 */
export const onRequestPut = adminAuthenticatedEndpoint(
  z.object({
    params: z.object({
      taxonomyCode: z.string(),
      subcategory: z.string(),
    }),
    body: UpdateSystemMappingSchema,
  }),
  async (context) => {
    const { env, auth, params, body } = context;
    const logger = createEndpointLogger('/api/admin/system-mappings');
    const prisma = createEdgePrismaClient(env.DATABASE_URL);

    try {
      const user = await prisma.user.findUnique({
        where: { clerkId: auth.userId },
        select: { role: true, id: true },
      });

      if (user?.role !== 'ADMIN' && user?.role !== 'SUPERADMIN') {
        logger.warn('Non-admin attempted to update system mapping', {
          userId: auth.userId,
          role: user?.role,
        });
        return {
          data: { error: 'Admin access required' },
          status: 403,
        };
      }

      const mapping = await prisma.systemMapping.findUnique({
        where: {
          taxonomyCode_subcategory: {
            taxonomyCode: params.taxonomyCode,
            subcategory: params.subcategory,
          },
        },
      });

      if (!mapping) {
        return {
          data: { error: 'System mapping not found' },
          status: 404,
        };
      }

      const updated = await prisma.systemMapping.update({
        where: {
          taxonomyCode_subcategory: {
            taxonomyCode: params.taxonomyCode,
            subcategory: params.subcategory,
          },
        },
        data: body,
      });

      logger.info('System mapping updated', {
        taxonomyCode: updated.taxonomyCode,
        subcategory: updated.subcategory,
        userId: auth.userId,
      });

      // Invalidate content cache to reflect mapping changes
      clearContentCache();

      return {
        data: updated,
        status: 200,
      };
    } catch (error) {
      logger.error('Failed to update system mapping', { error, userId: auth.userId });
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
 * DELETE /api/admin/system-mappings/:taxonomyCode/:subcategory
 * Delete a system mapping
 */
export const onRequestDelete = adminAuthenticatedEndpoint(
  z.object({
    params: z.object({
      taxonomyCode: z.string(),
      subcategory: z.string(),
    }),
  }),
  async (context) => {
    const { env, auth, params } = context;
    const logger = createEndpointLogger('/api/admin/system-mappings');
    const prisma = createEdgePrismaClient(env.DATABASE_URL);

    try {
      const user = await prisma.user.findUnique({
        where: { clerkId: auth.userId },
        select: { role: true, id: true },
      });

      if (user?.role !== 'ADMIN' && user?.role !== 'SUPERADMIN') {
        logger.warn('Non-admin attempted to delete system mapping', {
          userId: auth.userId,
          role: user?.role,
        });
        return {
          data: { error: 'Admin access required' },
          status: 403,
        };
      }

      const mapping = await prisma.systemMapping.findUnique({
        where: {
          taxonomyCode_subcategory: {
            taxonomyCode: params.taxonomyCode,
            subcategory: params.subcategory,
          },
        },
      });

      if (!mapping) {
        return {
          data: { error: 'System mapping not found' },
          status: 404,
        };
      }

      await prisma.systemMapping.delete({
        where: {
          taxonomyCode_subcategory: {
            taxonomyCode: params.taxonomyCode,
            subcategory: params.subcategory,
          },
        },
      });

      logger.info('System mapping deleted', {
        taxonomyCode: params.taxonomyCode,
        subcategory: params.subcategory,
        userId: auth.userId,
      });

      // Invalidate content cache to reflect mapping changes
      clearContentCache();

      return {
        data: { success: true },
        status: 200,
      };
    } catch (error) {
      logger.error('Failed to delete system mapping', { error, userId: auth.userId });
      return {
        data: { error: 'Internal server error' },
        status: 500,
      };
    } finally {
      await safePrismaDisconnect(prisma);
    }
  }
);