import { beforeEach, describe, expect, it, vi } from 'vitest';
import { onRequestPost } from './complete';
import { resolveUserByClerkId } from '../_shared/resolveUser';

const mockPrisma = {
  patientEncounterSession: {
    findUnique: vi.fn(),
    update: vi.fn(),
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
    expect(mockPrisma.patientEncounterSession.update).not.toHaveBeenCalled();
  });

  it('completes session and persists osceTelemetry', async () => {
    mockPrisma.patientEncounterSession.findUnique.mockResolvedValue({ status: 'active' });
    mockPrisma.patientEncounterSession.update.mockResolvedValue({ id: 'session_2', status: 'completed' });

    const response = await onRequestPost({
      ...baseContext,
      validated: {
        body: {
          sessionId: 'session_2',
          diagnosis: 'Acute coronary syndrome',
          treatmentPlan: 'Admit, aspirin, telemetry',
          osceTelemetry: { totalTimeMs: 180000 },
        },
      },
    } as any);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true });
    expect(mockPrisma.patientEncounterSession.update).toHaveBeenCalledTimes(1);
    expect(mockPrisma.patientEncounterSession.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'completed',
          diagnosis: 'Acute coronary syndrome',
          osceTelemetry: { totalTimeMs: 180000 },
        }),
      })
    );
  });

  it('succeeds without optional analytics fields', async () => {
    mockPrisma.patientEncounterSession.findUnique.mockResolvedValue({ status: 'active' });
    mockPrisma.patientEncounterSession.update.mockResolvedValue({ id: 'session_3', status: 'completed' });

    const response = await onRequestPost({
      ...baseContext,
      validated: {
        body: { sessionId: 'session_3' },
      },
    } as any);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true });
  });
});
