import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockPrisma = {
  stagingQuestion: { findFirst: vi.fn(), create: vi.fn() },
  textbookChunk: { findMany: vi.fn() },
  medicalContent: { findUnique: vi.fn(), update: vi.fn() },
};
const mockFindSimilarCachedQuestion = vi.fn();
const mockCacheGeneratedQuestion = vi.fn();
const mockLoadConditionData = vi.fn();
const mockGenerateSingleQuestion = vi.fn();

vi.mock('../_shared/middleware', () => ({
  aiEndpoint: vi.fn((_schema: unknown, handler: any) => handler),
}));

vi.mock('../_shared/prisma-edge', () => ({
  createEdgePrismaClient: vi.fn(() => mockPrisma),
  safePrismaDisconnect: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../_shared/semantic-cache', () => ({
  findSimilarCachedQuestion: (...args: unknown[]) => mockFindSimilarCachedQuestion(...args),
  cacheGeneratedQuestion: (...args: unknown[]) => mockCacheGeneratedQuestion(...args),
}));

vi.mock('../_shared/condition-loader', () => ({
  loadConditionData: (...args: unknown[]) => mockLoadConditionData(...args),
}));

vi.mock('../_shared/question-generator', () => ({
  generateSingleQuestion: (...args: unknown[]) => mockGenerateSingleQuestion(...args),
}));

vi.mock('../_shared/env-validation', async () => {
  const actual = await vi.importActual<typeof import('../_shared/env-validation')>(
    '../_shared/env-validation'
  );
  return {
    ...actual,
    validateFunctionEnv: vi.fn(),
  };
});

vi.mock('../../../lib/ai/aiGateway', () => ({
  toGatewayContext: vi.fn(() => ({ env: {} })),
}));

vi.mock('@/lib/services/medical-apis/rxnorm', () => ({
  validateQuestionDrugs: vi.fn().mockResolvedValue({
    allValid: true,
    results: [],
    interactions: { hasInteractions: false },
  }),
}));

vi.mock('../_shared/secureLogger', () => ({
  createEndpointLogger: vi.fn(() => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  })),
}));

import { onRequestPost } from './generate';
import { ErrorCode } from '../_shared/error-catalog';

function context(overrides: Record<string, unknown> = {}) {
  return {
    env: { DATABASE_URL: 'postgres://test', GEMINI_API_KEY: 'test-key' },
    auth: { userId: 'user-1' },
    validated: {
      queryText: 'Pulmonary embolism',
      questionType: 'mcq',
      system: 'Pulmonary',
      difficulty: 'medium',
    },
    ...overrides,
  } as never;
}

