/**
 * Semantic caching service for AI-generated questions
 * Recognizes semantically similar queries and serves cached content
 * Reduces LLM API costs by avoiding duplicate generations
 */

interface CacheQuery {
  queryText: string;
  questionType: string;
  system?: string;
  difficulty?: string;
}

interface CacheMatch {
  question: any;
  similarity: number;
  cacheId: string;
}

/**
 * Similarity threshold for cache hits (0-1)
 * 0.85 means 85% similar - adjust based on testing
 */
const SIMILARITY_THRESHOLD = 0.85;

/**
 * Simple tokenization for similarity matching
 * In production, use proper embeddings (OpenAI, Sentence Transformers, etc.)
 */
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 0);
}

/**
 * Calculate Jaccard similarity between two sets of tokens
 * This is a simple approach - in production use vector embeddings
 */
function calculateSimilarity(tokens1: string[], tokens2: string[]): number {
  const set1 = new Set(tokens1);
  const set2 = new Set(tokens2);
  
  const intersection = new Set([...set1].filter(x => set2.has(x)));
  const union = new Set([...set1, ...set2]);
  
  if (union.size === 0) return 0;
  return intersection.size / union.size;
}

/**
 * Normalize medical terminology for better matching
 * Maps common variations to canonical forms
 */
function normalizeMedicalTerms(text: string): string {
  const normalizations: Record<string, string> = {
    'pericarditis': 'pericarditis',
    'acute pericarditis': 'pericarditis',
    'pericardial inflammation': 'pericarditis',
    'myocardial infarction': 'mi',
    'heart attack': 'mi',
    'mi': 'mi',
    'stemi': 'mi',
    'nstemi': 'mi',
    'diabetes mellitus': 'diabetes',
    'diabetes': 'diabetes',
    'type 2 diabetes': 'diabetes',
    't2dm': 'diabetes',
    'congestive heart failure': 'chf',
    'heart failure': 'chf',
    'chf': 'chf',
    'copd': 'copd',
    'chronic obstructive pulmonary disease': 'copd',
    'pneumonia': 'pneumonia',
    'community acquired pneumonia': 'pneumonia',
    'cap': 'pneumonia',
  };
  
  let normalized = text.toLowerCase();
  
  // Apply normalizations
  for (const [variant, canonical] of Object.entries(normalizations)) {
    const regex = new RegExp(`\\b${variant}\\b`, 'gi');
    normalized = normalized.replace(regex, canonical);
  }
  
  return normalized;
}

/**
 * Find semantically similar cached questions
 * Returns matches above similarity threshold
 */
export async function findSimilarCachedQuestion(
  query: CacheQuery
): Promise<CacheMatch | null> {
  try {
    // For development without database
    if (!process.env.DATABASE_URL) {
      console.log('[SemanticCache] Database not configured, skipping cache lookup');
      return null;
    }
    
    const { prisma } = await import('../prisma');
    
    // Normalize and tokenize query
    const normalizedQuery = normalizeMedicalTerms(query.queryText);
    const queryTokens = tokenize(normalizedQuery);
    
    // Fetch recent cache entries of same type
    const cacheEntries = await prisma.semanticCache.findMany({
      where: {
        questionType: query.questionType,
        ...(query.system && { system: query.system }),
        ...(query.difficulty && { difficulty: query.difficulty }),
      },
      orderBy: {
        lastUsedAt: 'desc',
      },
      take: 50, // Check last 50 entries
    });
    
    let bestMatch: CacheMatch | null = null;
    let highestSimilarity = 0;
    
    // Calculate similarity for each cached entry
    for (const entry of cacheEntries) {
      const normalizedCache = normalizeMedicalTerms(entry.queryText);
      const cacheTokens = tokenize(normalizedCache);
      
      const similarity = calculateSimilarity(queryTokens, cacheTokens);
      
      if (similarity > highestSimilarity && similarity >= SIMILARITY_THRESHOLD) {
        highestSimilarity = similarity;
        bestMatch = {
          question: entry.cachedQuestion,
          similarity,
          cacheId: entry.id,
        };
      }
    }
    
    if (bestMatch) {
      // Update usage stats
      await prisma.semanticCache.update({
        where: { id: bestMatch.cacheId },
        data: {
          lastUsedAt: new Date(),
          useCount: { increment: 1 },
        },
      });
      
      console.log(`[SemanticCache] Cache HIT - similarity: ${(highestSimilarity * 100).toFixed(1)}%`);
    } else {
      console.log('[SemanticCache] Cache MISS');
    }
    
    return bestMatch;
  } catch (error) {
    console.error('[SemanticCache] Error finding cached question:', error);
    return null;
  }
}

