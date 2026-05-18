import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const {
  mockCreateEdgePrismaClient,
  mockSafePrismaDisconnect,
  mockUserFindUnique,
  mockKnowledgeCacheFindFirst,
  mockKnowledgeCacheDelete,
  mockLoggerWarn,
  mockLoggerInfo,
  mockLoggerError,
} = vi.hoisted(() => ({
  mockCreateEdgePrismaClient: vi.fn(),
  mockSafePrismaDisconnect: vi.fn().mockResolvedValue(undefined),
  mockUserFindUnique: vi.fn(),
  mockKnowledgeCacheFindFirst: vi.fn(),
  mockKnowledgeCacheDelete: vi.fn(),
  mockLoggerWarn: vi.fn(),
  mockLoggerInfo: vi.fn(),
  mockLoggerError: vi.fn(),
}));

vi.mock('@/functions/api/_shared/middleware', () => ({
  authenticatedEndpoint: vi.fn((_schema, handler) => handler),
  aiEndpoint: vi.fn((_schema, handler) => handler),
}));

vi.mock('@/functions/api/_shared/prisma-edge', () => ({
  createEdgePrismaClient: mockCreateEdgePrismaClient,
  safePrismaDisconnect: mockSafePrismaDisconnect,
}));

vi.mock('@/functions/api/_shared/secureLogger', () => ({
  createEndpointLogger: vi.fn(() => ({
    warn: mockLoggerWarn,
    info: mockLoggerInfo,
    error: mockLoggerError,
  })),
}));

import { onRequestDelete as deleteCacheById } from '@/functions/api/knowledge/cache/[id]';
import { onRequestDelete as deleteCacheByName } from '@/functions/api/knowledge/cache/[name]';

describe('knowledge cache deletion safety', () => {
  const prisma = {
    user: { findUnique: mockUserFindUnique },
    knowledgeCache: {
      findFirst: mockKnowledgeCacheFindFirst,
      delete: mockKnowledgeCacheDelete,
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateEdgePrismaClient.mockReturnValue(prisma);
    mockUserFindUnique.mockResolvedValue({ id: 'user-1' });
    mockKnowledgeCacheFindFirst.mockResolvedValue({
      id: 'cache-db-id',
      geminiCacheName: 'cachedContents/cache-1',
      expiresAt: new Date(Date.now() + 60_000),
    });
    mockKnowledgeCacheDelete.mockResolvedValue({ id: 'cache-db-id' });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('does not delete the DB record by id when Gemini deletion fails', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 503 });
    vi.stubGlobal('fetch', fetchMock);

    const response = await deleteCacheById({
      env: { DATABASE_URL: 'prisma://test', GEMINI_API_KEY: 'gemini-key' },
      auth: { userId: 'clerk-user' },
      validated: { id: 'cache-db-id' },
    } as any);

    expect(response).toBeInstanceOf(Response);
    expect((response as Response).status).toBe(502);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://generativelanguage.googleapis.com/v1beta/cachedContents/cache-1?key=gemini-key',
      { method: 'DELETE' }
    );
    expect(mockKnowledgeCacheDelete).not.toHaveBeenCalled();
  });

  it('deletes the Gemini cache before deleting the DB record by id', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    vi.stubGlobal('fetch', fetchMock);

    const response = await deleteCacheById({
      env: { DATABASE_URL: 'prisma://test', GEMINI_API_KEY: 'gemini-key' },
      auth: { userId: 'clerk-user' },
      validated: { id: 'cache-db-id' },
    } as any);

    expect(response).toBeInstanceOf(Response);
    expect((response as Response).status).toBe(200);
    expect(mockKnowledgeCacheDelete).toHaveBeenCalledWith({ where: { id: 'cache-db-id' } });
    expect(fetchMock.mock.invocationCallOrder[0]).toBeLessThan(
      mockKnowledgeCacheDelete.mock.invocationCallOrder[0] ?? Number.POSITIVE_INFINITY
    );
  });

  it('does not delete the DB record by name when Gemini deletion fails', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 503 });
    vi.stubGlobal('fetch', fetchMock);

    const result = await deleteCacheByName({
      env: { DATABASE_URL: 'prisma://test', GEMINI_API_KEY: 'gemini-key' },
      auth: { userId: 'clerk-user' },
      params: { name: encodeURIComponent('cachedContents/cache-1') },
    } as any);

    expect(result).toEqual({ status: 502, error: 'Failed to delete external cache' });
    expect(mockKnowledgeCacheDelete).not.toHaveBeenCalled();
  });
});
