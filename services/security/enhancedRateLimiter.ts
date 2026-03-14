/**
 * Enhanced Rate Limiter for PANaCEa API
 *
 * Features:
 * 1. Cost-based rate limiting for AI endpoints
 * 2. Token bucket algorithm for burst protection
 * 3. Adaptive limits based on user trust score
 * 4. Geographic-based rate adjustments
 * 5. Comprehensive monitoring and alerting
 *
 * Usage:
 *   const limiter = createEnhancedRateLimiter(env);
 *   const result = await limiter.check(userId, 'gemini', { estimatedTokens: 100 });
 *   if (!result.allowed) {
 *     return createRateLimitResponse(result);
 *   }
 */

// Type for KV namespace (from Cloudflare Workers types)
interface KVNamespace {
  get(key: string, type?: 'text'): Promise<string | null>;
  get(key: string, type: 'json'): Promise<unknown | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
  delete(key: string): Promise<void>;
}

// Enhanced rate limit configurations
export const ENHANCED_RATE_LIMITS = {
  // Gemini API calls - cost-based limiting
  gemini: {
    maxRequests: 20,
    windowSeconds: 3600, // 1 hour
    maxTokens: 100000, // 100k tokens per hour
    costPerToken: 0.000001, // Approximate cost per token ($0.001 per 1k tokens)
    burstSize: 5, // Allow 5 requests in quick succession
    refillRate: 0.005, // 0.005 requests per second (18 per hour)
    description: 'AI generation requests',
    highRiskRegions: {
      // Multiplier for high-risk regions
      CN: 0.5, // China - 50% of normal limit
      RU: 0.5, // Russia - 50% of normal limit
      IN: 0.8, // India - 80% of normal limit
    },
  },

  // Question pool requests - moderate
  questions: {
    maxRequests: 100,
    windowSeconds: 3600,
    burstSize: 20,
    refillRate: 0.027, // ~100 per hour
    description: 'Question fetching',
  },

  // Standard API calls - generous
  standard: {
    maxRequests: 300,
    windowSeconds: 3600,
    burstSize: 50,
    refillRate: 0.083, // ~300 per hour
    description: 'Standard API calls',
  },

  // Auth operations - tight to prevent brute force
  auth: {
    maxRequests: 10,
    windowSeconds: 300, // 5 minutes
    burstSize: 3,
    refillRate: 0.033, // ~10 per 5 minutes
    description: 'Authentication attempts',
  },

  // Admin operations
  admin: {
    maxRequests: 50,
    windowSeconds: 3600,
    burstSize: 10,
    refillRate: 0.014, // ~50 per hour
    description: 'Admin operations',
  },

  // Sync operations - high volume allowed
  sync: {
    maxRequests: 500,
    windowSeconds: 3600,
    burstSize: 100,
    refillRate: 0.139, // ~500 per hour
    description: 'Data synchronization',
  },
} as const;

export type EnhancedRateLimitType = keyof typeof ENHANCED_RATE_LIMITS;

export interface EnhancedRateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  retryAfter?: number;
  costUsed?: number; // For AI endpoints
  budgetRemaining?: number; // Token budget remaining
  burstTokensRemaining?: number; // Token bucket remaining
  trustScoreMultiplier?: number; // Applied trust multiplier
  geographicMultiplier?: number; // Applied geographic multiplier
}

export interface EnhancedRateLimitHeaders {
  'X-RateLimit-Limit': string;
  'X-RateLimit-Remaining': string;
  'X-RateLimit-Reset': string;
  'X-RateLimit-Burst-Remaining'?: string;
  'X-RateLimit-Budget-Remaining'?: string;
  'Retry-After'?: string;
  [key: string]: string | undefined;
}

export interface EnhancedRateLimitOptions {
  estimatedTokens?: number; // For AI endpoints
  userId?: string; // For trust score lookup
  ipAddress?: string; // For geographic lookup
  endpointPath?: string; // For detailed logging
}

/**
 * Token Bucket implementation for burst protection
 */
class TokenBucket {
  private tokens: number;
  private lastRefill: number;
  private readonly capacity: number;
  private readonly refillRate: number; // tokens per second

