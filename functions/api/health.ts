/**
 * GET /api/health
 * 
 * Health check endpoint for debugging Prisma 7 + Cloudflare Pages issues.
 * Returns database connection status without returning sensitive data.
 */

import { createEdgePrismaClient, safePrismaDisconnect } from './_shared/prisma-edge';
import { handleCorsOptions } from './_shared/auth';

export const onRequestOptions = handleCorsOptions;

export async function onRequestGet(context: any) {
  const { env } = context;
  
  const health: Record<string, any> = {
    status: 'checking',
    timestamp: new Date().toISOString(),
    prismaVersion: 7,
    checks: {}
  };

  // Check 1: DATABASE_URL environment variable
  if (!env.DATABASE_URL) {
    health.status = 'unhealthy';
    health.checks.database_url = {
      status: 'missing',
      error: 'DATABASE_URL environment variable is not set'
    };
    return new Response(JSON.stringify(health, null, 2), {
      status: 503,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }

  // Check 2: DATABASE_URL format
  const isAccelerate = env.DATABASE_URL.startsWith('prisma://');
  const isPostgres = env.DATABASE_URL.startsWith('postgresql://') || env.DATABASE_URL.startsWith('postgres://');
  
  health.checks.database_url = {
    status: 'present',
    format: isAccelerate ? 'prisma_accelerate' : isPostgres ? 'direct_postgresql' : 'unknown',
    warning: isPostgres ? 'Direct PostgreSQL URLs may not work on Cloudflare Workers edge runtime' : undefined
  };

  // Check 3: Try to create Prisma client
  let prisma = null;
  try {
    prisma = createEdgePrismaClient(env.DATABASE_URL);
    health.checks.prisma_client = { status: 'created' };
  } catch (error) {
    health.status = 'unhealthy';
    health.checks.prisma_client = {
      status: 'failed',
      error: error instanceof Error ? error.message : 'Unknown error creating Prisma client'
    };
    return new Response(JSON.stringify(health, null, 2), {
      status: 503,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }

  // Use try/finally to ensure disconnect is always called
  try {
    // Check 4: Try a simple database query
    try {
      const result = await prisma.$queryRaw`SELECT 1 as test`;
      health.checks.database_query = {
        status: 'success',
        result: 'SELECT 1 succeeded'
      };
    } catch (error) {
      health.status = 'unhealthy';
      health.checks.database_query = {
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown query error'
      };
      return new Response(JSON.stringify(health, null, 2), {
        status: 503,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    // Check 5: Try to count MedicalContent records
    try {
      const count = await prisma.medicalContent.count();
      health.checks.medical_content = {
        status: 'success',
        count: count
      };
    } catch (error) {
      health.checks.medical_content = {
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error counting records'
      };
    }

    // Final status
    health.status = 'healthy';

    return new Response(JSON.stringify(health, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-cache'
      }
    });
  } finally {
    await safePrismaDisconnect(prisma);
  }
}
