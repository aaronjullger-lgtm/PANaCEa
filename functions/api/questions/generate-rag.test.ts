import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockPrisma, mockLogger } = vi.hoisted(() => ({
  mockPrisma: {},
  mockLogger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

const {
  mockRetrieveForQuestionGeneration,
  mockRefineRetrievedContext,
  mockAssessRetrievalQuality,
  mockFormatContextForPrompt,
  mockGenerateQuestions,
  mockCritiqueQuestion,
  mockRewriteQuestion,
  mockShouldRefine,
  mockSaveToStaging,
} = vi.hoisted(() => ({
  mockRetrieveForQuestionGeneration: vi.fn(),
  mockRefineRetrievedContext: vi.fn(),
  mockAssessRetrievalQuality: vi.fn(),
  mockFormatContextForPrompt: vi.fn(),
  mockGenerateQuestions: vi.fn(),
  mockCritiqueQuestion: vi.fn(),
  mockRewriteQuestion: vi.fn(),
  mockShouldRefine: vi.fn(),
  mockSaveToStaging: vi.fn(),
}));

vi.mock('../_shared/middleware', () => ({
  aiEndpoint: vi.fn((_schema: unknown, handler: unknown) => handler),
}));

vi.mock('../_shared/prisma-edge', () => ({
  createEdgePrismaClient: vi.fn(() => mockPrisma),
  safePrismaDisconnect: vi.fn().mockResolvedValue(undefined),
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

vi.mock('../_shared/secureLogger', () => ({
  createEndpointLogger: vi.fn(() => mockLogger),
}));

vi.mock('../../../lib/services/ragContextService', () => ({
  retrieveForQuestionGeneration: mockRetrieveForQuestionGeneration,
  refineRetrievedContext: mockRefineRetrievedContext,
  assessRetrievalQuality: mockAssessRetrievalQuality,
  formatContextForPrompt: mockFormatContextForPrompt,
}));

vi.mock('../../../lib/services/selfRefineService', () => ({
  shouldRefine: mockShouldRefine,
  buildCritiquePrompt: vi.fn(() => 'critique prompt'),
  parseCritiqueResponse: vi.fn(() => ({ overallScore: 1 })),
  buildRewritePrompt: vi.fn(() => 'rewrite prompt'),
  buildRefinementMetrics: vi.fn(() => ({ refined: true })),
}));

vi.mock('../../../lib/langchain/chains/questionGeneration', () => ({
  generateQuestions: mockGenerateQuestions,
  critiqueQuestion: mockCritiqueQuestion,
  rewriteQuestion: mockRewriteQuestion,
}));

vi.mock('../../../lib/langchain/envAdapter', () => ({
  fromCloudflareEnv: vi.fn(() => ({ provider: 'test' })),
}));

vi.mock('../_shared/staging-questions', () => ({
  saveToStaging: mockSaveToStaging,
}));

import { onRequestPost } from './generate-rag';
import { ErrorCode } from '../_shared/error-catalog';

const groundedContext = {
  chunks: [
    {
      sourceId: 'mc-1',
      content: 'Asthma causes reversible obstruction and wheezing.',
      system: 'Pulmonary',
      condition: 'Asthma',
      contentType: 'overview',
      similarity: 0.86,
    },
  ],
  totalTokensEstimate: 64,
  retrievalScores: [0.86],
  isGrounded: true,
};

function makeContext(overrides: Record<string, unknown> = {}) {
  return {
    env: { DATABASE_URL: 'postgres://test', GEMINI_API_KEY: 'test-key' },
    auth: { userId: 'user-1' },
    validated: {
      conditionName: 'Asthma',
      system: 'Pulmonary',
      count: 1,
      questionType: 'vignette',
    },
    ...overrides,
  } as never;
}

function generatedQuestion(overrides: Record<string, unknown> = {}) {
  return {
    question: 'A patient has episodic wheezing. Which test confirms asthma?',
    options: ['Spirometry', 'CT pulmonary angiography', 'Chest x-ray', 'D-dimer'],
    correctAnswer: 'Spirometry',
    explanation: 'Spirometry shows reversible airflow obstruction.',
    difficulty: 'medium',
    ...overrides,
  };
}

describe('POST /api/questions/generate-rag', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRetrieveForQuestionGeneration.mockResolvedValue(groundedContext);
    mockRefineRetrievedContext.mockReturnValue({
      context: groundedContext,
      cragAction: 'CORRECT',
      cautionPrefix: null,
      contentGap: null,
      pipelineMetrics: {
        rawChunks: 1,
        afterRerank: 1,
        afterCRAG: 1,
        rerankDurationMs: 1,
        retrievalConfidence: 0.86,
        cragAction: 'CORRECT',
      },
    });
    mockAssessRetrievalQuality.mockReturnValue({
      grade: 'good',
      message: 'Grounded in approved clinical content.',
    });
    mockFormatContextForPrompt.mockReturnValue('Clinical context');
    mockGenerateQuestions.mockResolvedValue({
      questions: [generatedQuestion()],
      model: 'test-model',
      provider: 'test-provider',
      latencyMs: 12,
      usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
    });
    mockCritiqueQuestion.mockResolvedValue({ output: '{}' });
    mockRewriteQuestion.mockResolvedValue({ output: '{}' });
    mockShouldRefine.mockReturnValue(false);
    mockSaveToStaging.mockResolvedValue({ id: 'staging-rag-1' });
  });

  it('returns only preview questions that were successfully staged for review', async () => {
    const result = await onRequestPost(makeContext());

    expect(result).toMatchObject({
      data: {
        questions: [
          {
            question: 'A patient has episodic wheezing. Which test confirms asthma?',
            submissionReady: false,
            requiresApproval: true,
            metadata: expect.objectContaining({
              stagingQuestionId: 'staging-rag-1',
              persistence: 'staged_for_review',
              submissionReady: false,
              requiresApproval: true,
              groundingSources: ['mc-1'],
              isGrounded: true,
            }),
          },
        ],
        ragMetadata: expect.objectContaining({
          sourceChunkIds: ['mc-1'],
          retrievalQuality: 'good',
          stagingFailureCount: 0,
        }),
      },
    });
    expect(mockSaveToStaging).toHaveBeenCalledWith(
      mockPrisma,
      expect.objectContaining({
        question: 'A patient has episodic wheezing. Which test confirms asthma?',
        system: 'Pulmonary',
        difficulty: 'medium',
        explanation: 'Spirometry shows reversible airflow obstruction.',
      })
    );
  });

  it('fails closed when generated questions cannot be staged', async () => {
    mockSaveToStaging.mockRejectedValue(new Error('Staging write failed'));

    const result = await onRequestPost(makeContext());

    expect(result).toMatchObject({
      status: 502,
      code: ErrorCode.DB_ERROR,
      error: 'Generated questions could not be staged for review.',
      details: {
        generatedCount: 1,
        stagedCount: 0,
        stagingFailures: ['Staging write failed'],
      },
    });
    expect(JSON.stringify(result)).not.toContain('A patient has episodic wheezing');
    expect(mockLogger.error).toHaveBeenCalledWith(
      'RAG generation produced questions but none could be staged',
      expect.objectContaining({
        generatedCount: 1,
        stagingFailureCount: 1,
      })
    );
  });

  it('does not generate or stage questions when CRAG rejects retrieval', async () => {
    mockRefineRetrievedContext.mockReturnValue({
      context: groundedContext,
      cragAction: 'INCORRECT',
      cautionPrefix: null,
      contentGap: null,
      pipelineMetrics: {
        rawChunks: 1,
        afterRerank: 0,
        afterCRAG: 0,
        rerankDurationMs: 1,
        retrievalConfidence: 0.2,
        cragAction: 'INCORRECT',
      },
    });
    mockAssessRetrievalQuality.mockReturnValue({
      grade: 'poor',
      message: 'Insufficient grounding.',
    });

    const result = await onRequestPost(makeContext());

    expect(result).toMatchObject({
      data: {
        questions: [],
        ragMetadata: {
          retrievalQuality: 'poor',
          isGrounded: false,
          cragAction: 'INCORRECT',
        },
      },
    });
    expect(mockGenerateQuestions).not.toHaveBeenCalled();
    expect(mockSaveToStaging).not.toHaveBeenCalled();
  });
});
