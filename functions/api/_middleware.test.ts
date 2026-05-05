import { describe, expect, it, vi } from 'vitest';
import { onRequest } from './_middleware';

function contextFor(
  url: string,
  env: Record<string, unknown>,
  next = vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 }))
) {
  return {
    request: new Request(url),
    env,
    next,
  };
}

describe('API gateway middleware', () => {
  it('classifies question-generation routes as AI and fails closed when KV errors', async () => {
    const next = vi.fn(async () => new Response('should not run'));
    const kv = {
      get: vi.fn().mockRejectedValue(new Error('kv unavailable')),
      put: vi.fn(),
    };

    const response = await onRequest(
      contextFor('https://example.test/api/questions/generate-rag', { RATE_LIMIT_KV: kv }, next)
    );
    const body = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(503);
    expect(response.headers.get('X-RateLimit-Tier')).toBe('ai');
    expect(body).toMatchObject({
      success: false,
      error: 'AI rate limiter unavailable. Please try again shortly.',
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('does not call handlers once the AI gateway limit is exhausted', async () => {
    const next = vi.fn(async () => new Response('should not run'));
    const kv = {
      get: vi.fn().mockResolvedValue(10),
      put: vi.fn(),
    };

    const response = await onRequest(
      contextFor('https://example.test/api/veo/generate', { RATE_LIMIT_KV: kv }, next)
    );
    const body = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(429);
    expect(response.headers.get('X-RateLimit-Tier')).toBe('ai');
    expect(body).toMatchObject({
      success: false,
      error: 'Too many requests. Please try again later.',
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('keeps non-AI routes fail-open on gateway KV errors', async () => {
    const next = vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 }));
    const kv = {
      get: vi.fn().mockRejectedValue(new Error('kv unavailable')),
      put: vi.fn(),
    };

    const response = await onRequest(
      contextFor('https://example.test/api/user/preferences', { RATE_LIMIT_KV: kv }, next)
    );
    const body = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(body).toMatchObject({ ok: true });
    expect(next).toHaveBeenCalledOnce();
  });

  it('classifies admin AI routes as AI before the broader admin tier', async () => {
    const next = vi.fn(async () => new Response('should not run'));
    const kv = {
      get: vi.fn().mockRejectedValue(new Error('kv unavailable')),
      put: vi.fn(),
    };

    const response = await onRequest(
      contextFor('https://example.test/api/admin/generate-question', { RATE_LIMIT_KV: kv }, next)
    );
    const body = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(503);
    expect(response.headers.get('X-RateLimit-Tier')).toBe('ai');
    expect(body).toMatchObject({
      success: false,
      error: 'AI rate limiter unavailable. Please try again shortly.',
    });
    expect(next).not.toHaveBeenCalled();
  });
});
