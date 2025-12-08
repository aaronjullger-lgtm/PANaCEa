/**
 * Admin Authentication Middleware
 * 
 * Protects admin-only API routes with backend authentication.
 * This ensures that even if frontend checks are bypassed, 
 * the server will still enforce access control.
 * 
 * Usage in Express routes:
 * 
 *   import { requireAdmin } from './lib/middleware/adminAuth';
 *   app.post('/api/admin/media/approve', requireAdmin, async (req, res) => {
 *     // Handler code
 *   });
 * 
 * Usage in Cloudflare Functions:
 * 
 *   export async function onRequest(context) {
 *     const authResult = await verifyAdminAccess(context.request);
 *     if (!authResult.isAdmin) {
 *       return new Response('Forbidden', { status: 403 });
 *     }
 *     // Function code
 *   }
 */

import { Request, Response, NextFunction } from 'express';
import { clerkClient } from '@clerk/backend';

export interface AdminUser {
  id: string;
  email: string;
  role: string;
  firstName?: string;
  lastName?: string;
}

/**
 * Verify Clerk token and check admin role
 */
async function verifyClerkToken(authHeader: string | null): Promise<AdminUser | null> {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.substring(7);

  try {
    // Verify the token with Clerk
    const session = await clerkClient.sessions.verifySession(token, token);
    
    if (!session || !session.userId) {
      return null;
    }

    // Get user details
    const user = await clerkClient.users.getUser(session.userId);
    
    if (!user) {
      return null;
    }

    // Check role from user metadata
    // Roles can be stored in publicMetadata or privateMetadata
    const role = (user.publicMetadata as any)?.role || 
                 (user.privateMetadata as any)?.role || 
                 'user';

    return {
      id: user.id,
      email: user.emailAddresses[0]?.emailAddress || '',
      role,
      firstName: user.firstName || undefined,
      lastName: user.lastName || undefined,
    };
  } catch (error) {
    console.error('Token verification failed:', error);
    return null;
  }
}

/**
 * Check if user has admin privileges
 */
function isAdmin(user: AdminUser | null): boolean {
  if (!user) return false;
  
  const adminRoles = ['admin', 'superadmin', 'approver'];
  return adminRoles.includes(user.role.toLowerCase());
}

/**
 * Express middleware to require admin authentication
 */
export async function requireAdmin(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    const user = await verifyClerkToken(authHeader || null);

    if (!user) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required',
      });
      return;
    }

    if (!isAdmin(user)) {
      res.status(403).json({
        error: 'Forbidden',
        message: 'Admin access required',
      });
      return;
    }

    // Attach user to request for downstream handlers
    (req as any).user = user;
    next();
  } catch (error) {
    console.error('Admin auth middleware error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Authentication check failed',
    });
  }
}

/**
 * Cloudflare Functions version - verifies admin access from request
 */
export async function verifyAdminAccess(request: Request): Promise<{
  isAdmin: boolean;
  user: AdminUser | null;
  error?: string;
}> {
  try {
    const authHeader = request.headers.get?.('authorization') || 
                      (request as any).headers?.authorization;
    
    const user = await verifyClerkToken(authHeader || null);

    if (!user) {
      return {
        isAdmin: false,
        user: null,
        error: 'Authentication required',
      };
    }

    if (!isAdmin(user)) {
      return {
        isAdmin: false,
        user,
        error: 'Admin access required',
      };
    }

    return {
      isAdmin: true,
      user,
    };
  } catch (error: any) {
    console.error('Admin verification error:', error);
    return {
      isAdmin: false,
      user: null,
      error: error.message || 'Authentication check failed',
    };
  }
}

/**
 * Helper to check if a user ID has admin access
 * Useful for internal service calls
 */
export async function checkUserIsAdmin(userId: string): Promise<boolean> {
  try {
    const user = await clerkClient.users.getUser(userId);
    
    if (!user) {
      return false;
    }

    const role = (user.publicMetadata as any)?.role || 
                 (user.privateMetadata as any)?.role || 
                 'user';

    const adminRoles = ['admin', 'superadmin', 'approver'];
    return adminRoles.includes(role.toLowerCase());
  } catch (error) {
    console.error('User admin check failed:', error);
    return false;
  }
}

/**
 * Middleware to require specific role level
 */
export function requireRole(allowedRoles: string[]) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authHeader = req.headers.authorization;
      const user = await verifyClerkToken(authHeader || null);

      if (!user) {
        res.status(401).json({
          error: 'Unauthorized',
          message: 'Authentication required',
        });
        return;
      }

      if (!allowedRoles.includes(user.role.toLowerCase())) {
        res.status(403).json({
          error: 'Forbidden',
          message: `Requires one of: ${allowedRoles.join(', ')}`,
        });
        return;
      }

      (req as any).user = user;
      next();
    } catch (error) {
      console.error('Role check middleware error:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Authorization check failed',
      });
    }
  };
}

/**
 * Development bypass for testing (DO NOT USE IN PRODUCTION)
 */
export function requireAdminDev(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (process.env.NODE_ENV === 'development' && process.env.BYPASS_AUTH === 'true') {
    console.warn('⚠️  BYPASSING ADMIN AUTH (DEV MODE)');
    (req as any).user = {
      id: 'dev-user',
      email: 'dev@example.com',
      role: 'admin',
    };
    next();
    return;
  }

  requireAdmin(req, res, next);
}
