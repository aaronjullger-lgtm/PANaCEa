import { describe, expect, it } from 'vitest';
import {
  ok,
  fail,
  envelopeFromHandlerResult,
  envelopeInternalError,
  jsonSuccess,
  jsonError,
  type ApiSuccessEnvelope,
  type ApiErrorEnvelope,
} from '../api-response';
import { ErrorCode } from '../error-catalog';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const FALLBACK_TRACE_RE = /^t-[a-z0-9]+-[a-z0-9]+$/;

async function parse<T>(res: Response): Promise<T> {
  return (await res.json()) as T;
}

describe('api-response: ok()', () => {
  it('returns 200 with the unified envelope shape', async () => {
    const res = ok({ hello: 'world' });
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toContain('application/json');

    const body = await parse<ApiSuccessEnvelope<{ hello: string }>>(res);
    expect(body.ok).toBe(true);
    expect(body.success).toBe(true);
    expect(body.data).toEqual({ hello: 'world' });
    expect(typeof body.traceId).toBe('string');
    expect(body.traceId).toMatch(new RegExp(`${UUID_RE.source}|${FALLBACK_TRACE_RE.source}`, 'i'));
    expect(body.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('propagates traceId into body and both X-Request-ID + X-Trace-ID headers', async () => {
    const res = ok({ ok: true }, { traceId: 'fixed-trace-123' });
    expect(res.headers.get('X-Request-ID')).toBe('fixed-trace-123');
    expect(res.headers.get('X-Trace-ID')).toBe('fixed-trace-123');
    const body = await parse<ApiSuccessEnvelope<{ ok: boolean }>>(res);
    expect(body.traceId).toBe('fixed-trace-123');
  });

  it('honors custom status and optional message', async () => {
    const res = ok({ id: 'abc' }, { status: 201, message: 'Created' });
    expect(res.status).toBe(201);
    const body = await parse<ApiSuccessEnvelope<{ id: string }>>(res);
    expect(body.message).toBe('Created');
  });

  it('forwards sentry-trace header from the incoming request', async () => {
    const req = new Request('https://example.com/api/x', {
      headers: { 'sentry-trace': 'abc123-def456-1' },
    });
    const res = ok({}, { request: req });
    expect(res.headers.get('Sentry-Trace')).toBe('abc123-def456-1');
  });

  it('includes custom headers without clobbering envelope headers', async () => {
    const res = ok({}, { headers: { 'X-Custom': 'yes' } });
    expect(res.headers.get('X-Custom')).toBe('yes');
    expect(res.headers.get('Content-Type')).toContain('application/json');
  });
});

describe('api-response: fail()', () => {
  it('resolves status and default message from the catalog', async () => {
    const res = fail(ErrorCode.UNAUTHORIZED);
    expect(res.status).toBe(401);
    const body = await parse<ApiErrorEnvelope>(res);
    expect(body.ok).toBe(false);
    expect(body.success).toBe(false);
    expect(body.error).toEqual({
      code: ErrorCode.UNAUTHORIZED,
      message: 'Authentication required',
    });
    expect(body.code).toBe(ErrorCode.UNAUTHORIZED);
    expect(body.message).toBe('Authentication required');
    expect(typeof body.traceId).toBe('string');
  });

  it('allows overriding message and details', async () => {
    const res = fail(ErrorCode.VALIDATION_FAILED, {
      message: 'bad body',
      details: [{ path: ['email'], message: 'required' }],
    });
    expect(res.status).toBe(400);
    const body = await parse<ApiErrorEnvelope>(res);
    expect(body.message).toBe('bad body');
    expect(body.error).toMatchObject({
      code: ErrorCode.VALIDATION_FAILED,
      message: 'bad body',
      details: [{ path: ['email'], message: 'required' }],
    });
    expect(body.details).toEqual([{ path: ['email'], message: 'required' }]);
  });

  it('sets Retry-After header for rate-limited responses', async () => {
    const res = fail(ErrorCode.RATE_LIMITED, { retryAfterSeconds: 30 });
    expect(res.status).toBe(429);
    expect(res.headers.get('Retry-After')).toBe('30');
  });

  it('rounds fractional retry-after up', () => {
    const res = fail(ErrorCode.RATE_LIMITED, { retryAfterSeconds: 12.2 });
    expect(res.headers.get('Retry-After')).toBe('13');
  });

  it('collapses unknown codes to ERROR (500)', async () => {
    const res = fail('BOGUS_CODE' as ErrorCode);
    expect(res.status).toBe(500);
    const body = await parse<ApiErrorEnvelope>(res);
    expect(body.code).toBe(ErrorCode.ERROR);
  });

  it('honors status override when provided', async () => {
    const res = fail(ErrorCode.VALIDATION_FAILED, { status: 422 });
    expect(res.status).toBe(422);
    const body = await parse<ApiErrorEnvelope>(res);
    expect(body.code).toBe(ErrorCode.VALIDATION_FAILED);
  });

  it('emits traceId in body and both headers', async () => {
    const res = fail(ErrorCode.NOT_FOUND, { traceId: 'trace-xyz' });
    expect(res.headers.get('X-Request-ID')).toBe('trace-xyz');
    expect(res.headers.get('X-Trace-ID')).toBe('trace-xyz');
    const body = await parse<ApiErrorEnvelope>(res);
    expect(body.traceId).toBe('trace-xyz');
  });
});

describe('api-response: envelopeFromHandlerResult()', () => {
  const req = new Request('https://example.com/api/x');

  it('passthroughs an existing Response and stamps the traceId headers', async () => {
    const inner = new Response(JSON.stringify({ success: true, data: 1 }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
    const out = envelopeFromHandlerResult(inner, req, 'trace-pass');
    expect(out.status).toBe(201);
    expect(out.headers.get('X-Request-ID')).toBe('trace-pass');
    expect(out.headers.get('X-Trace-ID')).toBe('trace-pass');
  });

  it('wraps a { data } handler result in the success envelope', async () => {
    const out = envelopeFromHandlerResult(
      { status: 200, data: { items: [1, 2, 3] } },
      req,
      'trace-1'
    );
    expect(out.status).toBe(200);
    const body = await parse<ApiSuccessEnvelope<{ items: number[] }>>(out);
    expect(body.ok).toBe(true);
    expect(body.success).toBe(true);
    expect(body.data).toEqual({ items: [1, 2, 3] });
    expect(body.traceId).toBe('trace-1');
  });

  it('normalizes legacy success envelopes before wrapping handler data', async () => {
    const out = envelopeFromHandlerResult(
      { status: 200, data: { success: true, data: { items: [1, 2, 3] } } },
      req,
      'trace-legacy'
    );

    expect(out.status).toBe(200);
    const body = await parse<ApiSuccessEnvelope<{ items: number[] }>>(out);
    expect(body.ok).toBe(true);
    expect(body.success).toBe(true);
    expect(body.data).toEqual({ items: [1, 2, 3] });
    expect(body.traceId).toBe('trace-legacy');
  });

  it('preserves handler headers while wrapping data', async () => {
    const out = envelopeFromHandlerResult(
      { status: 200, data: { ok: true }, headers: { 'X-Cache-Test': 'yes' } },
      req,
      'trace-h'
    );
    expect(out.headers.get('X-Cache-Test')).toBe('yes');
    const body = await parse<ApiSuccessEnvelope<{ ok: boolean }>>(out);
    expect(body.ok).toBe(true);
  });

  it('wraps a { error } handler result in the error envelope with inferred code', async () => {
    const out = envelopeFromHandlerResult(
      { status: 404, error: 'No such user' },
      req,
      'trace-2'
    );
    expect(out.status).toBe(404);
    const body = await parse<ApiErrorEnvelope>(out);
    expect(body.success).toBe(false);
    expect(body.code).toBe(ErrorCode.NOT_FOUND);
    expect(body.message).toBe('No such user');
    expect(body.traceId).toBe('trace-2');
  });

  it('defaults status to 200 when not provided', async () => {
    const out = envelopeFromHandlerResult({ data: { k: 'v' } }, req, 't');
    expect(out.status).toBe(200);
  });
});

describe('api-response: envelopeInternalError()', () => {
  it('produces a 500 INTERNAL_ERROR envelope with traceId', async () => {
    const req = new Request('https://example.com/api/boom');
    const res = envelopeInternalError(req, 'trace-boom');
    expect(res.status).toBe(500);
    const body = await parse<ApiErrorEnvelope>(res);
    expect(body.code).toBe(ErrorCode.INTERNAL_ERROR);
    expect(body.traceId).toBe('trace-boom');
  });
});

describe('api-response: legacy aliases', () => {
  it('jsonSuccess() delegates to ok()', async () => {
    const res = jsonSuccess({ x: 1 });
    const body = await parse<ApiSuccessEnvelope<{ x: number }>>(res);
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.x).toBe(1);
    expect(typeof body.traceId).toBe('string');
  });

  it('jsonError() infers code from status', async () => {
    const res = jsonError('boom', 401);
    const body = await parse<ApiErrorEnvelope>(res);
    expect(res.status).toBe(401);
    expect(body.code).toBe(ErrorCode.UNAUTHORIZED);
    expect(body.message).toBe('boom');
  });

  it('jsonError() respects an explicit catalog code', async () => {
    const res = jsonError('gemini sad', 502, { code: ErrorCode.GEMINI_ERROR });
    const body = await parse<ApiErrorEnvelope>(res);
    expect(body.code).toBe(ErrorCode.GEMINI_ERROR);
    expect(res.status).toBe(502);
  });

  it('jsonError() ignores unknown codes and falls back to status inference', async () => {
    const res = jsonError('still bad', 429, { code: 'NOT_A_CODE' });
    const body = await parse<ApiErrorEnvelope>(res);
    expect(body.code).toBe(ErrorCode.RATE_LIMITED);
  });
});
