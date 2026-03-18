import { prisma } from './prisma-edge';

/**
 * Taxonomy Service
 * Provides database-backed access to content configuration (systems, conditions, etc)
 * replacing hardcoded arrays in TS config files.
 * This is the single source of truth for what content exists in the system.
 */

interface TaxonomyCache {
  systems: string[];
  conditionsBySystem: Map<string, string[]>;
  allConditions: Array<{ id: string; name: string; system: string }>;
  lastUpdated: number;
}

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
let taxonomyCache: TaxonomyCache | null = null;

/**
 * Get all unique systems from the database
 */
export async function getAllSystems(): Promise<string[]> {
  const cached = await getTaxonomyCache();
  return cached.systems;
}

/**
 * Get all conditions for a specific system
 */
export async function getConditionsBySystem(system: string): Promise<string[]> {
  const cached = await getTaxonomyCache();
  return cached.conditionsBySystem.get(system) || [];
}

/**
 * Get all conditions with their metadata
 */
export async function getAllConditions(): Promise<
  Array<{ id: string; name: string; system: string }>
> {
  const cached = await getTaxonomyCache();
  return cached.allConditions;
}

/**
 * Get systems ordered by question count (most popular first)
 * Useful for featured/trending content
 */
export async function getSystemsByPopularity(): Promise<
  Array<{ system: string; count: number }>
> {
  const results = await prisma.question.groupBy({
    by: ['system'],
    _count: {
      id: true,
    },
    orderBy: {
      _count: {
        id: 'desc',
      },
    },
  });

  return results.map((r) => ({
    system: r.system,
    count: r._count.id,
  }));
}

/**
 * Get active (non-deprecated) questions by system
 * Filters by lifecycle status and QA status
 */
export async function getActiveQuestionCountBySystem(): Promise<
  Record<string, number>
> {
  const results = await prisma.question.groupBy({
    by: ['system'],
    where: {
      lifecycleStatus: 'ACTIVE',
      qaStatus: 'APPROVED',
    },
    _count: {
      id: true,
    },
  });

  const counts: Record<string, number> = {};
  results.forEach((r) => {
    counts[r.system] = r._count.id;
  });
  return counts;
}

/**
 * Get conditions that need more questions (gap analysis)
 * Returns conditions with fewer active questions than a threshold
 */
export async function getConditionsNeedingContent(
  minQuestionCount: number = 5
): Promise<
  Array<{
    conditionId: string;
    conditionName: string;
    system: string;
    activeCount: number;
  }>
> {
  const conditions = await prisma.condition.findMany({
    select: {
      id: true,
      name: true,
      system: true,
      _count: {
        select: {
          Question: {
            where: {
              lifecycleStatus: 'ACTIVE',
              qaStatus: 'APPROVED',
            },
          },
        },
      },
    },
  });

  return conditions
    .map((c) => ({
      conditionId: c.id,
      conditionName: c.name,
      system: c.system,
      activeCount: c._count.Question,
    }))
    .filter((c) => c.activeCount < minQuestionCount)
    .sort((a, b) => a.activeCount - b.activeCount);
}

/**
 * Validate that a system exists in the database
 */
export async function validateSystem(system: string): Promise<boolean> {
  const systems = await getAllSystems();
  return systems.includes(system);
}

/**
 * Validate that a condition exists for a given system
 */
export async function validateConditionInSystem(
  conditionId: string,
  system: string
): Promise<boolean> {
  const condition = await prisma.condition.findUnique({
    where: { id: conditionId },
    select: { system: true },
  });
  return condition?.system === system;
}

/**
 * Internal: Get or refresh the taxonomy cache
 */
async function getTaxonomyCache(): Promise<TaxonomyCache> {
  const now = Date.now();

  if (
    taxonomyCache &&
    now - taxonomyCache.lastUpdated < CACHE_TTL
  ) {
    return taxonomyCache;
  }

  // Fetch all conditions
  const conditions = await prisma.condition.findMany({
    select: {
      id: true,
      name: true,
      system: true,
    },
    where: {
      status: 'published',
    },
  });

  // Extract unique systems
  const systems = Array.from(new Set(conditions.map((c) => c.system)));

  // Group conditions by system
  const conditionsBySystem = new Map<string, string[]>();
  systems.forEach((system) => {
    const systemConditions = conditions
      .filter((c) => c.system === system)
      .map((c) => c.name);
    conditionsBySystem.set(system, systemConditions);
  });

  taxonomyCache = {
    systems: systems.sort(),
    conditionsBySystem,
    allConditions: conditions,
    lastUpdated: now,
  };

  return taxonomyCache;
}

/**
 * Clear the cache (useful after content updates)
 */
export function clearTaxonomyCache(): void {
  taxonomyCache = null;
}
