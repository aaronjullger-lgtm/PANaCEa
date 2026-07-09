import { beforeEach, describe, expect, it, vi } from 'vitest';
import { onRequestDelete } from './cleanup';
import { resolveUserByClerkId } from '../_shared/resolveUser';

const mockPrisma = {
  patientEncounterSession: {
    updateMany: vi.fn(),
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

describe('DELETE /api/osce/cleanup', () => {
  const baseContext = {
    env: { DATABASE_URL: 'postgresql://test', CLERK_SECRET_KEY: 'sk_test_123' },
    auth: { userId: 'clerk_user_1' },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (resolveUserByClerkId as any).mockResolvedValue({ id: 'user_1' });
    mockPrisma.patientEncounterSession.updateMany.mockResolvedValue({ count: 1 });
  });

  it('clears chat history only for a session owned by the authenticated user', async () => {
    const response = await onRequestDelete({
      ...baseContext,
      request: new Request('https://studypanacea.com/api/osce/cleanup?sessionId=session_1', {
        method: 'DELETE',
      }),
    } as any);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      deleted: 1,
      message: 'Cleared chat messages for session session_1',
    });
    expect(mockPrisma.patientEncounterSession.updateMany).toHaveBeenCalledWith({
      where: { id: 'session_1', userId: 'user_1' },
      data: { messages: [] },
    });
  });

  it('returns not found when the caller does not own the session', async () => {
    mockPrisma.patientEncounterSession.updateMany.mockResolvedValue({ count: 0 });

    const response = await onRequestDelete({
      ...baseContext,
      request: new Request('https://studypanacea.com/api/osce/cleanup?sessionId=session_victim', {
        method: 'DELETE',
      }),
    } as any);

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: 'Session not found' });
    expect(mockPrisma.patientEncounterSession.updateMany).toHaveBeenCalledWith({
      where: { id: 'session_victim', userId: 'user_1' },
      data: { messages: [] },
    });
  });

  it('does not update sessions when the authenticated user is not synced', async () => {
    (resolveUserByClerkId as any).mockResolvedValue(null);

    const response = await onRequestDelete({
      ...baseContext,
      request: new Request('https://studypanacea.com/api/osce/cleanup?sessionId=session_1', {
        method: 'DELETE',
      }),
    } as any);

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: 'User not found' });
    expect(mockPrisma.patientEncounterSession.updateMany).not.toHaveBeenCalled();
  });
});
