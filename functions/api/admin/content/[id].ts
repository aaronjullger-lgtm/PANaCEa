/**
 * API: Get, Update, or Delete specific medical content
 * GET    /api/admin/content/[id] - Get content by ID (editor+)
 * PUT    /api/admin/content/[id] - Update content (editor+)
 * DELETE /api/admin/content/[id] - Soft-delete content (admin only)
 *
 * GET/PUT use cmsEndpoint (editor+), DELETE uses adminAuthenticatedEndpoint (admin only).
 * All include: rate limiting, structured logging, audit trail.
 */

import { z } from 'zod';
import { cmsEndpoint, adminAuthenticatedEndpoint } from '../../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../../_shared/prisma-edge';
import { createEndpointLogger } from '../../_shared/secureLogger';
import { auditLog } from '../../_shared/auditLog';
import { AdminContentUpdateSchema } from '../../_shared/schemas';
import { updateContent } from '../../../../lib/services/cms/contentService';
import { type UserRole } from '../../_shared/rbac';

const logger = createEndpointLogger('/api/admin/content/[id]');

/**
 * GET /api/admin/content/[id] — editor+ can view content details
 */
export const onRequestGet = cmsEndpoint(
  z.object({}).passthrough(),
  async (context) => {
    const { env, auth, params } = context;
    const contentId = params?.id;
    const prisma = createEdgePrismaClient(env.DATABASE_URL);

    try {
      const content = await prisma.medicalContent.findUnique({
        where: { id: contentId },
        include: {
          ContentVersion: {
            orderBy: { version: 'desc' },
            take: 10,
          },
        },
      });

      if (!content) {
        return { status: 404, error: 'Content not found' };
      }

      logger.info('Content retrieved', { contentId });

      return { data: content };
    } catch (error) {
      logger.error('Error fetching content', error);
      return { status: 500, error: 'Failed to fetch content' };
    } finally {
      await safePrismaDisconnect(prisma);
    }
  }
);

/**
 * PUT /api/admin/content/[id] — editor+ can update content
 */
export const onRequestPut = cmsEndpoint(
  z.object({
    body: AdminContentUpdateSchema,
  }),
  async (context) => {
    const { env, auth, validated, params } = context;
    const contentId = params?.id;
    const prisma = createEdgePrismaClient(env.DATABASE_URL);

    try {
      const dbUserId = auth.metadata?.dbUserId;
      const dbRole = auth.metadata?.dbRole as UserRole;
      const { content: contentData, description } = validated?.body ?? validated;

      const ipAddress =
        context.request.headers.get('x-forwarded-for') ||
        context.request.headers.get('x-real-ip') ||
        'unknown';
      const userAgent = context.request.headers.get('user-agent') || 'unknown';

      const updated = await updateContent(
        prisma as any,
        contentId,
        { content: contentData },
        {
          userId: dbUserId,
          userRole: dbRole,
          ipAddress,
          userAgent,
          description: description || 'Content updated',
        }
      );

      auditLog('admin_content_update', {
        userId: auth.userId,
        dbUserId,
        contentId,
        role: dbRole,
      });

      logger.info('Content updated', { contentId });

      return { data: updated };
    } catch (error: any) {
      logger.error('Error updating content', error);
      return { status: 500, error: error.message || 'Failed to update content' };
    } finally {
      await safePrismaDisconnect(prisma);
    }
  }
);

/**
 * DELETE /api/admin/content/[id] — admin only, soft-deletes by archiving.
 * Now includes audit trail (previously missing).
 */
export const onRequestDelete = adminAuthenticatedEndpoint(
  z.object({}).passthrough(),
  async (context) => {
    const { env, auth, params } = context;
    const contentId = params?.id;
    const prisma = createEdgePrismaClient(env.DATABASE_URL);

    try {
      // Look up the content first to capture pre-delete state for audit
      const existing = await prisma.medicalContent.findUnique({
        where: { id: contentId },
        select: { id: true, conditionId: true, status: true, system: true },
      });

      if (!existing) {
        return { status: 404, error: 'Content not found' };
      }

      // Look up admin's DB user ID for the updatedBy field
      const adminUser = await prisma.user.findUnique({
        where: { clerkId: auth.userId },
        select: { id: true },
      });

      // Soft delete by archiving
      const updated = await prisma.medicalContent.update({
        where: { id: contentId },
        data: {
          status: 'archived',
          updatedBy: adminUser?.id,
        },
      });

      auditLog('admin_content_delete', {
        userId: auth.userId,
        dbUserId: adminUser?.id,
        contentId,
        conditionId: existing.conditionId,
        previousStatus: existing.status,
        system: existing.system,
      });

      logger.info('Content soft-deleted (archived)', {
        contentId,
        previousStatus: existing.status,
      });

      return { data: { success: true, content: updated } };
    } catch (error) {
      logger.error('Error deleting content', error);
      return { status: 500, error: 'Failed to delete content' };
    } finally {
      await safePrismaDisconnect(prisma);
    }
  }
);
