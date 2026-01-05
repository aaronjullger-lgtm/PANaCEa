/**
 * Rate Limiter for Cloudflare Pages Functions
 * 
 * Uses in-memory sliding window for basic rate limiting.
 * For production scale, configure Cloudflare KV binding.
 * 
 * Usage:
 *   const limiter = createRateLimiter(context.env);
 *   const result = await limiter.check(userId, 'gemini');
 *   if (!result.allowed) {
 *     return new Response(JSON.stringify({ error: 'Rate limited' }), { 
 *       status: 429,
 *       headers: { 'Retry-After': String(result.retryAfter) }
 *     });
 *   }
 */

// Rate limit configurations by endpoint type
export const RATE_LIMITS = {
  // Gemini API calls - expensive, limit tightly
  gemini: {
    maxRequests: 20,
    windowSeconds: 3600, // 1 hour
    description: 'AI generation requests'
  },
  // Question pool requests - moderate
  questions: {
    maxRequests: 100,
    windowSeconds: 3600, // 1 hour
    description: 'Question fetching'
  },
  // Standard API calls - generous
  standard: {
    maxRequests: 300,
    windowSeconds: 3600, // 1 hour
    description: 'Standard API calls'
  },
  // Auth operations - tight to prevent brute force
  auth: {
    maxRequests: 10,
    windowSeconds: 300, // 5 minutes
    description: 'Authentication attempts'
  },
  // Admin operations
  admin: {
    maxRequests: 50,
    windowSeconds: 3600, // 1 hour
    description: 'Admin operations'
  }
} as const;

export type RateLimitType = keyof typeof RATE_LIMITS;

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  retryAfter?: number;
}

export interface RateLimitHeaders {
  'X-RateLimit-Limit': string;
  'X-RateLimit-Remaining': string;
  'X-RateLimit-Reset': string;
  'Retry-After'?: string;
}

// In-memory store for basic rate limiting (works per-isolate)
// For distributed rate limiting across isolates, use KV binding
const memoryStore = new Map<string, { count: number; resetAt: number }>();

/**
 * Clean up expired entries periodically
 */
function cleanupExpiredEntries(): void {
  const now = Date.now();
  for (const [key, value] of memoryStore.entries()) {
    if (value.resetAt < now) {
      memoryStore.delete(key);
    }
  }
}

// Run cleanup every 100 operations
let operationCount = 0;
function maybeCleanup(): void {
  operationCount++;
  if (operationCount >= 100) {
    operationCount = 0;
    cleanupExpiredEntries();
  }
}

/**
 * Check rate limit using in-memory store (per-isolate)
 */
async function checkMemoryRateLimit(
  identifier: string,
  limitType: RateLimitType
): Promise<RateLimitResult> {
  maybeCleanup();
  
  const config = RATE_LIMITS[limitType];
  const key = `${limitType}:${identifier}`;
  const now = Date.now();
  const windowMs = config.windowSeconds * 1000;
  
  let entry = memoryStore.get(key);
  
  // If no entry or expired, create new window
  if (!entry || entry.resetAt < now) {
    entry = {
      count: 1,
      resetAt: now + windowMs
    };
    memoryStore.set(key, entry);
    
    return {
      allowed: true,
      remaining: config.maxRequests - 1,
      resetAt: entry.resetAt
    };
  }
  
  // Increment and check
  entry.count++;
  
  if (entry.count > config.maxRequests) {
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
    return {
      allowed: false,
      remaining: 0,
      resetAt: entry.resetAt,
      retryAfter
    };
  }
  
  return {
    allowed: true,
    remaining: config.maxRequests - entry.count,
    resetAt: entry.resetAt
  };
}

/**
 * Check rate limit using Cloudflare KV (distributed)
 */
