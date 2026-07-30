/**
 * LangGraph OSCE Encounter Graph — Integration Tests
 *
 * Exercise the compiled graph end-to-end with `routeTask` and
 * `routeStructured` mocked so we verify state transitions, intent-driven
 * routing, transcript append semantics, and grading→END termination
 * without making real AI calls.
 *
 * @module tests/langchain-graphs-osce.test
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks (hoisted) ──────────────────────────────────────────────────────

const mocks = vi.hoisted(() => {
  let intentCounter = 0;
  let patientCounter = 0;
  let gradeCounter = 0;

  const routeTask = vi.fn(async (
    _task: string,
    _env: unknown,
    _params: { systemPrompt?: string; userPrompt: string },
    _opts?: unknown,
  ) => {
    if (_task === 'osce-chat') {
      return {
        output: `Patient reply ${++patientCounter}: I've had this pain for two hours.`,
        model: 'gemini-2.5-flash',
        provider: 'gemini',
        attempts: 1,
        latencyMs: 42,
        usage: { inputTokens: 12, outputTokens: 11, totalTokens: 23 },
      };
    }
    return {
      output: 'unhandled routeTask',
      model: 'gemini-2.5-flash',
      provider: 'gemini',
      attempts: 1,
      latencyMs: 1,
    };
  });

  const routeStructured = vi.fn(async (
    task: string,
    _env: unknown,
    _params: { systemPrompt?: string; userPrompt: string },
    schema: unknown,
    _opts?: unknown,
  ) => {
    if (task === 'extraction') {
      const intents = ['history_question', 'exam_request', 'assessment_present'];
      const intent = intents[++intentCounter % intents.length];
      return {
        output: { intent },
        model: 'gemini-2.5-flash',
        provider: 'gemini',
        attempts: 1,
        latencyMs: 8,
      };
    }
    if (task === 'clinical-reasoning') {
      const score = 50 + (++gradeCounter * 5);
      const capped = Math.min(score, 95);
      return {
        output: {
          QC: capped,
          CC: capped - 5,
          CD: capped - 10,
          RC: capped,
          LC: capped - 5,
          LN: capped,
          CS: capped,
          PD: capped,
          overallScore: capped - 5,
          justification: 'Mock SPBench evaluation summary.',
        },
        model: 'gemini-2.5-pro',
        provider: 'gemini',
        attempts: 1,
        latencyMs: 1200,
        usage: { inputTokens: 1000, outputTokens: 200, totalTokens: 1200 },
      };
    }
    return {
      output: {} as unknown,
      model: 'mock',
      provider: 'mock',
      attempts: 1,
      latencyMs: 1,
    };
  });

  return { routeTask, routeStructured };
});

vi.mock('@/lib/langchain/router', () => ({
  routeTask: mocks.routeTask,
  routeStructured: mocks.routeStructured,
}));

// ─── Setup ────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
});

const env = { GEMINI_API_KEY: 'test-key' };

// ─── Tests ─────────────────────────────────────────────────────────────────

describe('LangGraph OSCE Encounter Graph', () => {
  it('compiles into a runnable graph', async () => {
    const { compiledOsceGraph } = await import('@/lib/langchain/graphs/osceEncounter');
    expect(compiledOsceGraph).toBeDefined();
    expect(typeof compiledOsceGraph.invoke).toBe('function');
  });

  it('routes history_taking → physical_exam → diagnostic_workup → assessment → grading → END', async () => {
    const { compiledOsceGraph } = await import('@/lib/langchain/graphs/osceEncounter');

    const result = await compiledOsceGraph.invoke({
      sessionId: 'osce-1',
      clerkUserId: 'clerk-1',
      phase: 'intake',
      env,
      correctDiagnosis: 'Acute pericarditis',
      transcript: [
        { role: 'student', text: 'Can you tell me more about the pain?', ts: new Date().toISOString() },
      ],
    });

    expect(result.phase).toBe('grading');
    expect(result.scores).not.toBeNull();
    expect(result.scores).toHaveProperty('overallScore');
    expect(routeStructured_mock().routeStructured).toHaveBeenCalled();
  });

  it('appends patient transcript entries via the reducer', async () => {
    const { compiledOsceGraph } = await import('@/lib/langchain/graphs/osceEncounter');

    const result = await compiledOsceGraph.invoke({
      sessionId: 'osce-2',
      clerkUserId: 'clerk-2',
      phase: 'intake',
      env,
      correctDiagnosis: 'STEMI',
      transcript: [
        { role: 'student', text: 'When did the pain start?', ts: new Date().toISOString() },
      ],
    });

    expect(result.transcript.length).toBeGreaterThanOrEqual(1);
    const patientMessages = result.transcript.filter((m: { role: string }) => m.role === 'patient');
    expect(patientMessages.length).toBeGreaterThanOrEqual(1);
    expect(patientMessages[0].text).toContain('Patient reply');
  });

  it('reaches END after an assessment_present intent triggers grading', async () => {
    const { compiledOsceGraph } = await import('@/lib/langchain/graphs/osceEncounter');

    const result = await compiledOsceGraph.invoke({
      sessionId: 'osce-3',
      clerkUserId: 'clerk-3',
      phase: 'intake',
      env,
      correctDiagnosis: 'Pulmonary embolism',
      transcript: [
        { role: 'student', text: 'My diagnosis is PE.', ts: new Date().toISOString() },
      ],
    });

    expect(result.phase).toBe('grading');
    expect(result.scores).not.toBeNull();
    expect(result.scores).toHaveProperty('overallScore');
  });

  it('produces a non-null intent log for student turns', async () => {
    const { compiledOsceGraph } = await import('@/lib/langchain/graphs/osceEncounter');

    const result = await compiledOsceGraph.invoke({
      sessionId: 'osce-4',
      clerkUserId: 'clerk-4',
      phase: 'intake',
      env,
      correctDiagnosis: 'Asthma exacerbation',
      transcript: [
        { role: 'student', text: 'Any prior similar episodes?', ts: new Date().toISOString() },
      ],
    });

    expect(Array.isArray(result.intentLog)).toBe(true);
    expect(result.intentLog.length).toBeGreaterThan(0);
    expect(result.intentLog[0]).toHaveProperty('intent');
    expect(result.intentLog[0]).toHaveProperty('studentText');
  });

  it('throws clear error when env is missing from input', async () => {
    const { compiledOsceGraph } = await import('@/lib/langchain/graphs/osceEncounter');

    await expect(
      compiledOsceGraph.invoke({
        sessionId: 'osce-bad',
        clerkUserId: 'clerk-bad',
        phase: 'intake',
        correctDiagnosis: 'N/A',
        transcript: [],
      } as unknown),
    ).rejects.toThrow(/state\.env is not set/);
  });
});

// Local helper to silence TS about inferred type — same ref as mocks above.
function routeStructured_mock() {
  return mocks;
}