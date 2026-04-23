/**
 * GET /api/mapping-enrichment/suggestions
 * Retrieves pending suggestions with filters.
 *
 * Migrated to adminAuthenticatedEndpoint: adds rate limiting (60/min),
 * admin role check, CORS, structured logging, error handling.
 */

import { z } from 'zod';
import { adminAuthenticatedEndpoint } from '../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';

const SuggestionsQuerySchema = z.object({
  query: z
    .object({
      status: z.enum(['PENDING', 'APPROVED', 'REJECTED', 'IGNORED']).optional(),
      confidenceMin: z.coerce.number().min(0).max(1).optional(),
      confidenceMax: z.coerce.number().min(0).max(1).optional(),
      taxonomyCode: z.string().optional(),
      systemCode: z.string().optional(),
      page: z.coerce.number().int().min(1).optional().default(1),
      limit: z.coerce.number().int().min(1).max(100).optional().default(50),
      sortBy: z.enum(['confidence', 'createdAt', 'taxonomyCode', 'suggestedSystemCode']).optional().default('confidence'),
      sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
    })
    .optional()
    .default({}),
});

export const onRequestGet = adminAuthenticatedEndpoint(
  SuggestionsQuerySchema,
  async (context) => {
    const { env } = context;
    const prisma = createEdgePrismaClient(env.DATABASE_URL);

    try {
      const url = new URL(context.request.url);
      const sp = url.searchParams;

      const status = sp.get('status') as 'PENDING' | 'APPROVED' | 'REJECTED' | 'IGNORED' | undefined;
      const confidenceMin = sp.has('confidenceMin') ? parseFloat(sp.get('confidenceMin')!) : undefined;
      const confidenceMax = sp.has('confidenceMax') ? parseFloat(sp.get('confidenceMax')!) : undefined;
      const taxonomyCode = sp.get('taxonomyCode') || undefined;
      const systemCode = sp.get('systemCode') || undefined;
      const page = sp.has('page') ? parseInt(sp.get('page')!, 10) : 1;
      const limit = Math.min(sp.has('limit') ? parseInt(sp.get('limit')!, 10) : 50, 100);
      const sortBy = (sp.get('sortBy') as string) || 'confidence';
      const sortOrder = (sp.get('sortOrder') as 'asc' | 'desc') || 'desc';

      // Build where clause
      const where: any = {};
      if (status) where.status = status;
      if (confidenceMin !== undefined || confidenceMax !== undefined) {
        where.confidence = {};
        if (confidenceMin !== undefined) where.confidence.gte = confidenceMin;
        if (confidenceMax !== undefined) where.confidence.lte = confidenceMax;
      }
      if (taxonomyCode) where.taxonomyCode = { contains: taxonomyCode, mode: 'insensitive' };
      if (systemCode) where.suggestedSystemCode = systemCode;

      // Build orderBy clause
      const orderBy: any = {};
      if (sortBy === 'taxonomyCode') orderBy.taxonomyCode = sortOrder;
      else if (sortBy === 'suggestedSystemCode') orderBy.suggestedSystemCode = sortOrder;
      else if (sortBy === 'createdAt') orderBy.createdAt = sortOrder;
      else orderBy.confidence = sortOrder;

      const [suggestions, total] = await Promise.all([
        prisma.mappingSuggestion.findMany({
          where,
          orderBy,
          skip: (page - 1) * limit,
          take: limit,
          include: {
            taxonomy: {
              select: {
                description: true,
                isActive: true,
              },
            },
            reviewedByUser: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        }),
        prisma.mappingSuggestion.count({ where }),
      ]);

      // Transform suggestions (strip PII — no email in reviewer data)
      const transformed = suggestions.map((s: any) => ({
        id: s.id,
        taxonomyCode: s.taxonomyCode,
        taxonomyName: s.taxonomyName,
        taxonomyDescription: s.taxonomy?.description || null,
        taxonomyIsActive: s.taxonomy?.isActive || false,
        suggestedSystemCode: s.suggestedSystemCode,
        confidence: s.confidence,
        reason: s.reason,
        alternativeSystems: s.alternativeSystems,
        status: s.status,
        reviewedBy: s.reviewedBy,
        reviewedAt: s.reviewedAt,
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
        reviewedByUser: s.reviewedByUser,
      }));

      return {
        data: {
          suggestions: transformed,
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
          },
        },
      };
    } catch (error) {
      console.error('[MappingEnrichmentSuggestions]', error);
      return { status: 500, error: 'Internal server error' };
    } finally {
      await safePrismaDisconnect(prisma);
    }
  },
  { source: 'query' }
);
