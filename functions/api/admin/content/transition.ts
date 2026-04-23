/**
 * API: Transition content status
 * POST /api/admin/content/transition
 *
 * Requires: editor+ role (via cmsEndpoint), with additional per-action checks:
 *   - pending_review: editor+
 *   - approved: approver+
 *   - published: admin+
 *
 * Includes: rate limiting (60 req/min), structured logging, audit trail.
 *
 * Valid transitions:
 * - draft -> pending_review, archived
 * - pending_review -> draft, approved, archived
 * - approved -> published, draft, archived
 * - published -> archived, draft
 * - archived -> draft
 */

import { z } from 'zod';
import { cmsEndpoint } from '../../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../../_shared/prisma-edge';
import { createEndpointLogger } from '../../_shared/secureLogger';
import { auditLog } from '../../_shared/auditLog';
import { AdminContentTransitionSchema } from '../../_shared/schemas';
import {
  canEditContent,
  canApproveContent,
  canPublishContent,
  type UserRole,
} from '../../_shared/rbac';
import { transitionStatus, type ContentStatus } from '../../../../lib/services/cms/contentService';

const logger = createEndpointLogger('/api/admin/content/transition');

export const onRequestPost = cmsEndpoint(
  z.object({
    body: AdminContentTransitionSchema,
  }),
  async (context) => {
    const { env, auth, validated } = context;
    const prisma = createEdgePrismaClient(env.DATABASE_URL);

    try {
      const dbUserId = auth.metadata?.dbUserId;
      const dbRole = (auth.metadata?.dbRole || '') as UserRole;
      const { contentId, newStatus, description } = validated?.body ?? validated;

      // Permission checks based on target status (beyond basic editor+ from middleware)
      if (newStatus === 'pending_review' && !canEditContent(dbRole)) {
        return { status: 403, error: 'Insufficient permissions to submit for review' };
      }
      if (newStatus === 'approved' && !canApproveContent(dbRole)) {
        return { status: 403, error: 'Only approvers can approve content' };
      }
      if (newStatus === 'published' && !canPublishContent(dbRole)) {
        return { status: 403, error: 'Only admins can publish content' };
      }

      // Get client IP and user agent for audit logging
      const ipAddress =
        context.request.headers.get('x-forwarded-for') ||
        context.request.headers.get('x-real-ip') ||
        'unknown';
      const userAgent = context.request.headers.get('user-agent') || 'unknown';

      const updated = await transitionStatus(prisma as any, contentId, newStatus as ContentStatus, {
        userId: dbUserId,
        userRole: dbRole,
        ipAddress,
        userAgent,
        description: description || `Status changed to ${newStatus}`,
      });

      auditLog('admin_content_transition', {
        userId: auth.userId,
        dbUserId,
        contentId,
        newStatus,
        role: dbRole,
      });

      logger.info('Content transitioned', { contentId, newStatus });

      return { data: updated };
    } catch (error: any) {
      logger.error('Error transitioning content status', error);
      return { status: 500, error: error.message || 'Failed to transition status' };
    } finally {
      await safePrismaDisconnect(prisma);
    }
  }
);
