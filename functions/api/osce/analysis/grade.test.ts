import { beforeEach, describe, expect, it, vi } from 'vitest';
import { onRequestPost } from './grade';
import { resolveUserByClerkId } from '../../_shared/resolveUser';
import { validateFunctionEnv } from '../../_shared/env-validation';
import { withRateLimit } from '../../_shared/rateLimiter';

const mockPrisma = {
  patientEncounterSession: {
    findFirst: vi.fn(),
  },
  caseRubric: {
    findUnique: vi.fn(),
  },
  osceResult: {
    findUnique: vi.fn(),
    update: vi.fn(),
    create: vi.fn(),
  },
  conceptGap: {
    findFirst: vi.fn(),
    create: vi.fn(),
  },
};

vi.mock('../../_shared/middleware', () => ({
  authenticatedEndpoint: vi.fn((_schema, handler) => async (context: any) => {
    const result = await handler(context);
    if (result instanceof Response) return result;
    const status = result.status || 200;
    const body =
      result.error != null ? JSON.stringify({ error: result.error }) : JSON.stringify(result.data ?? result);
    return new Response(body, {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
  }),
  withCors: vi.fn(() => () => new Response(null, { status: 204 })),
}));

vi.mock('../../_shared/prisma-edge', () => ({
  createEdgePrismaClient: vi.fn(() => mockPrisma),
  safePrismaDisconnect: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../_shared/secureLogger', () => ({
  createEndpointLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  })),
}));

vi.mock('../../_shared/resolveUser', () => ({
  resolveUserByClerkId: vi.fn(),
}));

vi.mock('../../_shared/env-validation', () => ({
  validateFunctionEnv: vi.fn(),
  MissingEnvError: class MissingEnvError extends Error {
    toResponse() {
      return new Response(JSON.stringify({ error: this.message }), { status: 500 });
    }
  },
}));

vi.mock('../../_shared/rateLimiter', () => ({
  withRateLimit: vi.fn(),
  getRateLimitIdentifier: vi.fn(() => 'test-rate-limit-id'),
}));

vi.mock('../../_shared/inferSystem', () => ({
  resolveSystem: vi.fn(() => 'cardiovascular'),
}));

vi.mock('../../intelligence/profile', () => ({
  scheduleConceptReview: vi.fn(),
}));

describe('POST /api/osce/analysis/grade', () => {
  const baseContext = {
    request: new Request('http://localhost/api/osce/analysis/grade', { method: 'POST' }),
    env: { DATABASE_URL: 'postgresql://test', CLERK_SECRET_KEY: 'sk_test_123', GEMINI_API_KEY: 'gemini_test' },
    auth: { userId: 'clerk_user_1' },
    validated: { body: { sessionId: 'session_1' } },
  };

  const completedSession = {
    id: 'session_1',
    userId: 'user_1',
    caseId: 'case_1',
    status: 'completed',
    messages: [{ role: 'user', content: 'hello' }],
    PatientEncounterCase: {
      chiefComplaint: 'Chest pain',
      correctDiagnosis: 'Acute coronary syndrome',
      patientName: 'John Doe',
      age: 55,
      essentialQuestions: ['Onset of pain'],
      idealWorkup: ['EKG', 'Troponin'],
    },
    User: { id: 'user_1' },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (resolveUserByClerkId as any).mockResolvedValue({ id: 'user_1' });
    (validateFunctionEnv as any).mockImplementation(() => undefined);
    (withRateLimit as any).mockResolvedValue({ response: null });
    mockPrisma.caseRubric.findUnique.mockResolvedValue({
      checklist: [{ item: 'Ask onset and severity', isRedFlag: true }],
    });
  });

  it('returns 400 when session is not completed', async () => {
    mockPrisma.patientEncounterSession.findFirst.mockResolvedValue({
      ...completedSession,
      status: 'active',
    });

    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    const response = await onRequestPost(baseContext as any);
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'Session must be completed before grading' });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('maps Gemini 429 to endpoint 429', async () => {
    mockPrisma.patientEncounterSession.findFirst.mockResolvedValue(completedSession);

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response('Rate limited', {
          status: 429,
          statusText: 'Too Many Requests',
        })
      )
    );

    const response = await onRequestPost(baseContext as any);
    expect(response.status).toBe(429);
    expect(await response.json()).toEqual({ error: 'Rate limit exceeded' });
  });

  it('returns graded payload for completed session', async () => {
    mockPrisma.patientEncounterSession.findFirst.mockResolvedValue(completedSession);
    mockPrisma.osceResult.findUnique
      .mockResolvedValueOnce(null)      // idempotency check
      .mockResolvedValueOnce(null)      // persistGradeAndConceptGap: check existing
      .mockResolvedValueOnce({ id: 'result_1' }); // persistGradeAndConceptGap: verify saved
    mockPrisma.osceResult.create.mockResolvedValue({ id: 'result_1' });

    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              candidates: [
                {
                  content: {
                    parts: [
                      {
                        text: JSON.stringify({
                          score: 88,
                          checklist: [{ item: 'Ask onset and severity', status: 'PASS', feedback: 'Good' }],
                          redFlagsMissed: [],
                          clinicalReasoningScore: 82,
                          billingCodeSuggestion: 'I20.0',
                        }),
                      },
                    ],
                  },
                },
              ],
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          )
        )
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              candidates: [
                {
                  content: {
                    parts: [
                      {
                        text: JSON.stringify({
                          empathy: { score: 4, feedback: 'Supportive' },
                          professionalism: { score: 5, feedback: 'Appropriate tone' },
                          pacing: { score: 4, feedback: 'Well-paced' },
                        }),
                      },
                    ],
                  },
                },
              ],
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          )
        )
    );

    const response = await onRequestPost(baseContext as any);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.score).toBe(88);
    expect(body.clinicalReasoningScore).toBe(82);
    expect(body.checklist).toHaveLength(1);
    expect(body.conceptGapCreated).toBe(false);
  });
});
