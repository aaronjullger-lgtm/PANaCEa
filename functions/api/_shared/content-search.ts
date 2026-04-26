/**
 * Content Search Service for Cloudflare Edge Runtime
 * Database-driven search with intelligent ranking for medical content
 * Prioritizes: exact matches → alias matches → fuzzy text matches
 */

import type { EdgePrismaClient } from './prisma-edge';

export interface SearchResult {
  id: string;
  title: string;
  type: 'condition' | 'drug';
  snippet: string;
  matchType: 'exact' | 'alias' | 'fuzzy' | 'keyword';
  score: number;
  metadata?: {
    system?: string;
    subcategory?: string;
    drugClass?: string;
    matchedAlias?: string;
  };
}

interface RankedResult {
  item: any;
  type: 'condition' | 'drug';
  score: number;
  matchType: 'exact' | 'alias' | 'fuzzy' | 'keyword';
  matchedAlias?: string;
}

// Scoring weights for ranking
const SCORE_EXACT_MATCH = 100;
const SCORE_STARTS_WITH = 80;
const SCORE_ALIAS_EXACT = 90;
const SCORE_ALIAS_STARTS = 70;
const SCORE_KEYWORD_MATCH = 60;
const SCORE_CONTAINS = 50;
const SCORE_FUZZY = 30;

function sanitizeSearchQuery(query: string): string {
  const withoutControlChars = Array.from(query, (char) => {
    const code = char.charCodeAt(0);
    return code <= 31 || code === 127 ? ' ' : char;
  }).join('');

  return withoutControlChars.replace(/\s+/g, ' ').trim().slice(0, 200);
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

/**
 * Calculate similarity score between query and target string
 */
function calculateSimilarity(query: string, target: string): number {
  const normalizedQuery = query.toLowerCase().trim();
  const normalizedTarget = target.toLowerCase().trim();

  if (normalizedTarget === normalizedQuery) {
    return SCORE_EXACT_MATCH;
  }

  if (normalizedTarget.startsWith(normalizedQuery)) {
    return SCORE_STARTS_WITH;
  }

  if (normalizedTarget.includes(normalizedQuery)) {
    return SCORE_CONTAINS;
  }

  // Fuzzy matching using Levenshtein distance
  const distance = levenshteinDistance(normalizedQuery, normalizedTarget);
  const maxLength = Math.max(normalizedQuery.length, normalizedTarget.length);
  const similarity = 1 - distance / maxLength;

  return similarity > 0.6 ? SCORE_FUZZY * similarity : 0;
}

/**
 * Calculate Levenshtein distance
 */
function levenshteinDistance(a: string, b: string): number {
  const dp: number[][] = Array.from({ length: a.length + 1 }, () =>
    new Array<number>(b.length + 1).fill(0)
  );

  for (let i = 0; i <= a.length; i++) {
    const row = dp[i];
    if (row) row[0] = i;
  }
  for (let j = 0; j <= b.length; j++) {
    const firstRow = dp[0];
    if (firstRow) firstRow[j] = j;
  }

  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      const currentRow = dp[i];
      const prevRow = dp[i - 1];
      if (currentRow && prevRow) {
        currentRow[j] = Math.min(
          (prevRow[j] ?? 0) + 1,
          (currentRow[j - 1] ?? 0) + 1,
          (prevRow[j - 1] ?? 0) + cost
        );
      }
    }
  }

  return dp[a.length]?.[b.length] ?? 0;
}

/**
 * Check if query matches any alias with scoring
 */
function scoreAliasMatch(
  query: string,
  aliases: string[]
): { score: number; matchedAlias?: string } {
  const normalizedQuery = query.toLowerCase().trim();
  let bestScore = 0;
  let matchedAlias: string | undefined;

  for (const alias of aliases) {
    const normalizedAlias = alias.toLowerCase().trim();

    if (normalizedAlias === normalizedQuery) {
      return { score: SCORE_ALIAS_EXACT, matchedAlias: alias };
    }

    if (normalizedAlias.startsWith(normalizedQuery)) {
      if (SCORE_ALIAS_STARTS > bestScore) {
        bestScore = SCORE_ALIAS_STARTS;
        matchedAlias = alias;
      }
    }

    if (normalizedAlias.includes(normalizedQuery)) {
      if (SCORE_CONTAINS > bestScore) {
        bestScore = SCORE_CONTAINS;
        matchedAlias = alias;
      }
    }
  }

  return { score: bestScore, matchedAlias };
}

