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

// Type for KV namespace (from Cloudflare Workers types)
interface KVNamespace {
  get(key: string, type?: 'text'): Promise<string | null>;
  get(key: string, type: 'json'): Promise<unknown | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
}

// Rate limit configurations by endpoint type
// Plan: anonymous 20/15min, authenticated 100/15min, AI endpoints 10/min
export const RATE_LIMITS = {
  // Anonymous users - tight limit per plan
  anonymous: {
    maxRequests: 20,
    windowSeconds: 900, // 15 minutes
    description: 'Anonymous API requests',
  },
  // Authenticated users - per plan
  authenticated: {
    maxRequests: 100,
    windowSeconds: 900, // 15 minutes
    description: 'Authenticated API requests',
  },
  // AI endpoints (Gemini, etc.) - expensive
  ai_endpoints: {
    maxRequests: 10,
    windowSeconds: 60, // 1 minute
    description: 'AI generation requests',
  },
  // Legacy aliases (kept for backward compatibility)
  gemini: {
    maxRequests: 10,
    windowSeconds: 60,
    description: 'AI generation requests',
  },
  questions: {
    maxRequests: 100,
    windowSeconds: 900,
    description: 'Question fetching',
  },
  standard: {
    maxRequests: 300,
    windowSeconds: 3600,
    description: 'Standard API calls',
  },
  auth: {
    maxRequests: 10,
    windowSeconds: 300,
    description: 'Authentication attempts',
  },
  admin: {
    maxRequests: 50,
    windowSeconds: 3600,
    description: 'Admin operations',
  },
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
  [key: string]: string | undefined;
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
      resetAt: now + windowMs,
    };
    memoryStore.set(key, entry);

    return {
      allowed: true,
      remaining: config.maxRequests - 1,
      resetAt: entry.resetAt,
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
      retryAfter,
    };
  }

  return {
    allowed: true,
    remaining: config.maxRequests - entry.count,
    resetAt: entry.resetAt,
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
  const stored = (await kv.get(key, 'json')) as { count: number; resetAt: number } | null;

  // If no entry or expired, create new window
  if (!stored || stored.resetAt < now) {
    const newEntry = {
      count: 1,
      resetAt: now + windowMs,
    };

    await kv.put(key, JSON.stringify(newEntry), {
      expirationTtl: config.windowSeconds + 60, // Add buffer
    });

    return {
      allowed: true,
      remaining: config.maxRequests - 1,
      resetAt: newEntry.resetAt,
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
      retryAfter,
    };
  }

  // Update count
  await kv.put(
    key,
    JSON.stringify({
      count: newCount,
      resetAt: stored.resetAt,
    }),
    {
      expirationTtl: config.windowSeconds + 60,
    }
  );

  return {
    allowed: true,
    remaining: config.maxRequests - newCount,
    resetAt: stored.resetAt,
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
    'X-RateLimit-Reset': String(Math.ceil(result.resetAt / 1000)),
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
      ok: false,
      error: {
        code: 'RATE_LIMITED',
        message: `Rate limit exceeded for ${config.description}. Please try again later.`,
        details: { retryAfter: result.retryAfter, limitType },
      },
      success: false,
      code: 'RATE_LIMITED',
      message: `Rate limit exceeded for ${config.description}. Please try again later.`,
      details: { retryAfter: result.retryAfter, limitType },
      traceId: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
    }),
    {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
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
          response: createRateLimitResponse(result, limitType),
        };
      }

      return {
        allowed: true as const,
        headers: createRateLimitHeaders(result, limitType),
      };
    },
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
    return {
      response: (checkResult as { allowed: false; response: Response }).response,
      headers: {},
    };
  }

  // Cast headers since we added index signature
  const headers: Record<string, string> = {};
  const rateLimitHeaders = (checkResult as { allowed: true; headers: RateLimitHeaders }).headers;
  for (const [key, value] of Object.entries(rateLimitHeaders)) {
    if (value !== undefined) {
      headers[key] = value;
    }
  }

  return { headers };
}

/**
 * Normalize an IPv6 address to a canonical /64 prefix for rate limiting.
 * This prevents bypass attacks using different representations of the same address.
 *
 * Why /64?
 * - ISPs typically assign /64 or larger prefixes to end users
 * - Privacy extensions rotate the interface identifier (last 64 bits)
 * - Rate limiting by /64 catches all addresses from the same network
 *
 * @param ip - The IP address to normalize
 * @returns Normalized IP identifier (IPv4 as-is, IPv6 as /64 prefix)
 */
