/**
 * Rate Limiting Middleware for Admin Endpoints
 *
 * Provides configurable rate limiting to prevent abuse of admin operations.
 * Uses in-memory storage for simplicity - in production should use Redis.
 */

export interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Maximum requests per window
  keyGenerator?: (req: any) => string; // Custom key generator
  skipSuccessfulRequests?: boolean; // Don't count successful requests
  skipFailedRequests?: boolean; // Don't count failed requests
}

export interface RateLimitInfo {
  limit: number;
  remaining: number;
  resetTime: number;
  retryAfter?: number;
}

// In-memory store for rate limiting
// In production, this should be replaced with Redis
const rateLimitStore = new Map<
  string,
  {
    count: number;
    resetTime: number;
  }
>();

/**
 * Clean up expired entries from the rate limit store
 */
function cleanupExpiredEntries(): void {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.resetTime <= now) {
      rateLimitStore.delete(key);
    }
  }
}

/**
 * Generate default rate limit key from request
 */
function defaultKeyGenerator(req: any): string {
  // Use IP address and user ID if available
  const ip =
    req.headers?.['cf-connecting-ip'] ||
    req.headers?.['x-forwarded-for'] ||
    req.connection?.remoteAddress ||
    'unknown';

  const userId = req.adminContext?.userId || req.auth?.userId || 'anonymous';

  return `${ip}:${userId}`;
}

/**
 * Check if request should be rate limited
 */
export function checkRateLimit(
  key: string,
  config: RateLimitConfig
): { allowed: boolean; info: RateLimitInfo } {
  const now = Date.now();
  const windowStart = now - config.windowMs;

  // Clean up old entries periodically
  if (Math.random() < 0.01) {
    // 1% chance to cleanup
    cleanupExpiredEntries();
  }

  let entry = rateLimitStore.get(key);

  // Create new entry if doesn't exist or window has expired
  if (!entry || entry.resetTime <= now) {
    entry = {
      count: 0,
      resetTime: now + config.windowMs,
    };
    rateLimitStore.set(key, entry);
  }

  const info: RateLimitInfo = {
    limit: config.maxRequests,
    remaining: Math.max(0, config.maxRequests - entry.count),
    resetTime: entry.resetTime,
  };

  // Check if limit exceeded
  if (entry.count >= config.maxRequests) {
    info.retryAfter = Math.ceil((entry.resetTime - now) / 1000);
    return { allowed: false, info };
  }

  // Increment counter
  entry.count++;
  info.remaining = Math.max(0, config.maxRequests - entry.count);

  return { allowed: true, info };
}

/**
 * Express-style rate limiting middleware
 */
export function createRateLimiter(config: RateLimitConfig) {
  return (req: any, res: any, next: any) => {
    const keyGenerator = config.keyGenerator || defaultKeyGenerator;
    const key = keyGenerator(req);

    const { allowed, info } = checkRateLimit(key, config);

    // Add rate limit headers
    res.set({
      'X-RateLimit-Limit': info.limit.toString(),
      'X-RateLimit-Remaining': info.remaining.toString(),
      'X-RateLimit-Reset': new Date(info.resetTime).toISOString(),
    });

    if (!allowed) {
      res.set('Retry-After', info.retryAfter?.toString() || '60');

      // Log rate limit violation
      console.warn('[RATE_LIMIT] Request blocked:', {
        key,
        limit: info.limit,
        resetTime: new Date(info.resetTime).toISOString(),
        userAgent: req.headers?.['user-agent'],
        path: req.path,
      });

      return res.status(429).json({
        error: 'Too many requests',
        code: 'RATE_LIMIT_EXCEEDED',
        retryAfter: info.retryAfter,
        resetTime: info.resetTime,
      });
    }

    next();
  };
}

/**
 * Cloudflare Functions compatible rate limiter
 */
export async function checkRateLimitCF(
  request: Request,
  config: RateLimitConfig,
  adminContext?: any
): Promise<{ allowed: boolean; info: RateLimitInfo; response?: Response }> {
  // Generate key for rate limiting
  const ip =
    request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for') || 'unknown';

  const userId = adminContext?.userId || 'anonymous';
  const key = config.keyGenerator
    ? config.keyGenerator({ headers: Object.fromEntries(request.headers), adminContext })
    : `${ip}:${userId}`;

  const { allowed, info } = checkRateLimit(key, config);

  if (!allowed) {
    // Log rate limit violation
    console.warn('[RATE_LIMIT] Request blocked:', {
      key,
      limit: info.limit,
      resetTime: new Date(info.resetTime).toISOString(),
      userAgent: request.headers.get('user-agent'),
      url: request.url,
    });

    const response = new Response(
      JSON.stringify({
        error: 'Too many requests',
        code: 'RATE_LIMIT_EXCEEDED',
        retryAfter: info.retryAfter,
        resetTime: info.resetTime,
      }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'X-RateLimit-Limit': info.limit.toString(),
          'X-RateLimit-Remaining': info.remaining.toString(),
          'X-RateLimit-Reset': new Date(info.resetTime).toISOString(),
          'Retry-After': info.retryAfter?.toString() || '60',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );

    return { allowed: false, info, response };
  }

  return { allowed: true, info };
}

/**
 * Predefined rate limit configurations for different admin operations
 */
export const ADMIN_RATE_LIMITS = {
  // Media approval operations - moderate limits
  MEDIA_OPERATIONS: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 30, // 30 requests per minute
  },

  // Content editing - stricter limits
  CONTENT_OPERATIONS: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 20, // 20 requests per minute
  },

  // User management - very strict limits
  USER_OPERATIONS: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 10, // 10 requests per minute
  },

  // General admin operations
  GENERAL_ADMIN: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 60, // 60 requests per minute
  },
} as const;

/**
 * Get rate limit status for monitoring
 */
export function getRateLimitStatus(): {
  totalKeys: number;
  activeWindows: number;
  oldestEntry: number | null;
} {
  const now = Date.now();
  let activeWindows = 0;
  let oldestEntry: number | null = null;

  for (const entry of rateLimitStore.values()) {
    if (entry.resetTime > now) {
      activeWindows++;
      if (oldestEntry === null || entry.resetTime < oldestEntry) {
        oldestEntry = entry.resetTime;
      }
    }
  }

  return {
    totalKeys: rateLimitStore.size,
    activeWindows,
    oldestEntry,
  };
}

/**
 * Clear all rate limit entries (for testing or emergency reset)
 */
export function clearRateLimitStore(): void {
  rateLimitStore.clear();
  console.log('[RATE_LIMIT] Store cleared');
}
