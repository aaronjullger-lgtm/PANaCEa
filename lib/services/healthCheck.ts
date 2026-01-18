/**
 * Health Check Service
 *
 * Provides comprehensive health checks including:
 * - Database connectivity
 * - External service availability
 * - System resource status
 */

import { prisma } from '../prisma';
import { redis } from '../redis';

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime: number;
  version: string;
  checks: {
    database: 'ok' | 'error' | 'timeout';
    redis?: 'ok' | 'error' | 'disabled';
  };
  errors?: string[];
}

const HEALTH_CHECK_TIMEOUT = 3000; // 3 seconds

/**
 * Perform comprehensive health check
 */
export async function performHealthCheck(): Promise<HealthStatus> {
  const errors: string[] = [];
  const checks: HealthStatus['checks'] = {
    database: 'error',
  };

  // Check database connectivity
  try {
    const dbPromise = prisma.$queryRaw`SELECT 1 as health_check`;
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('timeout')), HEALTH_CHECK_TIMEOUT)
    );

    await Promise.race([dbPromise, timeoutPromise]);
    checks.database = 'ok';
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    if (message === 'timeout') {
      checks.database = 'timeout';
      errors.push('Database health check timed out');
    } else {
      checks.database = 'error';
      errors.push(`Database connection failed: ${message}`);
    }
  }

  // Check Redis if configured
  if (redis) {
    try {
      await redis.ping();
      checks.redis = 'ok';
    } catch (error) {
      checks.redis = 'error';
      const message = error instanceof Error ? error.message : 'Unknown error';
      errors.push(`Redis connection failed: ${message}`);
    }
  } else {
    checks.redis = 'disabled';
  }

  // Determine overall status
  let status: HealthStatus['status'] = 'healthy';

  if (checks.database !== 'ok') {
    status = 'unhealthy'; // Database is critical
  } else if (checks.redis === 'error') {
    status = 'degraded'; // Redis is optional but affects performance
  }

  return {
    status,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.npm_package_version || '0.0.0',
    checks,
    ...(errors.length > 0 && { errors }),
  };
}

/**
 * Get appropriate HTTP status code for health status
 */
export function getHealthStatusCode(status: HealthStatus['status']): number {
  switch (status) {
    case 'healthy':
      return 200;
    case 'degraded':
      return 200; // Still serving requests, but with degraded performance
    case 'unhealthy':
      return 503; // Service unavailable
    default:
      return 500;
  }
}
