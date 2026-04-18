import { describe, expect, it } from 'vitest';
import { resolveRequestId, getRequestId, attachLogMeta } from '../requestLogger';
import type { CloudflareContext } from '../middleware';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function makeContext(headers: Record<string, string> = {}): CloudflareContext {
  return {
    request: new Request('https://example.com/api/x', { headers }),
    env: {},
    params: {},
  };
}

describe('requestLogger: resolveRequestId', () => {
  it('returns an already-cached id without generating a new one', () => {
    const ctx = makeContext();
    (ctx as any)._requestId = 'sticky-id';
    expect(resolveRequestId(ctx)).toBe('sticky-id');
    // Call twice — should still be the same id, proving no churn
    expect(resolveRequestId(ctx)).toBe('sticky-id');
  });

  it('uses inbound X-Request-ID header when no cache exists', () => {
    const ctx = makeContext({ 'X-Request-ID': 'header-id-42' });
    expect(resolveRequestId(ctx)).toBe('header-id-42');
    // And caches it on the context
    expect((ctx as any)._requestId).toBe('header-id-42');
  });

  it('falls back to sentry-trace trace id when no header or cache', () => {
    const traceId = 'abcdef01234567890abcdef012345678';
    const ctx = makeContext({ 'sentry-trace': `${traceId}-span01-1` });
    expect(resolveRequestId(ctx)).toBe(traceId);
  });

  it('ignores malformed sentry-trace values and generates a UUID', () => {
    const ctx = makeContext({ 'sentry-trace': 'not-a-trace' });
    const id = resolveRequestId(ctx);
    expect(id).toMatch(UUID_RE);
  });

  it('generates a UUID when nothing is available', () => {
    const ctx = makeContext();
    const id = resolveRequestId(ctx);
    expect(id).toMatch(UUID_RE);
    // Repeated calls return the same id (cached on context)
    expect(resolveRequestId(ctx)).toBe(id);
  });

  it('prefers cache over headers (middleware-resolution order)', () => {
    const ctx = makeContext({ 'X-Request-ID': 'header-wins' });
    (ctx as any)._requestId = 'cache-wins';
    expect(resolveRequestId(ctx)).toBe('cache-wins');
  });
});

describe('requestLogger: getRequestId', () => {
  it('returns undefined before resolveRequestId is called', () => {
    const ctx = makeContext();
    expect(getRequestId(ctx)).toBeUndefined();
  });

  it('returns the resolved id after resolveRequestId sets it', () => {
    const ctx = makeContext({ 'X-Request-ID': 'after-resolve' });
    resolveRequestId(ctx);
    expect(getRequestId(ctx)).toBe('after-resolve');
  });
});

describe('requestLogger: attachLogMeta', () => {
  it('merges multiple calls into a single meta bag on context', () => {
    const ctx = makeContext();
    attachLogMeta(ctx, { fsrsMs: 12 });
    attachLogMeta(ctx, { dbMs: 4 });
    expect((ctx as any)._logMeta).toEqual({ fsrsMs: 12, dbMs: 4 });
  });

  it('overwrites keys from a later call (last writer wins)', () => {
    const ctx = makeContext();
    attachLogMeta(ctx, { stepsRun: 3 });
    attachLogMeta(ctx, { stepsRun: 8 });
    expect((ctx as any)._logMeta.stepsRun).toBe(8);
  });
});
