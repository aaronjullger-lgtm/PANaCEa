/**
 * Tests for the PANaCEa SDK Core Client
 *
 * Verifies auth injection, envelope unwrapping, error handling, and timeout.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { createApiClient, type ApiClient } from '../core';
import { ApiError } from '../types';

// ─── Mock fetch ───────────────────────────────────────────────────────────

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

// ─── Helpers ──────────────────────────────────────────────────────────────

const mockGetToken = vi.fn(() => Promise.resolve('test-token-123'));

describe('createApiClient', () => {
  let api: ApiClient;

  beforeEach(() => {
    vi.clearAllMocks();
    api = createApiClient(mockGetToken);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── Auth ──────────────────────────────────────────────────────────────

  it('injects Authorization header from token provider', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ data: { id: '1' } }));

    await api.get('/api/user/profile');

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [, init] = mockFetch.mock.calls[0];
    expect(init.headers.Authorization).toBe('Bearer test-token-123');
  });

  it('omits Authorization header when token is null', async () => {
    mockGetToken.mockResolvedValueOnce(null);
    mockFetch.mockResolvedValueOnce(jsonResponse({ data: {} }));

    await api.get('/api/public/health');

    const [, init] = mockFetch.mock.calls[0];
    expect(init.headers.Authorization).toBeUndefined();
  });

  // ── Envelope Unwrapping ───────────────────────────────────────────────

  it('unwraps { data: T } envelope', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ data: { name: 'Aaron' } }));

    const result = await api.get<{ name: string }>('/api/user/profile');
    expect(result).toEqual({ name: 'Aaron' });
  });

  it('unwraps { success: true, data: T } envelope', async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ success: true, data: { totalAttempts: 42 } })
    );

    const result = await api.get<{ totalAttempts: number }>('/api/user/stats');
    expect(result).toEqual({ totalAttempts: 42 });
  });

  it('returns bare object when no envelope wrapper', async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ sessionId: 'ses_123', questions: [] })
    );

    const result = await api.get<{ sessionId: string }>('/api/session/get');
    expect(result).toEqual({ sessionId: 'ses_123', questions: [] });
  });

  // ── POST with body ────────────────────────────────────────────────────

  it('sends JSON body on POST and sets Content-Type', async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ data: { isCorrect: true } })
    );

    const payload = { questionId: 'q1', selectedAnswer: 'A', timeSpentMs: 5000 };
    await api.post('/api/drills/submit-review', payload);

    const [, init] = mockFetch.mock.calls[0];
    expect(init.method).toBe('POST');
    expect(init.headers['Content-Type']).toBe('application/json');
    expect(JSON.parse(init.body)).toEqual(payload);
  });

  // ── Query params ──────────────────────────────────────────────────────

  it('appends query params to URL', async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ data: { results: [], count: 0 } })
    );

    await api.get('/api/content/search', { q: 'otitis media' });

    const [url] = mockFetch.mock.calls[0];
    expect(url).toBe('/api/content/search?q=otitis+media');
  });

  // ── Error handling ────────────────────────────────────────────────────

  it('throws ApiError with status and message on non-2xx', async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ error: 'Unauthorized', code: 'AUTH_FAILED' }, 401)
    );

    await expect(api.get('/api/user/profile')).rejects.toThrow(ApiError);

    try {
      mockFetch.mockResolvedValueOnce(
        jsonResponse({ error: 'Not Found' }, 404)
      );
      await api.get('/api/user/profile');
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      const apiErr = err as ApiError;
      expect(apiErr.status).toBe(404);
      expect(apiErr.message).toBe('Not Found');
    }
  });

  it('throws ApiError with NETWORK_ERROR on fetch failure', async () => {
    // GET retries up to maxRetries (default 2) + 1 initial = 3 attempts total
    mockFetch
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockRejectedValueOnce(new TypeError('Failed to fetch'));

    await expect(api.get('/api/health')).rejects.toThrow(ApiError);

    try {
      mockFetch
        .mockRejectedValueOnce(new TypeError('Failed to fetch'))
        .mockRejectedValueOnce(new TypeError('Failed to fetch'))
        .mockRejectedValueOnce(new TypeError('Failed to fetch'));
      await api.get('/api/health');
    } catch (err) {
      const apiErr = err as ApiError;
      expect(apiErr.code).toBe('NETWORK_ERROR');
    }
  });

  // ── Base URL ──────────────────────────────────────────────────────────

  it('prepends baseUrl to path', async () => {
    const customApi = createApiClient(mockGetToken, {
      baseUrl: 'https://api.studypanacea.com',
    });
    mockFetch.mockResolvedValueOnce(jsonResponse({ data: {} }));

    await customApi.get('/api/user/profile');

    const [url] = mockFetch.mock.calls[0];
    expect(url).toBe('https://api.studypanacea.com/api/user/profile');
  });

  // ── Default headers ───────────────────────────────────────────────────

  it('merges default headers into every request', async () => {
    const customApi = createApiClient(mockGetToken, {
      defaultHeaders: { 'X-App-Version': '2.0.0' },
    });
    mockFetch.mockResolvedValueOnce(jsonResponse({ data: {} }));

    await customApi.get('/api/user/profile');

    const [, init] = mockFetch.mock.calls[0];
    expect(init.headers['X-App-Version']).toBe('2.0.0');
  });
});
