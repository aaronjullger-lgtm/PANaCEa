/**
 * Validation hardening tests (Implementation Expansion Pass — Phase 4).
 *
 * Exercises the exported Zod schemas of high-risk mutation endpoints directly:
 * valid input passes, oversized/malformed input is rejected, and unknown fields
 * are rejected (`.strict()`). Endpoint behavior/contracts are unchanged for valid
 * payloads. Custom-session and soap-note strip unknown client fields instead of
 * rejecting production payloads.
 */
import { describe, it, expect } from 'vitest';
import { subscribeSchema, unsubscribeSchema } from '../push/subscribe';
import { SoapNoteSchema } from '../analytics/soap-note';
import { SecondChanceRequestSchema } from '../reviews/second-chance';

describe('push/subscribe subscribeSchema', () => {
  const valid = {
    endpoint: 'https://push.example.com/abc',
    keys: { p256dh: 'k1', auth: 'k2' },
  };

  it('accepts a valid subscription', () => {
    expect(subscribeSchema.safeParse(valid).success).toBe(true);
  });

  it('rejects a non-URL endpoint', () => {
    expect(subscribeSchema.safeParse({ ...valid, endpoint: 'not-a-url' }).success).toBe(false);
  });

  it('rejects an oversized endpoint (>2048 chars)', () => {
    const long = 'https://push.example.com/' + 'x'.repeat(2100);
    expect(subscribeSchema.safeParse({ ...valid, endpoint: long }).success).toBe(false);
  });

  it('rejects oversized keys (>512 chars)', () => {
    const bad = { ...valid, keys: { p256dh: 'x'.repeat(600), auth: 'k2' } };
    expect(subscribeSchema.safeParse(bad).success).toBe(false);
  });

  it('rejects unknown top-level fields (.strict)', () => {
    expect(subscribeSchema.safeParse({ ...valid, evil: 'x' }).success).toBe(false);
  });

  it('rejects unknown fields inside keys (.strict)', () => {
    const bad = { ...valid, keys: { ...valid.keys, evil: 'x' } };
    expect(subscribeSchema.safeParse(bad).success).toBe(false);
  });

  it('unsubscribeSchema accepts a URL and rejects extras', () => {
    expect(unsubscribeSchema.safeParse({ endpoint: 'https://p.example/a' }).success).toBe(true);
    expect(
      unsubscribeSchema.safeParse({ endpoint: 'https://p.example/a', evil: 1 }).success
    ).toBe(false);
  });
});

describe('analytics/soap-note SoapNoteSchema', () => {
  const valid = { body: { caseId: 'case-1', totalScore: 82, breakdown: { subjective: 20 } } };

  it('accepts a valid SOAP grading payload', () => {
    expect(SoapNoteSchema.safeParse(valid).success).toBe(true);
  });

  it('rejects NaN/Infinity totalScore', () => {
    expect(SoapNoteSchema.safeParse({ body: { ...valid.body, totalScore: NaN } }).success).toBe(
      false
    );
    expect(
      SoapNoteSchema.safeParse({ body: { ...valid.body, totalScore: Infinity } }).success
    ).toBe(false);
  });

  it('rejects an empty caseId and an oversized caseId', () => {
    expect(SoapNoteSchema.safeParse({ body: { ...valid.body, caseId: '' } }).success).toBe(false);
    expect(
      SoapNoteSchema.safeParse({ body: { ...valid.body, caseId: 'x'.repeat(300) } }).success
    ).toBe(false);
  });

  it('accepts client telemetry fields (timestamp, userId)', () => {
    const withTelemetry = {
      body: {
        ...valid.body,
        timestamp: new Date().toISOString(),
        userId: 'user_test_abc',
      },
    };
    expect(SoapNoteSchema.safeParse(withTelemetry).success).toBe(true);
  });

  it('strips unknown fields instead of rejecting the request', () => {
    const bad = { body: { ...valid.body, evil: true } };
    const result = SoapNoteSchema.safeParse(bad);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.body).not.toHaveProperty('evil');
    }
  });
});

describe('reviews/second-chance SecondChanceRequestSchema', () => {
  it('applies defaults for an empty request', () => {
    const parsed = SecondChanceRequestSchema.safeParse({});
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.count).toBe(10);
      expect(parsed.data.examType).toBe('PANCE');
    }
  });

  it('rejects count out of range', () => {
    expect(SecondChanceRequestSchema.safeParse({ count: 0 }).success).toBe(false);
    expect(SecondChanceRequestSchema.safeParse({ count: 26 }).success).toBe(false);
  });

  it('rejects an invalid examType', () => {
    expect(SecondChanceRequestSchema.safeParse({ examType: 'MCAT' }).success).toBe(false);
  });

  it('rejects unknown top-level and scopeFilter fields (.strict)', () => {
    expect(SecondChanceRequestSchema.safeParse({ evil: 1 }).success).toBe(false);
    expect(
      SecondChanceRequestSchema.safeParse({ scopeFilter: { system: 'CV', evil: 1 } }).success
    ).toBe(false);
  });

  it('rejects an oversized scopeFilter.system', () => {
    expect(
      SecondChanceRequestSchema.safeParse({ scopeFilter: { system: 'x'.repeat(200) } }).success
    ).toBe(false);
  });
});
