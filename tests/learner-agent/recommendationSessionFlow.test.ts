/**
 * Integration-style flow: recommendation → session start (accept path).
 * Covers unauthorized, feature-disabled, and idempotent session start.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockGetNextBestAction = vi.fn();
const mockStartStudySession = vi.fn();
const idemStore = new Map<string, { id: string; status: string; response?: Record<string, unknown> }>();

vi.mock('@/functions/api/_shared/middleware', () => ({
  authenticatedEndpoint: vi.fn((_schema: unknown, handler: unknown) => handler),
  withCors: vi.fn(() => async () => ({})),
  aiEndpoint: vi.fn((_schema: unknown, handler: unknown) => handler),
}));

vi.mock('@/functions/api/_shared/prisma-edge', () => ({
  createEdgePrismaClient: vi.fn(() => ({})),
  safePrismaDisconnect: vi.fn(),
}));

vi.mock('@/functions/api/_shared/user-resolver', () => ({
  resolveOrCreateUserRecord: vi.fn(async () => ({ id: 'internal-user-1' })),
}));

vi.mock('@/functions/api/_shared/submission-idempotency', () => ({
  beginSubmissionIdempotency: vi.fn(async (_prisma: unknown, options: any) => {
    if (!options.idempotencyKey) return null;
    const key = `${options.userId}:${options.endpoint}:${options.idempotencyKey}`;
    const existing = idemStore.get(key);
    if (existing?.status === 'completed') {
      return { state: 'completed', response: existing.response };
    }
    if (existing?.status === 'processing') {
      return { state: 'in_progress', retryAfterSeconds: 5 };
    }
    const id = `idem-${idemStore.size + 1}`;
    idemStore.set(key, { id, status: 'processing' });
    return { state: 'started', id };
  }),
  completeSubmissionIdempotency: vi.fn(async (_prisma: unknown, id: string, response: Record<string, unknown>) => {
    for (const record of idemStore.values()) {
      if (record.id === id) {
        record.status = 'completed';
        record.response = response;
      }
    }
  }),
  failSubmissionIdempotency: vi.fn(),
}));

vi.mock('@/lib/services/learner', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/services/learner')>();
  return {
    ...actual,
    getNextBestAction: (...args: unknown[]) => mockGetNextBestAction(...args),
    startStudySession: (...args: unknown[]) => mockStartStudySession(...args),
  };
});

import { onRequestGet as recommendationGet } from '@/functions/api/learner-agent/recommendation';
import { onRequestPost as sessionPost } from '@/functions/api/learner-agent/session';

const recommendation = {
  id: 'nba:fsrs_overdue:card-1',
  title: 'Clear overdue FSRS reviews',
  rationale: '12 cards overdue',
  launchRoute: '/study',
  launchParams: { mode: 'main' },
  score: 112,
  source: 'fsrs_overdue',
};

function baseContext(overrides: Record<string, unknown> = {}) {
  return {
    env: { ENABLE_LEARNER_AGENT: 'true', DATABASE_URL: 'postgres://test' },
    auth: { userId: 'clerk-user-1' },
    request: new Request('http://localhost/api/learner-agent/recommendation', {
      headers: { 'x-correlation-id': 'corr-test-1' },
    }),
    validated: {},
    ...overrides,
  } as any;
}

describe('learner-agent recommendation → session flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    idemStore.clear();
    mockGetNextBestAction.mockResolvedValue(recommendation);
    mockStartStudySession.mockResolvedValue({
      sessionId: 'ls_abc123',
      objective: recommendation.title,
      recommendedAction: recommendation,
      startedAt: new Date().toISOString(),
      idempotent: false,
    });
  });

  it('returns 404 when feature flag disabled', async () => {
    const res = await recommendationGet(baseContext({ env: {} }));
    expect(res.status).toBe(404);
  });

  it('returns deterministic recommendation for authenticated user', async () => {
    const res = await recommendationGet(
      baseContext({ validated: { availableMinutes: 40, objective: 'surgery' } })
    );
    expect(res.status).toBe(200);
    expect(res.data.recommendation.id).toBe(recommendation.id);
    expect(mockGetNextBestAction).toHaveBeenCalledWith(expect.anything(), {
      userId: 'internal-user-1',
      availableMinutes: 40,
      statedObjective: 'surgery',
    });
  });

  it('starts study session after acceptance with idempotency', async () => {
    const recRes = await recommendationGet(baseContext({ validated: {} }));
    expect(recRes.data.recommendation.title).toBe(recommendation.title);

    const sessionRes = await sessionPost(
      baseContext({
        request: new Request('http://localhost/api/learner-agent/session'),
        validated: {
          body: {
            action: 'start',
            objective: recRes.data.recommendation.title,
            idempotencyKey: 'session-start-key-12345678',
          },
        },
      })
    );

    expect(sessionRes.status).toBe(200);
    expect(sessionRes.data.sessionId).toBe('ls_abc123');
    expect(mockStartStudySession).toHaveBeenCalledWith(
      expect.anything(),
      'internal-user-1',
      recommendation.title,
      { idempotencyKey: 'session-start-key-12345678' }
    );

    const replay = await sessionPost(
      baseContext({
        request: new Request('http://localhost/api/learner-agent/session'),
        validated: {
          body: {
            action: 'start',
            objective: recommendation.title,
            idempotencyKey: 'session-start-key-12345678',
          },
        },
      })
    );
    expect(replay.status).toBe(200);
    expect(mockStartStudySession).toHaveBeenCalledTimes(1);
  });

  it('returns 409 when duplicate session action is in progress', async () => {
    idemStore.set('internal-user-1:learner-agent/session-start:dup-key-12345678', {
      id: 'idem-1',
      status: 'processing',
    });

    const res = await sessionPost(
      baseContext({
        request: new Request('http://localhost/api/learner-agent/session'),
        validated: {
          body: {
            action: 'start',
            objective: 'test',
            idempotencyKey: 'dup-key-12345678',
          },
        },
      })
    );
    expect(res.status).toBe(409);
  });
});
