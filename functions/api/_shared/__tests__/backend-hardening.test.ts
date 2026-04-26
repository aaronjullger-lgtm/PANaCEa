import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { authenticatedEndpoint, publicEndpoint } from '../middleware';
import { ErrorCode } from '../error-catalog';

vi.mock('@clerk/backend', () => ({
  verifyToken: vi.fn(),
}));

import { verifyToken } from '@clerk/backend';

const BASE_ENV = {
  DATABASE_URL: 'postgres://test',
  CLERK_SECRET_KEY: 'sk_test_1234567890abcdefghijklmnopqrstuvwxyz',
};

function context(request: Request, env: Record<string, unknown> = {}) {
  return {
    request,
    env: { ...BASE_ENV, ...env },
    params: {},
    waitUntil: () => undefined,
    passThroughOnException: () => undefined,
  };
}

async function json(response: Response) {
  return (await response.json()) as Record<string, any>;
}

describe('backend hardening middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns the standardized error envelope for invalid request bodies', async () => {
    (verifyToken as any).mockResolvedValue({ sub: 'clerk_user_1' });
    const handler = vi.fn(async () => ({ data: { reached: true } }));
    const endpoint = authenticatedEndpoint(
      z.object({ body: z.object({ name: z.string().min(1) }) }),
      handler
    );

    const response = await endpoint(
      context(
        new Request('https://example.test/api/private', {
          method: 'POST',
          headers: {
            Authorization: 'Bearer session-token',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({}),
        })
      ) as never
    );

    const body = await json(response);
    expect(response.status).toBe(400);
    expect(body).toMatchObject({
      ok: false,
      error: { code: ErrorCode.VALIDATION_FAILED },
      success: false,
      code: ErrorCode.VALIDATION_FAILED,
    });
    expect(handler).not.toHaveBeenCalled();
  });

  it('rejects unauthenticated requests before handlers run', async () => {
    const handler = vi.fn(async () => ({ data: { reached: true } }));
    const endpoint = authenticatedEndpoint(z.object({}), handler);

    const response = await endpoint(
      context(new Request('https://example.test/api/private', { method: 'GET' })) as never
    );

    const body = await json(response);
    expect(response.status).toBe(401);
    expect(body).toMatchObject({
      ok: false,
      error: { code: ErrorCode.UNAUTHORIZED },
      success: false,
    });
    expect(handler).not.toHaveBeenCalled();
  });

  it('returns standardized rate-limit responses', async () => {
    (verifyToken as any).mockResolvedValue({ sub: 'clerk_user_1' });
    const kv = {
      get: vi.fn().mockResolvedValueOnce(null).mockResolvedValueOnce(1),
      put: vi.fn().mockResolvedValue(undefined),
    };
    const handler = vi.fn(async () => ({ data: { reached: true } }));
    const endpoint = authenticatedEndpoint(z.object({}), handler, { requestsPerMinute: 1 });
    const request = new Request('https://example.test/api/private', {
      method: 'GET',
      headers: { Authorization: 'Bearer session-token' },
    });

    const first = await endpoint(context(request, { RATE_LIMIT_KV: kv }) as never);
    const second = await endpoint(context(request, { RATE_LIMIT_KV: kv }) as never);

    expect(first.status).toBe(200);
    expect(second.status).toBe(429);
    expect(second.headers.get('Retry-After')).toBe('60');
    expect(await json(second)).toMatchObject({
      ok: false,
      error: { code: ErrorCode.RATE_LIMITED },
      success: false,
    });
    expect(handler).toHaveBeenCalledOnce();
  });

  it('does not expose stack traces in backend error responses', async () => {
    (verifyToken as any).mockResolvedValue({ sub: 'clerk_user_1' });
    const endpoint = authenticatedEndpoint(z.object({}), async () => {
      throw new Error('database password leaked in stack should not appear');
    });

    const response = await endpoint(
      context(
        new Request('https://example.test/api/private', {
          method: 'GET',
          headers: { Authorization: 'Bearer session-token' },
        }),
        { ENVIRONMENT: 'production' }
      ) as never
    );

    const body = await json(response);
    expect(response.status).toBe(500);
    expect(JSON.stringify(body)).not.toContain('database password');
    expect(body).toMatchObject({
      ok: false,
      error: { code: ErrorCode.INTERNAL_ERROR, message: 'Internal server error' },
    });
  });

  it('uses environment-provided CORS origins for preflight requests', async () => {
    const endpoint = publicEndpoint(z.object({}), async () => ({ data: { reached: true } }));

    const response = await endpoint(
      context(
        new Request('https://example.test/api/public', {
          method: 'OPTIONS',
          headers: { Origin: 'https://preview.example.test' },
        }),
        { ALLOWED_ORIGINS: 'https://preview.example.test' }
      ) as never
    );

    expect(response.status).toBe(204);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe(
      'https://preview.example.test'
    );
  });
});
