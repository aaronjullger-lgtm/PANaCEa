// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { onRequestPost } from '@/functions/api/analytics/session';

const mockResolveOrCreateUserId = vi.hoisted(() => vi.fn());
const mockUuid = vi.hoisted(() => vi.fn(() => 'generated-session-id'));
const mockPrisma = vi.hoisted(() => ({
  studySession: {
    findUnique: vi.fn(),
    upsert: vi.fn(),
  },
  sessionAnalytics: {
    upsert: vi.fn(),
  },
  userLearningProfile: {
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  $disconnect: vi.fn(),
}));

vi.mock('../../../functions/api/_shared/prisma-edge', () => ({
  createEdgePrismaClient: vi.fn(() => mockPrisma),
  safePrismaDisconnect: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../functions/api/_shared/middleware', () => ({
  authenticatedEndpoint: vi.fn((schema, handler) => async (context: any) => {
    const result = await handler(context);
    if (result instanceof Response) return result;
    const status = result.status || 200;
    const body =
      result.error != null
        ? JSON.stringify({ error: result.error })
        : JSON.stringify(result.data ?? result);
    const headers = new Headers({ 'Content-Type': 'application/json' });
    return new Response(body, { status, headers });
  }),
  withCors: vi.fn(() => () => new Response(null, { status: 204 })),
}));

vi.mock('../../../functions/api/_shared/user-resolver', () => ({
  resolveOrCreateUserId: mockResolveOrCreateUserId,
}));

vi.mock('uuid', () => ({
  v4: mockUuid,
}));

function buildPayload(overrides: Record<string, unknown> = {}) {
  return {
    sessionId: 'session-123',
    startedAt: '2026-04-16T10:00:00.000Z',
    endedAt: '2026-04-16T10:12:00.000Z',
    totalQuestions: 10,
    correctAnswers: 8,
    accuracy: 80,
    totalTimeMs: 720000,
    avgTimePerQuestion: 72000,
    bestStreak: 4,
    finalStreak: 2,
    totalAnswerChanges: 1,
    helpfulChanges: 1,
    harmfulChanges: 0,
    systemsCovered: ['Cardiovascular', 'Pulmonary'],
    mode: 'adaptive',
    focus: 'growth',
    difficulty: 'same',
    ...overrides,
  };
}

function buildContext(validated: Record<string, unknown>) {
  return {
    env: { DATABASE_URL: 'test-db-url' },
    validated,
    auth: { userId: 'clerk-user-123' },
  };
}

describe('POST /api/analytics/session', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockResolveOrCreateUserId.mockResolvedValue('internal-user-123');
    mockPrisma.studySession.findUnique.mockResolvedValue(null);
    mockPrisma.studySession.upsert.mockResolvedValue({ id: 'session-123' });
    mockPrisma.sessionAnalytics.upsert.mockResolvedValue({ id: 'analytics_session-123' });
    mockPrisma.userLearningProfile.findUnique.mockResolvedValue(null);
    mockPrisma.userLearningProfile.create.mockResolvedValue({ id: 'profile-1' });
    mockPrisma.userLearningProfile.update.mockResolvedValue({ id: 'profile-1' });
  });

  it('upserts analytics onto an existing generated session owned by the user', async () => {
    mockPrisma.studySession.findUnique.mockResolvedValue({
      id: 'session-123',
      userId: 'internal-user-123',
    });
    mockPrisma.studySession.upsert.mockResolvedValue({ id: 'session-123' });

    const response = await onRequestPost(buildContext(buildPayload()) as any);
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body).toEqual({
      success: true,
      sessionId: 'session-123',
      message: 'Session analytics recorded successfully',
    });

    expect(mockPrisma.studySession.findUnique).toHaveBeenCalledWith({
      where: { id: 'session-123' },
      select: { id: true, userId: true },
    });

    const upsertArgs = mockPrisma.studySession.upsert.mock.calls[0][0];
    expect(upsertArgs.where).toEqual({ id: 'session-123' });
    expect(upsertArgs.create.id).toBe('session-123');
    expect(upsertArgs.create.userId).toBe('internal-user-123');
    expect(upsertArgs.update.mode).toBe('adaptive');
    expect(upsertArgs.update.questionIds).toBeUndefined();
    expect(upsertArgs.update.blueprintStage).toBeUndefined();
    expect(upsertArgs.update.systemsTargeted).toBeUndefined();

    expect(mockPrisma.sessionAnalytics.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { sessionId: 'session-123' },
      })
    );
  });

  it('rejects analytics updates for a session owned by another user', async () => {
    mockPrisma.studySession.findUnique.mockResolvedValue({
      id: 'session-123',
      userId: 'different-user',
    });

    const response = await onRequestPost(buildContext(buildPayload()) as any);
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body).toEqual({
      error: 'You do not have permission to update this session.',
    });
    expect(mockPrisma.studySession.upsert).not.toHaveBeenCalled();
    expect(mockPrisma.sessionAnalytics.upsert).not.toHaveBeenCalled();
  });

  it('creates a fallback session id for non-generated flows', async () => {
    mockPrisma.studySession.upsert.mockResolvedValue({ id: 'generated-session-id' });

    const payload = buildPayload({ sessionId: undefined });
    const response = await onRequestPost(buildContext(payload) as any);
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.sessionId).toBe('generated-session-id');
    expect(mockUuid).toHaveBeenCalled();
    expect(mockPrisma.studySession.findUnique).not.toHaveBeenCalled();
    expect(mockPrisma.studySession.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'generated-session-id' },
      })
    );
    expect(mockPrisma.sessionAnalytics.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { sessionId: 'generated-session-id' },
      })
    );
  });
});
