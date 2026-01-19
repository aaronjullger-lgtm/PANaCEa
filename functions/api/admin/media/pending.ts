/**
 * Pending Media API Endpoint
 *
 * GET /api/admin/media/pending
 * Returns media assets awaiting approval with optional filtering and stats.
 *
 * SECURITY: Admin-only endpoint with rate limiting
 */

import { z } from 'zod';
import { adminEndpoint, withCors } from '../../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect, EdgePrismaClient } from '../../_shared/prisma-edge';
import { logger } from '../../_shared/secureLogger';

// Schema for GET query parameters
const PendingMediaQuerySchema = z.object({
  category: z.string().max(50).optional(),
  limit: z.string().regex(/^\d+$/).transform(Number).optional(),
  offset: z.string().regex(/^\d+$/).transform(Number).optional(),
  includeStats: z.enum(['true', 'false']).optional(),
});

export const onRequestOptions = withCors();

export const onRequestGet = adminEndpoint(PendingMediaQuerySchema, async ({ env, validated, auth }) => {
  logger.info('Admin fetching pending media', {
    userId: auth.userId,
    filters: validated,
  });

  if (!env.DATABASE_URL) {
    logger.warn('Database not configured');
    return { status: 503, error: 'Database not configured' };
  }

  let prisma: EdgePrismaClient | null = null;

  try {
    prisma = createEdgePrismaClient(env.DATABASE_URL);

    // Apply defaults and caps
    const category = validated.category;
    const limit = Math.min(validated.limit || 50, 100); // Cap at 100
    const offset = validated.offset || 0;
    const includeStats = validated.includeStats === 'true';

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
      take: limit,
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

    logger.info('Pending media fetched successfully', {
      userId: auth.userId,
      count: transformedMedia.length,
      total,
    });

    return {
      success: true,
      media: transformedMedia,
      total,
      stats,
    };
  } catch (error) {
    logger.error('Failed to fetch pending media', error, {
      userId: auth.userId,
    });
    return { status: 500, error: 'Failed to fetch pending media' };
  } finally {
    await safePrismaDisconnect(prisma);
  }
});