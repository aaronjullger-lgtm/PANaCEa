/**
 * Shared authentication utilities for API endpoints
 */

import { createClerkClient } from '@clerk/backend';

export interface Env {
  DATABASE_URL?: string;
  CLERK_SECRET_KEY?: string;
}

export interface AuthContext {
  userId: string;
  clerkId: string;
}

/**
 * Verify and extract user ID from Clerk session token
 * Uses @clerk/backend SDK for secure JWT verification
 */
export async function verifyAuthToken(
  authHeader: string | null,
  secretKey: string
): Promise<string | null> {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  try {
    const token = authHeader.substring(7);
    const clerkClient = createClerkClient({ secretKey });

    // Verify the token using Clerk's secure verification
    const verifiedToken = await clerkClient.verifyToken(token);

    return verifiedToken.sub || null;
  } catch (error) {
    console.error('Token verification failed:', error);
    return null;
  }
}

/**
 * Create a standardized error response
 */
export function createErrorResponse(
  error: string,
  status: number
): Response {
  return new Response(JSON.stringify({ error }), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  });
}

/**
 * Create a standardized success response
 */
export function createSuccessResponse(
  data: any,
  status: number = 200
): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  });
}

/**
 * Handle CORS preflight requests
 */
export function handleCorsOptions(): Response {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}

/**
 * Verify authentication and extract user context
 * Returns null if authentication fails
 */
export async function authenticateRequest(
  request: Request,
  env: Env
): Promise<AuthContext | null> {
  const secretKey = env.CLERK_SECRET_KEY;

  if (!secretKey) {
    console.error('CLERK_SECRET_KEY is not configured');
    return null;
  }

  const authHeader = request.headers.get('Authorization');
  const userId = await verifyAuthToken(authHeader, secretKey);

  if (!userId) {
    return null;
  }

  return {
    userId,
    clerkId: userId,
  };
}
