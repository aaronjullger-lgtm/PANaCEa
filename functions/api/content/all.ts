/**
 * GET /api/content/all
 * 
 * Returns a SUMMARY list of all conditions for dashboard/search.
 * This endpoint only returns essential fields to stay under 5MB Prisma Accelerate limit.
 * 
 * Heavy fields (clinicalPearls, treatment, diagnostics, etc.) should be fetched
 * on-demand via /api/conditions/[conditionId] when a user opens a specific condition.
 * 
 * This "Summary List + Detail Fetch" pattern:
 * - Reduces initial payload from 14MB+ to ~2MB
 * - Improves mobile data usage and battery life
 * - Enables millisecond-fast dashboard loads
 * - Stays 100% database-driven (no static JSON)
 */

import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { handleCorsOptions } from '../_shared/auth';
import { CloudflareContext } from '../_shared/types';

export const onRequestOptions = handleCorsOptions;

export async function onRequestGet(context: CloudflareContext) {
  const { env } = context;

  if (!env.DATABASE_URL) {
    return new Response(JSON.stringify({ error: 'Database not configured' }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }

  const prisma = createEdgePrismaClient(env.DATABASE_URL);

  try {
    // CRITICAL: Only fetch essential fields for listing/search
    // This keeps response under 5MB Prisma Accelerate limit
    // Heavy content fields should be fetched via /api/conditions/[id]
    const allContent = await prisma.medicalContent.findMany({
      where: { status: 'published' },
      select: {
        // Essential fields for list display and search (total ~2MB)
        conditionId: true,
        condition: true,
        system: true,
        subcategory: true,

        // Hierarchy grouping
        canonicalName: true,

        // Buzzwords are needed for search functionality
        buzzwords: true,

        // Overview is a short text, useful for previews (no 'definition' field exists)
        overview: true,

        // High-yield flag for filtering
        pance_yield: true,

        // Classic patient for quick recognition
        classic_patient: true,
      },
      orderBy: { conditionId: 'asc' },
      take: 3000, // Safety limit
    });

    // If no content found, return empty object (not an error)
    if (!allContent || allContent.length === 0) {
      console.warn('No published medical content found in database');
      return new Response(JSON.stringify({}), {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type'
        }
      });
    }

    // Transform to map format expected by frontend
    // This is the SUMMARY version - heavy fields intentionally excluded
    const contentMap: Record<string, any> = {};
    for (const item of allContent) {
      contentMap[item.conditionId] = {
        // Core identifiers
        conditionId: item.conditionId,
        condition: item.condition,
        system: item.system,
        subcategory: item.subcategory,
        canonicalName: item.canonicalName,

        // Search/filter support
        buzzwords: item.buzzwords && (item.buzzwords as any[]).length > 0 ? item.buzzwords : undefined,

        // Preview text (kept short)
        overview: item.overview,
        classic_patient: item.classic_patient,

        // Yield info
        pance_yield: item.pance_yield,

        // Flag indicating full content must be fetched separately
        _isSummary: true,
      };
    }

    console.log(`Returning summary for ${Object.keys(contentMap).length} conditions`);

    return new Response(JSON.stringify(contentMap), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Cache-Control': 'public, max-age=3600, s-maxage=3600' // Cache for 1 hour
      }
    });

  } catch (error) {
    console.error('Error fetching all content:', error);
    return new Response(JSON.stringify({
      error: 'Failed to fetch content',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  } finally {
    await safePrismaDisconnect(prisma);
  }
}