function normalizeIPForRateLimit(ip?: string): string {
  // Default undefined inputs to empty string to avoid strict errors
  const normalizedIp: string = ip || '';

  // Handle empty or invalid
  if (!normalizedIp || normalizedIp === 'anonymous') {
    return 'anonymous';
  }

  // Trim whitespace
  const trimmedIp: string = normalizedIp.trim().toLowerCase();

  // Check for IPv4-mapped IPv6 (::ffff:192.168.1.1)
  const ipv4MappedMatch = trimmedIp.match(/^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/i);
  if (ipv4MappedMatch) {
    return ipv4MappedMatch[1] ?? trimmedIp; // Extract and return the IPv4 part
  }

  // Check if it's IPv4 (simple check for dotted decimal)
  if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(trimmedIp)) {
    return trimmedIp; // Return IPv4 as-is
  }

  // Check if it's IPv6 (contains colons)
  if (trimmedIp.includes(':')) {
    return normalizeIPv6ToPrefix64(trimmedIp);
  }

  // Unknown format, return as-is
  return trimmedIp;
}

/**
 * Normalize an IPv6 address and extract the /64 prefix.
 * Handles all valid IPv6 representations including:
 * - Full form: 2001:0db8:85a3:0000:0000:8a2e:0370:7334
 * - Compressed: 2001:db8:85a3::8a2e:370:7334
 * - Mixed: 2001:db8::192.168.1.1
 *
 * @param ipv6 - The IPv6 address to normalize
 * @returns The normalized /64 prefix in lowercase
 */
function normalizeIPv6ToPrefix64(ipv6: string): string {
  try {
    // Remove zone ID if present (e.g., %eth0)
    const zoneIndex = ipv6.indexOf('%');
    if (zoneIndex !== -1) {
      ipv6 = ipv6.substring(0, zoneIndex);
    }

    // Handle IPv6 with embedded IPv4 (e.g., ::ffff:192.168.1.1 or 2001:db8::192.168.1.1)
    const ipv4Embedded = ipv6.match(/:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/);
    if (ipv4Embedded) {
      // Convert embedded IPv4 to two 16-bit groups
      const ipv4Parts = (ipv4Embedded[1] ?? '0.0.0.0').split('.').map(Number);
      const part0 = ipv4Parts[0] ?? 0;
      const part1 = ipv4Parts[1] ?? 0;
      const part2 = ipv4Parts[2] ?? 0;
      const part3 = ipv4Parts[3] ?? 0;
      const high = ((part0 << 8) | part1).toString(16);
      const low = ((part2 << 8) | part3).toString(16);
      ipv6 = ipv6.replace(ipv4Embedded[0], `:${high}:${low}`);
    }

    // Expand :: to full zeros
    let parts: string[];
    if (ipv6.includes('::')) {
      const [left, right] = ipv6.split('::');
      const leftParts = left ? left.split(':') : [];
      const rightParts = right ? right.split(':') : [];
      const missing = 8 - leftParts.length - rightParts.length;
      const zeros = Array(missing).fill('0');
      parts = [...leftParts, ...zeros, ...rightParts];
    } else {
      parts = ipv6.split(':');
    }

    // Normalize each part to 4 hex digits (lowercase)
    const normalizedParts = parts.map((part) => part.padStart(4, '0').toLowerCase());

    // Return only the first 4 groups (64 bits) as the /64 prefix
    // This groups all addresses in the same /64 network together
    const prefix64 = normalizedParts.slice(0, 4).join(':');
    return `${prefix64}::/64`;
  } catch {
    // If parsing fails, return original (lowercase)
    return ipv6.toLowerCase();
  }
}

/**
 * Get identifier from request for rate limiting
 * Prefers userId, falls back to IP with IPv6 normalization
 *
 * IPv6 Security Considerations:
 * - IPv6 addresses can be represented in many equivalent forms
 * - Without normalization, attackers could bypass rate limits
 * - We normalize to /64 prefix to catch all addresses from same network
 */
export function getRateLimitIdentifier(request: Request, userId?: string): string {
  if (userId) {
    return `user:${userId}`;
  }

  // Cloudflare provides CF-Connecting-IP header
  const rawIp =
    request.headers.get('CF-Connecting-IP') ||
    request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim() ||
    '';

  // Normalize IP for consistent rate limiting
  const normalizedIp = normalizeIPForRateLimit(rawIp);

  return `ip:${normalizedIp}`;
}
