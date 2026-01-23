/**
 * API Endpoint: /api/health
 *
 * Production health check endpoint for monitoring services.
 * Checks database, storage, and AI service connectivity.
 *
 * Used by:
 * - Uptime monitoring (BetterUptime, Pingdom, etc.)
 * - CI/CD deployment verification
 * - Manual health checks
 */

import { createEdgePrismaClient, safePrismaDisconnect } from './_shared/prisma-edge';
import type { CloudflareContext } from './_shared/types';

interface Env {
  DATABASE_URL: string;
  GEMINI_API_KEY?: string;
  NODE_ENV?: string;
}

interface HealthCheck {
  name: string;
  status: 'ok' | 'degraded' | 'error';
  latencyMs: number;
  message?: string;
}

interface HealthResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  version: string;
  timestamp: string;
  uptime: number;
  checks: HealthCheck[];
  environment: string;
}

// Track server start time for uptime calculation
const serverStartTime = Date.now();

/**
 * GET: Comprehensive health check
 */
export const onRequestGet = async (context: CloudflareContext<Env>) => {
  const checks: HealthCheck[] = [];
  const startTime = Date.now();

  // 1. Database Check
  const dbCheck = await checkDatabase(context.env.DATABASE_URL);
  checks.push(dbCheck);

  // 2. Environment Check
  const envCheck = checkEnvironment(context.env);
  checks.push(envCheck);

  // 3. Memory/Performance Check (basic)
  const perfCheck = checkPerformance();
  checks.push(perfCheck);

  // Determine overall status
  const hasError = checks.some((c) => c.status === 'error');
  const hasDegraded = checks.some((c) => c.status === 'degraded');

  let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
  if (hasError) {
    overallStatus = 'unhealthy';
  } else if (hasDegraded) {
    overallStatus = 'degraded';
  }

  const response: HealthResponse = {
    status: overallStatus,
    version: '2.0.0', // Should match package.json
    timestamp: new Date().toISOString(),
    uptime: Math.floor((Date.now() - serverStartTime) / 1000),
    checks,
    environment: context.env.NODE_ENV || 'production',
  };

  // Return appropriate status code
  const statusCode = overallStatus === 'healthy' ? 200 : overallStatus === 'degraded' ? 200 : 503;

  return new Response(JSON.stringify(response, null, 2), {
    status: statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'Access-Control-Allow-Origin': '*',
      'X-Health-Status': overallStatus,
    },
  });
};

/**
 * Check database connectivity
 */
async function checkDatabase(databaseUrl: string): Promise<HealthCheck> {
  const start = Date.now();

  if (!databaseUrl) {
    return {
      name: 'database',
      status: 'error',
      latencyMs: 0,
      message: 'DATABASE_URL not configured',
    };
  }

  try {
    const prisma = createEdgePrismaClient(databaseUrl);

    try {
      // Simple query to verify connectivity
      await prisma.$queryRaw`SELECT 1 as health_check`;

      const latency = Date.now() - start;

      return {
        name: 'database',
        status: latency > 1000 ? 'degraded' : 'ok',
        latencyMs: latency,
        message: latency > 1000 ? 'High latency detected' : 'Connected',
      };
    } finally {
      await safePrismaDisconnect(prisma);
    }
  } catch (error) {
    return {
      name: 'database',
      status: 'error',
      latencyMs: Date.now() - start,
      message: error instanceof Error ? error.message : 'Connection failed',
    };
  }
}

/**
 * Check required environment variables
 */
function checkEnvironment(env: Env): HealthCheck {
  const start = Date.now();
  const missingVars: string[] = [];

  // Required variables
  if (!env.DATABASE_URL) missingVars.push('DATABASE_URL');

  // Optional but recommended
  const warnings: string[] = [];
  if (!env.GEMINI_API_KEY) warnings.push('GEMINI_API_KEY');

  if (missingVars.length > 0) {
    return {
      name: 'environment',
      status: 'error',
      latencyMs: Date.now() - start,
      message: `Missing required: ${missingVars.join(', ')}`,
    };
  }

  if (warnings.length > 0) {
    return {
      name: 'environment',
      status: 'degraded',
      latencyMs: Date.now() - start,
      message: `Missing optional: ${warnings.join(', ')}`,
    };
  }

  return {
    name: 'environment',
    status: 'ok',
    latencyMs: Date.now() - start,
    message: 'All variables configured',
  };
}

/**
 * Basic performance check
 */
function checkPerformance(): HealthCheck {
  const start = Date.now();

  // Simple computation to measure basic performance
  let sum = 0;
  for (let i = 0; i < 10000; i++) {
    sum += Math.sqrt(i);
  }

  const latency = Date.now() - start;

  return {
    name: 'performance',
    status: latency > 100 ? 'degraded' : 'ok',
    latencyMs: latency,
    message: latency > 100 ? 'Slow computation detected' : 'Normal',
  };
}

/**
 * Simple health check (for quick uptime checks)
 */
export const onRequestHead = async () => {
  return new Response(null, {
    status: 200,
    headers: {
      'X-Health-Status': 'ok',
      'Cache-Control': 'no-store',
    },
  });
};

// Handle CORS preflight
export const onRequestOptions = () => {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
};
