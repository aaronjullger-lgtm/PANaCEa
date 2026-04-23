/**
 * API: List medical content with filtering and pagination
 * GET /api/admin/content/list
 *
 * Requires: editor+ role (via cmsEndpoint).
 * Includes: rate limiting (60 req/min), structured logging, audit trail.
 *
 * Query parameters:
 * - system: Filter by system code
 * - status: Filter by content status
 * - search: Search query
 * - page: Page number (default 1)
 * - perPage: Items per page (default 20, max 100)
 * - sortBy: Field to sort by (default 'updatedAt')
 * - sortOrder: asc or desc (default 'desc')
 */

import { z } from 'zod';
import { cmsEndpoint } from '../../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../../_shared/prisma-edge';
import { createEndpointLogger } from '../../_shared/secureLogger';
import { auditLog } from '../../_shared/auditLog';
import { ContentListQuerySchema } from '../../_shared/schemas';

const logger = createEndpointLogger('/api/admin/content/list');

export const onRequestGet = cmsEndpoint(
  z.object({
    query: ContentListQuerySchema,
  }),
  async (context) => {
    const { env, auth } = context;
    const prisma = createEdgePrismaClient(env.DATABASE_URL);

    try {
      // Parse query parameters
      const url = new URL(context.request.url);
      const system = url.searchParams.get('system') || undefined;
      const status = url.searchParams.get('status') || undefined;
      const search = url.searchParams.get('search') || undefined;
      const page = parseInt(url.searchParams.get('page') || '1', 10);
      const perPage = Math.min(parseInt(url.searchParams.get('perPage') || '20', 10), 100);
      const sortBy = url.searchParams.get('sortBy') || 'updatedAt';
      const sortOrder = url.searchParams.get('sortOrder') === 'asc' ? 'asc' : 'desc';

      auditLog('admin_content_list', {
        userId: auth.userId,
        filters: { system, status, search, page },
      });

      // Build where clause
      const where: any = {};
      if (system) where.system = system;
      if (status) where.status = status;
      if (search) {
        where.OR = [
          { condition: { contains: search, mode: 'insensitive' } },
          { conditionId: { contains: search, mode: 'insensitive' } },
          { subcategory: { contains: search, mode: 'insensitive' } },
        ];
      }

      // Get total count
      const total = await prisma.medicalContent.count({ where });

      // Get content with pagination
      const content = await prisma.medicalContent.findMany({
        where,
        orderBy: { [sortBy]: sortOrder },
        skip: (page - 1) * perPage,
        take: perPage,
        select: {
          id: true,
          conditionId: true,
          system: true,
          subcategory: true,
          condition: true,
          status: true,
          version: true,
          createdAt: true,
          createdBy: true,
          updatedAt: true,
          updatedBy: true,
          publishedAt: true,
          approvedAt: true,
        },
      });

      logger.info('Content listed', { total, page, perPage });

      return {
        data: {
          content,
          pagination: {
            page,
            perPage,
            total,
            totalPages: Math.ceil(total / perPage),
          },
        },
      };
    } catch (error) {
      logger.error('Error listing content', error);
      return { status: 500, error: 'Failed to list content' };
    } finally {
      await safePrismaDisconnect(prisma);
    }
  },
  { source: 'query' }
);
