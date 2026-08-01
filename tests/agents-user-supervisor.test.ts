/**
 * Tests for the user supervisor — intent classification, LLM/keyword routing,
 * supervisor registration, and end-to-end dispatch. All AI calls are mocked.
 *
 * @module tests/agents-user-supervisor.test
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => {
  const routeStructured = vi.fn();
  return { routeStructured };
});

vi.mock('@/lib/langchain/router', () => ({
  routeStructured: mocks.routeStructured,
}));

import { clearRegistryForTests } from '@/lib/agents/shared/runtime';

beforeEach(() => {
  vi.clearAllMocks();
  mocks.routeStructured.mockReset();
});

beforeEach(async () => {
  clearRegistryForTests();
  vi.resetModules();
  await import('@/lib/agents/encounter/standardizedPatient');
  await import('@/lib/agents/encounter/feedbackSummarizer');
  await import('@/lib/agents/graphs/preceptor');
});

const ctx = { env: { GEMINI_API_KEY: 'test-key' } };
const noEnvCtx = { env: {} };

describe('classifyUserIntent', () => {
  it('classifies tutor intent', async () => {
    const { classifyUserIntent } = await import('@/lib/agents/userSupervisor');
    expect(classifyUserIntent('I need a tutor to walk me through heart failure')).toBe('tutor');
  });

  it('classifies osce intent', async () => {
    const { classifyUserIntent } = await import('@/lib/agents/userSupervisor');
    expect(classifyUserIntent('Set up an OSCE with a standardized patient')).toBe('osce');
  });

  it('classifies explain intent', async () => {
    const { classifyUserIntent } = await import('@/lib/agents/userSupervisor');
    expect(classifyUserIntent('Why was my answer wrong? Explain the rationale')).toBe('explain');
  });

  it('classifies generate intent', async () => {
    const { classifyUserIntent } = await import('@/lib/agents/userSupervisor');
    expect(classifyUserIntent('Generate 10 practice questions for cardiology')).toBe('generate');
  });

  it('returns unknown when nothing matches', async () => {
    const { classifyUserIntent } = await import('@/lib/agents/userSupervisor');
    expect(classifyUserIntent('hello world')).toBe('unknown');
  });

  it('classifies non-string input via JSON serialization', async () => {
    const { classifyUserIntent } = await import('@/lib/agents/userSupervisor');
    expect(classifyUserIntent({ request: 'explain this answer' })).toBe('explain');
    expect(classifyUserIntent(undefined)).toBe('unknown');
    expect(classifyUserIntent(null)).toBe('unknown');
  });

  it('breaks keyword ties by declaration order (tutor > osce > explain > generate)', async () => {
    const { classifyUserIntent } = await import('@/lib/agents/userSupervisor');
    expect(classifyUserIntent('Generate a question to explain')).toBe('explain');
  });
});

describe('buildUserRouterConfig', () => {
  it('filters the catalog to registered agents only', async () => {
    const { buildUserRouterConfig } = await import('@/lib/agents/userSupervisor');
    const config = buildUserRouterConfig(new Set(['standardized-patient']));
    expect(config.agents).toEqual([
      expect.objectContaining({ name: 'standardized-patient' }),
    ]);
    expect(config.defaultAgent).toBe('standardized-patient');
  });

  it('returns an empty config when nothing is registered', async () => {
    const { buildUserRouterConfig } = await import('@/lib/agents/userSupervisor');
    const config = buildUserRouterConfig(new Set());
    expect(config.agents).toEqual([]);
    expect(config.defaultAgent).toBeUndefined();
  });
});

describe('registerUserSupervisorV2', () => {
  it('registers user-supervisor-v2 with the three routeable agents', async () => {
    const { registerUserSupervisorV2 } = await import('@/lib/agents/userSupervisor');
    registerUserSupervisorV2();
    const { listSupervisorsV2 } = await import('@/lib/agents/supervisor-v2');
    const supervisors = listSupervisorsV2();
    expect(supervisors).toContainEqual({
      name: 'user-supervisor-v2',
      description: 'Student-facing intent router — tutor / OSCE / explain / generate',
      agentCount: 3,
      routingMethod: 'llm-primary',
    });
  });
});

describe('routeUserIntent', () => {
  it('routes via LLM when a model is available', async () => {
    mocks.routeStructured.mockResolvedValue({
      output: {
        agent: 'standardized-patient',
        confidence: 0.92,
        reasoning: 'Student wants to practice a patient interview',
        alternatives: [],
        requiresMultiAgent: false,
      },
    });
    const { routeUserIntent } = await import('@/lib/agents/userSupervisor');
    const decision = await routeUserIntent('Practice taking a history', ctx);
    expect(decision).toMatchObject({
      intent: 'osce',
      agent: 'standardized-patient',
      routingMethod: 'llm',
      confidence: 0.92,
    });
  });

  it('accepts the LLM default-agent fallback when the model hallucinates a name', async () => {
    mocks.routeStructured.mockResolvedValue({
      output: {
        agent: 'ddx-generator',
        confidence: 0.8,
        reasoning: 'Hallucinated agent',
        alternatives: [],
        requiresMultiAgent: false,
      },
    });
    const { routeUserIntent } = await import('@/lib/agents/userSupervisor');
    const decision = await routeUserIntent('Explain why my answer was wrong', ctx);
    expect(decision).toMatchObject({
      intent: 'explain',
      agent: 'feedback-summarizer',
      routingMethod: 'llm',
    });
    expect(decision.confidence).toBeLessThan(0.5);
  });

  it('falls back to keyword routing without a model', async () => {
    const { routeUserIntent } = await import('@/lib/agents/userSupervisor');
    const decision = await routeUserIntent('Explain the rationale for this answer', noEnvCtx);
    expect(decision).toMatchObject({
      intent: 'explain',
      agent: 'feedback-summarizer',
      routingMethod: 'keyword',
      confidence: 0.55,
    });
  });

  it('returns a null agent for generate intent with no registered generator', async () => {
    const runtime = await import('@/lib/agents/shared/runtime');
    runtime.clearRegistryForTests();
    const { routeUserIntent } = await import('@/lib/agents/userSupervisor');
    const decision = await routeUserIntent('Generate 10 new practice questions', ctx);
    expect(decision).toMatchObject({
      intent: 'generate',
      agent: null,
      routingMethod: 'keyword',
      confidence: 0,
    });
  });
});

describe('runUserSupervisor', () => {
  it('returns no_agent for generate intent (question-generator is catalog-only)', async () => {
    const { runUserSupervisor } = await import('@/lib/agents/userSupervisor');
    const result = await runUserSupervisor('Generate 10 practice questions', noEnvCtx);
    expect(result).toMatchObject({
      supervisor: 'user-supervisor-v2',
      intent: 'generate',
      agent: null,
      status: 'no_agent',
      error: null,
    });
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('invokes the routed agent and returns its output', async () => {
    mocks.routeStructured.mockImplementation((runName: string) => {
      if (runName === 'agent-routing') {
        return Promise.resolve({
          output: {
            agent: 'feedback-summarizer',
            confidence: 0.9,
            reasoning: 'Student wants coaching feedback',
            alternatives: [],
            requiresMultiAgent: false,
          },
        });
      }
      return Promise.resolve({
        output: {
          overallAssessment: 'Solid clinical reasoning with room to improve exam technique.',
          strengths: ['Good differential generation'],
          improvements: [{
            area: 'Exam technique',
            specificFeedback: 'Complete the physical exam before ordering tests.',
            actionableStep: 'Practice the full exam sequence in the next encounter.',
          }],
          studyRecommendation: 'Review the cardiopulmonary exam module.',
          encouragementLevel: 'developing',
        },
      });
    });
    const { runUserSupervisor } = await import('@/lib/agents/userSupervisor');
    const result = await runUserSupervisor({
      sessionId: 's1',
      scores: {
        QC: 70, CC: 65, CD: 80, RC: 60,
        LC: 75, LN: 55, CS: 85, PD: 90,
        overallScore: 72,
        justification: 'Good differential, weak exam technique',
      },
      transcript: [{ role: 'student', text: 'I would order a CBC' }],
    }, ctx);
    expect(result).toMatchObject({
      supervisor: 'user-supervisor-v2',
      intent: 'explain',
      agent: 'feedback-summarizer',
      routingMethod: 'llm',
      status: 'ok',
    });
    expect(result.output).toMatchObject({ strengths: ['Good differential generation'] });
  });

  it('surfaces schema_invalid when the routed agent rejects the input', async () => {
    const { runUserSupervisor } = await import('@/lib/agents/userSupervisor');
    const result = await runUserSupervisor('Explain the rationale for this answer', noEnvCtx);
    expect(result).toMatchObject({
      supervisor: 'user-supervisor-v2',
      intent: 'explain',
      agent: 'feedback-summarizer',
      routingMethod: 'keyword',
      status: 'schema_invalid',
    });
    expect(result.error?.cause).toBe('feedback-summarizer.input');
  });
});
