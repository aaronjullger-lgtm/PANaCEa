/**
 * User Stability Trend API
 * 
 * Returns FSRS stability growth over time for visualization
 * Used by AnalyticsDashboard to show learning progress
 */

import { authenticateRequest, handleCorsOptions } from '../_shared/auth';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';

export const onRequestOptions = handleCorsOptions;

export interface StabilityTrendDataPoint {
  date: string; // ISO 8601 date
  avgStability: number;
  totalReviews: number;
  conditions: Array<{
    conditionId: string;
    stability: number;
  }>;
}

interface ReviewSnapshot {
  date: string;
  stability: number;
  difficulty: number;
  rating: number;
  state: number;
}

export async function onRequestGet(context: any) {
  const { request, env } = context;
  const url = new URL(request.url);
  const days = parseInt(url.searchParams.get('days') || '30', 10);

  // Authenticate
  const auth = await authenticateRequest(request, env);
  if (!auth) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }

  const prisma = createEdgePrismaClient(env.DATABASE_URL);

  try {
    // Get user by clerkId
    const user = await prisma.user.findUnique({
      where: { clerkId: auth.userId },
      select: { id: true },
    });

    if (!user) {
      return new Response(JSON.stringify({ 
        data: [],
        message: 'User not found. Please complete some questions first!' 
      }), {
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }

    // Fetch all UserProgress records with review history - INLINED to avoid import issues
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const allProgress = await prisma.userProgress.findMany({
      where: { userId: user.id },
      select: {
        conditionId: true,
        reviewHistory: true,
      },
    });

    // Extract and filter review history
    const allSnapshots: Array<ReviewSnapshot & { conditionId: string }> = [];

    for (const progress of allProgress) {
      if (!Array.isArray(progress.reviewHistory)) continue;

      const snapshots = (progress.reviewHistory as ReviewSnapshot[])
        .filter((snapshot) => {
          if (!snapshot.date) return false;
          const snapshotDate = new Date(snapshot.date);
          return snapshotDate >= cutoffDate;
        })
        .map((snapshot) => ({
          ...snapshot,
          conditionId: progress.conditionId,
        }));

      allSnapshots.push(...snapshots);
    }

    // Sort by date
    const reviewHistory = allSnapshots.sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    if (reviewHistory.length === 0) {
      return new Response(
        JSON.stringify({
          data: [],
          message: 'No review history found. Complete some questions to see stability trends!',
        }),
        {
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        }
      );
    }

    // Group by date (day-level granularity)
    const dateMap = new Map<string, {
      stabilities: number[];
      conditions: Map<string, number>;
    }>();

    reviewHistory.forEach((snapshot) => {
      const date = snapshot.date.split('T')[0]; // Get YYYY-MM-DD
      
      if (!dateMap.has(date)) {
        dateMap.set(date, {
          stabilities: [],
          conditions: new Map(),
        });
      }

      const entry = dateMap.get(date)!;
      entry.stabilities.push(snapshot.stability);
      entry.conditions.set(snapshot.conditionId, snapshot.stability);
    });

    // Convert to array format
    const trendData: StabilityTrendDataPoint[] = Array.from(dateMap.entries())
      .map(([date, entry]) => {
        const avgStability = entry.stabilities.reduce((sum, s) => sum + s, 0) / entry.stabilities.length;
        
        return {
          date,
          avgStability: Math.round(avgStability * 100) / 100, // Round to 2 decimals
          totalReviews: entry.stabilities.length,
          conditions: Array.from(entry.conditions.entries()).map(([conditionId, stability]) => ({
            conditionId,
            stability: Math.round(stability * 100) / 100,
          })),
        };
      })
      .sort((a, b) => a.date.localeCompare(b.date));

    return new Response(
      JSON.stringify({
        data: trendData,
        summary: {
          days,
          totalDataPoints: trendData.length,
          totalReviews: reviewHistory.length,
          startDate: trendData[0]?.date,
          endDate: trendData[trendData.length - 1]?.date,
          startStability: trendData[0]?.avgStability || 0,
          endStability: trendData[trendData.length - 1]?.avgStability || 0,
          stabilityGrowth: trendData.length > 1 && trendData[0].avgStability > 0
            ? Math.round(((trendData[trendData.length - 1].avgStability - trendData[0].avgStability) / trendData[0].avgStability) * 100)
            : 0,
        },
      }),
      {
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      }
    );
  } catch (error) {
    // Enhanced error logging for debugging
    const errorDetails = {
      message: error instanceof Error ? error.message : 'Unknown error',
      name: error instanceof Error ? error.name : 'UnknownError',
      stack: error instanceof Error ? error.stack?.split('\n').slice(0, 5).join('\n') : undefined,
      prismaCode: (error as any)?.code,
      prismaClientVersion: (error as any)?.clientVersion,
    };
    console.error('[StabilityTrendAPI] Error:', JSON.stringify(errorDetails, null, 2));
    
    return new Response(
      JSON.stringify({ 
        error: 'Failed to fetch stability trend',
        data: [],
        details: errorDetails.message,
        code: errorDetails.prismaCode,
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      }
    );
  } finally {
    await safePrismaDisconnect(prisma);
  }
}