/**
 * Store a newly generated question in the cache
 */
export async function cacheGeneratedQuestion(
  query: CacheQuery,
  question: any,
  qualityScore?: number
): Promise<void> {
  try {
    // For development without database
    if (!process.env.DATABASE_URL) {
      console.log('[SemanticCache] Database not configured, skipping cache storage');
      return;
    }
    
    const { prisma } = await import('../prisma');
    
    // Store normalized query for better future matches
    const normalizedQuery = normalizeMedicalTerms(query.queryText);
    
    await prisma.semanticCache.create({
      data: {
        queryText: normalizedQuery,
        questionType: query.questionType,
        system: query.system || null,
        difficulty: query.difficulty || null,
        cachedQuestion: question,
        qualityScore: qualityScore || 0,
      },
    });
    
    console.log('[SemanticCache] Question cached successfully');
  } catch (error) {
    console.error('[SemanticCache] Error caching question:', error);
    // Don't throw - caching failures shouldn't break question generation
  }
}

/**
 * Get cache statistics for monitoring
 */
export async function getCacheStats(): Promise<{
  totalEntries: number;
  totalHits: number;
  avgQualityScore: number;
  topConditions: Array<{ system: string; count: number }>;
}> {
  try {
    if (!process.env.DATABASE_URL) {
      return {
        totalEntries: 0,
        totalHits: 0,
        avgQualityScore: 0,
        topConditions: [],
      };
    }
    
    const { prisma } = await import('../prisma');
    
    const entries = await prisma.semanticCache.findMany({
      select: {
        system: true,
        useCount: true,
        qualityScore: true,
      },
    });
    
    const totalEntries = entries.length;
    const totalHits = entries.reduce((sum, e) => sum + e.useCount - 1, 0); // Subtract 1 for initial creation
    const avgQualityScore = entries.length > 0
      ? entries.reduce((sum, e) => sum + e.qualityScore, 0) / entries.length
      : 0;
    
    // Count by system
    const systemCounts = entries.reduce((acc, e) => {
      if (e.system) {
        acc[e.system] = (acc[e.system] || 0) + 1;
      }
      return acc;
    }, {} as Record<string, number>);
    
    const topConditions = Object.entries(systemCounts)
      .map(([system, count]) => ({ system, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
    
    return {
      totalEntries,
      totalHits,
      avgQualityScore,
      topConditions,
    };
  } catch (error) {
    console.error('[SemanticCache] Error getting cache stats:', error);
    return {
      totalEntries: 0,
      totalHits: 0,
      avgQualityScore: 0,
      topConditions: [],
    };
  }
}

/**
 * Clean up old cache entries
 * Run periodically to prevent cache from growing indefinitely
 */
export async function pruneCache(
  maxAge: number = 90, // days
  minQualityScore: number = 3 // 0-10 scale
): Promise<number> {
  try {
    if (!process.env.DATABASE_URL) {
      return 0;
    }
    
    const { prisma } = await import('../prisma');
    
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - maxAge);
    
    const result = await prisma.semanticCache.deleteMany({
      where: {
        OR: [
          { lastUsedAt: { lt: cutoffDate } },
          { qualityScore: { lt: minQualityScore } },
        ],
      },
    });
    
    console.log(`[SemanticCache] Pruned ${result.count} old cache entries`);
    return result.count;
  } catch (error) {
    console.error('[SemanticCache] Error pruning cache:', error);
    return 0;
  }
}
