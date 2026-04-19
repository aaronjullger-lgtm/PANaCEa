import { describe, it, expect } from 'vitest';
import {
  ok,
  failed,
  classifyError,
  failedFromResponse,
  dataOrEmpty,
  isEnrichmentFailed,
  isEnrichmentOk,
  type EnrichmentResult,
} from './enrichmentResult';

describe('enrichmentResult', () => {
  it('ok() produces a well-formed success with ISO timestamp', () => {
    const r = ok(['a', 'b']);
    expect(r.status).toBe('ok');
    if (r.status !== 'ok') throw new Error('narrowing');
    expect(r.data).toEqual(['a', 'b']);
    expect(Number.isFinite(Date.parse(r.fetchedAt))).toBe(true);
    expect(r.fromCache).toBeUndefined();
  });

  it('ok({fromCache:true}) records cache hit flag', () => {
    const r = ok([], { fromCache: true });
    if (r.status !== 'ok') throw new Error('narrowing');
    expect(r.fromCache).toBe(true);
  });

  it('failed() produces a well-formed failure with reason + timestamp', () => {
    const r = failed('timeout', 'PubMed took too long');
    expect(r.status).toBe('failed');
    if (r.status !== 'failed') throw new Error('narrowing');
    expect(r.reason).toBe('timeout');
    expect(r.message).toBe('PubMed took too long');
    expect(Number.isFinite(Date.parse(r.failedAt))).toBe(true);
  });

  it('classifyError maps TimeoutError name → timeout', () => {
    const err = new Error('boom');
    err.name = 'TimeoutError';
    const r = classifyError(err);
    expect(r.status).toBe('failed');
    expect(r.reason).toBe('timeout');
  });

  it('classifyError maps AbortError → timeout', () => {
    const err = new Error('aborted');
    err.name = 'AbortError';
    expect(classifyError(err).reason).toBe('timeout');
  });

  it('classifyError maps fetch/network messages → network', () => {
    expect(classifyError(new Error('fetch failed')).reason).toBe('network');
    expect(classifyError(new Error('ENOTFOUND host')).reason).toBe('network');
  });

  it('classifyError falls back to unknown for arbitrary errors', () => {
    expect(classifyError(new Error('something broke')).reason).toBe('unknown');
    expect(classifyError('raw string')).toMatchObject({
      reason: 'unknown',
      message: 'raw string',
    });
    expect(classifyError(undefined).reason).toBe('unknown');
  });

  it('failedFromResponse maps 429 → rate_limited and 5xx → upstream_error', () => {
    const res429 = new Response('x', { status: 429 });
    const res503 = new Response('x', { status: 503 });
    const res404 = new Response('x', { status: 404 });
    expect(failedFromResponse(res429, 'PubMed').reason).toBe('rate_limited');
    expect(failedFromResponse(res429, 'PubMed').httpStatus).toBe(429);
    expect(failedFromResponse(res503, 'PubMed').reason).toBe('upstream_error');
    expect(failedFromResponse(res503, 'PubMed').httpStatus).toBe(503);
    expect(failedFromResponse(res404, 'PubMed').reason).toBe('upstream_error');
  });

  it('dataOrEmpty returns data on ok and [] on failed', () => {
    const good: EnrichmentResult<number[]> = ok([1, 2, 3]);
    const bad: EnrichmentResult<number[]> = failed('timeout', 'x');
    expect(dataOrEmpty(good)).toEqual([1, 2, 3]);
    expect(dataOrEmpty(bad)).toEqual([]);
  });

  it('type guards narrow correctly', () => {
    const good: EnrichmentResult<string[]> = ok(['a']);
    const bad: EnrichmentResult<string[]> = failed('network', 'x');
    expect(isEnrichmentOk(good)).toBe(true);
    expect(isEnrichmentFailed(good)).toBe(false);
    expect(isEnrichmentOk(bad)).toBe(false);
    expect(isEnrichmentFailed(bad)).toBe(true);
  });
});
