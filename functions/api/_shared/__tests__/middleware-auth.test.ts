import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { authenticatedEndpoint } from '../middleware';

vi.mock('@clerk/backend', () => ({
  verifyToken: vi.fn(),
}));

import { verifyToken } from '@clerk/backend';

const ENV = {
  DATABASE_URL: 'postgres://test',
  CLERK_SECRET_KEY: 'sk_test_1234567890abcdefghijklmnopqrstuvwxyz',
};

function context(request: Request) {
  return {
    request,
    env: ENV,
    params: {},
    waitUntil: () => undefined,
    passThroughOnException: () => undefined,
  };
}

async function json(response: Response) {
  return (await response.json()) as Record<string, unknown>;
}

describe('authenticatedEndpoint auth policy', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('rejects unauthenticated requests before the handler runs', async () => {
    const handler = vi.fn(async () => ({ data: { reached: true } }));
    const endpoint = authenticatedEndpoint(z.object({}), handler);

    const response = await endpoint(
      context(new Request('https://example.test/api/private', { method: 'GET' })) as never
    );

    expect(response.status).toBe(401);
    expect(await json(response)).toMatchObject({
      success: false,
      message: 'Authentication required',
    });
    expect(handler).not.toHaveBeenCalled();
  });

  it('allows authenticated requests and exposes the Clerk subject on context.auth', async () => {
    (verifyToken as any).mockResolvedValue({ sub: 'clerk_user_123' });
    const handler = vi.fn(async (ctx) => ({
      data: { clerkId: ctx.auth.userId },
    }));
    const endpoint = authenticatedEndpoint(z.object({}), handler);

    const response = await endpoint(
      context(
        new Request('https://example.test/api/private', {
          method: 'GET',
          headers: { Authorization: 'Bearer session-token' },
        })
      ) as never
    );

    expect(response.status).toBe(200);
    expect(await json(response)).toMatchObject({
      success: true,
      data: { clerkId: 'clerk_user_123' },
    });
    expect(handler).toHaveBeenCalledOnce();
  });
});
