/**
 * Tests for `callApi` — the typed contract caller.
 *
 * Covers:
 *   - Input validation (Zod) → ApiError(VALIDATION_FAILED) before fetch fires
 *   - URL building (path interpolation + query string for GET)
 *   - Auth header injection from TokenProvider
 *   - Envelope parsing ({ success, data } + { success: false, code, error })
 *   - Response validation (server drift → ApiError(VALIDATION_FAILED))
 *   - Timeout / network error paths
 *   - skipResponseValidation escape hatch
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { z } from 'zod';
import { defineContract } from '../../api/contracts/types';
import { callApi } from '../callApi';
import { ApiError } from '../types';
import { ErrorCode } from '../../../functions/api/_shared/error-catalog';

// ─── Mock fetch ──────────────────────────────────────────────────────────────

const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    json: () => Promise.resolve(body),
    headers: new Headers(),
  } as unknown as Response;
}

// ─── Fixtures ────────────────────────────────────────────────────────────────

const PingRequestSchema = z.object({ msg: z.string().min(1) });
const PingResponseSchema = z.object({ echoed: z.string() });

const postPing = defineContract({
  method: 'POST',
  path: '/api/ping',
  request: PingRequestSchema,
  response: PingResponseSchema,
  description: 'test',
});

const SearchRequestSchema = z.object({
  q: z.string(),
  limit: z.number().int().positive().optional(),
});
const SearchResponseSchema = z.object({
  results: z.array(z.string()),
  count: z.number(),
});

const getSearch = defineContract({
  method: 'GET',
  path: '/api/search',
  request: SearchRequestSchema,
  response: SearchResponseSchema,
  description: 'test',
});

const GetByIdResponseSchema = z.object({ id: z.string(), name: z.string() });

const getById = defineContract({
  method: 'GET',
  path: '/api/items/:id',
  params: z.object({ id: z.string() }),
  response: GetByIdResponseSchema,
  description: 'test',
});

const getToken = vi.fn(() => Promise.resolve('tok_abc'));

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('callApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── Input validation ────────────────────────────────────────────────────

  it('throws VALIDATION_FAILED on invalid input before calling fetch', async () => {
    await expect(
      callApi(postPing, { msg: '' } as unknown as { msg: string }),
    ).rejects.toThrow(ApiError);

    try {
      await callApi(postPing, { msg: '' } as unknown as { msg: string });
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      const e = err as ApiError;
      expect(e.code).toBe(ErrorCode.VALIDATION_FAILED);
      expect(e.status).toBe(0);
    }
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('throws when payload is passed to a contract with no request schema', async () => {
    const noInput = defineContract({
      method: 'GET',
      path: '/api/health',
      response: z.object({ ok: z.boolean() }),
      description: 'test',
    });

    await expect(
      callApi(noInput, { stray: true } as unknown as undefined),
    ).rejects.toThrow(/does not accept an input payload/);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  // ── URL building ────────────────────────────────────────────────────────

  it('sends POST body when contract source is body', async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ success: true, data: { echoed: 'hi' } }),
    );

    await callApi(postPing, { msg: 'hi' }, { getToken });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe('/api/ping');
    expect(init.method).toBe('POST');
    expect(init.headers['Content-Type']).toBe('application/json');
    expect(JSON.parse(init.body as string)).toEqual({ msg: 'hi' });
  });

  it('appends query string for GET contracts with body→query default', async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ success: true, data: { results: [], count: 0 } }),
    );

    await callApi(getSearch, { q: 'otitis', limit: 5 }, { getToken });

    const [url, init] = mockFetch.mock.calls[0];
    expect(init.method).toBe('GET');
    // Body absent on GET
    expect(init.body).toBeUndefined();
    // Query params present
    expect(url).toMatch(/^\/api\/search\?/);
    expect(url).toContain('q=otitis');
    expect(url).toContain('limit=5');
  });

  it('interpolates :params into the path', async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ success: true, data: { id: 'abc', name: 'Aaron' } }),
    );

    await callApi(getById, undefined, {
      getToken,
      params: { id: 'abc' },
    });

    const [url] = mockFetch.mock.calls[0];
    expect(url).toBe('/api/items/abc');
  });

  it('prepends baseUrl to the interpolated path', async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ success: true, data: { echoed: 'hi' } }),
    );

    await callApi(postPing, { msg: 'hi' }, {
      getToken,
      baseUrl: 'https://api.studypanacea.com',
    });

    const [url] = mockFetch.mock.calls[0];
    expect(url).toBe('https://api.studypanacea.com/api/ping');
  });

  // ── Auth header ─────────────────────────────────────────────────────────

  it('injects Authorization header from getToken', async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ success: true, data: { echoed: 'hi' } }),
    );

    await callApi(postPing, { msg: 'hi' }, { getToken });

    const [, init] = mockFetch.mock.calls[0];
    expect(init.headers.Authorization).toBe('Bearer tok_abc');
  });

  it('omits Authorization when getToken returns null', async () => {
    const nullToken = vi.fn(() => Promise.resolve(null));
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ success: true, data: { echoed: 'hi' } }),
    );

    await callApi(postPing, { msg: 'hi' }, { getToken: nullToken });

    const [, init] = mockFetch.mock.calls[0];
    expect(init.headers.Authorization).toBeUndefined();
  });

  it('merges caller-provided headers', async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ success: true, data: { echoed: 'hi' } }),
    );

    await callApi(postPing, { msg: 'hi' }, {
      getToken,
      headers: { 'X-Trace': 'xyz' },
    });

    const [, init] = mockFetch.mock.calls[0];
    expect(init.headers['X-Trace']).toBe('xyz');
  });

  // ── Envelope parsing ────────────────────────────────────────────────────

  it('extracts .data from the success envelope', async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        success: true,
        data: { echoed: 'hi' },
        traceId: 't_1',
      }),
    );

    const result = await callApi(postPing, { msg: 'hi' }, { getToken });
    expect(result).toEqual({ echoed: 'hi' });
  });

  it('throws ApiError with server code on error envelope', async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse(
        {
          success: false,
          error: 'Rate limit exceeded',
          code: ErrorCode.RATE_LIMITED,
          message: 'Slow down',
        },
        429,
      ),
    );

    await expect(
      callApi(postPing, { msg: 'hi' }, { getToken }),
    ).rejects.toThrow(ApiError);

    try {
      mockFetch.mockResolvedValueOnce(
        jsonResponse(
          {
            success: false,
            error: 'Rate limit exceeded',
            code: ErrorCode.RATE_LIMITED,
            message: 'Slow down',
          },
          429,
        ),
      );
      await callApi(postPing, { msg: 'hi' }, { getToken });
    } catch (err) {
      const e = err as ApiError;
      expect(e.status).toBe(429);
      expect(e.code).toBe(ErrorCode.RATE_LIMITED);
      expect(e.message).toBe('Slow down');
    }
  });

  it('passes through legacy bare responses (no envelope wrapper)', async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ echoed: 'hi' }),
    );

    const result = await callApi(postPing, { msg: 'hi' }, { getToken });
    expect(result).toEqual({ echoed: 'hi' });
  });

  // ── Response validation ─────────────────────────────────────────────────

  it('throws VALIDATION_FAILED when server response breaks the contract', async () => {
    // Server forgets to return `echoed`.
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ success: true, data: { notEchoed: 'hi' } }),
    );

    await expect(
      callApi(postPing, { msg: 'hi' }, { getToken }),
    ).rejects.toThrow(ApiError);

    try {
      mockFetch.mockResolvedValueOnce(
        jsonResponse({ success: true, data: { notEchoed: 'hi' } }),
      );
      await callApi(postPing, { msg: 'hi' }, { getToken });
    } catch (err) {
      const e = err as ApiError;
      expect(e.status).toBe(500);
      expect(e.code).toBe(ErrorCode.VALIDATION_FAILED);
      expect(e.message).toContain('did not match contract');
    }
  });

  it('returns raw data when skipResponseValidation is true', async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ success: true, data: { notEchoed: 'hi' } }),
    );

    const result = await callApi(postPing, { msg: 'hi' }, {
      getToken,
      skipResponseValidation: true,
    });
    // No validation, so the mis-typed shape comes through untouched.
    expect(result).toEqual({ notEchoed: 'hi' });
  });

  // ── Network / timeout ───────────────────────────────────────────────────

  it('throws NETWORK_ERROR on fetch failure', async () => {
    mockFetch.mockRejectedValueOnce(new TypeError('Failed to fetch'));

    await expect(
      callApi(postPing, { msg: 'hi' }, { getToken }),
    ).rejects.toThrow(ApiError);

    try {
      mockFetch.mockRejectedValueOnce(new TypeError('Failed to fetch'));
      await callApi(postPing, { msg: 'hi' }, { getToken });
    } catch (err) {
      const e = err as ApiError;
      expect(e.code).toBe('NETWORK_ERROR');
      expect(e.category).toBe('network');
    }
  });

  it('throws TIMEOUT when the request aborts via the internal timer', async () => {
    // Simulate an abort by having fetch reject with an AbortError-shaped
    // object, which is what `AbortController.abort()` ultimately produces.
    mockFetch.mockRejectedValueOnce(
      Object.assign(new Error('aborted'), { name: 'AbortError' }),
    );

    try {
      await callApi(postPing, { msg: 'hi' }, { getToken, timeoutMs: 10 });
      throw new Error('should have thrown');
    } catch (err) {
      const e = err as ApiError;
      expect(e).toBeInstanceOf(ApiError);
      expect(e.code).toBe(ErrorCode.TIMEOUT);
      expect(e.category).toBe('timeout');
    }
  });
});
