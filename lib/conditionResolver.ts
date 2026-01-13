/**
 * Condition Resolver
 * 
 * Fixes the critical bug where questions generate fake conditionIds from names
 * instead of linking to actual database MedicalContent records.
 * 
 * Uses fuzzy matching with Levenshtein distance to find best matches.
 */

import type { PrismaClient } from '@prisma/client';

/**
 * Note: This module requires a Prisma client to be passed in.
 * It does not create its own client to avoid configuration issues.
 */

interface ConditionMatch {
  conditionId: string;
  name: string;
  system: string;
  confidence: number; // 0-1, where 1 is exact match
}

/**
 * Calculate Levenshtein distance between two strings (edit distance)
 */
function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

/**
 * Normalize condition name for matching
 */
function normalizeConditionName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^\w\s]/g, '') // Remove punctuation
    .replace(/\s+/g, ' ')    // Normalize whitespace
    .trim();
}

/**
 * Calculate similarity score (0-1, higher is better)
 */
function calculateSimilarity(query: string, target: string): number {
  const normQuery = normalizeConditionName(query);
  const normTarget = normalizeConditionName(target);
  
  // Exact match
  if (normQuery === normTarget) return 1.0;
  
  // Contains match
  if (normTarget.includes(normQuery)) return 0.9;
  if (normQuery.includes(normTarget)) return 0.85;
  
  // Levenshtein distance
  const distance = levenshteinDistance(normQuery, normTarget);
  const maxLen = Math.max(normQuery.length, normTarget.length);
  const similarity = 1 - (distance / maxLen);
  
  return Math.max(0, similarity);
}

/**
 * In-memory cache for condition lookups (expires after 5 minutes)
 */
const conditionCache = new Map<string, { result: ConditionMatch | null; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Resolve a condition name to a real conditionId from MedicalContent
 * 
 * @param conditionName - The condition name from question (e.g., "Atrial Fibrillation")
 * @param system - Optional system hint to narrow search (e.g., "CV")
 * @param minConfidence - Minimum confidence threshold (0-1), default 0.6
 * @returns ConditionMatch with conditionId and confidence, or null if no match
 */
export async function resolveConditionId(
  prisma: PrismaClient,
  conditionName: string,
  system?: string,
  minConfidence: number = 0.6
): Promise<ConditionMatch | null> {
  if (!conditionName || conditionName === 'unknown') return null;
  
  // Check cache first
  const cacheKey = `${conditionName}:${system || 'all'}`;
  const cached = conditionCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.result;
  }
  
  try {
    // Build query filter
    const where: any = {
      status: 'published', // Only match against published conditions
    };
    
    if (system) {
      where.system = system;
    }
    
    // Fetch candidate conditions
    const candidates = await prisma.medicalContent.findMany({
      where,
      select: {
        conditionId: true,
        condition: true,  // This is the name field
        system: true,
      },
      take: 100, // Limit for performance
    });
    
    if (candidates.length === 0) return null;
    
    // Calculate similarity for each candidate
    const matches = candidates.map(candidate => ({
      conditionId: candidate.conditionId,
      name: candidate.condition,  // condition field is the name
      system: candidate.system,
      confidence: calculateSimilarity(conditionName, candidate.condition),
    }));
    
    // Sort by confidence
    matches.sort((a, b) => b.confidence - a.confidence);
    
    // Return best match if above threshold
    const bestMatch = matches[0];
    const result = bestMatch.confidence >= minConfidence ? bestMatch : null;
    
    // Cache result
    conditionCache.set(cacheKey, { result, timestamp: Date.now() });
    
    return result;
    
  } catch (error) {
    console.error('[ConditionResolver] Error resolving condition:', error);
    return null;
  }
}

/**
 * Batch resolve multiple condition names
 * More efficient than calling resolveConditionId multiple times
 */
export async function resolveConditionIdBatch(
  prisma: PrismaClient,
  conditions: Array<{ name: string; system?: string }>,
  minConfidence: number = 0.6
): Promise<Map<string, ConditionMatch | null>> {
  const results = new Map<string, ConditionMatch | null>();
  
  // Group by system for efficient querying
  const bySystem = new Map<string, string[]>();
  
  for (const { name, system } of conditions) {
    const key = system || 'all';
    if (!bySystem.has(key)) bySystem.set(key, []);
    bySystem.get(key)!.push(name);
  }
  
  // Resolve each system group
  for (const [system, names] of bySystem.entries()) {
    const where: any = { status: 'published' };
    if (system !== 'all') where.system = system;
    
    const candidates = await prisma.medicalContent.findMany({
      where,
      select: { conditionId: true, condition: true, system: true },
    });
    
    // Match each name
    for (const conditionName of names) {
      const matches = candidates.map(c => ({
        conditionId: c.conditionId,
        name: c.condition,  // condition field is the name
        system: c.system,
        confidence: calculateSimilarity(conditionName, c.condition),
      }));
      
      matches.sort((a, b) => b.confidence - a.confidence);
      const bestMatch = matches[0];
      
      results.set(
        conditionName,
        bestMatch && bestMatch.confidence >= minConfidence ? bestMatch : null
      );
    }
  }
  
  return results;
}

/**
 * Clear the condition resolution cache
 * Call this after bulk database updates
 */
export function clearConditionCache(): void {
  conditionCache.clear();
}

/**
 * Get cache statistics (for debugging)
 */
export function getConditionCacheStats() {
  return {
    size: conditionCache.size,
    entries: Array.from(conditionCache.entries()).map(([key, value]) => ({
      key,
      age: Date.now() - value.timestamp,
      hasResult: !!value.result,
    })),
  };
}