  constructor(capacity: number, refillRate: number) {
    this.capacity = capacity;
    this.refillRate = refillRate;
    this.tokens = capacity;
    this.lastRefill = Date.now();
  }

  private refill(): void {
    const now = Date.now();
    const timePassed = (now - this.lastRefill) / 1000; // Convert to seconds
    const newTokens = timePassed * this.refillRate;

    this.tokens = Math.min(this.capacity, this.tokens + newTokens);
    this.lastRefill = now;
  }

  consume(tokens: number = 1): boolean {
    this.refill();

    if (this.tokens >= tokens) {
      this.tokens -= tokens;
      return true;
    }

    return false;
  }

  getTokensRemaining(): number {
    this.refill();
    return this.tokens;
  }

  getTimeToNextToken(): number {
    this.refill();
    if (this.tokens >= 1) return 0;

    const tokensNeeded = 1 - this.tokens;
    return Math.ceil((tokensNeeded / this.refillRate) * 1000); // ms to next token
  }
}

/**
 * User trust scoring system
 */
class TrustScoreManager {
  private trustScores = new Map<string, number>();

  // In production, this would query a database or cache
  async getTrustScore(userId: string): Promise<number> {
    // Default score for unknown users
    if (!this.trustScores.has(userId)) {
      // Check if user has completed medical verification
      // Check if user has good history
      // Return score between 0.5 (low trust) and 2.0 (high trust)
      this.trustScores.set(userId, 1.0); // Default neutral score
    }

    return this.trustScores.get(userId) || 1.0;
  }

  async updateTrustScore(userId: string, delta: number): Promise<void> {
    const current = await this.getTrustScore(userId);
    const newScore = Math.max(0.1, Math.min(3.0, current + delta));
    this.trustScores.set(userId, newScore);
  }
}

/**
 * Geographic rate limiting adjustments
 */
class GeographicRateManager {
  private readonly highRiskRegions: Record<string, number> = {
    CN: 0.5, // China
    RU: 0.5, // Russia
    IR: 0.3, // Iran
    KP: 0.1, // North Korea
    SY: 0.3, // Syria
    CU: 0.5, // Cuba
  };

  private readonly vpnDetectionPatterns = [/vpn/i, /proxy/i, /tor/i, /anonymous/i, /\.onion$/i];

  async getGeographicMultiplier(ipAddress?: string, userAgent?: string): Promise<number> {
    // Default multiplier
    let multiplier = 1.0;

    // Check for VPN/proxy indicators
    if (userAgent && this.vpnDetectionPatterns.some((pattern) => pattern.test(userAgent))) {
      multiplier *= 0.5; // Reduce limits for VPN users
    }

    // In production, this would use a geo-IP service
    // For now, return default multiplier
    return multiplier;
  }
}

/**
 * Enhanced rate limiter with cost tracking
 */
export class EnhancedRateLimiter {
  private kv?: KVNamespace;
  private tokenBuckets = new Map<string, TokenBucket>();
  private trustManager = new TrustScoreManager();
  private geoManager = new GeographicRateManager();

  constructor(env: { RATE_LIMIT_KV?: KVNamespace }) {
    this.kv = env.RATE_LIMIT_KV;
  }