describe('POST /api/questions/generate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFindSimilarCachedQuestion.mockResolvedValue(null);
    mockPrisma.stagingQuestion.findFirst.mockResolvedValue(null);
    mockPrisma.stagingQuestion.create.mockImplementation((args: any) =>
      Promise.resolve({ id: 'staging-1', ...args.data })
    );
    mockPrisma.textbookChunk.findMany.mockResolvedValue([]);
    mockPrisma.medicalContent.findUnique.mockResolvedValue({
      content: { pearls: [] },
    });
    mockPrisma.medicalContent.update.mockResolvedValue({});
  });

  it('fails closed when the requested condition cannot be resolved', async () => {
    mockLoadConditionData.mockResolvedValue(null);

    const result = await onRequestPost(context());

    expect(result).toMatchObject({
      status: 404,
      code: ErrorCode.NOT_FOUND,
      error: 'No approved clinical source was found for that topic.',
    });
    expect(mockGenerateSingleQuestion).not.toHaveBeenCalled();
    expect(mockCacheGeneratedQuestion).not.toHaveBeenCalled();
  });

  it('does not return placeholder questions when generation fails', async () => {
    mockLoadConditionData.mockResolvedValue({
      id: 'content-1',
      name: 'Pulmonary embolism',
      system: 'Pulmonary',
      content: {},
    });
    mockGenerateSingleQuestion.mockResolvedValue(null);

    const result = await onRequestPost(context());

    expect(result).toMatchObject({
      status: 502,
      code: ErrorCode.GEMINI_ERROR,
      error: 'Question generation failed. No learner-facing question was created.',
    });
    expect(JSON.stringify(result)).not.toContain('Option A');
    expect(JSON.stringify(result)).not.toContain('Unable to generate question');
    expect(mockCacheGeneratedQuestion).not.toHaveBeenCalled();
  });

  it('marks cached generated questions as preview-only', async () => {
    mockFindSimilarCachedQuestion.mockResolvedValue({
      similarity: 0.94,
      question: {
        id: 'cached-legacy-question',
        text: 'Cached legacy generated question',
        metadata: { legacy: true },
      },
    });

    const result = await onRequestPost(context());

    expect(result).toMatchObject({
      data: {
        success: true,
        cached: true,
        similarity: 0.94,
        question: {
          id: 'cached-legacy-question',
          submissionReady: false,
          requiresApproval: true,
          metadata: {
            legacy: true,
            cached: true,
            fromCache: true,
            submissionReady: false,
            requiresApproval: true,
          },
        },
      },
    });
    expect(mockLoadConditionData).not.toHaveBeenCalled();
    expect(mockGenerateSingleQuestion).not.toHaveBeenCalled();
    expect(mockCacheGeneratedQuestion).not.toHaveBeenCalled();
  });

  it('returns and caches only successfully generated questions', async () => {
    mockLoadConditionData.mockResolvedValue({
      id: 'content-1',
      conditionId: 'cond-1',
      name: 'Pulmonary embolism',
      system: 'Pulmonary',
      content: {
        overview: 'VTE condition',
        treatment: ['Anticoagulation'],
      },
    });
    mockGenerateSingleQuestion.mockResolvedValue({
      id: 'generated-1',
      text: 'A postoperative patient develops acute dyspnea. What is the next best test?',
      options: ['CT pulmonary angiography', 'Chest x-ray', 'Peak flow', 'D-dimer only'],
      correctAnswer: 'CT pulmonary angiography',
      explanation: { rationale: 'Clinical Pearl: Match pretest probability to testing.' },
    });

    const result = await onRequestPost(context());

    expect(result).toMatchObject({
      data: {
        success: true,
        question: {
          id: 'generated-1',
          system: 'Pulmonary',
          difficulty: 'medium',
          submissionReady: false,
          requiresApproval: true,
          metadata: expect.objectContaining({
            stagingQuestionId: expect.any(String),
            persistence: 'staged_for_review',
            medicalContentId: 'content-1',
            conditionId: 'cond-1',
          }),
        },
        cached: false,
      },
    });
    expect(mockCacheGeneratedQuestion).toHaveBeenCalledOnce();
    expect(mockPrisma.stagingQuestion.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          question: 'A postoperative patient develops acute dyspnea. What is the next best test?',
          correctAnswer: 'CT pulmonary angiography',
          system: 'Pulmonary',
          tags: expect.arrayContaining([
            'condition:cond-1',
            'medicalContent:content-1',
            'conditionName:Pulmonary embolism',
            'source:learner_question_generate_endpoint',
          ]),
        }),
      })
    );
  });

  it('fails closed when a newly generated question cannot be staged', async () => {
    mockLoadConditionData.mockResolvedValue({
      id: 'content-1',
      conditionId: 'cond-1',
      name: 'Pulmonary embolism',
      system: 'Pulmonary',
      content: {
        overview: 'VTE condition',
        treatment: ['Anticoagulation'],
      },
    });
    mockGenerateSingleQuestion.mockResolvedValue({
      id: 'generated-1',
      text: 'A postoperative patient develops acute dyspnea. What is the next best test?',
      options: ['CT pulmonary angiography', 'Chest x-ray', 'Peak flow', 'D-dimer only'],
      correctAnswer: 'CT pulmonary angiography',
      explanation: { rationale: 'Clinical Pearl: Match pretest probability to testing.' },
    });
    mockPrisma.stagingQuestion.create.mockRejectedValueOnce(new Error('staging unavailable'));

    const result = await onRequestPost(context());

    expect(result).toMatchObject({
      status: 502,
      code: ErrorCode.DB_ERROR,
      error: 'Generated question could not be staged for review.',
      details: {
        questionType: 'mcq',
        system: 'Pulmonary',
        difficulty: 'medium',
      },
    });
    expect(JSON.stringify(result)).not.toContain('A postoperative patient develops acute dyspnea');
    expect(mockCacheGeneratedQuestion).not.toHaveBeenCalled();
  });
});
