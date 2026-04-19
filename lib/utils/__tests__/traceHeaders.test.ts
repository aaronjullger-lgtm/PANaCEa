import { describe, it, expect } from 'vitest';
import {
  generateClientTraceId,
  withTraceHeaders,
  getResponseTraceId,
} from '../traceHeaders';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const FALLBACK_RE = /^c-[a-z0-9]+-[a-z0-9]+$/;

describe('traceHeaders: generateClientTraceId', () => {
  it('returns a UUID when crypto.randomUUID is available', () => {
    const id = generateClientTraceId();
    expect(id).toMatch(new RegExp(`${UUID_RE.source}|${FALLBACK_RE.source}`, 'i'));
  });

  it('returns a distinct id each call', () => {
    const a = generateClientTraceId();
    const b = generateClientTraceId();
    expect(a).not.toBe(b);
  });
});

describe('traceHeaders: withTraceHeaders', () => {
  it('adds X-Request-ID when caller provides none', () => {
    const { headers, traceId } = withTraceHeaders({ 'Content-Type': 'application/json' });
    expect(headers['X-Request-ID']).toBe(traceId);
    expect(headers['Content-Type']).toBe('application/json');
  });

  it('preserves an existing X-Request-ID (retry correlation)', () => {
    const { headers, traceId } = withTraceHeaders({ 'X-Request-ID': 'caller-id' });
    expect(traceId).toBe('caller-id');
    expect(headers['X-Request-ID']).toBe('caller-id');
  });

  it('accepts a Headers instance', () => {
    const input = new Headers({ Authorization: 'Bearer foo' });
    const { headers, traceId } = withTraceHeaders(input);
    expect(headers.authorization).toBe('Bearer foo');
    expect(headers['X-Request-ID']).toBe(traceId);
  });

  it('accepts an array-of-tuples HeadersInit', () => {
    const { headers, traceId } = withTraceHeaders([
      ['Authorization', 'Bearer bar'],
      ['X-Custom', 'yes'],
    ]);
    expect(headers.Authorization).toBe('Bearer bar');
    expect(headers['X-Custom']).toBe('yes');
    expect(headers['X-Request-ID']).toBe(traceId);
  });

  it('uses an explicit traceId override even over caller-supplied header', () => {
    const { headers, traceId } = withTraceHeaders(
      { 'X-Request-ID': 'stale' },
      'override-id'
    );
    expect(traceId).toBe('override-id');
    expect(headers['X-Request-ID']).toBe('override-id');
  });

  it('returns undefined headers input as empty, still stamped with X-Request-ID', () => {
    const { headers, traceId } = withTraceHeaders(undefined);
    expect(headers['X-Request-ID']).toBe(traceId);
    expect(Object.keys(headers)).toEqual(['X-Request-ID']);
  });
});

describe('traceHeaders: getResponseTraceId', () => {
  it('reads X-Request-ID when present', () => {
    const res = new Response('{}', { headers: { 'X-Request-ID': 'abc-123' } });
    expect(getResponseTraceId(res)).toBe('abc-123');
  });

  it('falls back to X-Trace-ID', () => {
    const res = new Response('{}', { headers: { 'X-Trace-ID': 'xyz-456' } });
    expect(getResponseTraceId(res)).toBe('xyz-456');
  });

  it('returns null when neither header is set', () => {
    const res = new Response('{}');
    expect(getResponseTraceId(res)).toBeNull();
  });
});
