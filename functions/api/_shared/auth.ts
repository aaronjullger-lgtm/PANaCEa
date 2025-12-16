/**
 * Shared authentication utilities for API endpoints
 */

import { verifyToken } from '@clerk/backend';
import { authLogger } from '../../../lib/logging/structuredLogger';

export interface Env {
  DATABASE_URL?: string;
  CLERK_SECRET_KEY?: string;
  GEMINI_API_KEY?: string;
  GOOGLE_API_KEY?: string;
}

export interface AuthContext {
  userId: string;
  clerkId: string;
}

/**
 * Helper function to safely mask secret keys for logging
 * Shows only first and last 5 characters
 */
function maskSecretKey(key: string): string {
  if (key.length <= 10) {
    return '***';
  }
  return `${key.substring(0, 5)}...${key.substring(key.length - 5)}`;
}

/**
 * JWT payload interface for type safety
 */
interface JwtPayload {
  sub?: string;        // Subject (user ID)
  iss?: string;        // Issuer
  aud?: string;        // Audience
  exp?: number;        // Expiration time (Unix timestamp)
  iat?: number;        // Issued at (Unix timestamp)
  email?: string;      // User email
  [key: string]: unknown; // Allow additional claims
}

/**
 * Helper function to decode JWT payload without verification
 * Used for diagnostic purposes only
 */
function decodeJwtPayload(token: string): JwtPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      return null;
    }
    // JWT uses base64url encoding, not standard base64
    // Replace URL-safe characters and add padding if needed
    let payload = parts[1];
    payload = payload.replace(/-/g, '+').replace(/_/g, '/');
    // Add padding if needed
    while (payload.length % 4 !== 0) {
      payload += '=';
    }
    const decoded = Buffer.from(payload, 'base64').toString('utf-8');
    return JSON.parse(decoded) as JwtPayload;
  } catch (error) {
    console.error('Failed to decode JWT payload:', error);
    return null;
  }
}

/**
 * Verify and extract user ID from Clerk session token
 * Uses @clerk/backend SDK for secure JWT verification
 * Supports both (authHeader, secretKey) and (request, env) signatures
 */
export async function verifyAuthToken(
  requestOrHeader: any,
  envOrSecret: any
): Promise<string | null> {
  let authHeader: string | null = null;
  let secretKey: string = '';

  // Handle first argument (Request object or header string)
  if (typeof requestOrHeader === 'string' || requestOrHeader === null) {
    authHeader = requestOrHeader;
  } else if (requestOrHeader && typeof requestOrHeader.headers?.get === 'function') {
    authHeader = requestOrHeader.headers.get('Authorization');
  }

  // Handle second argument (Env object or secret key string)
  if (typeof envOrSecret === 'string') {
    secretKey = envOrSecret;
  } else if (envOrSecret && typeof envOrSecret === 'object') {
    secretKey = envOrSecret.CLERK_SECRET_KEY || '';
  }

  // Phase 3.1: Verify header format
  if (!authHeader) {
    console.error('[AUTH] Authorization header is missing');
    return null;
  }

  if (!authHeader.startsWith('Bearer ')) {
    console.error('[AUTH] Authorization header format is invalid. Expected "Bearer <token>", got:', 
      authHeader.substring(0, 10) + '...');
    return null;
  }

  try {
    const token = authHeader.substring(7);
    
    // Phase 2.2: Identify token claims for diagnostics (only in test/dev environments)
    const isTestEnv = secretKey.startsWith('sk_test_');
    if (isTestEnv) {
      const payload = decodeJwtPayload(token);
      if (payload) {
        // Only log non-sensitive claims for diagnostics
        authLogger.success(payload.sub || 'unknown', 'jwt_verification');
        
        // Check if token is expired
        if (payload.exp && payload.exp < Date.now() / 1000) {
          console.error('[AUTH] Token is expired. Expiration time:', 
            new Date(payload.exp * 1000).toISOString());
        }
      }
    }

    // Verify the token using Clerk's secure verification.
    // Pass secretKey in options and add clockSkewInMs to tolerate clock skew (e.g., 5000 ms = 5 seconds)
    const verifiedToken = await verifyToken(token, {
      secretKey,
      // This is the critical change for clock skew/timing issues
      clockSkewInMs: 5000
    });

    authLogger.success(verifiedToken.sub || 'unknown', 'token_verification');
    return verifiedToken.sub || null;
  } catch (error) {
    // Phase 2.1: Retrieve error details (limited to essential info)
    console.error('[AUTH] Token verification failed with detailed error:', {
      message: error instanceof Error ? error.message : String(error),
      name: error instanceof Error ? error.name : 'Unknown',
    });
    
    // Log specific error patterns to help identify root cause
    if (error instanceof Error) {
      const errorMsg = error.message.toLowerCase();
      if (errorMsg.includes('expired')) {
        console.error('[AUTH] Root Cause: Token Expiration');
      } else if (errorMsg.includes('signature')) {
        console.error('[AUTH] Root Cause: Signature Verification Failed (possible mismatched secret key)');
      } else if (errorMsg.includes('issuer') || errorMsg.includes('iss')) {
        console.error('[AUTH] Root Cause: Invalid Issuer');
      } else if (errorMsg.includes('audience') || errorMsg.includes('aud')) {
        console.error('[AUTH] Root Cause: Invalid Audience');
      } else {
        console.error('[AUTH] Root Cause: Unknown - See error details above');
      }
    }
    
    return null;
  }
}

/**
 * Create a standardized error response
 */
export function createErrorResponse(
  error: string,
  status: number,
  code?: string
): Response {
  const response = {
    success: false,
    error,
    code,
    timestamp: new Date().toISOString()
  };
  
  return new Response(JSON.stringify(response), {
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
export function createSuccessResponse<T = unknown>(
  data: T,
  status: number = 200
): Response {
  const response = {
    success: true,
    data,
    timestamp: new Date().toISOString()
  };
  
  return new Response(JSON.stringify(response), {
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
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
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

  // Phase 1.1: Verify secret key exists
  if (!secretKey) {
    console.error('[AUTH] CLERK_SECRET_KEY is not configured in environment');
    return null;
  }

  // Phase 1.2: Check key format (should start with sk_test_ or sk_live_)
  if (!secretKey.startsWith('sk_test_') && !secretKey.startsWith('sk_live_')) {
    console.error('[AUTH] CLERK_SECRET_KEY has invalid format. Expected to start with "sk_test_" or "sk_live_", got:', 
      secretKey.substring(0, 4) + '***');
    console.error('[AUTH] Note: Public keys (pk_*) cannot be used as secret keys');
    return null;
  }

  const isTestEnv = secretKey.startsWith('sk_test_');

  // Phase 1.3: Log masked key for verification (first/last 5 characters only)
  // Secret key verification logged at debug level only

  const authHeader = request.headers.get('Authorization');
  const userId = await verifyAuthToken(authHeader, secretKey);

  if (!userId) {
    console.error('[AUTH] Authentication failed - no valid user ID extracted');
    return null;
  }

  authLogger.success(userId, 'request_authentication');
  return {
    userId,
    clerkId: userId,
  };
}
