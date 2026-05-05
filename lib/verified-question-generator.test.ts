import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  fetchNewQuestion: vi.fn(),
  quickVerify: vi.fn(),
  runCoVePipeline: vi.fn(),
  loggerWarn: vi.fn(),
  loggerError: vi.fn(),
}));

vi.mock('@/services/ai/geminiService', () => ({
  fetchNewQuestion: (...args: unknown[]) => mocks.fetchNewQuestion(...args),
  callGeminiText: vi.fn().mockResolvedValue('verification response'),
}));

vi.mock('./cove-verification', () => ({
  quickVerify: (...args: unknown[]) => mocks.quickVerify(...args),
  runCoVePipeline: (...args: unknown[]) => mocks.runCoVePipeline(...args),
}));

vi.mock('@/lib/simple-logger', () => ({
  logger: {
    scope: vi.fn(() => ({
      warn: (...args: unknown[]) => mocks.loggerWarn(...args),
      error: (...args: unknown[]) => mocks.loggerError(...args),
    })),
  },
}));

vi.mock('@/config/topic-map', () => ({
  GEMINI_FLASH_MODEL: 'gemini-test',
}));

vi.mock('../services/conditionContentService', () => ({
  fetchConditionContent: vi.fn().mockResolvedValue(null),
  hasCompleteContent: vi.fn().mockReturnValue(false),
}));

import { fetchVerifiedQuestion } from './verified-question-generator';

const question = {
  id: 'generated-1',
  question: 'Question?',
  options: ['A', 'B', 'C', 'D'],
  correctAnswerIndex: 0,
  rationale: 'A is correct.',
  condition: 'Pulmonary embolism',
  conditionId: 'mc-1',
  system: 'PULM',
};

describe('fetchVerifiedQuestion', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.fetchNewQuestion.mockResolvedValue(question);
  });

  it('returns a question only when quick verification passes', async () => {
    mocks.quickVerify.mockResolvedValue({
      passed: true,
      confidence: 0.72,
      criticalIssues: [],
    });

    const result = await fetchVerifiedQuestion({
      settings: { focus: 'all' } as never,
      growthAreas: [],
      verificationMode: 'quick',
      maxAttempts: 1,
    });

    expect(result.question).toEqual(question);
    expect(result.verified).toBe(true);
  });

  it('fails closed when quick verification is high confidence but not passed', async () => {
    mocks.quickVerify.mockResolvedValue({
      passed: false,
      confidence: 0.97,
      criticalIssues: ['Answer key mismatch'],
    });

    await expect(
      fetchVerifiedQuestion({
        settings: { focus: 'all' } as never,
        growthAreas: [],
        verificationMode: 'quick',
        maxAttempts: 1,
      })
    ).rejects.toThrow('Generated question failed verification and was not served');
  });
});
