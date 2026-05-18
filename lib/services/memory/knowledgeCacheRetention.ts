export interface KnowledgeCacheRetentionRecord {
  id: string;
  userId: string;
  geminiCacheName: string;
  expiresAt: Date | string;
  source?: string | null;
}

export interface KnowledgeCacheRetentionDecision {
  cacheId: string;
  userIdHash: string;
  geminiCacheName: string;
  expired: boolean;
  action: 'retain' | 'delete_external_then_db';
  reason: string;
}

function parseExpiry(expiresAt: Date | string): Date {
  const date = expiresAt instanceof Date ? expiresAt : new Date(expiresAt);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid KnowledgeCache expiresAt: ${String(expiresAt)}`);
  }
  return date;
}

function redactedUserHash(userId: string): string {
  let hash = 2166136261;
  for (let index = 0; index < userId.length; index += 1) {
    hash ^= userId.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `u_${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

export function isKnowledgeCacheExpired(
  cache: Pick<KnowledgeCacheRetentionRecord, 'expiresAt'>,
  now: Date = new Date()
): boolean {
  return parseExpiry(cache.expiresAt).getTime() <= now.getTime();
}

export function buildKnowledgeCacheRetentionDecision(
  cache: KnowledgeCacheRetentionRecord,
  now: Date = new Date()
): KnowledgeCacheRetentionDecision {
  const expired = isKnowledgeCacheExpired(cache, now);
  return {
    cacheId: cache.id,
    userIdHash: redactedUserHash(cache.userId),
    geminiCacheName: cache.geminiCacheName,
    expired,
    action: expired ? 'delete_external_then_db' : 'retain',
    reason: expired ? 'cache_expired' : 'cache_not_expired',
  };
}

export function summarizeKnowledgeCacheRetention(
  caches: KnowledgeCacheRetentionRecord[],
  now: Date = new Date()
): { decisions: KnowledgeCacheRetentionDecision[]; expiredCount: number; retainedCount: number } {
  const decisions = caches.map((cache) => buildKnowledgeCacheRetentionDecision(cache, now));
  return {
    decisions,
    expiredCount: decisions.filter((decision) => decision.expired).length,
    retainedCount: decisions.filter((decision) => !decision.expired).length,
  };
}
