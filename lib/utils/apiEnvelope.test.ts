import { describe, expect, it } from 'vitest';
import { getApiEnvelopeError, unwrapApiEnvelope } from './apiEnvelope';

describe('apiEnvelope utilities', () => {
  it('unwraps canonical ok envelopes', () => {
    expect(unwrapApiEnvelope<{ count: number }>({ ok: true, data: { count: 2 } })).toEqual({
      count: 2,
    });
  });

  it('unwraps legacy success envelopes', () => {
    expect(unwrapApiEnvelope<string[]>({ success: true, data: ['a', 'b'] })).toEqual(['a', 'b']);
  });

  it('passes through bare payloads', () => {
    expect(unwrapApiEnvelope<{ status: string }>({ status: 'active' })).toEqual({
      status: 'active',
    });
  });

  it('throws the nested envelope error message', () => {
    expect(() =>
      unwrapApiEnvelope({ ok: false, error: { message: 'No access' } })
    ).toThrow('No access');
  });

  it('extracts string envelope errors', () => {
    expect(getApiEnvelopeError({ success: false, error: 'Bad request' })).toBe('Bad request');
  });
});
