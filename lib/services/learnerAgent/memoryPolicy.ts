/**
 * Learner Agent memory policy — explicit proposal, confirmation, and governance.
 */

export type MemoryCategory =
  | 'preference'
  | 'goal'
  | 'difficulty'
  | 'schedule'
  | 'rotation_note';

export type MemorySource = 'learner_stated' | 'tool_derived' | 'inferred';

export type MemoryExpirationPolicy = 'session' | '30d' | 'until_exam' | 'manual';

export interface MemoryCandidate {
  id: string;
  proposed: string;
  category: MemoryCategory;
  source: MemorySource;
  timestamp: string;
  confidence: number;
  expirationPolicy: MemoryExpirationPolicy;
  userVisible: boolean;
  requiresConfirmation: boolean;
}

export interface StoredLearnerMemory extends MemoryCandidate {
  confirmedAt: string;
  correctedFrom?: string;
}

const SENSITIVE_PATTERNS = [
  /\b\d{3}-\d{2}-\d{4}\b/, // SSN-like
  /\bmrn\b/i,
  /\bpatient\s+name\b/i,
];

const HIGH_IMPACT_CATEGORIES: MemoryCategory[] = ['schedule', 'goal'];

export function requiresConfirmation(
  category: MemoryCategory,
  source: MemorySource,
  proposed: string,
  confidence: number
): boolean {
  if (source === 'inferred' && confidence < 0.85) return true;
  if (HIGH_IMPACT_CATEGORIES.includes(category)) return true;
  if (SENSITIVE_PATTERNS.some((p) => p.test(proposed))) return true;
  return false;
}

export function proposeMemory(input: {
  proposed: string;
  category: MemoryCategory;
  source: MemorySource;
  confidence?: number;
  expirationPolicy?: MemoryExpirationPolicy;
}): MemoryCandidate {
  const confidence = input.confidence ?? (input.source === 'learner_stated' ? 1 : 0.7);
  const needsConfirm = requiresConfirmation(
    input.category,
    input.source,
    input.proposed,
    confidence
  );

  return {
    id: `mem_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    proposed: sanitizeMemoryText(input.proposed),
    category: input.category,
    source: input.source,
    timestamp: new Date().toISOString(),
    confidence,
    expirationPolicy: input.expirationPolicy ?? '30d',
    userVisible: true,
    requiresConfirmation: needsConfirm,
  };
}

export function confirmMemory(candidate: MemoryCandidate): StoredLearnerMemory {
  if (candidate.requiresConfirmation && candidate.source === 'inferred') {
    throw new Error('MEMORY_REQUIRES_EXPLICIT_CONFIRMATION');
  }
  return {
    ...candidate,
    confirmedAt: new Date().toISOString(),
  };
}

export function correctMemory(
  existing: StoredLearnerMemory,
  correctedText: string
): StoredLearnerMemory {
  return {
    ...existing,
    proposed: sanitizeMemoryText(correctedText),
    correctedFrom: existing.proposed,
    timestamp: new Date().toISOString(),
    source: 'learner_stated',
    confidence: 1,
    requiresConfirmation: false,
  };
}

export function sanitizeMemoryText(text: string): string {
  let out = text.trim().slice(0, 500);
  for (const pattern of SENSITIVE_PATTERNS) {
    out = out.replace(pattern, '[REDACTED]');
  }
  return out;
}

export function isCategoryEnabled(
  disabledCategories: MemoryCategory[],
  category: MemoryCategory
): boolean {
  return !disabledCategories.includes(category);
}

export const KV_MEMORY_PREFIX = 'learner-memory:';

export function memoryKvKey(userId: string): string {
  return `${KV_MEMORY_PREFIX}${userId}`;
}
