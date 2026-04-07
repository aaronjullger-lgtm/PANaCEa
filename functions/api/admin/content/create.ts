/**
 * API: Create new medical content
 * POST /api/admin/content/create
 *
 * Requires: editor+ role (via cmsEndpoint).
 * Includes: rate limiting (60 req/min), structured logging, audit trail.
 */

import { z } from 'zod';
import { cmsEndpoint, withCors } from '../../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../../_shared/prisma-edge';
import { createEndpointLogger } from '../../_shared/secureLogger';
import { auditLog } from '../../_shared/auditLog';
import { AdminContentCreateSchema } from '../../_shared/schemas';
import { createDraft } from '../../../../lib/services/cms/contentService';
import { type UserRole } from '../../_shared/rbac';

const logger = createEndpointLogger('/api/admin/content/create');

export const onRequestOptions = withCors();

export const onRequestPost = cmsEndpoint(
  z.object({
    body: AdminContentCreateSchema,
  }),
  async (context) => {
    const { env, auth, validated } = context;
    const prisma = createEdgePrismaClient(env.DATABASE_URL);

    try {
      const dbUserId = auth.metadata?.dbUserId;
      const dbRole = auth.metadata?.dbRole;
      const { conditionId, system, subcategory, condition, content, description } =
        validated?.body ?? validated;

      // Check if conditionId already exists
      const existing = await prisma.medicalContent.findUnique({
        where: { conditionId },
      });

      if (existing) {
        return { status: 409, error: 'Content with this conditionId already exists' };
      }

      // Get client IP and user agent for audit logging
      const ipAddress =
        context.request.headers.get('x-forwarded-for') ||
        context.request.headers.get('x-real-ip') ||
        'unknown';
      const userAgent = context.request.headers.get('user-agent') || 'unknown';

      const newContent = await createDraft(
        prisma as any,
        {
          conditionId,
          system,
          subcategory,
          condition,
          content: content || {},
        },
        {
          userId: dbUserId,
          userRole: dbRole as UserRole,
          ipAddress,
          userAgent,
          description: description || 'Created new content',
        }
      );

      auditLog('admin_content_create', {
        userId: auth.userId,
        dbUserId,
        conditionId,
        system,
      });

      logger.info('Content created', { conditionId, system });

      return { status: 201, data: newContent };
    } catch (error: any) {
      logger.error('Error creating content', error);
      return { status: 500, error: error.message || 'Failed to create content' };
    } finally {
      await safePrismaDisconnect(prisma);
    }
  }
);
