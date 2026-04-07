/**
 * Admin API - Check Access
 * GET /api/admin/check-access
 *
 * Probe endpoint: any authenticated user can call this to check whether they
 * have admin access. Returns { hasAccess, role } — no PII.
 *
 * Uses authenticatedEndpoint intentionally (not adminAuthenticatedEndpoint)
 * so non-admins get a structured { hasAccess: false } instead of a raw 403.
 *
 * Hardened (Sprint 3):
 * - Stripped email and internal userId from response (PII reduction)
 * - Added audit logging for grant/deny
 * - Removed duplicated getAdminIds helper (uses same env parsing as withAdminRole)
 */

import { z } from 'zod';
import { authenticatedEndpoint, withCors } from '../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { createEndpointLogger } from '../_shared/secureLogger';
import { auditLog } from '../_shared/auditLog';

const logger = createEndpointLogger('/api/admin/check-access');

const CheckAccessSchema = z.object({
  query: z.object({}).optional(),
});

export const onRequestOptions = withCors();

/**
 * GET: Check if current user has admin access.
 * Response: { hasAccess: boolean, role: string }
 */
export const onRequestGet = authenticatedEndpoint(CheckAccessSchema, async (context) => {
  const { env, auth } = context;
  const clerkId = auth.userId;

  try {
    // Check environment-based admin IDs first (fast path, no DB)
    const adminIds = env.ADMIN_USER_IDS
      ? String(env.ADMIN_USER_IDS).split(',').map((id: string) => id.trim()).filter(Boolean)
      : [];
    const superadminIds = env.SUPERADMIN_USER_IDS
      ? String(env.SUPERADMIN_USER_IDS).split(',').map((id: string) => id.trim()).filter(Boolean)
      : [];

    if (superadminIds.includes(clerkId)) {
      logger.info('Superadmin access granted (env)', { userId: clerkId });
      auditLog('admin_check_access_granted', { clerkId, source: 'env', role: 'superadmin' });
      return { data: { hasAccess: true, role: 'superadmin' } };
    }

    if (adminIds.includes(clerkId)) {
      logger.info('Admin access granted (env)', { userId: clerkId });
      auditLog('admin_check_access_granted', { clerkId, source: 'env', role: 'admin' });
      return { data: { hasAccess: true, role: 'admin' } };
    }

    // Fall back to DB role check
    if (env.DATABASE_URL) {
      const prisma = createEdgePrismaClient(env.DATABASE_URL);
      try {
        const user = await prisma.user.findUnique({
          where: { clerkId },
          select: { role: true },
        });

        if (user) {
          const role = (user.role as string)?.toLowerCase() || 'user';

          if (role === 'admin' || role === 'superadmin') {
            logger.info('Admin access granted (db)', { userId: clerkId, role });
            auditLog('admin_check_access_granted', { clerkId, source: 'db', role });
            return { data: { hasAccess: true, role } };
          }
        }
      } finally {
        await safePrismaDisconnect(prisma);
      }
    }

    // Not an admin
    logger.warn('Admin access denied', { userId: clerkId });
    auditLog('admin_check_access_denied', { clerkId });
    return { status: 403, data: { hasAccess: false, role: 'user' } };
  } catch (error) {
    logger.error('Admin check-access error', {
      error: error instanceof Error ? error.message : String(error),
      userId: clerkId,
    });
    return { status: 500, error: 'Internal server error' };
  }
});