  /**
   * Check rate limit with enhanced features
   */
  async check(
    identifier: string,
    limitType: EnhancedRateLimitType,
    options: EnhancedRateLimitOptions = {}
  ): Promise<EnhancedRateLimitResult> {
    const config = ENHANCED_RATE_LIMITS[limitType];
    const now = Date.now();
    const windowMs = config.windowSeconds * 1000;

    // Get trust score multiplier
    let trustMultiplier = 1.0;
    if (options.userId) {
      trustMultiplier = await this.trustManager.getTrustScore(options.userId);
    }

    // Get geographic multiplier
    let geoMultiplier = 1.0;
    if (options.ipAddress) {
      geoMultiplier = await this.geoManager.getGeographicMultiplier(options.ipAddress);
    }

    // Apply multipliers to limits
    const effectiveMaxRequests = Math.floor(config.maxRequests * trustMultiplier * geoMultiplier);
    const effectiveBurstSize = Math.floor((config.burstSize || 1) * trustMultiplier);

    // Check token bucket for burst protection
    const bucketKey = `${limitType}:${identifier}:bucket`;
    let bucket = this.tokenBuckets.get(bucketKey);
    if (!bucket) {
      bucket = new TokenBucket(effectiveBurstSize, config.refillRate || 1);
      this.tokenBuckets.set(bucketKey, bucket);
    }

    const burstAllowed = bucket.consume(1);
    const burstTokensRemaining = bucket.getTokensRemaining();

    // Check sliding window limit (using KV for distributed consistency)
    const windowKey = `enhanced:${limitType}:${identifier}:window`;
    const costKey = `enhanced:${limitType}:${identifier}:cost`;

    let windowEntry: { count: number; resetAt: number } | null = null;
    let costEntry: { tokens: number; resetAt: number } | null = null;

    if (this.kv) {
      // Try to get from KV
      try {
        windowEntry = (await this.kv.get(windowKey, 'json')) as {
          count: number;
          resetAt: number;
        } | null;
        costEntry = (await this.kv.get(costKey, 'json')) as {
          tokens: number;
          resetAt: number;
        } | null;
      } catch (error) {
        console.error('KV rate limit check failed:', error);
        // Fall back to in-memory
      }
    }

    // Initialize or reset expired entries
    if (!windowEntry || windowEntry.resetAt < now) {
      windowEntry = {
        count: 0,
        resetAt: now + windowMs,
      };
    }

    if (!costEntry || costEntry.resetAt < now) {
      costEntry = {
        tokens: 0,
        resetAt: now + windowMs,
      };
    }

    // Calculate cost for this request
    const configWithTokens = config as { maxTokens?: number; costPerToken?: number };
    const estimatedTokens = options.estimatedTokens || 0;
    const cost = estimatedTokens * (configWithTokens.costPerToken || 0);
    const newTokenCount = costEntry.tokens + estimatedTokens;
    const newRequestCount = windowEntry.count + 1;

    // Check limits
    const exceededRequests = newRequestCount > effectiveMaxRequests;
    const exceededTokens = configWithTokens.maxTokens != null && newTokenCount > configWithTokens.maxTokens;
    const exceededBurst = !burstAllowed;

    const exceeded = exceededRequests || exceededTokens || exceededBurst;

    if (!exceeded) {
      // Update counts
      windowEntry.count = newRequestCount;
      costEntry.tokens = newTokenCount;

      if (this.kv) {
        try {
          await Promise.all([
            this.kv.put(windowKey, JSON.stringify(windowEntry), {
              expirationTtl: config.windowSeconds + 60,
            }),
            this.kv.put(costKey, JSON.stringify(costEntry), {
              expirationTtl: config.windowSeconds + 60,
            }),
          ]);
        } catch (error) {
          console.error('KV rate limit update failed:', error);
        }
      }
    }

    // Calculate retry time if limited
    let retryAfter: number | undefined;
    if (exceeded) {
      if (exceededRequests) {
        retryAfter = Math.ceil((windowEntry.resetAt - now) / 1000);
      } else if (exceededTokens && configWithTokens.maxTokens) {
        retryAfter = Math.ceil((costEntry.resetAt - now) / 1000);
      } else if (exceededBurst) {
        retryAfter = Math.ceil(bucket.getTimeToNextToken() / 1000);
      }
    }

    return {
      allowed: !exceeded,
      remaining: Math.max(0, effectiveMaxRequests - newRequestCount),
      resetAt: windowEntry.resetAt,
      retryAfter,
      costUsed: cost,
      budgetRemaining: configWithTokens.maxTokens != null ? Math.max(0, configWithTokens.maxTokens - newTokenCount) : undefined,
      burstTokensRemaining,
      trustScoreMultiplier: trustMultiplier,
      geographicMultiplier: geoMultiplier,
    };
  }

  /**
   * Check and respond with appropriate headers or error response
   */
  async checkAndRespond(
    identifier: string,
    limitType: EnhancedRateLimitType,
    options: EnhancedRateLimitOptions = {}
  ): Promise<
    { allowed: true; headers: EnhancedRateLimitHeaders } | { allowed: false; response: Response }
  > {
    const result = await this.check(identifier, limitType, options);

    if (!result.allowed) {
      return {
        allowed: false as const,
        response: this.createRateLimitResponse(result, limitType),
      };
    }

    return {
      allowed: true as const,
      headers: this.createRateLimitHeaders(result, limitType),
    };
  }

