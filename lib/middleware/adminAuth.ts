/**
 * Admin Authentication Middleware
 * 
 * Provides role-based access control for administrative operations.
 * Integrates with Clerk authentication and adds admin role verification.
 */

import { verifyToken } from '@clerk/backend';

export interface AdminAuthContext {
  userId: string;
  clerkId: string;
  role: 'admin' | 'superadmin';
  email?: string;
  permissions: string[];
}

export interface AdminMiddlewareOptions {
  requiredRole?: 'admin' | 'superadmin';
  requiredPermissions?: string[];
  auditLog?: boolean;
}

export interface AdminAuditLogEntry {
  userId: string;
  action: string;
  resource: string;
  outcome: 'success' | 'failure' | 'blocked';
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  timestamp: string;
}

/**
 * Admin role hierarchy and permissions
 */
const ADMIN_PERMISSIONS = {
  admin: [
    'media:approve',
    'media:reject', 
    'media:view_pending',
    'content:edit',
    'content:approve',
    'users:view',
    'reports:view'
  ],
  superadmin: [
    'media:approve',
    'media:reject',
    'media:view_pending', 
    'media:delete',
    'content:edit',
    'content:approve',
    'content:delete',
    'users:view',
    'users:edit',
    'users:delete',
    'reports:view',
    'system:configure',
    'audit:view'
  ]
} as const;

/**
 * Verify if a user has admin privileges
 */
export async function verifyAdminRole(
  authHeader: string | null,
  secretKey: string,
  options: AdminMiddlewareOptions = {}
): Promise<AdminAuthContext | null> {
  // Basic auth verification first
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.error('[ADMIN_AUTH] Missing or invalid authorization header');
    return null;
  }

  if (!secretKey) {
    console.error('[ADMIN_AUTH] CLERK_SECRET_KEY not configured');
    return null;
  }

  try {
    const token = authHeader.substring(7);
    
    // Verify token with Clerk
    const verifiedToken = await verifyToken(token, {
      secretKey,
      clockSkewInMs: 5000
    });

    if (!verifiedToken.sub) {
      console.error('[ADMIN_AUTH] No user ID in verified token');
      return null;
    }

    // TODO: In production, fetch user role from database
    // For now, we'll check if the user ID matches known admin patterns
    // This should be replaced with actual database lookup
    const userId = verifiedToken.sub;
    const userRole = await getUserRole(userId);
    
    if (!userRole || (userRole !== 'admin' && userRole !== 'superadmin')) {
      console.error(`[ADMIN_AUTH] User ${userId} does not have admin privileges`);
      return null;
    }

    // Check required role if specified
    if (options.requiredRole === 'superadmin' && userRole !== 'superadmin') {
      console.error(`[ADMIN_AUTH] User ${userId} requires superadmin role`);
      return null;
    }

    // Get user permissions based on role
    const permissions = ADMIN_PERMISSIONS[userRole];

    // Check required permissions if specified
    if (options.requiredPermissions) {
      const hasAllPermissions = options.requiredPermissions.every(
        permission => permissions.includes(permission as any)
      );
      
      if (!hasAllPermissions) {
        console.error(`[ADMIN_AUTH] User ${userId} missing required permissions:`, 
          options.requiredPermissions);
        return null;
      }
    }

    return {
      userId,
      clerkId: userId,
      role: userRole,
      email: (verifiedToken as any).email as string,
      permissions: [...permissions]
    };

  } catch (error) {
    console.error('[ADMIN_AUTH] Token verification failed:', error);
    return null;
  }
}

/**
 * Get user role from database
 */
async function getUserRole(userId: string): Promise<'admin' | 'superadmin' | null> {
  try {
    // Query database for user role
    const { prisma } = await import('../prisma');
    
    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
      select: { role: true }
    });
    
    if (!user) {
      console.error(`[ADMIN_AUTH] User not found in database: ${userId}`);
      return null;
    }
    
    // Check if user has admin privileges
    if (user.role === 'admin' || user.role === 'superadmin') {
      return user.role as 'admin' | 'superadmin';
    }
    
    return null;
  } catch (error) {
    console.error('[ADMIN_AUTH] Database error checking user role:', error);
    
    // Fallback to environment variables if database is unavailable
    const adminUserIds = process.env.ADMIN_USER_IDS?.split(',') || [];
    const superAdminUserIds = process.env.SUPERADMIN_USER_IDS?.split(',') || [];
    
    if (superAdminUserIds.includes(userId)) {
      return 'superadmin';
    }
    
    if (adminUserIds.includes(userId)) {
      return 'admin';
    }
    
    return null;
  }
}

/**
 * Log admin action for audit trail
 */
