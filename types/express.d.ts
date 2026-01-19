/**
 * Type extensions for Express Request
 */

import { Request } from 'express';

declare global {
  namespace Express {
    interface Request {
      /**
       * Clerk authentication data
       * Added by Clerk middleware (clerkMiddleware or requireAuth)
       */
      auth?: {
        userId: string;
        sessionId?: string;
        orgId?: string;
        [key: string]: any;
      };

      /**
       * User data (added by custom middleware)
       */
      user?: {
        id: string;
        email?: string;
        role?: string;
        [key: string]: any;
      };
    }
  }
}
