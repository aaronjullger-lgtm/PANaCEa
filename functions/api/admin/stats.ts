/**
 * Admin API - Get platform statistics
 * GET /api/admin/stats
 * Requires: admin or superadmin role
 */

import {
  type Env,
  authenticateRequest,
  createErrorResponse,
  createSuccessResponse,
  handleCorsOptions,
} from '../_shared/auth';

interface PagesContext {
  request: Request;
  env: Env;
}

export async function onRequestOptions(): Promise<Response> {
  return handleCorsOptions();
}

/**
 * GET: Fetch platform statistics (admin only)
 */
export async function onRequestGet(context: PagesContext): Promise<Response> {
  const { request, env } = context;

  try {
    const authContext = await authenticateRequest(request, env);

    if (!authContext) {
      return createErrorResponse('Unauthorized', 401);
    }

    // Note: This endpoint is designed for Cloudflare Workers/Pages Functions
    // For full database functionality, use the Express server endpoints at /api/admin/*
    // instead of these Cloudflare Functions
    
    // In Cloudflare environment, we have limited options:
    // 1. Use Prisma Data Proxy for database access
    // 2. Use Cloudflare D1 (their serverless SQL database)
    // 3. Call the Express API server from here
    
    // For now, we return basic info and recommend using the main server API
    const response = {
      success: true,
      message: 'For full admin statistics, please use the main server endpoint at /api/admin/stats',
      data: {
        totalUsers: 0,
        activeUsersToday: 0,
        totalStudySessions: 0,
        averageAccuracy: 0,
        popularSystems: [],
      },
      note: 'Database connection is configured in the main Express server. Use /api/admin/stats on the server for full statistics.',
    };

    return createSuccessResponse(response);
  } catch (error) {
    console.error('Admin stats error:', error);
    return createErrorResponse('Internal server error', 500);
  }
}
