/**
 * Clerk Authentication Middleware for Express
 *
 * Verifies Clerk JWT tokens and attaches user information to requests.
 * Used to protect API endpoints that require authentication.
 */

import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '@clerk/backend';

export interface AuthenticatedRequest extends Request {
  auth?: {
    userId: string;
    sessionId?: string;
  };
}

/**
 * Middleware to verify Clerk authentication token
 * Attaches auth context to request if valid
 * Returns 401 if authentication fails
 */
export async function requireAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const debug = process.env.CLERK_AUTH_DEBUG === 'true';

  try {
    // Log all request headers (sanitized) for debugging
    if (debug) {
      const headerKeys = Object.keys(req.headers);
      console.log('[Auth Debug] Request headers present:', headerKeys);
      console.log(
        '[Auth Debug] Authorization header:',
        req.headers.authorization ? 'PRESENT (redacted)' : 'MISSING'
      );
    }

    const authHeader = req.headers.authorization;

    if (!authHeader) {
      if (debug) {
        console.log('[Auth Debug] No authorization header present');
      }
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Authorization header is required',
        ...(debug && { reason: 'missing-authorization-header' }),
      });
      return;
    }

    if (!authHeader.startsWith('Bearer ')) {
      if (debug) {
        console.log(
          '[Auth Debug] Invalid authorization header format:',
          authHeader.substring(0, 20)
        );
      }
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid authorization header format. Expected: Bearer <token>',
        ...(debug && { reason: 'invalid-authorization-format' }),
      });
      return;
    }

    const token = authHeader.substring(7);
    const secretKey = process.env.CLERK_SECRET_KEY;

    if (!secretKey) {
      throw new Error('CLERK_SECRET_KEY is not configured');
    }

    if (debug) {
      console.log(
        '[Auth Debug] Attempting to verify token with clock skew tolerance: 60000ms (60 seconds)'
      );
      console.log('[Auth Debug] Current server time:', new Date().toISOString());
    }

    // Verify the token using Clerk's standalone verifyToken function
    // Use clockSkewInMs to tolerate clock skew (60000ms = 60 seconds to handle time discrepancies)
    const verifiedToken = await verifyToken(token, {
      secretKey,
      clockSkewInMs: 60000,
    });

    if (!verifiedToken || !verifiedToken.sub) {
      if (debug) {
        console.log('[Auth Debug] Token verification returned invalid or missing subject');
      }
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid or expired token',
        ...(debug && { reason: 'invalid-token-or-missing-subject' }),
      });
      return;
    }

    if (debug) {
      console.log('[Auth Debug] Token verified successfully for user:', verifiedToken.sub);
    }

    // Attach auth context to request
    req.auth = {
      userId: verifiedToken.sub,
      sessionId: verifiedToken.sid || undefined,
    };

    next();
  } catch (error: any) {
    console.error('[Auth] Token verification failed:', {
      message: error.message,
      name: error.name,
      stack: debug ? error.stack : undefined,
    });

    // Provide specific error messages based on error type
    let message = 'Authentication failed';
    let reason = 'unknown-error';

    if (error.message) {
      const errorMsg = error.message.toLowerCase();
      if (errorMsg.includes('expired')) {
        message = 'Token has expired. Please sign in again.';
        reason = 'token-expired';
      } else if (errorMsg.includes('not active') || errorMsg.includes('nbf')) {
        message =
          'Token is not yet active. This may be due to clock skew between client and server.';
        reason = 'token-not-active-yet';
      } else if (errorMsg.includes('signature')) {
        message = 'Invalid token signature';
        reason = 'invalid-signature';
      } else if (errorMsg.includes('issuer')) {
        message = 'Invalid token issuer';
        reason = 'invalid-issuer';
      }
    }

    if (debug) {
      console.error('[Auth Debug] Full error details:', {
        reason,
        message: error.message,
        serverTime: new Date().toISOString(),
      });
    }

    res.status(401).json({
      error: 'Unauthorized',
      message,
      ...(debug && { reason, details: error.message }),
    });
  }
}

/**
 * Optional auth middleware - doesn't fail if no auth provided
 * Useful for endpoints that work with or without authentication
 */
export async function optionalAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const debug = process.env.CLERK_AUTH_DEBUG === 'true';

  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      // No auth provided, continue without auth context
      if (debug) {
        console.log(
          '[Auth Debug] Optional auth: No valid authorization header, continuing without auth'
        );
      }
      next();
      return;
    }

    const token = authHeader.substring(7);
    const secretKey = process.env.CLERK_SECRET_KEY;

    if (!secretKey) {
      if (debug) {
        console.log('[Auth Debug] Optional auth: CLERK_SECRET_KEY not configured');
      }
      next();
      return;
    }

    try {
      if (debug) {
        console.log(
          '[Auth Debug] Optional auth: Attempting to verify token with clock skew tolerance: 60000ms (60 seconds)'
        );
      }

      const verifiedToken = await verifyToken(token, {
        secretKey,
        clockSkewInMs: 60000,
      });

      if (verifiedToken && verifiedToken.sub) {
        req.auth = {
          userId: verifiedToken.sub,
          sessionId: verifiedToken.sid || undefined,
        };
        if (debug) {
          console.log(
            '[Auth Debug] Optional auth: Token verified successfully for user:',
            verifiedToken.sub
          );
        }
      }
    } catch (error: any) {
      // Ignore token verification errors for optional auth
      if (debug) {
        console.warn('[Auth Debug] Optional auth token verification failed:', {
          message: error.message,
          reason: error.message?.includes('not active') ? 'token-not-active-yet' : 'unknown',
        });
      } else {
        console.warn('[Auth] Optional auth token verification failed');
      }
    }

    next();
  } catch (error) {
    // Never fail on optional auth
    if (debug) {
      console.log('[Auth Debug] Optional auth: Unexpected error, continuing without auth');
    }
    next();
  }
}
