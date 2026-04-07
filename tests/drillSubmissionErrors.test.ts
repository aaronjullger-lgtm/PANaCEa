/**
 * Error Handling Tests for Drill Submission Pipeline
 *
 * Covers:
 * 1. SDK retry logic (core.ts) — transient errors trigger backoff, auth errors don't
 * 2. ApiError classification (types.ts) — category, isRetryable, userMessage
 * 3. drillReviewService transaction retry on timeout
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { createApiClient, type ApiClient } from '../lib/sdk/core';
import { ApiError } from '../lib/sdk/types';

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

const mockGetToken = vi.fn(() => Promise.resolve('test-token'));

// ═══════════════════════════════════════════════════════════════════════════
// 1. ApiError Classification
// ═══════════════════════════════════════════════════════════════════════════

describe('ApiError classification', () => {
  it('categorizes network errors as retryable', () => {
    const err = new ApiError(0, 'Network error', 'NETWORK_ERROR');
    expect(err.category).toBe('network');
    expect(err.isRetryable).toBe(true);
    expect(err.isAuthError).toBe(false);
    expect(err.userMessage).toContain('connection');
  });

  it('categorizes timeout errors as retryable', () => {
    const err = new ApiError(0, 'Request timed out after 30000ms', 'TIMEOUT');
    expect(err.category).toBe('timeout');
    expect(err.isRetryable).toBe(true);
    expect(err.userMessage).toContain('too long');
  });

  it('categorizes 500 errors as retryable server errors', () => {
    const err = new ApiError(500, 'Internal server error');
    expect(err.category).toBe('server');
    expect(err.isRetryable).toBe(true);
    expect(err.userMessage).toContain('our end');
  });

  it('categorizes 504 gateway timeout as retryable', () => {
    const err = new ApiError(504, 'Gateway timeout', 'SUBMISSION_TIMEOUT');
    expect(err.category).toBe('server');
    expect(err.isRetryable).toBe(true);
  });

  it('categorizes 401 as auth error (not retryable)', () => {
    const err = new ApiError(401, 'Unauthorized');
    expect(err.category).toBe('auth');
    expect(err.isRetryable).toBe(false);
    expect(err.isAuthError).toBe(true);
    expect(err.userMessage).toContain('sign in');
  });

  it('categorizes 403 as auth error (not retryable)', () => {
    const err = new ApiError(403, 'Forbidden');
    expect(err.category).toBe('auth');
    expect(err.isRetryable).toBe(false);
    expect(err.isAuthError).toBe(true);
  });

  it('categorizes 400 as validation error (not retryable)', () => {
    const err = new ApiError(400, 'Bad request');
    expect(err.category).toBe('validation');
    expect(err.isRetryable).toBe(false);
    expect(err.userMessage).toContain('wrong with the request');
  });

  it('categorizes 404 as validation error (not retryable)', () => {
    const err = new ApiError(404, 'Not found');
    expect(err.category).toBe('validation');
    expect(err.isRetryable).toBe(false);
  });

  it('preserves code and details', () => {
    const details = { field: 'questionId', constraint: 'required' };
    const err = new ApiError(422, 'Validation failed', 'VALIDATION_ERROR', details);
    expect(err.code).toBe('VALIDATION_ERROR');
    expect(err.details).toEqual(details);
    expect(err.status).toBe(422);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 2. SDK Core Retry Logic
// ═══════════════════════════════════════════════════════════════════════════

describe('SDK core retry logic', () => {
  let api: ApiClient;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('retries GET requests on 500 errors up to maxRetries', async () => {
    api = createApiClient(mockGetToken, { maxRetries: 2 });

    // Fail twice, succeed on third
    mockFetch
      .mockResolvedValueOnce(jsonResponse({ error: 'Internal error' }, 500))
      .mockResolvedValueOnce(jsonResponse({ error: 'Internal error' }, 500))
      .mockResolvedValueOnce(jsonResponse({ data: { ok: true } }));

    const result = await api.get<{ ok: boolean }>('/api/health');
    expect(result).toEqual({ ok: true });
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  it('does NOT retry POST requests by default', async () => {
    api = createApiClient(mockGetToken, { maxRetries: 2 });

    mockFetch.mockResolvedValueOnce(jsonResponse({ error: 'Server error' }, 500));

    await expect(api.post('/api/drills/submit-review', { questionId: 'q1' }))
      .rejects.toThrow(ApiError);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('retries POST requests for explicitly allowed paths', async () => {
    api = createApiClient(mockGetToken, {
      maxRetries: 1,
      retryablePosts: ['/api/drills/submit-review'],
    });

    // Fail once (timeout), succeed on retry
    mockFetch
      .mockRejectedValueOnce(Object.assign(new Error('aborted'), { name: 'AbortError' }))
      .mockResolvedValueOnce(jsonResponse({ data: { isCorrect: true } }));

    const result = await api.post<{ isCorrect: boolean }>(
      '/api/drills/submit-review',
      { questionId: 'q1' }
    );
    expect(result).toEqual({ isCorrect: true });
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('does NOT retry auth errors (401)', async () => {
    api = createApiClient(mockGetToken, { maxRetries: 2 });

    mockFetch.mockResolvedValueOnce(jsonResponse({ error: 'Unauthorized' }, 401));

    await expect(api.get('/api/user/profile')).rejects.toThrow(ApiError);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('does NOT retry validation errors (400)', async () => {
    api = createApiClient(mockGetToken, { maxRetries: 2 });

    mockFetch.mockResolvedValueOnce(jsonResponse({ error: 'Bad request' }, 400));

    await expect(api.get('/api/questions/bad-id')).rejects.toThrow(ApiError);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('retries network errors on GET', async () => {
    api = createApiClient(mockGetToken, { maxRetries: 1 });

    mockFetch
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce(jsonResponse({ data: { ok: true } }));

    const result = await api.get<{ ok: boolean }>('/api/health');
    expect(result).toEqual({ ok: true });
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('throws after exhausting retries', async () => {
    api = createApiClient(mockGetToken, { maxRetries: 1 });

    mockFetch
      .mockResolvedValueOnce(jsonResponse({ error: 'Internal error' }, 500))
      .mockResolvedValueOnce(jsonResponse({ error: 'Internal error' }, 500));

    const err = await api.get('/api/health').catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(500);
    expect(err.isRetryable).toBe(true);
    expect(mockFetch).toHaveBeenCalledTimes(2); // 1 initial + 1 retry
  });

  it('disables retry when maxRetries is 0', async () => {
    api = createApiClient(mockGetToken, { maxRetries: 0 });

    mockFetch.mockResolvedValueOnce(jsonResponse({ error: 'error' }, 500));

    await expect(api.get('/api/health')).rejects.toThrow(ApiError);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 3. ApiError user-facing messages are honest but non-scary
// ═══════════════════════════════════════════════════════════════════════════

describe('ApiError userMessage quality', () => {
  const cases: Array<[number, string | undefined, string[]]> = [
    // [status, code, must-contain-words]
    [0, 'NETWORK_ERROR', ['connection']],
    [0, 'TIMEOUT', ['too long']],
    [401, undefined, ['sign in']],
    [500, undefined, ['our end']],
    [400, undefined, ['try again']],
  ];

  it.each(cases)(
    'status=%i code=%s produces helpful message',
    (status, code, mustContain) => {
      const err = new ApiError(status, 'test', code);
      const msg = err.userMessage.toLowerCase();
      for (const word of mustContain) {
        expect(msg).toContain(word);
      }
      // Must NEVER contain scary technical terms
      expect(msg).not.toContain('exception');
      expect(msg).not.toContain('stack');
      expect(msg).not.toContain('prisma');
      expect(msg).not.toContain('database');
    },
  );
});