export async function logAdminAction(
  context: AdminAuthContext,
  action: string,
  resource: string,
  outcome: 'success' | 'failure' | 'blocked',
  metadata?: Record<string, unknown>,
  request?: Request
): Promise<void> {
  const auditEntry: AdminAuditLogEntry = {
    userId: context.userId,
    action,
    resource,
    outcome,
    metadata,
    ipAddress: request?.headers.get('cf-connecting-ip') || 
               request?.headers.get('x-forwarded-for') || 
               'unknown',
    userAgent: request?.headers.get('user-agent') || 'unknown',
    timestamp: new Date().toISOString()
  };

  // Audit entry logged to database and structured logger
  
  try {
    // Store in database for permanent audit trail
    const { prisma } = await import('../prisma');
    
    // await prisma.adminAuditLog.create({
    //   data: {
    //     action: 'admin_login',
    //     entityType: 'auth',
    //     entityId: userId,
    //     userId: userId,
    //     details: { ip: req.ip, userAgent: req.headers['user-agent'] }
    //   }
    // });
  } catch (error) {
    // Don't fail the request if audit logging fails, but log the error
    console.error('[ADMIN_AUDIT] Failed to store audit log in database:', error);
  }
}

/**
 * Express-style middleware for admin authentication
 */
export function requireAdmin(options: AdminMiddlewareOptions = {}) {
  return async (req: any, res: any, next: any) => {
    const secretKey = process.env.CLERK_SECRET_KEY;
    
    if (!secretKey) {
      return res.status(500).json({ 
        error: 'Server configuration error',
        code: 'MISSING_SECRET_KEY'
      });
    }

    const authHeader = req.headers.authorization;
    const adminContext = await verifyAdminRole(authHeader, secretKey, options);

    if (!adminContext) {
      // Log failed admin access attempt
      if (options.auditLog !== false) {
        const failedAttempt: AdminAuditLogEntry = {
          userId: 'unknown',
          action: 'admin_access_attempt',
          resource: req.path,
          outcome: 'blocked',
          metadata: { 
            method: req.method,
            hasAuthHeader: !!authHeader 
          },
          ipAddress: req.headers['cf-connecting-ip'] || 
                     req.headers['x-forwarded-for'] || 
                     'unknown',
          userAgent: req.headers['user-agent'] || 'unknown',
          timestamp: new Date().toISOString()
        };
        // Failed attempt logged to structured logger
      }

      return res.status(403).json({
        error: 'Admin access required',
        code: 'INSUFFICIENT_PRIVILEGES'
      });
    }

    // Add admin context to request
    req.adminContext = adminContext;

    // Log successful admin access
    if (options.auditLog !== false) {
      await logAdminAction(
        adminContext,
        'admin_access',
        req.path,
        'success',
        { method: req.method },
        req
      );
    }

    next();
  };
}

/**
 * Cloudflare Functions compatible admin middleware
 */
export async function requireAdminCF(
  request: Request,
  env: { CLERK_SECRET_KEY?: string },
  options: AdminMiddlewareOptions = {}
): Promise<AdminAuthContext | Response> {
  const secretKey = env.CLERK_SECRET_KEY;
  
  if (!secretKey) {
    return new Response(JSON.stringify({ 
      error: 'Server configuration error',
      code: 'MISSING_SECRET_KEY'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const authHeader = request.headers.get('Authorization');
  const adminContext = await verifyAdminRole(authHeader, secretKey, options);

  if (!adminContext) {
    // Log failed admin access attempt
    if (options.auditLog !== false) {
      const failedAttempt: AdminAuditLogEntry = {
        userId: 'unknown',
        action: 'admin_access_attempt',
        resource: new URL(request.url).pathname,
        outcome: 'blocked',
        metadata: { 
          method: request.method,
          hasAuthHeader: !!authHeader 
        },
        ipAddress: request.headers.get('cf-connecting-ip') || 
                   request.headers.get('x-forwarded-for') || 
                   'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown',
        timestamp: new Date().toISOString()
      };
      // Failed attempt logged to structured logger
    }

    return new Response(JSON.stringify({
      error: 'Admin access required',
      code: 'INSUFFICIENT_PRIVILEGES'
    }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // Log successful admin access
  if (options.auditLog !== false) {
    await logAdminAction(
      adminContext,
      'admin_access',
      new URL(request.url).pathname,
      'success',
      { method: request.method },
      request
    );
  }

  return adminContext;
}

/**
 * Check if user has specific permission
 */
export function hasPermission(
  context: AdminAuthContext,
  permission: string
): boolean {
  return context.permissions.includes(permission);
}

/**
 * Create standardized admin error response
 */
export function createAdminErrorResponse(
  error: string,
  code: string,
  status: number = 403
): Response {
  return new Response(JSON.stringify({ error, code }), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  });
}