import { beforeEach, describe, expect, it, vi } from 'vitest';
import { onRequestPost } from './grade';
import { resolveUserByClerkId } from '../../_shared/resolveUser';
import { validateFunctionEnv } from '../../_shared/env-validation';
import { withRateLimit } from '../../_shared/rateLimiter';
import { scheduleConceptReview } from '../../ai/learning/profile-crud';
import { gateway } from '@/lib/ai/aiGateway';

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

vi.mock('../../_shared/middleware', () => {
  // Inlined inside the factory so vi.mock's hoisted evaluation has access
  // to it. Declaring it as a top-level `const` fails because `vi.mock` is
  // hoisted above all other top-level statements.
  const wrapEndpoint =
    (_schema: unknown, handler: (context: any) => Promise<any>) =>
    async (context: any) => {
      const result = await handler(context);
      if (result instanceof Response) return result;
      const status = result.status || 200;
      const body =
        result.error != null
          ? JSON.stringify({ error: result.error })
          : JSON.stringify(result.data ?? result);
      return new Response(body, {
        status,
        headers: { 'Content-Type': 'application/json' },
      });
    };
  return {
    authenticatedEndpoint: vi.fn(wrapEndpoint),
    aiEndpoint: vi.fn(wrapEndpoint),
    withCors: vi.fn(() => () => new Response(null, { status: 204 })),
  };
});

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

vi.mock('../../ai/learning/profile-crud', () => ({
  scheduleConceptReview: vi.fn(),
}));

vi.mock('@/lib/ai/aiGateway', async () => {
  // The endpoint only uses `gateway.grade(...)`, `GatewayError`, and
  // `toGatewayContext(...)`. Everything else on the real module can stay.
  const actual = await vi.importActual<typeof import('@/lib/ai/aiGateway')>('@/lib/ai/aiGateway');
  return {
    ...actual,
    gateway: {
      grade: vi.fn(),
    },
    toGatewayContext: vi.fn(() => ({ env: {}, auth: { userId: 'clerk_user_1' } })),
  };
});

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

    // The endpoint now delegates to `gateway.grade(...)`. The gateway
    // throws a `GatewayError` with code 'RATE_LIMITED' on upstream 429,
    // which the endpoint maps to a 429 response.
    // Use the same module that the endpoint imports so `instanceof` matches.
    const { GatewayError } = await import('@/lib/ai/aiGateway');
    (gateway.grade as ReturnType<typeof vi.fn>).mockRejectedValue(
      new GatewayError({
        code: 'RATE_LIMITED',
        message: 'Upstream rate limit',
        retryable: true,
        requestId: 'req_test',
        traceId: 'trace_test',
        task: 'grade',
      }),
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

    // The gateway is called twice: once for the graded payload, once for
    // the soft-skills payload. Both return the parsed & validated objects.
    (gateway.grade as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({
        data: {
          score: 88,
          checklist: [
            { item: 'Ask onset and severity', status: 'PASS', feedback: 'Good' },
          ],
          redFlagsMissed: [],
          clinicalReasoningScore: 82,
          billingCodeSuggestion: 'I20.0',
        },
      })
      .mockResolvedValueOnce({
        data: {
          empathy: { score: 4, feedback: 'Supportive' },
          professionalism: { score: 5, feedback: 'Appropriate tone' },
          pacing: { score: 4, feedback: 'Well-paced' },
        },
      });

    const response = await onRequestPost(baseContext as any);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.score).toBe(88);
    expect(body.clinicalReasoningScore).toBe(82);
    expect(body.checklist).toHaveLength(1);
    expect(body.conceptGapCreated).toBe(false);
  });

  it('creates an OSCE concept gap without writing a legacy review schedule', async () => {
    mockPrisma.patientEncounterSession.findFirst.mockResolvedValue(completedSession);
    mockPrisma.osceResult.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'result_2' });
    mockPrisma.osceResult.create.mockResolvedValue({ id: 'result_2' });
    mockPrisma.conceptGap.findFirst.mockResolvedValue(null);
    mockPrisma.conceptGap.create.mockResolvedValue({ id: 'gap_1' });

    (gateway.grade as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({
        data: {
          score: 52,
          checklist: [
            { item: 'Ask onset and severity', status: 'FAIL', feedback: 'Missed key history' },
          ],
          redFlagsMissed: ['Missed aspirin administration'],
          clinicalReasoningScore: 45,
          billingCodeSuggestion: 'I20.0',
        },
      })
      .mockResolvedValueOnce({
        data: {
          empathy: { score: 4, feedback: 'Supportive' },
          professionalism: { score: 5, feedback: 'Appropriate tone' },
          pacing: { score: 4, feedback: 'Well-paced' },
        },
      });

    const response = await onRequestPost(baseContext as any);
    expect(response.status).toBe(200);
    const body = await response.json();

    expect(body.conceptGapCreated).toBe(true);
    expect(mockPrisma.conceptGap.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'user_1',
        system: 'cardiovascular',
        sourceType: 'osce',
        sourceId: 'result_2',
      }),
    });
    expect(scheduleConceptReview).not.toHaveBeenCalled();
  });
});
