/**
 * Admin API - Check Access
 * GET /api/admin/check-access
 *
 * Verifies if the current user has admin access.
 * Returns 200 if admin, 403 if not authorized.
 */

import { z } from 'zod';
import { authenticatedEndpoint, withCors } from '../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { createEndpointLogger } from '../_shared/secureLogger';

// Admin user IDs (can be overridden by env vars)
const ADMIN_USER_IDS: string[] = [];
const SUPERADMIN_USER_IDS: string[] = [];

/**
 * Get admin user IDs from environment or fallback to hardcoded list
 */
function getAdminIds(env: any): { adminIds: string[]; superadminIds: string[] } {
  const adminIds = env.ADMIN_USER_IDS
    ? env.ADMIN_USER_IDS.split(',').map((id: string) => id.trim())
    : ADMIN_USER_IDS;

  const superadminIds = env.SUPERADMIN_USER_IDS
    ? env.SUPERADMIN_USER_IDS.split(',').map((id: string) => id.trim())
    : SUPERADMIN_USER_IDS;

  return { adminIds, superadminIds };
}

const CheckAccessSchema = z.object({
  query: z.object({}).optional(),
});

export const onRequestOptions = withCors();

/**
 * GET: Check if current user has admin access
 */
export const onRequestGet = authenticatedEndpoint(CheckAccessSchema, async (context) => {
  const { env, auth } = context;
  const logger = createEndpointLogger('/api/admin/check-access');
  const clerkId = auth.userId;

  try {
    // Check environment-based admin IDs first (for quick access without DB)
    const { adminIds, superadminIds } = getAdminIds(env);

    if (superadminIds.includes(clerkId)) {
      logger.info('Superadmin access granted', { userId: clerkId });

      return {
        data: {
          success: true,
          hasAccess: true,
          role: 'superadmin',
          userId: clerkId,
        },
      };
    }

    if (adminIds.includes(clerkId)) {
      logger.info('Admin access granted', { userId: clerkId });

      return {
        data: {
          success: true,
          hasAccess: true,
          role: 'admin',
          userId: clerkId,
        },
      };
    }

    // Check database for role if not in env vars
    if (env.DATABASE_URL) {
      const prisma = createEdgePrismaClient(env.DATABASE_URL);

      try {
        const user = await prisma.user.findUnique({
          where: { clerkId },
          select: { id: true, role: true, email: true },
        });

        if (user) {
          const role = (user.role as string)?.toLowerCase() || 'user';

          if (role === 'admin' || role === 'superadmin') {
            logger.info('Admin access granted from database', {
              userId: user.id,
              role,
            });

            return {
              data: {
                success: true,
                hasAccess: true,
                role,
                userId: user.id,
                email: user.email,
              },
            };
          }
        }
      } finally {
        await safePrismaDisconnect(prisma);
      }
    }

    // Not an admin
    logger.warn('Admin access denied', { userId: clerkId });

    return {
      data: {
        success: false,
        hasAccess: false,
        message: 'Forbidden - Admin access required',
      },
      status: 403,
    };
  } catch (error) {
    logger.error('Admin check-access error', {
      error: error instanceof Error ? error.message : String(error),
      userId: clerkId,
    });
    return {
      data: { error: 'Internal server error', hasAccess: false },
      status: 500,
    };
  }
});
