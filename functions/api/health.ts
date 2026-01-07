/**
 * Health Check Endpoint for PANaCEa
 * 
 * Provides comprehensive system health status including:
 * - Database connectivity
 * - Cache availability
 * - API uptime
 * - Error rates
 */

import { createEdgePrismaClient } from './_shared/prisma-edge';
import { withErrorHandler, successResponse, errorResponse } from './_shared/error-handler';
import type { PagesFunction, Response as CfResponse } from '@cloudflare/workers-types';

interface Env {
  DATABASE_URL: string;
  APP_VERSION?: string;
  CACHE?: any;
  SENTRY_DSN?: string;
  CLERK_SECRET_KEY?: string;
  CLERK_WEBHOOK_SECRET?: string;
  GEMINI_API_KEY?: string;
}

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime: number;
  version: string;
  checks: {
    database: CheckResult;
    cache: CheckResult;
    environment: CheckResult;
  };
}

interface CheckResult {
  status: 'pass' | 'warn' | 'fail';
  message: string;
  latency?: number;
  details?: Record<string, any>;
}

/**
 * Check database connectivity
 */
async function checkDatabase(databaseUrl: string): Promise<CheckResult> {
  const startTime = Date.now();
  
  try {
    const prisma = createEdgePrismaClient(databaseUrl);
    
    try {
      // Simple query to test connectivity
      await prisma.$queryRaw`SELECT 1 as health`;
      
      const latency = Date.now() - startTime;
      
      return {
        status: latency < 500 ? 'pass' : 'warn',
        message: latency < 500 ? 'Database connection healthy' : 'Database responding slowly',
        latency,
      };
    } finally {
      await prisma.$disconnect();
    }
  } catch (error) {
    const latency = Date.now() - startTime;
    return {
      status: 'fail',
      message: 'Database connection failed',
      latency,
      details: {
        error: error instanceof Error ? error.message : String(error),
      },
    };
  }
}

/**
 * Check KV cache availability
 */
async function checkCache(env: any): Promise<CheckResult> {
  const startTime = Date.now();
  
  try {
    if (!env.CACHE) {
      return {
        status: 'warn',
        message: 'Cache namespace not configured',
      };
    }
    
    // Test KV write and read
    const testKey = 'health_check_' + Date.now();
    const testValue = 'ok';
    
    await env.CACHE.put(testKey, testValue, { expirationTtl: 60 });
    const retrieved = await env.CACHE.get(testKey);
    
    // Clean up
    await env.CACHE.delete(testKey);
    
    const latency = Date.now() - startTime;
    
    if (retrieved !== testValue) {
      return {
        status: 'warn',
        message: 'Cache read/write mismatch',
        latency,
      };
    }
    
    return {
      status: 'pass',
      message: 'Cache operational',
      latency,
    };
  } catch (error) {
    const latency = Date.now() - startTime;
    return {
      status: 'fail',
      message: 'Cache check failed',
      latency,
      details: {
        error: error instanceof Error ? error.message : String(error),
      },
    };
  }
}

/**
 * Check environment configuration
 */
function checkEnvironment(env: any): CheckResult {
  const required = [
    'DATABASE_URL',
    'CLERK_SECRET_KEY',
    'GEMINI_API_KEY',
  ];
  
  const missing = required.filter(key => !env[key]);
  
  if (missing.length > 0) {
    return {
      status: 'fail',
      message: 'Missing required environment variables',
      details: { missing },
    };
  }
  
  // Check optional but recommended variables
  const recommended = [
    'CACHE',
    'SENTRY_DSN',
    'CLERK_WEBHOOK_SECRET',
  ];
  
  const missingRecommended = recommended.filter(key => !env[key]);
  
  if (missingRecommended.length > 0) {
    return {
      status: 'warn',
      message: 'Some optional variables not configured',
      details: { missingRecommended },
    };
  }
  
  return {
    status: 'pass',
    message: 'All environment variables configured',
  };
}

/**
 * Determine overall health status
 */
function determineOverallStatus(checks: HealthStatus['checks']): HealthStatus['status'] {
  const statuses = Object.values(checks).map(check => check.status);
  
  if (statuses.includes('fail')) {
    return 'unhealthy';
  }
  
  if (statuses.includes('warn')) {
    return 'degraded';
  }
  
  return 'healthy';
}

/**
 * Health check handler
 */
const handler: PagesFunction<Env> = async (context): Promise<CfResponse> => {
  const { env, request } = context;
  const startTime = Date.now();
  
  // Check if this is a simple ping (fast path)
  const url = new URL(request.url);
  if (url.searchParams.get('ping') === 'true') {
    return successResponse({ status: 'ok', timestamp: new Date().toISOString() }) as unknown as CfResponse;
  }
  
  // Run comprehensive health checks in parallel
  const [databaseCheck, cacheCheck, envCheck] = await Promise.all([
    checkDatabase(env.DATABASE_URL),
    checkCache(env),
    Promise.resolve(checkEnvironment(env)),
  ]);
  
  const checks = {
    database: databaseCheck,
    cache: cacheCheck,
    environment: envCheck,
  };
  
  const uptime = Date.now() - startTime;
  const status = determineOverallStatus(checks);
  
  const health: HealthStatus = {
    status,
    timestamp: new Date().toISOString(),
    uptime,
    version: env.APP_VERSION || '1.0.0',
    checks,
  };
  
  // Return appropriate status code based on health
  const statusCode = status === 'healthy' ? 200 : status === 'degraded' ? 200 : 503;
  
  return new Response(JSON.stringify(health, null, 2), {
    status: statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    },
  }) as unknown as CfResponse;
};

export const onRequestGet = withErrorHandler(handler, { endpoint: '/api/health' });
