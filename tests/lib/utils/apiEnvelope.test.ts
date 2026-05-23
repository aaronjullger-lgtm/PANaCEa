import { describe, it, expect } from 'vitest';
import { unwrapApiEnvelope, getApiEnvelopeError } from '@/lib/utils/apiEnvelope';

describe('unwrapApiEnvelope', () => {
  it('extracts data from a success envelope', () => {
    const payload = { success: true, data: { model: { id: 'heart' } } };
    const result = unwrapApiEnvelope<{ model: { id: string } }>(payload);
    expect(result.model.id).toBe('heart');
  });

  it('extracts data from an ok envelope', () => {
    const payload = { ok: true, data: [1, 2, 3] };
    const result = unwrapApiEnvelope<number[]>(payload);
    expect(result).toEqual([1, 2, 3]);
  });

  it('returns non-envelope object as-is', () => {
    const payload = { items: ['a', 'b'] };
    const result = unwrapApiEnvelope<{ items: string[] }>(payload);
    expect(result.items).toEqual(['a', 'b']);
  });

  it('throws on ok: false envelope', () => {
    const payload = { ok: false, error: 'Not found' };
    expect(() => unwrapApiEnvelope(payload)).toThrow('Not found');
  });

  it('throws on success: false envelope', () => {
    const payload = { success: false, error: 'Server error' };
    expect(() => unwrapApiEnvelope(payload)).toThrow('Server error');
  });

  it('returns null/undefined as-is (not an envelope)', () => {
    expect(unwrapApiEnvelope(null)).toBeNull();
    expect(unwrapApiEnvelope(undefined)).toBeUndefined();
  });

  it('returns plain array as-is', () => {
    const arr = [{ id: 1 }, { id: 2 }];
    expect(unwrapApiEnvelope(arr)).toBe(arr);
  });

  it('returns primitive as-is', () => {
    expect(unwrapApiEnvelope(42)).toBe(42);
    expect(unwrapApiEnvelope('hello')).toBe('hello');
  });

  it('handles double-wrapped envelope (nested data)', () => {
    const payload = {
      success: true,
      data: { ok: true, data: { pearls: ['pearl1'] } },
    };
    const result = unwrapApiEnvelope<{ ok: boolean; data: { pearls: string[] } }>(payload);
    // Only unwraps one level; nested envelope is returned as data
    expect(result.ok).toBe(true);
    expect(result.data.pearls).toEqual(['pearl1']);
  });

  it('handles deeply nested middleware type (data with undefined data)', () => {
    // Middleware sometimes unwraps once: { data: { data: X } } → { data: X }
    const payload = { data: [{ name: 'Hgb' }] };
    const result = unwrapApiEnvelope(payload);
    expect(Array.isArray(result)).toBe(true);
    expect((result as { name: string }[])[0].name).toBe('Hgb');
  });
});

describe('getApiEnvelopeError', () => {
  it('extracts string error from envelope', () => {
    expect(getApiEnvelopeError({ ok: false, error: 'Bad request' })).toBe('Bad request');
  });

  it('extracts nested error.message', () => {
    expect(
      getApiEnvelopeError({ ok: false, error: { message: 'Timeout', details: {} } }),
    ).toBe('Timeout');
  });

  it('falls back to top-level message', () => {
    expect(getApiEnvelopeError({ ok: false, message: 'Fallback' })).toBe('Fallback');
  });

  it('returns fallback for non-envelope', () => {
    expect(getApiEnvelopeError({ foo: 'bar' }, 'Custom fallback')).toBe('Custom fallback');
  });

  it('returns default fallback for non-envelope without custom', () => {
    expect(getApiEnvelopeError(null)).toBe('Request failed');
  });
});
