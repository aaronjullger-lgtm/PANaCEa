/**
 * Quality gate tests — the shared Dev↔QA loop.
 *
 * Covers the deterministic core (`runQualityGate`: PASS / retry+improve /
 * quarantine, retry budget clamp, validator-exception safety) and the
 * LLM-backed validator factory (`createLLMValidator` / `createClinicalContentValidator`)
 * against a mocked AI gateway.
 *
 * @module tests/agents-quality-gate
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

import {
  runQualityGate,
  noOpQualityGate,
  clampRetries,
  MAX_GATE_RETRIES,
  type GateValidator,
  type GateVerdict,
} from '@/lib/agents/quality/qualityGate';
import {
  createLLMValidator,
  createClinicalContentValidator,
  CLINICAL_CONTENT_CRITERIA,
} from '@/lib/agents/quality/llmValidator';

// ─── Gateway mock ───────────────────────────────────────────────────────────

const mocks = vi.hoisted(() => ({
  callStructured: vi.fn(),
  toGatewayContext: vi.fn((x: unknown) => x),
  GatewayError: class GatewayError extends Error {
    code: string;
    retryable: boolean;
    constructor(code: string, message: string, retryable = true) {
      super(message);
      this.code = code;
      this.retryable = retryable;
    }
  },
}));

vi.mock('@/lib/ai/aiGateway', () => ({
  gateway: { callStructured: mocks.callStructured },
  toGatewayContext: mocks.toGatewayContext,
  GatewayError: mocks.GatewayError,
}));

// ─── Fixtures ───────────────────────────────────────────────────────────────

interface FakeQuestion {
  vignette: string;
  correctAnswerIndex: number;
  options: string[];
}

const makeQuestion = (overrides: Partial<FakeQuestion> = {}): FakeQuestion => ({
  vignette: 'A 45-year-old presents with chest pain.',
  correctAnswerIndex: 2,
  options: ['A', 'B', 'C', 'D'],
  ...overrides,
});

const ctx = { env: { GEMINI_API_KEY: 'test-key' } };

const passVerdict: GateVerdict = { passed: true, feedback: [] };
const failVerdict = (feedback: string[]): GateVerdict => ({
  passed: false,
  feedback,
});

// ─── runQualityGate: core loop ──────────────────────────────────────────────

describe('runQualityGate (deterministic core)', () => {
  beforeEach(() => {
    mocks.callStructured.mockReset();
  });

  it('passes on first attempt without invoking improve', async () => {
    const improve = vi.fn();
    const result = await runQualityGate(
      makeQuestion(),
      { validator: () => passVerdict, improve },
      ctx,
    );

    expect(result.outcome).toBe('pass');
    if (result.outcome === 'pass') {
      expect(result.attempts).toBe(1);
      expect(result.feedback).toEqual([]);
    }
    expect(improve).not.toHaveBeenCalled();
  });

  it('feeds validator feedback into improve and passes on the refined artifact', async () => {
    const validator = vi
      .fn<GateValidator<FakeQuestion>>()
      .mockReturnValueOnce(failVerdict(['Option C is not the best answer.']))
      .mockReturnValueOnce(passVerdict);
    const improve = vi.fn((artifact: FakeQuestion, feedback: string[]) => ({
      ...artifact,
      vignette: `${artifact.vignette} [revised: ${feedback.join('; ')}]`,
    }));

    const result = await runQualityGate(makeQuestion(), { validator, improve }, ctx);

    expect(result.outcome).toBe('pass');
    if (result.outcome === 'pass') {
      expect(result.attempts).toBe(2);
      expect(result.feedback).toContain('Option C is not the best answer.');
      expect(result.artifact.vignette).toContain('[revised: Option C is not the best answer.]');
    }
    expect(improve).toHaveBeenCalledTimes(1);
    expect(improve).toHaveBeenCalledWith(expect.any(Object), ['Option C is not the best answer.'], 1, ctx);
  });

  it('quarantines when the artifact never passes, accumulating feedback across attempts', async () => {
    const validator = vi
      .fn<GateValidator<FakeQuestion>>()
      .mockReturnValue(failVerdict(['defect A']));
    const improve = vi.fn((artifact: FakeQuestion) => ({ ...artifact }));

    const result = await runQualityGate(makeQuestion(), { validator, improve, maxRetries: 2 }, ctx);

    expect(result.outcome).toBe('quarantine');
    if (result.outcome === 'quarantine') {
      expect(result.attempts).toBe(3); // initial + 2 retries
      expect(result.feedback.filter((f) => f === 'defect A')).toHaveLength(3);
    }
    expect(validator).toHaveBeenCalledTimes(3);
    expect(improve).toHaveBeenCalledTimes(2);
  });

  it('quarantines immediately when no improve callback exists', async () => {
    const validator = vi.fn<GateValidator<FakeQuestion>>().mockReturnValue(failVerdict(['x']));
    const result = await runQualityGate(makeQuestion(), { validator, maxRetries: 2 }, ctx);
    expect(result.outcome).toBe('quarantine');
    if (result.outcome === 'quarantine') {
      expect(result.attempts).toBe(1);
    }
    expect(validator).toHaveBeenCalledTimes(1);
  });

  it('treats a throwing validator as a transient failing verdict, never crashing the pipeline', async () => {
    const validator = vi.fn<GateValidator<FakeQuestion>>().mockImplementation(() => {
      throw new Error('boom');
    });
    const result = await runQualityGate(makeQuestion(), { validator }, ctx);
    expect(result.outcome).toBe('quarantine');
    if (result.outcome === 'quarantine') {
      expect(result.verdict.transient).toBe(true);
      expect(result.feedback[0]).toContain('boom');
    }
  });

  it('passes on the retry even when the first attempt threw (transient recoverable)', async () => {
    const validator = vi
      .fn<GateValidator<FakeQuestion>>()
      .mockImplementationOnce(() => {
        throw new Error('rate limited');
      })
      .mockReturnValue(passVerdict);
    const result = await runQualityGate(makeQuestion(), { validator, maxRetries: 1 }, ctx);
    expect(result.outcome).toBe('pass');
    if (result.outcome === 'pass') {
      expect(result.attempts).toBe(2);
      expect(result.feedback[0]).toContain('rate limited');
    }
  });

  it('noOpQualityGate always passes with zero attempts (disabled wiring)', async () => {
    const result = await noOpQualityGate(makeQuestion(), {
      validator: () => ({ passed: false, feedback: ['should never run'] }),
    }, ctx);
    expect(result).toEqual({
      outcome: 'pass',
      artifact: expect.any(Object),
      attempts: 0,
      verdict: { passed: true, feedback: [] },
      feedback: [],
    });
  });
});

// ─── clampRetries ───────────────────────────────────────────────────────────

describe('clampRetries (cost guardrail)', () => {
  it('defaults to 2 retries (3 attempts total)', () => {
    expect(clampRetries(undefined)).toBe(2);
  });

  it('clamps above the hard cap of 3', () => {
    expect(clampRetries(10)).toBe(MAX_GATE_RETRIES);
    expect(clampRetries(3)).toBe(3);
  });

  it('floors below zero to 0 (single attempt)', () => {
    expect(clampRetries(-1)).toBe(0);
    expect(clampRetries(0)).toBe(0);
  });

  it('floors fractional budgets', () => {
    expect(clampRetries(1.9)).toBe(1);
  });

  it('returns 0 for non-finite budgets', () => {
    expect(clampRetries(Number.NaN)).toBe(0);
    expect(clampRetries(Number.POSITIVE_INFINITY)).toBe(0);
  });
});

// ─── createLLMValidator ─────────────────────────────────────────────────────

describe('createLLMValidator (gateway-backed)', () => {
  beforeEach(() => {
    mocks.callStructured.mockReset();
  });

  it('returns a transient fail when GEMINI_API_KEY is missing (no gateway call)', async () => {
    const validator = createLLMValidator({
      endpoint: '/api/test#quality-gate',
      criteriaPrompt: 'criteria',
    });
    const verdict = await validator(makeQuestion(), { env: {} });
    expect(verdict.passed).toBe(false);
    expect(verdict.transient).toBe(true);
    expect(verdict.feedback[0]).toContain('GEMINI_API_KEY');
    expect(mocks.callStructured).not.toHaveBeenCalled();
  });

  it('routes the artifact through gateway.callStructured and returns the verdict', async () => {
    mocks.callStructured.mockResolvedValue({
      data: { passed: false, feedback: ['Defect: answer key mismatch'], score: 0.4 },
    });
    const validator = createLLMValidator({
      endpoint: '/api/questions/generate#quality-gate',
      criteriaPrompt: CLINICAL_CONTENT_CRITERIA,
      task: 'grading',
    });

    const question = makeQuestion();
    const verdict = await validator(question, ctx);

    expect(verdict).toEqual({
      passed: false,
      feedback: ['Defect: answer key mismatch'],
      score: 0.4,
    });
    expect(mocks.callStructured).toHaveBeenCalledTimes(1);
    const [, request] = mocks.callStructured.mock.calls[0] as unknown as [
      unknown,
      { userPrompt: string; task: string; endpoint: string; schema: unknown },
    ];
    expect(request.endpoint).toBe('/api/questions/generate#quality-gate');
    expect(request.task).toBe('grading');
    expect(request.userPrompt).toContain(question.vignette);
    expect(request.userPrompt).toContain('ARTIFACT TO VERIFY');
  });

  it('converts GatewayError into a transient fail carrying the error code', async () => {
    mocks.callStructured.mockRejectedValue(new mocks.GatewayError('RATE_LIMITED', 'nope'));
    const validator = createLLMValidator({
      endpoint: '/api/test#quality-gate',
      criteriaPrompt: 'criteria',
    });
    const verdict = await validator(makeQuestion(), ctx);
    expect(verdict.passed).toBe(false);
    expect(verdict.transient).toBe(true);
    expect(verdict.feedback[0]).toContain('RATE_LIMITED');
  });

  it('converts unknown errors into a transient fail with UNKNOWN code', async () => {
    mocks.callStructured.mockRejectedValue(new Error('kaboom'));
    const validator = createLLMValidator({
      endpoint: '/api/test#quality-gate',
      criteriaPrompt: 'criteria',
    });
    const verdict = await validator(makeQuestion(), ctx);
    expect(verdict.passed).toBe(false);
    expect(verdict.transient).toBe(true);
    expect(verdict.feedback[0]).toContain('UNKNOWN');
  });

  it('createClinicalContentValidator defaults to grading task on the clinical criteria', async () => {
    mocks.callStructured.mockResolvedValue({
      data: { passed: true, feedback: [] },
    });
    const validator = createClinicalContentValidator({
      endpoint: '/api/questions/generate#quality-gate',
    });
    const verdict = await validator(makeQuestion(), ctx);
    expect(verdict.passed).toBe(true);

    const [, request] = mocks.callStructured.mock.calls[0] as unknown as [
      unknown,
      { userPrompt: string },
    ];
    expect(request.userPrompt).toContain('clinical content QA verifier');
  });
});
