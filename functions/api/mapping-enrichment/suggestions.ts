/**
 * GET /api/mapping-enrichment/suggestions
 * Retrieves pending suggestions with filters.
 */

import { getCorsHeaders, getCorsConfig } from '../_shared/cors';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';

export const onRequestOptions = async (context: any) => {
  const corsConfig = context?.env ? getCorsConfig(context.env) : undefined;
  return new Response(null, {
    status: 204,
    headers: getCorsHeaders(context?.request, corsConfig) ?? {},
  });
};

export const onRequestGet = async (context: any) => {
  const corsConfig = context?.env ? getCorsConfig(context.env) : undefined;
  const cors = getCorsHeaders(context?.request, corsConfig) ?? {};
  const jsonHeaders = { ...cors, 'Content-Type': 'application/json' };

  let prisma = null;
  try {
    // Validate environment
    const env = context?.env ?? {};
    if (!env.DATABASE_URL) {
      return new Response(
        JSON.stringify({ error: 'DATABASE_URL environment variable is not set' }),
        { status: 500, headers: jsonHeaders }
      );
    }

    prisma = createEdgePrismaClient(env.DATABASE_URL);
    const url = new URL(context.request.url);
    const searchParams = url.searchParams;

    // Parse filter parameters
    const status = searchParams.get('status') as 'PENDING' | 'APPROVED' | 'REJECTED' | 'IGNORED' | undefined;
    const confidenceMin = searchParams.has('confidenceMin') ? parseFloat(searchParams.get('confidenceMin')!) : undefined;
    const confidenceMax = searchParams.has('confidenceMax') ? parseFloat(searchParams.get('confidenceMax')!) : undefined;
    const taxonomyCode = searchParams.get('taxonomyCode') || undefined;
    const systemCode = searchParams.get('systemCode') || undefined;
    const page = searchParams.has('page') ? parseInt(searchParams.get('page')!, 10) : 1;
    const limit = searchParams.has('limit') ? parseInt(searchParams.get('limit')!, 10) : 50;
    const sortBy = searchParams.get('sortBy') as 'confidence' | 'createdAt' | 'taxonomyCode' | 'suggestedSystemCode' || 'confidence';
    const sortOrder = searchParams.get('sortOrder') as 'asc' | 'desc' || 'desc';

    // Validate pagination
    if (page < 1) {
      return new Response(
        JSON.stringify({ error: 'Page must be greater than 0' }),
        { status: 400, headers: jsonHeaders }
      );
    }
    if (limit < 1 || limit > 100) {
      return new Response(
        JSON.stringify({ error: 'Limit must be between 1 and 100' }),
        { status: 400, headers: jsonHeaders }
      );
    }

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
    else orderBy.confidence = sortOrder; // default

    // Fetch suggestions with pagination
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
              email: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      }),
      prisma.mappingSuggestion.count({ where }),
    ]);

    // Transform suggestions to include taxonomy description
    const transformed = suggestions.map((suggestion) => ({
      id: suggestion.id,
      taxonomyCode: suggestion.taxonomyCode,
      taxonomyName: suggestion.taxonomyName,
      taxonomyDescription: suggestion.taxonomy?.description || null,
      taxonomyIsActive: suggestion.taxonomy?.isActive || false,
      suggestedSystemCode: suggestion.suggestedSystemCode,
      confidence: suggestion.confidence,
      reason: suggestion.reason,
      alternativeSystems: suggestion.alternativeSystems as Array<{
        systemCode: string;
        confidence: number;
        reason: string;
      }>,
      status: suggestion.status,
      reviewedBy: suggestion.reviewedBy,
      reviewedAt: suggestion.reviewedAt,
      createdAt: suggestion.createdAt,
      updatedAt: suggestion.updatedAt,
      reviewedByUser: suggestion.reviewedByUser,
    }));

    return new Response(
      JSON.stringify({
        suggestions: transformed,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      }),
      { status: 200, headers: jsonHeaders }
    );
  } catch (error) {
    console.error('[MappingEnrichmentSuggestions]', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: (error as Error).message }),
      { status: 500, headers: jsonHeaders }
    );
  } finally {
    await safePrismaDisconnect(prisma);
  }
};