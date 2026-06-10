/**
 * Pure token-match cache helpers (Edge-safe, no Prisma, no Node APIs).
 *
 * Extracted from the deprecated lib/services/semanticCacheService.ts per its
 * 2026-05-22 deprecation note. functions/api/_shared/semantic-cache.ts wraps
 * these with Prisma calls for the Edge runtime. NOT a true semantic cache —
 * Jaccard token overlap, not vector embeddings.
 */

export interface TokenCacheQuery {
  queryText: string;
  questionType: string;
  system?: string;
  difficulty?: string;
}

export interface TokenCacheMatch {
  question: unknown;
  similarity: number;
  cacheId: string;
}

/** Similarity threshold for cache hits (0-1). 0.85 = 85% token overlap. */
export const JACCARD_SIMILARITY_THRESHOLD = 0.85;

/** Lowercase, strip punctuation, split on whitespace. */
export function tokenizeForCache(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 0);
}

/** Jaccard similarity between two token lists (set intersection / union). */
export function jaccardSimilarity(tokens1: string[], tokens2: string[]): number {
  const set1 = new Set(tokens1);
  const set2 = new Set(tokens2);

  const intersection = new Set([...set1].filter((x) => set2.has(x)));
  const union = new Set([...set1, ...set2]);

  if (union.size === 0) return 0;
  return intersection.size / union.size;
}

/**
 * Normalize medical terminology variants to canonical forms so near-identical
 * queries ("heart attack" vs "myocardial infarction") hit the same cache entry.
 */
export function normalizeMedicalTerms(text: string): string {
  const normalizations: Record<string, string> = {
    pericarditis: 'pericarditis',
    'acute pericarditis': 'pericarditis',
    'pericardial inflammation': 'pericarditis',
    'myocardial infarction': 'mi',
    'heart attack': 'mi',
    mi: 'mi',
    stemi: 'mi',
    nstemi: 'mi',
    'diabetes mellitus': 'diabetes',
    diabetes: 'diabetes',
    'type 2 diabetes': 'diabetes',
    t2dm: 'diabetes',
    'congestive heart failure': 'chf',
    'heart failure': 'chf',
    chf: 'chf',
    copd: 'copd',
    'chronic obstructive pulmonary disease': 'copd',
    pneumonia: 'pneumonia',
    'community acquired pneumonia': 'pneumonia',
    cap: 'pneumonia',
  };

  let normalized = text.toLowerCase();

  for (const [variant, canonical] of Object.entries(normalizations)) {
    const regex = new RegExp(`\\b${variant}\\b`, 'gi');
    normalized = normalized.replace(regex, canonical);
  }

  return normalized;
}
