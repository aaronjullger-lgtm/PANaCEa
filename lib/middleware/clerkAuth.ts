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
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Authorization header is required',
      });
      return;
    }

    if (!authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid authorization header format. Expected: Bearer <token>',
      });
      return;
    }

    const token = authHeader.substring(7);
    const secretKey = process.env.CLERK_SECRET_KEY;

    if (!secretKey) {
      throw new Error('CLERK_SECRET_KEY is not configured');
    }

    // Verify the token using Clerk's standalone verifyToken function
    // Use leeway to tolerate clock skew (5 seconds)
    const verifiedToken = await verifyToken(token, {
      secretKey,
      leeway: 5,
    });

    if (!verifiedToken || !verifiedToken.sub) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid or expired token',
      });
      return;
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
    });

    // Provide specific error messages based on error type
    let message = 'Authentication failed';
    
    if (error.message) {
      const errorMsg = error.message.toLowerCase();
      if (errorMsg.includes('expired')) {
        message = 'Token has expired. Please sign in again.';
      } else if (errorMsg.includes('signature')) {
        message = 'Invalid token signature';
      } else if (errorMsg.includes('issuer')) {
        message = 'Invalid token issuer';
      }
    }

    res.status(401).json({
      error: 'Unauthorized',
      message,
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
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      // No auth provided, continue without auth context
      next();
      return;
    }

    const token = authHeader.substring(7);
    const secretKey = process.env.CLERK_SECRET_KEY;

    if (!secretKey) {
      next();
      return;
    }

    try {
      const verifiedToken = await verifyToken(token, {
        secretKey,
        leeway: 5,
      });

      if (verifiedToken && verifiedToken.sub) {
        req.auth = {
          userId: verifiedToken.sub,
          sessionId: verifiedToken.sid || undefined,
        };
      }
    } catch (error) {
      // Ignore token verification errors for optional auth
      console.warn('[Auth] Optional auth token verification failed:', error);
    }

    next();
  } catch (error) {
    // Never fail on optional auth
    next();
  }
}
