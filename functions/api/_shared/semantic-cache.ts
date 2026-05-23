/**
 * Question-generation cache for Cloudflare Edge Functions.
 *
 * Imports pure token-match helpers from lib/services/tokenMatchCache.ts
 * and wraps them with Prisma calls. NOT a true semantic cache — uses
 * Jaccard token overlap, not vector embeddings.
 *
 * Depends on a `semanticCache` table with fields:
 *   queryText, questionType, system, difficulty, cachedQuestion,
 *   lastUsedAt, useCount.
 */

import {
  tokenizeForCache,
  jaccardSimilarity,
  normalizeMedicalTerms,
  JACCARD_SIMILARITY_THRESHOLD,
  type TokenCacheQuery,
  type TokenCacheMatch,
} from '@/lib/services/tokenMatchCache';

export type { TokenCacheQuery as CacheQuery, TokenCacheMatch as CacheMatch };

export async function findSimilarCachedQuestion(
  prisma: any,
  query: TokenCacheQuery,
): Promise<TokenCacheMatch | null> {
  try {
    const normalizedQuery = normalizeMedicalTerms(query.queryText);
    const queryTokens = tokenizeForCache(normalizedQuery);

    const cacheEntries = await prisma.semanticCache.findMany({
      where: {
        questionType: query.questionType,
        ...(query.system && { system: query.system }),
        ...(query.difficulty && { difficulty: query.difficulty }),
      },
      orderBy: { lastUsedAt: 'desc' },
      take: 50,
    });

    let bestMatch: TokenCacheMatch | null = null;
    let highestSimilarity = 0;

    for (const entry of cacheEntries) {
      const normalizedCache = normalizeMedicalTerms(entry.queryText);
      const cacheTokens = tokenizeForCache(normalizedCache);
      const similarity = jaccardSimilarity(queryTokens, cacheTokens);

      if (similarity > highestSimilarity && similarity >= JACCARD_SIMILARITY_THRESHOLD) {
        highestSimilarity = similarity;
        bestMatch = {
          question: entry.cachedQuestion,
          similarity,
          cacheId: entry.id,
        };
      }
    }

    if (bestMatch) {
      await prisma.semanticCache.update({
        where: { id: bestMatch.cacheId },
        data: {
          lastUsedAt: new Date(),
          useCount: { increment: 1 },
        },
      });
    }

    return bestMatch;
  } catch (error) {
    console.error('Error finding cached question:', error);
    return null;
  }
}

export async function cacheGeneratedQuestion(
  prisma: any,
  query: TokenCacheQuery,
  question: any,
): Promise<void> {
  try {
    await prisma.semanticCache.create({
      data: {
        queryText: query.queryText,
        questionType: query.questionType,
        system: query.system,
        difficulty: query.difficulty,
        cachedQuestion: question,
        lastUsedAt: new Date(),
        useCount: 1,
      },
    });
  } catch (error) {
    console.error('Error caching question:', error);
  }
}