  /**
   * Create rate limit headers from result
   */
  createRateLimitHeaders(
    result: EnhancedRateLimitResult,
    limitType: EnhancedRateLimitType
  ): EnhancedRateLimitHeaders {
    const config = ENHANCED_RATE_LIMITS[limitType];
    const headers: EnhancedRateLimitHeaders = {
      'X-RateLimit-Limit': String(config.maxRequests),
      'X-RateLimit-Remaining': String(result.remaining),
      'X-RateLimit-Reset': String(Math.ceil(result.resetAt / 1000)),
    };

    if (result.burstTokensRemaining !== undefined) {
      headers['X-RateLimit-Burst-Remaining'] = String(Math.floor(result.burstTokensRemaining));
    }

    if (result.budgetRemaining !== undefined) {
      headers['X-RateLimit-Budget-Remaining'] = String(Math.floor(result.budgetRemaining));
    }

    if (result.retryAfter) {
      headers['Retry-After'] = String(result.retryAfter);
    }

    return headers;
  }

  /**
   * Create a 429 Too Many Requests response
   */
  createRateLimitResponse(
    result: EnhancedRateLimitResult,
    limitType: EnhancedRateLimitType
  ): Response {
    const config = ENHANCED_RATE_LIMITS[limitType];
    const headers = this.createRateLimitHeaders(result, limitType);

    let message = `Rate limit exceeded for ${config.description}.`;
    if (result.budgetRemaining !== undefined && result.budgetRemaining <= 0) {
      message = `Token budget exceeded for ${config.description}. Please try again later.`;
    } else if (result.burstTokensRemaining !== undefined && result.burstTokensRemaining <= 0) {
      message = `Too many requests too quickly. Please slow down.`;
    }

    return new Response(
      JSON.stringify({
        error: 'Too Many Requests',
        message,
        retryAfter: result.retryAfter,
        limitType,
        budgetRemaining: result.budgetRemaining,
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
   * Record a security event (for monitoring)
   */
  async recordSecurityEvent(
    type: 'rate_limit' | 'suspicious_request' | 'cost_exceeded',
    identifier: string,
    limitType: EnhancedRateLimitType,
    details: Record<string, any>
  ): Promise<void> {
    const event = {
      type,
      identifier,
      limitType,
      timestamp: new Date().toISOString(),
      details,
    };

    // In production, this would send to a security monitoring service
    console.warn('Security event:', event);

    // Update trust score for abusive users
    if (type === 'rate_limit' && details.userId) {
      await this.trustManager.updateTrustScore(details.userId, -0.1); // Reduce trust score
    }
  }
}

/**
 * Create an enhanced rate limiter instance
 */
export function createEnhancedRateLimiter(env: {
  RATE_LIMIT_KV?: KVNamespace;
}): EnhancedRateLimiter {
  return new EnhancedRateLimiter(env);
}

/**
 * Middleware-style enhanced rate limit checker
 */
export async function withEnhancedRateLimit(
  env: { RATE_LIMIT_KV?: KVNamespace },
  identifier: string,
  limitType: EnhancedRateLimitType,
  options: EnhancedRateLimitOptions = {}
): Promise<{ response?: Response; headers: Record<string, string> }> {
  const limiter = createEnhancedRateLimiter(env);
  const checkResult = await limiter.checkAndRespond(identifier, limitType, options);

  if (!checkResult.allowed) {
    // Record security event for rate limiting
    await limiter.recordSecurityEvent('rate_limit', identifier, limitType, {
      userId: options.userId,
      ipAddress: options.ipAddress,
      endpointPath: options.endpointPath,
    });

    return {
      response: (checkResult as { allowed: false; response: Response }).response,
      headers: {},
    };
  }

  // Convert headers to Record<string, string>
  const headers: Record<string, string> = {};
  const rateLimitHeaders = (checkResult as { allowed: true; headers: EnhancedRateLimitHeaders })
    .headers;
  for (const [key, value] of Object.entries(rateLimitHeaders)) {
    if (value !== undefined) {
      headers[key] = value;
    }
  }

  return { headers };
}