/**
 * Rank and score a condition result
 */
function rankCondition(condition: any, query: string): RankedResult {
  const normalizedQuery = query.toLowerCase().trim();
  let bestScore = 0;
  let matchType: 'exact' | 'alias' | 'fuzzy' | 'keyword' = 'fuzzy';
  let matchedAlias: string | undefined;

  // Score name match
  const nameScore = calculateSimilarity(query, condition.name);
  if (nameScore > bestScore) {
    bestScore = nameScore;
    matchType = nameScore >= SCORE_STARTS_WITH ? 'exact' : 'fuzzy';
  }

  // Score display name match
  if (condition.displayName) {
    const displayScore = calculateSimilarity(query, condition.displayName);
    if (displayScore > bestScore) {
      bestScore = displayScore;
      matchType = displayScore >= SCORE_STARTS_WITH ? 'exact' : 'fuzzy';
    }
  }

  // Score alias matches
  const aliasMatch = scoreAliasMatch(query, condition.aliases || []);
  if (aliasMatch.score > bestScore) {
    bestScore = aliasMatch.score;
    matchType = 'alias';
    matchedAlias = aliasMatch.matchedAlias;
  }

  // Boost if system matches
  if (condition.system && condition.system.toLowerCase().includes(normalizedQuery)) {
    bestScore += 10;
  }

  return {
    item: condition,
    type: 'condition',
    score: bestScore,
    matchType,
    matchedAlias,
  };
}

/**
 * Rank and score a drug result
 */
function rankDrug(drug: any, query: string): RankedResult {
  const normalizedQuery = query.toLowerCase().trim();
  let bestScore = 0;
  let matchType: 'exact' | 'alias' | 'fuzzy' | 'keyword' = 'fuzzy';
  let matchedAlias: string | undefined;

  // Score drug name match
  const nameScore = calculateSimilarity(query, drug.genericName);
  if (nameScore > bestScore) {
    bestScore = nameScore;
    matchType = nameScore >= SCORE_STARTS_WITH ? 'exact' : 'fuzzy';
  }

  // Score brand name match
  if (drug.brandName) {
    const brandScore = calculateSimilarity(query, drug.brandName);
    if (brandScore > bestScore) {
      bestScore = brandScore;
      matchType = brandScore >= SCORE_STARTS_WITH ? 'exact' : 'alias';
      matchedAlias = drug.brandName;
    }
  }

  // Score aliases match
  if (drug.aliases && drug.aliases.length > 0) {
    const aliasMatch = scoreAliasMatch(query, drug.aliases);
    if (aliasMatch.score > bestScore) {
      bestScore = aliasMatch.score;
      matchType = 'alias';
      matchedAlias = aliasMatch.matchedAlias;
    }
  }

  // Score drug class match
  if (drug.drugClass && Array.isArray(drug.drugClass)) {
    for (const className of drug.drugClass) {
      if (className.toLowerCase().includes(normalizedQuery)) {
        const classScore = SCORE_KEYWORD_MATCH;
        if (classScore > bestScore) {
          bestScore = classScore;
          matchType = 'keyword';
        }
      }
    }
  }

  return {
    item: drug,
    type: 'drug',
    score: bestScore,
    matchType,
    matchedAlias,
  };
}

/**
 * Format a ranked result into a search result
 */
function formatSearchResult(ranked: RankedResult): SearchResult {
  if (ranked.type === 'condition') {
    const condition = ranked.item;
    const title = condition.displayName || condition.name;
    const snippet = `${condition.system}${
      ranked.matchedAlias ? ` • matches "${ranked.matchedAlias}"` : ''
    }`;

    return {
      id: condition.id,
      title,
      type: 'condition',
      snippet,
      matchType: ranked.matchType,
      score: ranked.score,
      metadata: {
        system: condition.system,
        matchedAlias: ranked.matchedAlias,
      },
    };
  } else {
    const drug = ranked.item;
    const title = drug.genericName;
    const drugClassDisplay =
      drug.drugClass && drug.drugClass.length > 0 ? drug.drugClass[0] : 'Drug';
    const snippet = `${drugClassDisplay}${
      ranked.matchedAlias ? ` • matches "${ranked.matchedAlias}"` : ''
    }`;

    return {
      id: drug.id,
      title,
      type: 'drug',
      snippet,
      matchType: ranked.matchType,
      score: ranked.score,
      metadata: {
        drugClass: drugClassDisplay,
        matchedAlias: ranked.matchedAlias,
      },
    };
  }
}

