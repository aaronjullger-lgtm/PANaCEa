import { beforeEach, describe, expect, it, vi } from 'vitest';
import { onRequestPost } from './complete';
import { resolveUserByClerkId } from '../_shared/resolveUser';

const mockPrisma = {
  patientEncounterSession: {
    findUnique: vi.fn(),
    updateMany: vi.fn(),
  },
  caseFile: {
    create: vi.fn(),
  },
};

vi.mock('../_shared/middleware', () => ({
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

vi.mock('../_shared/prisma-edge', () => ({
  createEdgePrismaClient: vi.fn(() => mockPrisma),
  safePrismaDisconnect: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../_shared/resolveUser', () => ({
  resolveUserByClerkId: vi.fn(),
}));

vi.mock('../_shared/secureLogger', () => ({
  createEndpointLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  })),
}));

describe('POST /api/osce/complete', () => {
  const baseContext = {
    env: { DATABASE_URL: 'postgresql://test', CLERK_SECRET_KEY: 'sk_test_123' },
    auth: { userId: 'clerk_user_1' },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (resolveUserByClerkId as any).mockResolvedValue({ id: 'user_1' });
  });

  it('returns idempotent success for already completed session', async () => {
    mockPrisma.patientEncounterSession.findUnique.mockResolvedValue({ status: 'completed' });

    const response = await onRequestPost({
      ...baseContext,
      validated: { body: { sessionId: 'session_1' } },
    } as any);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true, alreadyCompleted: true });
    expect(mockPrisma.patientEncounterSession.updateMany).not.toHaveBeenCalled();
    expect(mockPrisma.caseFile.create).not.toHaveBeenCalled();
  });

  it('creates CaseFile when analytics payload is present', async () => {
    mockPrisma.patientEncounterSession.findUnique.mockResolvedValue({ status: 'active' });
    mockPrisma.patientEncounterSession.updateMany.mockResolvedValue({ count: 1 });

    const response = await onRequestPost({
      ...baseContext,
      validated: {
        body: {
          sessionId: 'session_2',
          diagnosis: 'Acute coronary syndrome',
          treatmentPlan: 'Admit, aspirin, telemetry',
          soapComparison: { subjective: 's' },
          timingAnalytics: { totalSeconds: 180 },
          infographics: ['https://cdn.example.com/infographic.svg'],
        },
      },
    } as any);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true });
    expect(mockPrisma.patientEncounterSession.updateMany).toHaveBeenCalledTimes(1);
    expect(mockPrisma.caseFile.create).toHaveBeenCalledTimes(1);
  });

  it('does not fail completion if CaseFile create throws', async () => {
    mockPrisma.patientEncounterSession.findUnique.mockResolvedValue({ status: 'active' });
    mockPrisma.patientEncounterSession.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.caseFile.create.mockRejectedValue(new Error('casefile write failed'));

    const response = await onRequestPost({
      ...baseContext,
      validated: {
        body: {
          sessionId: 'session_3',
          soapComparison: { note: 'x' },
          timingAnalytics: { totalSeconds: 120 },
        },
      },
    } as any);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true });
  });
});