async function checkKVRateLimit(
  kv: KVNamespace,
  identifier: string,
  limitType: RateLimitType
): Promise<RateLimitResult> {
  const config = RATE_LIMITS[limitType];
  const key = `ratelimit:${limitType}:${identifier}`;
  const now = Date.now();
  const windowMs = config.windowSeconds * 1000;
  
  // Get current count
  const stored = await kv.get(key, 'json') as { count: number; resetAt: number } | null;
  
  // If no entry or expired, create new window
  if (!stored || stored.resetAt < now) {
    const newEntry = {
      count: 1,
      resetAt: now + windowMs
    };
    
    await kv.put(key, JSON.stringify(newEntry), {
      expirationTtl: config.windowSeconds + 60 // Add buffer
    });
    
    return {
      allowed: true,
      remaining: config.maxRequests - 1,
      resetAt: newEntry.resetAt
    };
  }
  
  // Increment and check
  const newCount = stored.count + 1;
  
  if (newCount > config.maxRequests) {
    const retryAfter = Math.ceil((stored.resetAt - now) / 1000);
    return {
      allowed: false,
      remaining: 0,
      resetAt: stored.resetAt,
      retryAfter
    };
  }
  
  // Update count
  await kv.put(key, JSON.stringify({
    count: newCount,
    resetAt: stored.resetAt
  }), {
    expirationTtl: config.windowSeconds + 60
  });
  
  return {
    allowed: true,
    remaining: config.maxRequests - newCount,
    resetAt: stored.resetAt
  };
}

/**
 * Create rate limit headers from result
 */
export function createRateLimitHeaders(
  result: RateLimitResult,
  limitType: RateLimitType
): RateLimitHeaders {
  const config = RATE_LIMITS[limitType];
  const headers: RateLimitHeaders = {
    'X-RateLimit-Limit': String(config.maxRequests),
    'X-RateLimit-Remaining': String(result.remaining),
    'X-RateLimit-Reset': String(Math.ceil(result.resetAt / 1000))
  };
  
  if (result.retryAfter) {
    headers['Retry-After'] = String(result.retryAfter);
  }
  
  return headers;
}

/**
 * Create a 429 Too Many Requests response
 */
export function createRateLimitResponse(
  result: RateLimitResult,
  limitType: RateLimitType
): Response {
  const config = RATE_LIMITS[limitType];
  const headers = createRateLimitHeaders(result, limitType);
  
  return new Response(
    JSON.stringify({
      error: 'Too Many Requests',
      message: `Rate limit exceeded for ${config.description}. Please try again later.`,
      retryAfter: result.retryAfter
    }),
    {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    }
  );
}

/**
 * Rate limiter interface
 */
export interface RateLimiter {
  check(identifier: string, limitType: RateLimitType): Promise<RateLimitResult>;
  checkAndRespond(
    identifier: string, 
    limitType: RateLimitType
  ): Promise<{ allowed: true; headers: RateLimitHeaders } | { allowed: false; response: Response }>;
}

/**
 * Create a rate limiter instance
 * Uses KV if available, falls back to in-memory
 */
export function createRateLimiter(env: { RATE_LIMIT_KV?: KVNamespace }): RateLimiter {
  const useKV = !!env.RATE_LIMIT_KV;
  
  return {
    async check(identifier: string, limitType: RateLimitType): Promise<RateLimitResult> {
      if (useKV && env.RATE_LIMIT_KV) {
        return checkKVRateLimit(env.RATE_LIMIT_KV, identifier, limitType);
      }
      return checkMemoryRateLimit(identifier, limitType);
    },
    
    async checkAndRespond(identifier: string, limitType: RateLimitType) {
      const result = await this.check(identifier, limitType);
      
      if (!result.allowed) {
        return {
          allowed: false as const,
          response: createRateLimitResponse(result, limitType)
        };
      }
      
      return {
        allowed: true as const,
        headers: createRateLimitHeaders(result, limitType)
      };
    }
  };
}

/**
 * Middleware-style rate limit checker for Functions
 * 
 * Usage:
 *   const { response, headers } = await withRateLimit(
 *     context.env,
 *     userId,
 *     'gemini'
 *   );
 *   if (response) return response;
 *   // Continue with request...
 */
export async function withRateLimit(
  env: { RATE_LIMIT_KV?: KVNamespace },
  identifier: string,
  limitType: RateLimitType
): Promise<{ response?: Response; headers: Record<string, string> }> {
  const limiter = createRateLimiter(env);
  const checkResult = await limiter.checkAndRespond(identifier, limitType);
  
  if (!checkResult.allowed) {
    return { response: checkResult.response, headers: {} };
  }
  
  return { headers: checkResult.headers as Record<string, string> };
}

/**
 * Get identifier from request for rate limiting
 * Prefers userId, falls back to IP
 */
export function getRateLimitIdentifier(
  request: Request,
  userId?: string
): string {
  if (userId) {
    return `user:${userId}`;
  }
  
  // Cloudflare provides CF-Connecting-IP header
  const ip = request.headers.get('CF-Connecting-IP') 
    || request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim()
    || 'anonymous';
  
  return `ip:${ip}`;
}
