/**
 * Secure CORS Configuration
 *
 * Restricts CORS to trusted origins only, preventing sensitive data exposure.
 *
 * SECURITY: Never use '*' for Access-Control-Allow-Origin in production with
 * credentials or sensitive data.
 */

export interface CorsConfig {
  allowedOrigins: string[];
  allowedMethods: string[];
  allowedHeaders: string[];
  maxAge: number;
  allowCredentials?: boolean;
}

/**
 * Production-safe CORS configuration
 * Add your production domain(s) here
 */
const DEFAULT_CORS_CONFIG: CorsConfig = {
  allowedOrigins: [
    'http://localhost:5173', // Vite dev server
    'http://localhost:3000', // Alternative local dev
    'https://studypanacea.com', // Production domain (update with actual)
    'https://www.studypanacea.com', // Production www subdomain
    // Add Cloudflare Pages preview URLs pattern if needed
  ],
  allowedMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
  maxAge: 86400, // 24 hours
  allowCredentials: true,
};

/**
 * Get CORS configuration from environment or use defaults
 */
export function getCorsConfig(env?: any): CorsConfig {
  // Allow environment override for additional origins
  const envOrigins = env?.ALLOWED_ORIGINS?.split(',').map((o: string) => o.trim()) || [];

  return {
    ...DEFAULT_CORS_CONFIG,
    allowedOrigins: [...DEFAULT_CORS_CONFIG.allowedOrigins, ...envOrigins],
  };
}

/**
 * Validate if an origin is allowed
 */
export function isOriginAllowed(origin: string | null, config: CorsConfig): boolean {
  if (!origin) return false;

  // Exact match
  if (config.allowedOrigins.includes(origin)) {
    return true;
  }

  // Cloudflare Pages preview URLs — scoped to this project only
  // Matches: https://<hash>.panacea-9ke.pages.dev or https://<hash>.panacea.pages.dev
  if (origin.match(/^https:\/\/[a-z0-9-]+\.panacea(-9ke)?\.pages\.dev$/)) {
    return true;
  }

  return false;
}

/**
 * Get CORS headers for a request
 * Returns appropriate headers or null if origin is not allowed
 */
export function getCorsHeaders(
  request: Request,
  config?: CorsConfig
): Record<string, string> | null {
  const corsConfig = config || DEFAULT_CORS_CONFIG;
  const origin = request.headers.get('Origin');

  // If no origin header (same-origin request), allow it
  if (!origin) {
    return {
      'Access-Control-Allow-Methods': corsConfig.allowedMethods.join(', '),
      'Access-Control-Allow-Headers': corsConfig.allowedHeaders.join(', '),
      'Access-Control-Max-Age': String(corsConfig.maxAge),
    };
  }

  // Validate origin
  if (!isOriginAllowed(origin, corsConfig)) {
    console.warn('[CORS] Rejected request from unauthorized origin:', origin);
    return null; // Origin not allowed
  }

  // Return headers with validated origin
  const headers: Record<string, string> = {
    'Access-Control-Allow-Origin': origin, // Echo back the validated origin
    'Access-Control-Allow-Methods': corsConfig.allowedMethods.join(', '),
    'Access-Control-Allow-Headers': corsConfig.allowedHeaders.join(', '),
    'Access-Control-Max-Age': String(corsConfig.maxAge),
  };

  if (corsConfig.allowCredentials) {
    headers['Access-Control-Allow-Credentials'] = 'true';
  }

  // Add Vary header to ensure proper caching
  headers['Vary'] = 'Origin';

  return headers;
}

/**
 * Handle CORS preflight OPTIONS request
 */
export function handleCorsPreflightSecure(request: Request, env?: any): Response {
  const config = getCorsConfig(env);
  const headers = getCorsHeaders(request, config);

  if (!headers) {
    // Origin not allowed
    return new Response('Forbidden', {
      status: 403,
      headers: {
        'Content-Type': 'text/plain',
      },
    });
  }

  return new Response(null, {
    status: 204,
    headers,
  });
}

/**
 * Add CORS headers to an existing response
 * Returns a new Response with CORS headers added
 */
export function addCorsHeaders(
  response: Response,
  request: Request,
  config?: CorsConfig
): Response {
  const corsHeaders = getCorsHeaders(request, config);

  // If origin not allowed, return 403
  if (!corsHeaders) {
    return new Response('Forbidden - Origin not allowed', {
      status: 403,
      headers: {
        'Content-Type': 'text/plain',
      },
    });
  }

  // Clone response and add headers
  const newHeaders = new Headers(response.headers);
  Object.entries(corsHeaders).forEach(([key, value]) => {
    newHeaders.set(key, value);
  });

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders,
  });
}

/**
 * Development mode: Allow all origins (use sparingly!)
 * Only use this for truly public, non-sensitive endpoints
 */
export function getCorsHeadersPermissive(): Record<string, string> {
  console.warn('[CORS] Using permissive CORS - only use for public endpoints');
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
  };
}
