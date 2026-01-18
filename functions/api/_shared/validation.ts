/**
 * Shared validation utilities for API endpoints
 */

/**
 * Check if required fields are present in body
 * @returns Array of missing field names
 */
export function validateRequired(body: any, fields: string[]): string[] {
  if (!body) return fields;
  return fields.filter((field) => {
    const value = body[field];
    return value === undefined || value === null || value === '';
  });
}

/**
 * Validate that a value is one of the allowed values
 */
export function validateEnum(value: any, allowed: string[]): boolean {
  return allowed.includes(value);
}

/**
 * Validate string length constraints
 */
export function validateStringLength(
  value: string | undefined | null,
  minLength: number = 0,
  maxLength: number = Infinity
): boolean {
  if (value === undefined || value === null) return minLength === 0;
  return value.length >= minLength && value.length <= maxLength;
}

/**
 * Validate email format (basic check)
 */
export function validateEmail(email: string | undefined | null): boolean {
  if (!email) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * Validate UUID format
 */
export function validateUUID(uuid: string | undefined | null): boolean {
  if (!uuid) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(uuid);
}

/**
 * Sanitize string input - remove potential XSS vectors
 */
export function sanitizeString(input: string | undefined | null): string {
  if (!input) return '';
  return input
    .replace(/[<>]/g, '') // Remove angle brackets
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/on\w+=/gi, '') // Remove event handlers
    .trim();
}

/**
 * Validate and sanitize pagination parameters
 */
export function validatePagination(
  limit: string | number | null | undefined,
  offset: string | number | null | undefined,
  maxLimit: number = 100
): { limit: number; offset: number } {
  let parsedLimit = typeof limit === 'string' ? parseInt(limit, 10) : (limit ?? 10);
  let parsedOffset = typeof offset === 'string' ? parseInt(offset, 10) : (offset ?? 0);

  // Ensure valid numbers
  if (isNaN(parsedLimit) || parsedLimit < 1) parsedLimit = 10;
  if (isNaN(parsedOffset) || parsedOffset < 0) parsedOffset = 0;

  // Cap limit at max
  parsedLimit = Math.min(parsedLimit, maxLimit);

  return { limit: parsedLimit, offset: parsedOffset };
}

/**
 * Rate limiting interface for Cloudflare KV or in-memory tracking
 */
export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

/**
 * Simple in-memory rate limiter for development
 * In production, use Cloudflare Durable Objects or KV
 */
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

export function checkRateLimit(
  key: string,
  limit: number = 100,
  windowMs: number = 60000
): RateLimitResult {
  const now = Date.now();
  const entry = rateLimitStore.get(key);

  // Clean up expired entries periodically
  if (Math.random() < 0.01) {
    for (const [k, v] of rateLimitStore.entries()) {
      if (v.resetAt < now) rateLimitStore.delete(k);
    }
  }

  if (!entry || entry.resetAt < now) {
    // Start new window
    rateLimitStore.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1, resetAt: now + windowMs };
  }

  if (entry.count >= limit) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt };
  }

  entry.count++;
  return { allowed: true, remaining: limit - entry.count, resetAt: entry.resetAt };
}

/**
 * Generate rate limit key from request
 */
export function getRateLimitKey(request: Request, prefix: string = ''): string {
  // Use CF-Connecting-IP header if available, fallback to X-Forwarded-For
  const ip =
    request.headers.get('CF-Connecting-IP') ||
    request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim() ||
    'unknown';
  return `${prefix}:${ip}`;
}
