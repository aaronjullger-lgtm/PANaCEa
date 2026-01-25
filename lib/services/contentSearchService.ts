/**
 * Content Search Service
 * Database-driven search with intelligent ranking for medical content
 * Prioritizes: exact matches → alias matches → fuzzy text matches
 */

import { prisma } from '../../lib/prisma';

// Client-safe interfaces (structural typing, no Prisma import)
interface ConditionLike {
  id: string;
  name: string;
  displayName: string | null;
  aliases: string[];
  system: string;
}

interface DrugLike {
  id: string;
  genericName: string;
  brandName: string | null;
  aliases: string[];
  drugClass: string[];
  displayName?: string | null;
}

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
  item: ConditionLike | DrugLike;
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

/**
 * Calculate similarity score between query and target string
 * Uses Levenshtein distance for fuzzy matching
 */
function calculateSimilarity(query: string, target: string): number {
  const normalizedQuery = query.toLowerCase().trim();
  const normalizedTarget = target.toLowerCase().trim();

  // Exact match
  if (normalizedTarget === normalizedQuery) {
    return SCORE_EXACT_MATCH;
  }

  // Starts with
  if (normalizedTarget.startsWith(normalizedQuery)) {
    return SCORE_STARTS_WITH;
  }

  // Contains
  if (normalizedTarget.includes(normalizedQuery)) {
    return SCORE_CONTAINS;
  }

  // Fuzzy matching using simple distance
  const distance = levenshteinDistance(normalizedQuery, normalizedTarget);
  const maxLength = Math.max(normalizedQuery.length, normalizedTarget.length);
  const similarity = 1 - distance / maxLength;

  return similarity > 0.6 ? SCORE_FUZZY * similarity : 0;
}

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(a: string, b: string): number {
  const dp = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));

  for (let i = 0; i <= a.length; i++) dp[i][0] = i;
  for (let j = 0; j <= b.length; j++) dp[0][j] = j;

  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }

  return dp[a.length][b.length];
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

    // Exact alias match
    if (normalizedAlias === normalizedQuery) {
      return { score: SCORE_ALIAS_EXACT, matchedAlias: alias };
    }

    // Alias starts with query
    if (normalizedAlias.startsWith(normalizedQuery)) {
      if (SCORE_ALIAS_STARTS > bestScore) {
        bestScore = SCORE_ALIAS_STARTS;
        matchedAlias = alias;
      }
    }

    // Alias contains query
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
function rankCondition(condition: ConditionLike, query: string): RankedResult {
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

  // Score display name match (if exists)
  if (condition.displayName) {
    const displayScore = calculateSimilarity(query, condition.displayName);
    if (displayScore > bestScore) {
      bestScore = displayScore;
      matchType = displayScore >= SCORE_STARTS_WITH ? 'exact' : 'fuzzy';
    }
  }

  // Score alias matches
  const aliasMatch = scoreAliasMatch(query, condition.aliases);
  if (aliasMatch.score > bestScore) {
    bestScore = aliasMatch.score;
    matchType = 'alias';
    matchedAlias = aliasMatch.matchedAlias;
  }

  // Boost score if system matches query
  if (condition.system.toLowerCase().includes(normalizedQuery)) {
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
function rankDrug(drug: DrugLike, query: string): RankedResult {
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

  // Score brand name match (single brand name)
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

  // Score drug class match (array of classes)
  if (drug.drugClass && drug.drugClass.length > 0) {
    drug.drugClass.forEach((className) => {
      if (className.toLowerCase().includes(normalizedQuery)) {
        const classScore = SCORE_KEYWORD_MATCH;
        if (classScore > bestScore) {
          bestScore = classScore;
          matchType = 'keyword';
        }
      }
    });
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
    const condition = ranked.item as ConditionLike;
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
    const drug = ranked.item as DrugLike;
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
 * @param query - Search query string
 * @param limit - Maximum number of results (default: 10)
 * @param includeTypes - Content types to search (default: both)
 * @returns Array of ranked search results
 */
export async function searchContent(
  query: string,
  limit = 10,
  includeTypes: ('condition' | 'drug')[] = ['condition', 'drug']
): Promise<SearchResult[]> {
  // Sanitize input
  const sanitizedQuery = query.trim();

  if (!sanitizedQuery || sanitizedQuery.length < 2) {
    return [];
  }

  const normalizedQuery = sanitizedQuery.toLowerCase();
  const results: RankedResult[] = [];

  try {
    // Search conditions
    if (includeTypes.includes('condition')) {
      const conditions = await prisma.condition.findMany({
        where: {
          OR: [
            { name: { contains: normalizedQuery, mode: 'insensitive' } },
            { displayName: { contains: normalizedQuery, mode: 'insensitive' } },
            { aliases: { hasSome: [normalizedQuery] } }, // PostgreSQL array contains
            { system: { contains: normalizedQuery, mode: 'insensitive' } },
          ],
        },
        take: limit * 2, // Fetch more for ranking
      });

      // Rank each condition
      conditions.forEach((condition) => {
        const ranked = rankCondition(condition, sanitizedQuery);
        if (ranked.score > 0) {
          results.push(ranked);
        }
      });
    }

    // Search drugs
    if (includeTypes.includes('drug')) {
      const drugs = await prisma.drug.findMany({
        where: {
          OR: [
            { genericName: { contains: normalizedQuery, mode: 'insensitive' } },
            { brandName: { contains: normalizedQuery, mode: 'insensitive' } },
            { aliases: { hasSome: [normalizedQuery] } },
            { drugClass: { hasSome: [normalizedQuery] } },
            { displayName: { contains: normalizedQuery, mode: 'insensitive' } },
          ],
        },
        take: limit * 2, // Fetch more for ranking
      });

      // Rank each drug
      drugs.forEach((drug) => {
        const ranked = rankDrug(drug, sanitizedQuery);
        if (ranked.score > 0) {
          results.push(ranked);
        }
      });
    }

    // Sort by score (highest first) and take top results
    results.sort((a, b) => b.score - a.score);
    const topResults = results.slice(0, limit);

    // Format results
    return topResults.map(formatSearchResult);
  } catch (error) {
    console.error('Error searching content:', error);
    throw new Error('Failed to search content');
  }
}

/**
 * Search only conditions (convenience wrapper)
 */
export async function searchConditions(query: string, limit = 10): Promise<SearchResult[]> {
  return searchContent(query, limit, ['condition']);
}

/**
 * Search only drugs (convenience wrapper)
 */
export async function searchDrugs(query: string, limit = 10): Promise<SearchResult[]> {
  return searchContent(query, limit, ['drug']);
}

/**
 * Get search statistics (for debugging/analytics)
 */
export async function getSearchStats() {
  const [conditionCount, drugCount] = await Promise.all([
    prisma.condition.count(),
    prisma.drug.count(),
  ]);

  return {
    totalConditions: conditionCount,
    totalDrugs: drugCount,
    totalSearchable: conditionCount + drugCount,
  };
}
