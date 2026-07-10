/**
 * Validation contract tests for POST /api/questions/custom-session.
 * Filter arrays flow into Prisma `in:` clauses, so they are length/size bounded
 * and unknown fields rejected. Valid configs pass unchanged.
 */
import { describe, it, expect } from 'vitest';
import { CustomSessionSchema } from './custom-session';

const valid = { body: { config: { systems: ['CV', 'PULM'], difficulty: 'harder' as const }, count: 10 } };

describe('CustomSessionSchema', () => {
  it('accepts a valid config', () => {
    expect(CustomSessionSchema.safeParse(valid).success).toBe(true);
  });

  it('accepts an empty config (all filters optional)', () => {
    expect(CustomSessionSchema.safeParse({ body: { config: {} } }).success).toBe(true);
  });

  it('rejects count out of range', () => {
    expect(CustomSessionSchema.safeParse({ body: { config: {}, count: 0 } }).success).toBe(false);
    expect(CustomSessionSchema.safeParse({ body: { config: {}, count: 51 } }).success).toBe(false);
  });

  it('rejects an invalid difficulty enum', () => {
    expect(
      CustomSessionSchema.safeParse({ body: { config: { difficulty: 'impossible' } } }).success
    ).toBe(false);
  });

  it('rejects oversized filter arrays (>50 entries)', () => {
    const big = Array.from({ length: 51 }, (_, i) => `s${i}`);
    expect(CustomSessionSchema.safeParse({ body: { config: { systems: big } } }).success).toBe(
      false
    );
  });

  it('rejects oversized filter strings (>100 chars) and empty strings', () => {
    expect(
      CustomSessionSchema.safeParse({ body: { config: { conditions: ['x'.repeat(101)] } } }).success
    ).toBe(false);
    expect(
      CustomSessionSchema.safeParse({ body: { config: { conditions: [''] } } }).success
    ).toBe(false);
  });

  it('rejects unknown fields on config and body (.strict)', () => {
    expect(
      CustomSessionSchema.safeParse({ body: { config: { evil: 1 } } }).success
    ).toBe(false);
    expect(
      CustomSessionSchema.safeParse({ body: { config: {}, evil: 1 } }).success
    ).toBe(false);
  });
});
