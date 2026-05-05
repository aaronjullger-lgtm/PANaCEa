import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockPrisma, mockGateway, mockRunCoVePipeline } = vi.hoisted(() => ({
  mockPrisma: {
    stagingQuestion: {
      create: vi.fn(),
      update: vi.fn(),
    },
    question: {
      create: vi.fn(),
    },
  },
  mockGateway: {
    callText: vi.fn(),
  },
  mockRunCoVePipeline: vi.fn(),
}));

vi.mock('../_shared/middleware', () => ({
  aiEndpoint: vi.fn((_schema: unknown, handler: unknown) => handler),
}));

vi.mock('../_shared/prisma-edge', () => ({
  createEdgePrismaClient: vi.fn(() => mockPrisma),
  safePrismaDisconnect: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../_shared/secureLogger', () => ({
  createEndpointLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  })),
}));

vi.mock('../../../lib/ai/aiGateway', () => ({
  gateway: mockGateway,
  toGatewayContext: vi.fn(() => ({ env: {} })),
  GatewayError: class GatewayError extends Error {
    code = 'TEST_GATEWAY_ERROR';
    retryable = false;
  },
}));

vi.mock('../../../lib/cove-verification', () => ({
  runCoVePipeline: mockRunCoVePipeline,
  quickVerify: vi.fn(),
}));

import { onRequestPost } from './generate-enhanced';

function makeContext() {
  return {
    env: { DATABASE_URL: 'postgres://test', GEMINI_API_KEY: 'test-key' },
    auth: { userId: 'clerk-user-1' },
    validated: {
      body: {
        context: 'Overview: Pulmonary embolism. Diagnostics: CT pulmonary angiography.',
        conditionId: 'mc-1',
        conditionName: 'Pulmonary embolism',
        system: 'Pulmonary',
        task: 'Using Diagnostic Studies',
        difficulty: 'same',
      },
    },
  } as never;
}

describe('POST /api/questions/generate-enhanced', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.stagingQuestion.create.mockResolvedValue({});
    mockPrisma.stagingQuestion.update.mockResolvedValue({});
    mockPrisma.question.create.mockResolvedValue({});
    mockRunCoVePipeline.mockResolvedValue({
      passed: true,
      overallConfidence: 0.92,
      verificationId: 'verify-1',
      recommendation: 'accept',
      flags: [],
      summary: 'Verified.',
    });
    mockGateway.callText.mockResolvedValue({
      blocked: false,
      text: JSON.stringify({
        vignette: 'A postoperative patient develops pleuritic chest pain and tachycardia.',
        question: 'Which diagnostic test is most appropriate to confirm the diagnosis?',
        options: ['D-dimer', 'CT pulmonary angiography', 'Chest x-ray', 'Spirometry'],
        correctAnswerIndex: 1,
        rationale: {
          bottomLine: 'CT pulmonary angiography confirms PE in stable patients.',
          whyCorrect: 'The presentation raises concern for PE and the patient is stable.',
          whyIncorrectA: 'D-dimer is less useful when suspicion is high.',
          whyIncorrectC: 'Chest x-ray does not confirm PE.',
          whyIncorrectD: 'Spirometry does not evaluate PE.',
          clinicalPearl: 'Use CTPA for stable patients with high suspicion.',
        },
        pearls: ['CTPA confirms PE in stable high-risk patients.'],
      }),
    });
  });

  it('stores CoVe-passed enhanced questions as production-servable canonical rows', async () => {
    const result = await (onRequestPost as any)(makeContext());

    expect(result).toMatchObject({
      data: {
        success: true,
        verification: {
          verified: true,
          confidence: 0.92,
        },
      },
    });
    expect(mockPrisma.question.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        source: 'enhanced-generation',
        lifecycleStatus: 'ACTIVE',
        qaStatus: 'APPROVED',
        humanReviewed: false,
        verificationScore: 0.92,
        generatedAt: expect.any(Date),
      }),
    });
    expect(mockPrisma.stagingQuestion.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { status: 'approved' },
      })
    );
  });

  it('holds unverified questions for review instead of returning learner-servable output', async () => {
    mockRunCoVePipeline.mockResolvedValue({
      passed: false,
      overallConfidence: 0.6,
      verificationId: 'verify-review',
      recommendation: 'review',
      flags: [
        {
          severity: 'warning',
          code: 'NEEDS_REVIEW',
          message: 'Needs clinical review.',
        },
      ],
      summary: 'Needs review.',
    });

    const result = await (onRequestPost as any)(makeContext());

    expect(result).toMatchObject({
      status: 202,
      data: {
        success: false,
        submissionReady: false,
        requiresApproval: true,
        stagingQuestionId: expect.stringMatching(/^stg-/),
        verification: {
          verified: false,
          confidence: 0.6,
          recommendation: 'review',
        },
      },
    });
    expect(result.data.question).toBeUndefined();
    expect(mockPrisma.question.create).not.toHaveBeenCalled();
    expect(mockPrisma.stagingQuestion.update).not.toHaveBeenCalled();
  });

  it('fails closed when a verified question cannot be persisted live', async () => {
    mockPrisma.question.create.mockRejectedValue(new Error('DB write failed'));

    await expect((onRequestPost as any)(makeContext())).rejects.toThrow(
      'Failed to generate enhanced question'
    );

    expect(mockPrisma.question.create).toHaveBeenCalledTimes(1);
    expect(mockPrisma.stagingQuestion.update).not.toHaveBeenCalled();
  });

  it('fails closed when a verified question cannot be staged for review', async () => {
    mockPrisma.stagingQuestion.create.mockRejectedValue(new Error('staging write failed'));

    await expect((onRequestPost as any)(makeContext())).rejects.toThrow(
      'Failed to generate enhanced question'
    );

    expect(mockPrisma.stagingQuestion.create).toHaveBeenCalledTimes(1);
    expect(mockPrisma.question.create).not.toHaveBeenCalled();
    expect(mockPrisma.stagingQuestion.update).not.toHaveBeenCalled();
  });
});
