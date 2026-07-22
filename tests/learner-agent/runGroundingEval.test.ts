/**
 * Evaluation: agent run endpoint wires deterministic tools and grounded context.
 * Mocks Gemini via runAgent to avoid paid API calls while validating integration.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockRunAgent = vi.fn();
const mockGetLearnerContext = vi.fn();
const mockListMemories = vi.fn();

vi.mock('@/functions/api/_shared/middleware', () => ({
  aiEndpoint: vi.fn((_schema: unknown, handler: unknown) => handler),
}));

vi.mock('@/functions/api/_shared/prisma-edge', () => ({
  createEdgePrismaClient: vi.fn(() => ({})),
  safePrismaDisconnect: vi.fn(),
}));

vi.mock('@/functions/api/_shared/user-resolver', () => ({
  resolveOrCreateUserRecord: vi.fn(async () => ({ id: 'internal-user-1' })),
}));

vi.mock('@/lib/services/agents/agentRunner', () => ({
  runAgent: (...args: unknown[]) => mockRunAgent(...args),
}));

vi.mock('@/lib/services/learner', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/services/learner')>();
  return {
    ...actual,
    getLearnerContext: (...args: unknown[]) => mockGetLearnerContext(...args),
    listLearnerMemories: (...args: unknown[]) => mockListMemories(...args),
  };
});

import { onRequestPost as runPost } from '@/functions/api/learner-agent/run';

const nba = {
  id: 'nba:fsrs_overdue:batch',
  title: 'Clear overdue FSRS reviews',
  rationale: '12 cards overdue on surgery rotation',
  launchRoute: '/study',
  launchParams: { mode: 'main' },
  score: 112,
  source: 'fsrs_overdue',
};

describe('learner-agent run grounding eval', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetLearnerContext.mockResolvedValue({
      profile: { currentRotation: 'Surgery', examDate: '2026-06-01' },
      dueItemCounts: { overdueFsrs: 12 },
    });
    mockListMemories.mockResolvedValue({
      confirmed: [
        {
          id: 'mem-1',
          category: 'preference',
          proposed: 'Prefer 25-minute sessions',
          confirmedAt: new Date().toISOString(),
        },
      ],
      pending: [],
    });
    mockRunAgent.mockResolvedValue({
      finalText: `Recommended: ${nba.title}. Rationale: ${nba.rationale} (source: ${nba.source}, score: ${nba.score})`,
      stopReason: 'completed',
      iterations: 2,
      steps: [
        {
          iteration: 1,
          role: 'tool',
          parts: [{ type: 'function_result', name: 'get_next_best_action', ok: true, output: nba }],
        },
      ],
      tokensUsed: { input: 10, output: 20, total: 30 },
      durationMs: 100,
    });
  });

  it('includes Postgres memories and allows canonical_write tools', async () => {
    const res = await runPost({
      env: { ENABLE_LEARNER_AGENT: 'true', DATABASE_URL: 'postgres://test' },
      auth: { userId: 'clerk-1' },
      request: new Request('http://localhost/api/learner-agent/run', {
        headers: { 'x-correlation-id': 'corr-eval-1' },
      }),
      validated: { message: 'What should I study next?', includeSteps: true },
      waitUntil: vi.fn(),
    } as any);

    expect(res.status).toBe(200);
    expect(mockRunAgent).toHaveBeenCalledOnce();

    const config = mockRunAgent.mock.calls[0]![0].config;
    expect(config.allowedTools).toContain('record_attempt');
    expect(config.allowedTools).toContain('get_next_best_action');
    expect(config.allowedCategories).toContain('canonical_write');
    expect(config.systemInstruction).toContain('Prefer 25-minute sessions');
    expect(config.systemInstruction).toContain('Surgery');

    expect(res.data.finalText).toContain(nba.title);
    expect(res.data.finalText).toContain(String(nba.score));
    expect(res.data.steps?.[0]?.parts?.[0]?.name).toBe('get_next_best_action');
  });

  it('returns 404 when feature disabled', async () => {
    const res = await runPost({
      env: {},
      auth: { userId: 'clerk-1' },
      request: new Request('http://localhost/api/learner-agent/run'),
      validated: { message: 'hi' },
      waitUntil: vi.fn(),
    } as any);
    expect(res.status).toBe(404);
    expect(mockRunAgent).not.toHaveBeenCalled();
  });
});
