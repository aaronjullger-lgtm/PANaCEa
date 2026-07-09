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

const MEDICAL_TERM_NORMALIZATIONS: Record<string, string> = {
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

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function normalizeMedicalTerms(text: string): string {
  let normalized = text.toLowerCase();

  for (const [variant, canonical] of Object.entries(MEDICAL_TERM_NORMALIZATIONS)) {
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

export function jaccardSimilarity(tokens1: string[], tokens2: string[]): number {
  const set1 = new Set(tokens1);
  const set2 = new Set(tokens2);
  const union = new Set([...set1, ...set2]);

  if (union.size === 0) return 0;

  let intersectionSize = 0;
  for (const token of set1) {
    if (set2.has(token)) intersectionSize += 1;
  }

  return intersectionSize / union.size;
}
