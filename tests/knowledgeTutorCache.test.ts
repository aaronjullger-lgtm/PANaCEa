/**
 * Knowledge / Tutor cache integration tests
 * - Streaming client includes cachedContent in request when provided (Tutor uses active library)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { streamGeminiText } from '@/lib/utils/streamingClient';

describe('Knowledge Tutor cache', () => {
  let fetchCalls: { url: string; body: string }[] = [];

  beforeEach(() => {
    fetchCalls = [];
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string, init?: RequestInit) => {
        fetchCalls.push({ url, body: (init?.body as string) ?? '' });
        return Promise.resolve({
          ok: true,
          status: 200,
          headers: new Headers({ 'content-type': 'text/event-stream' }),
          body: new ReadableStream({
            start(controller) {
              controller.enqueue(new TextEncoder().encode('data: {"text":"ok"}\n\n'));
              controller.close();
            },
          }),
        } as Response);
      })
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('includes cachedContent in request body when provided', async () => {
    await streamGeminiText('Explain this', {
      cachedContent: 'cachedContents/abc123',
      onChunk: () => {},
    });

    expect(fetchCalls.length).toBe(1);
    const body = JSON.parse(fetchCalls[0]?.body ?? '{}');
    expect(body.cachedContent).toBe('cachedContents/abc123');
    expect(body.prompt).toBe('Explain this');
  });

  it('omits cachedContent when not provided', async () => {
    await streamGeminiText('Explain this', { onChunk: () => {} });

    expect(fetchCalls.length).toBe(1);
    const body = JSON.parse(fetchCalls[0]?.body ?? '{}');
    expect(body).not.toHaveProperty('cachedContent');
  });

  it('omits cachedContent when value does not start with cachedContents/', async () => {
    await streamGeminiText('Explain this', {
      cachedContent: 'invalid-name',
      onChunk: () => {},
    });

    expect(fetchCalls.length).toBe(1);
    const body = JSON.parse(fetchCalls[0]?.body ?? '{}');
    expect(body).not.toHaveProperty('cachedContent');
  });
});
