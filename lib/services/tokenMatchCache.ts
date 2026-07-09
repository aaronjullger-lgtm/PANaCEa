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

export const JACCARD_SIMILARITY_THRESHOLD = 0.85;

const MEDICAL_TERM_NORMALIZATIONS: ReadonlyArray<readonly [string, string]> = [
  ['acute pericarditis', 'pericarditis'],
  ['pericardial inflammation', 'pericarditis'],
  ['pericarditis', 'pericarditis'],
  ['myocardial infarction', 'mi'],
  ['heart attack', 'mi'],
  ['stemi', 'mi'],
  ['nstemi', 'mi'],
  ['mi', 'mi'],
  ['diabetes mellitus', 'diabetes'],
  ['type 2 diabetes', 'diabetes'],
  ['t2dm', 'diabetes'],
  ['diabetes', 'diabetes'],
  ['congestive heart failure', 'chf'],
  ['heart failure', 'chf'],
  ['chf', 'chf'],
  ['chronic obstructive pulmonary disease', 'copd'],
  ['copd', 'copd'],
  ['community acquired pneumonia', 'pneumonia'],
  ['pneumonia', 'pneumonia'],
  ['cap', 'pneumonia'],
];

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function normalizeMedicalTerms(text: string): string {
  let normalized = text.toLowerCase();

  for (const [variant, canonical] of MEDICAL_TERM_NORMALIZATIONS) {
    normalized = normalized.replace(new RegExp(`\\b${escapeRegExp(variant)}\\b`, 'gi'), canonical);
  }

  return normalized;
}

export function tokenizeForCache(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length > 0);
}

export function jaccardSimilarity(tokensA: readonly string[], tokensB: readonly string[]): number {
  const setA = new Set(tokensA);
  const setB = new Set(tokensB);
  const union = new Set([...setA, ...setB]);

  if (union.size === 0) return 0;

  let intersectionSize = 0;
  for (const token of setA) {
    if (setB.has(token)) intersectionSize += 1;
  }

  return intersectionSize / union.size;
}
