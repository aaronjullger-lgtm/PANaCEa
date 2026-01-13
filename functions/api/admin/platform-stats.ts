/**
 * Platform Statistics API
 * GET /api/admin/platform-stats
 * 
 * Returns aggregated platform-wide statistics with optional date range filtering.
 * Admin-only endpoint.
 * 
 * Query params:
 * - start: Start date (YYYY-MM-DD)
 * - end: End date (YYYY-MM-DD)
 * - limit: Number of days to return (default 30)
 */

import { createEdgePrismaClient } from '../_shared/prisma-edge';
import { authenticateRequest, handleCorsOptions } from '../_shared/auth';

interface Env {
  DATABASE_URL: string;
  CLERK_SECRET_KEY: string;
}

export const onRequestOptions = handleCorsOptions;

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  
  const prisma = createEdgePrismaClient(env.DATABASE_URL);
  
  try {
    // Authenticate and check admin access
    const auth = await authenticateRequest(request, env.CLERK_SECRET_KEY);
    if (!auth.authenticated || !auth.userId) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    // Check if user is admin
    const user = await prisma.user.findUnique({
      where: { id: auth.userId },
      select: { role: true }
    });

    if (!user || user.role !== 'admin') {
      return new Response(JSON.stringify({ error: 'Admin access required' }), {
        status: 403,
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    // Parse query parameters
    const url = new URL(request.url);
    const startParam = url.searchParams.get('start');
    const endParam = url.searchParams.get('end');
    const limitParam = url.searchParams.get('limit');

    const limit = limitParam ? parseInt(limitParam) : 30;
    
    const endDate = endParam ? new Date(endParam) : new Date();
    endDate.setUTCHours(23, 59, 59, 999);
    
    const startDate = startParam 
      ? new Date(startParam)
      : new Date(endDate.getTime() - (limit * 24 * 60 * 60 * 1000));
    startDate.setUTCHours(0, 0, 0, 0);

    // Query platform statistics
    const stats = await prisma.platformStatistics.findMany({
      where: {
        date: {
          gte: startDate,
          lte: endDate
        }
      },
      orderBy: {
        date: 'desc'
      },
      take: limit
    });

    // Calculate summary metrics
    const summary = stats.length > 0 ? {
      totalDays: stats.length,
      avgDAU: Math.round(stats.reduce((sum, s) => sum + s.dau, 0) / stats.length),
      avgWAU: Math.round(stats.reduce((sum, s) => sum + s.wau, 0) / stats.length),
      avgMAU: Math.round(stats.reduce((sum, s) => sum + s.mau, 0) / stats.length),
      totalQuestionsAnswered: stats.reduce((sum, s) => sum + s.questionsAnswered, 0),
      avgAccuracy: stats
        .filter(s => s.averageAccuracy !== null)
        .reduce((sum, s, _, arr) => sum + Number(s.averageAccuracy) / arr.length, 0),
      totalNewUsers: stats.reduce((sum, s) => sum + s.newUsers, 0),
      avgRetention7Day: stats
        .filter(s => s.retention7Day !== null)
        .reduce((sum, s, _, arr) => sum + Number(s.retention7Day) / arr.length, 0),
      avgRetention30Day: stats
        .filter(s => s.retention30Day !== null)
        .reduce((sum, s, _, arr) => sum + Number(s.retention30Day) / arr.length, 0)
    } : null;

    return new Response(JSON.stringify({
      success: true,
      data: stats,
      summary,
      dateRange: {
        start: startDate.toISOString().split('T')[0],
        end: endDate.toISOString().split('T')[0]
      }
    }), {
      status: 200,
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });

  } catch (error) {
    console.error('Error fetching platform statistics:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
    
  } finally {
    await prisma.$disconnect();
  }
};