/**
 * Search medical content across conditions and drugs
 */
export async function searchContent(
  prisma: EdgePrismaClient,
  query: string,
  limit = 10,
  includeTypes: ('condition' | 'drug')[] = ['condition', 'drug']
): Promise<SearchResult[]> {
  const sanitizedQuery = sanitizeSearchQuery(query);

  if (!sanitizedQuery || sanitizedQuery.length < 2) {
    return [];
  }

  const results: RankedResult[] = [];
  const seen = new Set<string>();

  try {
    // Search conditions
    if (includeTypes.includes('condition')) {
      const conditions = await prisma.condition.findMany({
        where: {
          status: 'published',
          OR: [
            { name: { contains: sanitizedQuery, mode: 'insensitive' } },
            { displayName: { contains: sanitizedQuery, mode: 'insensitive' } },
            { aliases: { hasSome: [sanitizedQuery, sanitizedQuery.toLowerCase(), sanitizedQuery.toUpperCase()] } },
            { system: { contains: sanitizedQuery, mode: 'insensitive' } },
            { subcategory: { contains: sanitizedQuery, mode: 'insensitive' } },
          ],
        },
        take: limit * 2,
      });

      conditions.forEach((row) => {
        const condition = {
          id: row.id,
          name: row.name,
          displayName: row.displayName ?? undefined,
          aliases: row.aliases,
          system: row.system,
        };
        const ranked = rankCondition(condition, sanitizedQuery);
        if (ranked.score > 0) {
          results.push(ranked);
          seen.add(`condition:${condition.id}`);
        }
      });

      const contentMatches = await prisma.medicalContent.findMany({
        where: {
          status: 'published',
          OR: [
            { condition: { contains: sanitizedQuery, mode: 'insensitive' } },
            { overview: { contains: sanitizedQuery, mode: 'insensitive' } },
            { classic_patient: { contains: sanitizedQuery, mode: 'insensitive' } },
            { symptoms: { contains: sanitizedQuery, mode: 'insensitive' } },
            { diagnostics: { contains: sanitizedQuery, mode: 'insensitive' } },
            { treatment: { contains: sanitizedQuery, mode: 'insensitive' } },
          ],
        },
        select: {
          conditionId: true,
          condition: true,
          canonicalName: true,
          synonyms: true,
          system: true,
          subcategory: true,
        },
        take: limit * 2,
      });

      contentMatches.forEach((row) => {
        const conditionId = row.conditionId;
        if (!conditionId || seen.has(`condition:${conditionId}`)) return;
        const condition = {
          id: conditionId,
          name: row.condition,
          displayName: row.canonicalName ?? undefined,
          aliases: stringArray(row.synonyms),
          system: row.system,
          subcategory: row.subcategory ?? undefined,
        };
        const ranked = rankCondition(condition, sanitizedQuery);
        if (ranked.score > 0) {
          results.push(ranked);
          seen.add(`condition:${conditionId}`);
        }
      });
    }

    // Search drugs
    if (includeTypes.includes('drug')) {
      const drugs = await prisma.drug.findMany({
        where: {
          OR: [
            { genericName: { contains: sanitizedQuery, mode: 'insensitive' } },
            { brandName: { contains: sanitizedQuery, mode: 'insensitive' } },
            { aliases: { hasSome: [sanitizedQuery, sanitizedQuery.toLowerCase(), sanitizedQuery.toUpperCase()] } },
            { drugClass: { hasSome: [sanitizedQuery, sanitizedQuery.toLowerCase(), sanitizedQuery.toUpperCase()] } },
            { displayName: { contains: sanitizedQuery, mode: 'insensitive' } },
            { mechanismOfAction: { contains: sanitizedQuery, mode: 'insensitive' } },
          ],
        },
        take: limit * 2,
      });

      drugs.forEach((row) => {
        const drug = {
          id: row.id,
          genericName: row.genericName,
          brandName: row.brandName ?? undefined,
          aliases: row.aliases,
          drugClass: row.drugClass,
          displayName: row.displayName ?? undefined,
        };
        const ranked = rankDrug(drug, sanitizedQuery);
        if (ranked.score > 0) {
          results.push(ranked);
        }
      });
    }

    // Sort by score and take top results
    results.sort((a, b) => b.score - a.score);
    const topResults = results.slice(0, limit);

    return topResults.map(formatSearchResult);
  } catch (error) {
    console.error('Error searching content:', error);
    throw new Error('Failed to search content');
  }
}
