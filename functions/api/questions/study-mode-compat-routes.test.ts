import { beforeEach, describe, expect, it, vi } from 'vitest';

const _capture = vi.hoisted(() => ({
  handlers: [] as Array<(context: any) => Promise<any>>,
}));

const _logger = vi.hoisted(() => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}));

const mockPrisma: any = {
  question: {
    findMany: vi.fn(),
  },
};

vi.mock('../_shared/middleware', () => ({
  authenticatedEndpoint: vi.fn((_schema: unknown, handler: any) => {
    _capture.handlers.push(handler);
    return handler;
  }),
}));

vi.mock('../_shared/prisma-edge', () => ({
  createEdgePrismaClient: vi.fn(() => mockPrisma),
  safePrismaDisconnect: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../_shared/secureLogger', () => ({
  createEndpointLogger: vi.fn(() => _logger),
}));

import './system-drill';
import './condition-drill';
import './pharmacology-drill';

function makeContext(body: Record<string, unknown>) {
  return {
    env: { DATABASE_URL: 'postgresql://test' },
    auth: { userId: 'clerk_user_1' },
    validated: { body },
  };
}

function makeQuestion(overrides: Record<string, unknown> = {}) {
  return {
    id: 'q-1',
    question: 'What is the best next step?',
    vignette: 'A patient presents for care.',
    options: ['A option', 'B option', 'C option', 'D option'],
    correctAnswer: 'B',
    explanation: 'B is correct.',
    conditionId: 'cond-1',
    system: 'Pulmonary',
    category: 'Respiratory',
    topic: 'Pneumonia',
    difficulty: 'medium',
    tags: ['pharmacology'],
    relatedDrugs: ['amoxicillin'],
    Condition: { name: 'Pneumonia', subcategory: 'Infectious' },
    ...overrides,
  };
}

describe('study-mode compatibility question routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.question.findMany.mockResolvedValue([makeQuestion()]);
  });

  it('gates system drill questions to active approved content and points callers to canonical sessions', async () => {
    const handler = _capture.handlers[0]!;
    const result = await handler(makeContext({ system: 'Pulmonary' }));

    expect(mockPrisma.question.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          system: 'Pulmonary',
          lifecycleStatus: 'ACTIVE',
          qaStatus: 'APPROVED',
        }),
      })
    );
    expect(result.data.metadata).toMatchObject({
      deprecated: true,
      replacement: '/api/study/session/generate',
      canonicalRequest: { mode: 'system', system: 'Pulmonary' },
    });
  });

  it('gates condition drill questions and supports real conditionId scope', async () => {
    const handler = _capture.handlers[1]!;
    const result = await handler(makeContext({ conditionId: 'cond-1', count: 2 }));

    expect(mockPrisma.question.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          conditionId: 'cond-1',
          lifecycleStatus: 'ACTIVE',
          qaStatus: 'APPROVED',
        }),
      })
    );
    expect(result.data.questions).toHaveLength(1);
    expect(result.data.metadata.canonicalRequest).toMatchObject({
      mode: 'condition',
      conditionId: 'cond-1',
      sessionLane: 'drill',
    });
  });

  it('gates pharmacology compatibility questions to active approved content', async () => {
    const handler = _capture.handlers[2]!;
    const result = await handler(makeContext({ drugClass: 'beta lactam' }));

    expect(mockPrisma.question.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          lifecycleStatus: 'ACTIVE',
          qaStatus: 'APPROVED',
        }),
      })
    );
    expect(result.data.metadata).toMatchObject({
      deprecated: true,
      replacement: '/api/study/session/generate',
    });
  });
});
