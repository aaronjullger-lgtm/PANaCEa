/**
 * Token-match (Jaccard) question cache utilities.
 *
 * NOT an embedding-backed semantic cache — uses Jaccard token overlap with
 * medical-term normalization. For a true embedding-backed semantic cache,
 * use the pgvector path through ragContextService / MedicalContentEmbedding.
 *
 * Previously duplicated across lib/services/semanticCacheService.ts and
 * functions/api/_shared/semantic-cache.ts. This module is the shared source
 * of truth. Callers in Cloudflare Edge Functions should import only the
 * pure helpers and instantiate Prisma at the call site.
 */

export const JACCARD_SIMILARITY_THRESHOLD = 0.85;

export interface TokenCacheQuery {
  queryText: string;
  questionType: string;
  system?: string;
  difficulty?: string;
}

export interface TokenCacheMatch {
  question: any;
  similarity: number;
  cacheId: string;
}

/**
 * Simple word tokenization for Jaccard comparison.
 * Keeps tokens > 0 chars after stripping punctuation.
 */
export function tokenizeForCache(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 0);
}

/**
 * Jaccard similarity: |intersection| / |union|.
 * Returns 0 when either set is empty.
 */
export function jaccardSimilarity(tokens1: string[], tokens2: string[]): number {
  const set1 = new Set(tokens1);
  const set2 = new Set(tokens2);

  if (set1.size === 0 && set2.size === 0) return 0;

  const intersection = new Set([...set1].filter((x) => set2.has(x)));
  const union = new Set([...set1, ...set2]);

  return union.size > 0 ? intersection.size / union.size : 0;
}

/**
 * Normalize common medical terminology variations to canonical forms.
 * Maps synonyms, abbreviations, and phrasings to reduce cache misses
 * on equivalent queries.
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
