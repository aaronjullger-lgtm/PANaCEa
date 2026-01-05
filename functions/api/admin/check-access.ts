/**
 * Admin API - Check Access
 * GET /api/admin/check-access
 * 
 * Verifies if the current user has admin access.
 * Returns 200 if admin, 403 if not authorized.
 */

import {
  type Env,
  authenticateRequest,
  createErrorResponse,
  createSuccessResponse,
  handleCorsOptions,
} from '../_shared/auth';
import { createEdgePrismaClient } from '../_shared/prisma-edge';

interface PagesContext {
  request: Request;
  env: Env;
}

// Admin user IDs (can be overridden by env vars)
const ADMIN_USER_IDS: string[] = [];
const SUPERADMIN_USER_IDS: string[] = [];

/**
 * Get admin user IDs from environment or fallback to hardcoded list
 */
function getAdminIds(env: Env): { adminIds: string[]; superadminIds: string[] } {
  const adminIds = (env as Record<string, string>).ADMIN_USER_IDS
    ? (env as Record<string, string>).ADMIN_USER_IDS.split(',').map(id => id.trim())
    : ADMIN_USER_IDS;
    
  const superadminIds = (env as Record<string, string>).SUPERADMIN_USER_IDS
    ? (env as Record<string, string>).SUPERADMIN_USER_IDS.split(',').map(id => id.trim())
    : SUPERADMIN_USER_IDS;
    
  return { adminIds, superadminIds };
}

export async function onRequestOptions(): Promise<Response> {
  return handleCorsOptions();
}

/**
 * GET: Check if current user has admin access
 */
export async function onRequestGet(context: PagesContext): Promise<Response> {
  const { request, env } = context;

  try {
    const authContext = await authenticateRequest(request, env);

    if (!authContext) {
      return createErrorResponse('Unauthorized', 401);
    }

    const clerkId = authContext.userId;
    
    // Check environment-based admin IDs first (for quick access without DB)
    const { adminIds, superadminIds } = getAdminIds(env);
    
    if (superadminIds.includes(clerkId)) {
      return createSuccessResponse({
        success: true,
        hasAccess: true,
        role: 'superadmin',
        userId: clerkId,
      });
    }
    
    if (adminIds.includes(clerkId)) {
      return createSuccessResponse({
        success: true,
        hasAccess: true,
        role: 'admin',
        userId: clerkId,
      });
    }

    // Check database for role if not in env vars
    if (env.DATABASE_URL) {
      const prisma = createEdgePrismaClient(env);

      try {
        const user = await prisma.user.findUnique({
          where: { clerkId },
          select: { id: true, role: true, email: true },
        });

        if (user) {
          const role = (user.role as string)?.toLowerCase() || 'user';
          
          if (role === 'admin' || role === 'superadmin') {
            return createSuccessResponse({
              success: true,
              hasAccess: true,
              role,
              userId: user.id,
              email: user.email,
            });
          }
        }
      } finally {
        await prisma.$disconnect();
      }
    }

    // Not an admin
    return createErrorResponse('Forbidden - Admin access required', 403);
  } catch (error) {
    console.error('Admin check-access error:', error);
    return createErrorResponse('Internal server error', 500);
  }
}
