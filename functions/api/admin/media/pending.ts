/**
 * Pending Media API Endpoint
 * 
 * GET /api/admin/media/pending
 * Returns media assets awaiting approval with optional filtering and stats.
 */

import { createEdgePrismaClient } from '../../_shared/prisma-edge';
import { authenticateRequest, createErrorResponse, createSuccessResponse } from '../../_shared/auth';

interface Env {
  DATABASE_URL: string;
  CLERK_SECRET_KEY: string;
}

export const onRequestGet = async (context: { request: Request; env: Env }) => {
  const prisma = createEdgePrismaClient(context.env.DATABASE_URL);

  try {
    // Authenticate - require admin role
    const auth = await authenticateRequest(context.request, context.env);
    if (!auth) {
      return createErrorResponse('Unauthorized', 401);
    }

    const user = await prisma.user.findUnique({
      where: { clerkId: auth.clerkId },
      select: { role: true },
    });

    if (!user || user.role !== 'admin') {
      return createErrorResponse('Admin access required', 403);
    }

    // Parse query params
    const url = new URL(context.request.url);
    const category = url.searchParams.get('category');
    const limit = parseInt(url.searchParams.get('limit') || '50', 10);
    const offset = parseInt(url.searchParams.get('offset') || '0', 10);
    const includeStats = url.searchParams.get('includeStats') === 'true';

    // Build where clause
    const whereClause: any = {
      approvalStatus: 'pending',
    };

    if (category && category !== 'all') {
      whereClause.type = category;
    }

    // Fetch pending media
    const media = await prisma.mediaAsset.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 100), // Cap at 100
      skip: offset,
      include: {
        Condition: {
          select: { id: true, name: true, system: true },
        },
      },
    });

    // Get total count
    const total = await prisma.mediaAsset.count({
      where: whereClause,
    });

    // Optionally fetch stats
    let stats = null;
    if (includeStats) {
      const [pending, approved, rejected, totalAll] = await Promise.all([
        prisma.mediaAsset.count({ where: { approvalStatus: 'pending' } }),
        prisma.mediaAsset.count({ where: { approvalStatus: 'approved' } }),
        prisma.mediaAsset.count({ where: { approvalStatus: 'rejected' } }),
        prisma.mediaAsset.count(),
      ]);

      stats = {
        pending,
        approved,
        rejected,
        total: totalAll,
        approvalRate: totalAll > 0 ? Math.round((approved / totalAll) * 100) : 0,
      };
    }

    // Transform media for frontend
    const transformedMedia = media.map((m) => ({
      id: m.id,
      filename: m.filename,
      originalUrl: m.originalUrl,
      thumbnailUrl: m.thumbnailUrl,
      type: m.type,
      mediaType: m.mediaType || 'image',
      tags: m.tags || [],
      description: m.description,
      qualityScore: m.qualityScore,
      isClinical: m.isClinical,
      folder: m.folder,
      status: m.status,
      uploadedAt: m.createdAt?.toISOString(),
      uploadedBy: m.uploadedBy,
      aiMetadata: m.aiMetadata,
      condition: m.Condition
        ? {
            id: m.Condition.id,
            name: m.Condition.name,
            system: m.Condition.system,
          }
        : null,
      sourceUrl: m.sourceUrl,
      citation: m.citation,
    }));

    return createSuccessResponse({
      success: true,
      media: transformedMedia,
      total,
      stats,
    });
  } catch (error) {
    console.error('Pending media fetch error:', error);
    return createErrorResponse('Failed to fetch pending media', 500);
  } finally {
    await prisma.$disconnect();
  }
};
