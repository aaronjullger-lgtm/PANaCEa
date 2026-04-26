import { beforeEach, describe, expect, it, vi } from 'vitest';

const _capture = vi.hoisted(() => ({
  handler: null as ((context: any) => Promise<any>) | null,
}));

const mockPrisma: any = {};

vi.mock('../_shared/middleware', () => ({
  aiEndpoint: vi.fn((_schema: unknown, handler: any) => {
    _capture.handler = handler;
    return handler;
  }),
}));

vi.mock('../_shared/prisma-edge', () => ({
  createEdgePrismaClient: vi.fn(() => mockPrisma),
  safePrismaDisconnect: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../lib/services/ragContextService', () => ({
  retrieveForExplanation: vi.fn().mockResolvedValue({
    chunks: [{ sourceId: 'source-1' }],
    retrievalScores: [0.8],
    isGrounded: true,
  }),
  formatContextForPrompt: vi.fn(() => 'Clinical context'),
  assessRetrievalQuality: vi.fn(() => ({ grade: 'good', message: 'Grounded' })),
}));

import './explain-rag';

function makeContext() {
  return {
    env: {
      DATABASE_URL: 'postgresql://test',
      CLERK_SECRET_KEY: 'sk_test_123',
      GEMINI_API_KEY: 'gemini-key',
    },
    auth: { userId: 'clerk_user_1' },
    validated: {
      questionId: 'q-1',
      questionText: 'Question text',
      selectedAnswer: 'A',
      correctAnswer: 'B',
      system: 'Cardiovascular',
      allOptions: ['A', 'B', 'C', 'D'],
    },
  };
}

describe('POST /api/questions/explain-rag', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it('returns a safe fallback explanation when the AI provider fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response('provider unavailable', { status: 503 }),
      ),
    );

    const result = await _capture.handler!(makeContext());

    expect(result.data.fallback).toBe(true);
    expect(result.data.explanation.whyCorrect).toContain('B');
    expect(result.data.explanation.whyWrong).toContain('A');
    expect(result.data.ragMetadata.retrievalMessage).toContain('temporarily unavailable');
    expect(result.status).toBeUndefined();
    expect(result.error).toBeUndefined();
  });
});
