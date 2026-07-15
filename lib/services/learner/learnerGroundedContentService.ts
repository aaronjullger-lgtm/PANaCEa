/**
 * Grounded clinical content retrieval wrapper.
 * Read-only; uses existing search primitives.
 */

import type { PrismaClient } from '@prisma/client';
import type { GroundedContentResult } from './types';

export interface GroundedContentFilters {
  system?: string;
  conditionId?: string;
  maxResults?: number;
}

export async function retrieveGroundedContent(
  prisma: PrismaClient,
  query: string,
  filters: GroundedContentFilters = {}
): Promise<GroundedContentResult> {
  const maxResults = Math.min(filters.maxResults ?? 5, 10);
  const q = query.trim().slice(0, 200);
  if (!q) {
    return { query: '', items: [], retrievedAt: new Date().toISOString() };
  }

  const conditions = await prisma.condition.findMany({
    where: {
      OR: [
        { name: { contains: q, mode: 'insensitive' } },
        { id: { contains: q, mode: 'insensitive' } },
      ],
      ...(filters.system ? { system: filters.system } : {}),
      ...(filters.conditionId ? { id: filters.conditionId } : {}),
    },
    select: {
      id: true,
      name: true,
      system: true,
    },
    take: maxResults,
  });

  const contentRows = await prisma.medicalContent.findMany({
    where: {
      conditionId: { in: conditions.map((c) => c.id) },
      status: { in: ['published', 'approved'] },
    },
    select: {
      id: true,
      conditionId: true,
      condition: true,
      system: true,
      overview: true,
      status: true,
    },
    take: maxResults,
  });

  const contentByCondition = new Map(contentRows.map((r) => [r.conditionId, r]));

  const items = conditions.map((c) => {
    const content = contentByCondition.get(c.id);
    const excerpt = content?.overview
      ? String(content.overview).slice(0, 400)
      : `Condition entry for ${c.name}`;
    return {
      sourceType: 'medical_content',
      sourceId: content?.id ?? c.id,
      title: c.name,
      excerpt,
      citationLabel: `PANaCEa Condition: ${c.name} (${c.system ?? 'general'})`,
      reviewStatus: content?.status ?? undefined,
    };
  });

  return {
    query: q,
    items,
    retrievedAt: new Date().toISOString(),
  };
}
