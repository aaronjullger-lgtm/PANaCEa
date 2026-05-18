import { describe, expect, it } from 'vitest';
import {
  buildKnowledgeCacheRetentionDecision,
  isKnowledgeCacheExpired,
  summarizeKnowledgeCacheRetention,
} from '@/lib/services/memory/knowledgeCacheRetention';

describe('knowledge cache retention policy', () => {
  const now = new Date('2026-05-17T12:00:00.000Z');

  it('marks expired caches for external deletion before DB deletion', () => {
    const decision = buildKnowledgeCacheRetentionDecision(
      {
        id: 'cache-1',
        userId: 'user-secret-123',
        geminiCacheName: 'cachedContents/cache-1',
        expiresAt: '2026-05-17T11:59:59.000Z',
      },
      now
    );

    expect(decision.expired).toBe(true);
    expect(decision.action).toBe('delete_external_then_db');
    expect(decision.reason).toBe('cache_expired');
    expect(decision.userIdHash).toMatch(/^u_[a-f0-9]{8}$/);
    expect(decision.userIdHash).not.toContain('user-secret-123');
  });

  it('retains unexpired caches', () => {
    expect(isKnowledgeCacheExpired({ expiresAt: new Date('2026-05-17T12:05:00.000Z') }, now)).toBe(
      false
    );
  });

  it('summarizes retention decisions without raw learner identifiers', () => {
    const summary = summarizeKnowledgeCacheRetention(
      [
        {
          id: 'expired',
          userId: 'learner-a',
          geminiCacheName: 'cachedContents/expired',
          expiresAt: '2026-05-17T10:00:00.000Z',
        },
        {
          id: 'active',
          userId: 'learner-b',
          geminiCacheName: 'cachedContents/active',
          expiresAt: '2026-05-18T10:00:00.000Z',
        },
      ],
      now
    );

    expect(summary.expiredCount).toBe(1);
    expect(summary.retainedCount).toBe(1);
    expect(JSON.stringify(summary)).not.toContain('learner-a');
    expect(JSON.stringify(summary)).not.toContain('learner-b');
  });
});
