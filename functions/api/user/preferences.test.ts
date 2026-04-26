import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockUserFindUnique,
  mockUserCreate,
  mockPreferencesFindUnique,
  mockPreferencesCreate,
  mockPreferencesUpsert,
  mockPreferencesUpdate,
  mockPreferencesDelete,
  mockDisconnect,
  capturedHandlers,
  registerHandler,
} = vi.hoisted(() => {
  const capturedHandlers: Record<string, ((ctx: any) => Promise<any>) | null> = {
    get: null,
    post: null,
    patch: null,
    delete: null,
  };
  let index = 0;
  return {
    mockUserFindUnique: vi.fn(),
    mockUserCreate: vi.fn(),
    mockPreferencesFindUnique: vi.fn(),
    mockPreferencesCreate: vi.fn(),
    mockPreferencesUpsert: vi.fn(),
    mockPreferencesUpdate: vi.fn(),
    mockPreferencesDelete: vi.fn(),
    mockDisconnect: vi.fn().mockResolvedValue(undefined),
    capturedHandlers,
    registerHandler: (handler: (ctx: any) => Promise<any>) => {
      const keys = ['get', 'post', 'patch', 'delete'] as const;
      capturedHandlers[keys[index]!] = handler;
      index += 1;
      return handler;
    },
  };
});

vi.mock('../_shared/prisma-edge', () => ({
  createEdgePrismaClient: () => ({
    user: { findUnique: mockUserFindUnique, create: mockUserCreate },
    userPreferences: {
      findUnique: mockPreferencesFindUnique,
      create: mockPreferencesCreate,
      upsert: mockPreferencesUpsert,
      update: mockPreferencesUpdate,
      delete: mockPreferencesDelete,
    },
  }),
  safePrismaDisconnect: (...args: unknown[]) => mockDisconnect(...args),
}));

vi.mock('../_shared/middleware', () => ({
  authenticatedEndpoint: (_schema: unknown, handler: (ctx: any) => Promise<any>) =>
    registerHandler(handler),
}));

vi.mock('../_shared/secureLogger', () => ({
  createEndpointLogger: () => ({
    addContext: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

import './preferences';

function makeContext(validated: Record<string, unknown> = {}) {
  return {
    env: { DATABASE_URL: 'postgres://test' },
    auth: { userId: 'clerk_user_123' },
    validated,
  };
}

describe('/api/user/preferences auth/user bootstrap', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('GET creates a placeholder user and default preferences on first login', async () => {
    mockUserFindUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'user-db-1' });
    mockUserCreate.mockResolvedValue({ id: 'user-db-1' });
    mockPreferencesFindUnique.mockResolvedValue(null);
    mockPreferencesCreate.mockResolvedValue({
      id: 'prefs-1',
      userId: 'user-db-1',
      dailyGoal: 40,
      updatedAt: new Date('2026-04-26T00:00:00.000Z'),
    });

    const result = await capturedHandlers.get!(makeContext());

    expect(mockUserCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          clerkId: 'clerk_user_123',
          email: 'clerk_user_123@placeholder.panacea.app',
        }),
      })
    );
    expect(mockPreferencesCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: 'user-db-1',
          updatedAt: expect.any(Date),
        }),
      })
    );
    expect(result.data.success).toBe(true);
    expect(result.data.preferences.userId).toBe('user-db-1');
  });

  it('POST writes preferences for the authenticated internal user only', async () => {
    mockUserFindUnique.mockResolvedValue({ id: 'user-db-1' });
    mockPreferencesUpsert.mockResolvedValue({
      id: 'prefs-1',
      userId: 'user-db-1',
      dailyGoal: 30,
    });

    const result = await capturedHandlers.post!(
      makeContext({ dailyGoal: 30, userId: 'user-db-other' })
    );

    expect(mockPreferencesUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'user-db-1' },
        create: expect.objectContaining({
          userId: 'user-db-1',
          updatedAt: expect.any(Date),
        }),
        update: expect.not.objectContaining({ userId: 'user-db-other' }),
      })
    );
    expect(result.data.success).toBe(true);
  });

  it('DELETE does not create a user and rejects missing synced users', async () => {
    mockUserFindUnique.mockResolvedValue(null);

    const result = await capturedHandlers.delete!(makeContext());

    expect(mockUserCreate).not.toHaveBeenCalled();
    expect(mockPreferencesDelete).not.toHaveBeenCalled();
    expect(result.status).toBe(404);
    expect(result.error).toBe('User not found');
  });
});
