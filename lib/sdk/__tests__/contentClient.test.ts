/**
 * Tests for the PANaCEa SDK Content Client
 *
 * Verifies that semanticSearch uses POST (matching the onRequestPost handler)
 * and that search uses GET (matching the onRequestGet handler).
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createApiClient, type ApiClient } from '../core';
import { createContentClient, type ContentClient } from '../contentClient';

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

describe('createContentClient', () => {
  let api: ApiClient;
  let content: ContentClient;

  beforeEach(() => {
    vi.clearAllMocks();
    api = createApiClient(mockGetToken);
    content = createContentClient(api);
  });

  // ── semanticSearch uses POST ────────────────────────────────────────────

  it('semanticSearch sends POST request (matching onRequestPost handler)', async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        data: {
          results: [
            { id: '1', condition: 'Heart Failure', similarity: 0.92 },
          ],
          count: 1,
        },
      })
    );

    await content.semanticSearch({ query: 'heart failure treatment', limit: 10 });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, init] = mockFetch.mock.calls[0];

    // Must be POST — the endpoint is onRequestPost
    expect(init.method).toBe('POST');

    // Must target the correct endpoint
    expect(url).toContain('/api/library/semantic-search');

    // Body must contain query and limit as JSON
    const body = JSON.parse(init.body);
    expect(body.query).toBe('heart failure treatment');
    expect(body.limit).toBe(10);
  });

  it('semanticSearch sends POST without limit when not provided', async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        data: { results: [], count: 0 },
      })
    );

    await content.semanticSearch({ query: 'pneumonia' });

    const [url, init] = mockFetch.mock.calls[0];
    expect(init.method).toBe('POST');

    const body = JSON.parse(init.body);
    expect(body.query).toBe('pneumonia');
    expect(body.limit).toBeUndefined();
  });

  it('semanticSearch sends POST with system filter when provided', async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        data: { results: [], count: 0 },
      })
    );

    await content.semanticSearch({ query: 'chest pain', system: 'Cardiovascular' });

    const [, init] = mockFetch.mock.calls[0];
    const body = JSON.parse(init.body);
    expect(body.system).toBe('Cardiovascular');
  });

  // ── search uses GET ────────────────────────────────────────────────────

  it('search sends GET request with query param', async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        data: {
          results: [{ id: '1', name: 'Otitis Media', type: 'condition' }],
          count: 1,
          query: 'otitis',
        },
      })
    );

    await content.search('otitis');

    const [url, init] = mockFetch.mock.calls[0];
    expect(init.method).toBe('GET');
    expect(url).toContain('/api/content/search');
    expect(url).toContain('q=otitis');
  });

  // ── Error handling ─────────────────────────────────────────────────────

  it('semanticSearch propagates ApiError on server error', async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ error: 'Semantic search failed' }, 500)
    );

    await expect(
      content.semanticSearch({ query: 'test' })
    ).rejects.toThrow();
  });
});
