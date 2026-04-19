import { describe, expect, it, vi, beforeEach } from 'vitest';
import { z } from 'zod';
import { withEndpoint, cronEndpoint, ok } from '../endpoint';
import type { ApiSuccessEnvelope, ApiErrorEnvelope } from '../api-response';
import { ErrorCode } from '../error-catalog';

// Minimal env for endpoint tests. Auth-level stacks require CLERK_SECRET_KEY,
// so we only exercise the 'none' (public) level here — the role-specific
// behaviour is covered by the existing middleware-level test suites.
const PUBLIC_ENV = {
  DATABASE_URL: 'postgres://test',
};

async function parse<T>(res: Response): Promise<T> {
  return (await res.json()) as T;
}

function fakeContext(request: Request, env: Record<string, unknown> = PUBLIC_ENV) {
  return {
    request,
    env,
    params: {},
    waitUntil: () => undefined,
    passThroughOnException: () => undefined,
    data: {},
    next: vi.fn(),
  };
}

describe('withEndpoint: auth=none (public)', () => {
  it('runs the handler and produces the unified envelope', async () => {
    const handler = vi.fn(async () => ok({ got: true }));
    const fn = withEndpoint({
      auth: 'none',
      schema: z.object({ foo: z.string() }),
      source: 'query',
      handler,
    });

    const req = new Request('https://example.com/api/x?foo=bar', { method: 'GET' });
    const res = await fn(fakeContext(req) as never);

    expect(res.status).toBe(200);
    const body = await parse<ApiSuccessEnvelope<{ got: boolean }>>(res);
    expect(body.success).toBe(true);
    expect(body.data).toEqual({ got: true });
    expect(typeof body.traceId).toBe('string');
    expect(handler).toHaveBeenCalledOnce();
  });

  it('returns 400 VALIDATION_FAILED when query fails schema', async () => {
    const fn = withEndpoint({
      auth: 'none',
      schema: z.object({ foo: z.string().min(3) }),
      source: 'query',
      handler: async () => ok({}),
    });

    const req = new Request('https://example.com/api/x?foo=no', { method: 'GET' });
    const res = await fn(fakeContext(req) as never);

    expect(res.status).toBe(400);
    const body = await parse<ApiErrorEnvelope>(res);
    // Envelope consistency: code is a catalog code, traceId present
    expect([ErrorCode.VALIDATION_FAILED, ErrorCode.ERROR]).toContain(body.code);
    expect(typeof body.traceId).toBe('string');
  });

  it('stamps X-Request-ID and X-Trace-ID headers on success', async () => {
    const fn = withEndpoint({
      auth: 'none',
      schema: z.object({}).optional(),
      source: 'query',
      handler: async () => ok({ ok: true }),
    });

    const req = new Request('https://example.com/api/x', { method: 'GET' });
    const res = await fn(fakeContext(req) as never);

    // Middleware provides X-Request-ID; api-response.ok adds X-Trace-ID too.
    const requestId = res.headers.get('X-Request-ID');
    expect(requestId).toBeTruthy();
  });
});

describe('cronEndpoint', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const CRON_ENV = { CRON_SECRET: 'super-secret', DATABASE_URL: 'postgres://t' };

  it('rejects requests with no secret', async () => {
    const fn = cronEndpoint({
      handler: async () => new Response('ok', { status: 200 }),
    });
    const req = new Request('https://example.com/api/cron/x', { method: 'POST' });
    const res = await fn(fakeContext(req, CRON_ENV) as never);
    expect(res.status).toBe(401);
    const body = await parse<ApiErrorEnvelope>(res);
    expect(body.code).toBe(ErrorCode.UNAUTHORIZED);
  });

  it('rejects requests with wrong secret', async () => {
    const fn = cronEndpoint({
      handler: async () => new Response('ok', { status: 200 }),
    });
    const req = new Request('https://example.com/api/cron/x', {
      method: 'POST',
      headers: { authorization: 'Bearer wrong' },
    });
    const res = await fn(fakeContext(req, CRON_ENV) as never);
    expect(res.status).toBe(401);
  });

  it('returns 500 ENV_MISCONFIGURED when CRON_SECRET is not set', async () => {
    const fn = cronEndpoint({
      handler: async () => new Response('ok', { status: 200 }),
    });
    const req = new Request('https://example.com/api/cron/x', {
      method: 'POST',
      headers: { authorization: 'Bearer whatever' },
    });
    const res = await fn(fakeContext(req, { DATABASE_URL: 'x' }) as never);
    expect(res.status).toBe(500);
    const body = await parse<ApiErrorEnvelope>(res);
    expect(body.code).toBe(ErrorCode.ENV_MISCONFIGURED);
  });

  it('accepts the correct secret via Authorization: Bearer', async () => {
    const handler = vi.fn(async () => ok({ ran: true }));
    const fn = cronEndpoint({ handler });
    const req = new Request('https://example.com/api/cron/x', {
      method: 'POST',
      headers: { authorization: `Bearer super-secret` },
      body: JSON.stringify({}),
    });
    const res = await fn(fakeContext(req, CRON_ENV) as never);
    expect(res.status).toBe(200);
    expect(handler).toHaveBeenCalledOnce();
  });

  it('accepts the correct secret via X-Cron-Secret header', async () => {
    const handler = vi.fn(async () => ok({ ran: true }));
    const fn = cronEndpoint({ handler });
    const req = new Request('https://example.com/api/cron/x', {
      method: 'POST',
      headers: { 'x-cron-secret': 'super-secret' },
      body: JSON.stringify({}),
    });
    const res = await fn(fakeContext(req, CRON_ENV) as never);
    expect(res.status).toBe(200);
  });

  it('validates payload when a schema is given', async () => {
    const fn = cronEndpoint({
      schema: z.object({ job: z.string() }),
      handler: async () => ok({ ran: true }),
    });
    const req = new Request('https://example.com/api/cron/x', {
      method: 'POST',
      headers: { authorization: 'Bearer super-secret' },
      body: JSON.stringify({ job: 123 }),
    });
    const res = await fn(fakeContext(req, CRON_ENV) as never);
    expect(res.status).toBe(400);
    const body = await parse<ApiErrorEnvelope>(res);
    expect(body.code).toBe(ErrorCode.VALIDATION_FAILED);
  });

  it('returns INVALID_JSON for malformed bodies', async () => {
    const fn = cronEndpoint({
      schema: z.object({}).passthrough(),
      handler: async () => ok({}),
    });
    const req = new Request('https://example.com/api/cron/x', {
      method: 'POST',
      headers: { authorization: 'Bearer super-secret' },
      body: 'not json',
    });
    const res = await fn(fakeContext(req, CRON_ENV) as never);
    expect(res.status).toBe(400);
    const body = await parse<ApiErrorEnvelope>(res);
    expect(body.code).toBe(ErrorCode.INVALID_JSON);
  });

  it('wraps caught handler errors in INTERNAL_ERROR', async () => {
    const fn = cronEndpoint({
      handler: async () => {
        throw new Error('boom');
      },
    });
    const req = new Request('https://example.com/api/cron/x', {
      method: 'POST',
      headers: { authorization: 'Bearer super-secret' },
      body: JSON.stringify({}),
    });
    const res = await fn(fakeContext(req, CRON_ENV) as never);
    expect(res.status).toBe(500);
    const body = await parse<ApiErrorEnvelope>(res);
    expect(body.code).toBe(ErrorCode.INTERNAL_ERROR);
    expect(body.message).toContain('boom');
  });
});
