/**
 * Tests for env-validation utilities
 *
 * Regression tests for the April 2026 outage caused by
 * literal quote characters in DATABASE_URL environment variable.
 */

import { describe, it, expect } from 'vitest';
import {
  sanitizeEnvValue,
  validateFunctionEnv,
  getEnvVar,
  MissingEnvError,
} from '../env-validation';

describe('sanitizeEnvValue', () => {
  it('strips leading and trailing double quotes', () => {
    expect(sanitizeEnvValue('"prisma://accelerate.prisma-data.net/?api_key=abc"')).toBe(
      'prisma://accelerate.prisma-data.net/?api_key=abc'
    );
  });

  it('strips leading and trailing single quotes', () => {
    expect(sanitizeEnvValue("'sk_live_abc123'")).toBe('sk_live_abc123');
  });

  it('strips surrounding whitespace', () => {
    expect(sanitizeEnvValue('  prisma://foo  ')).toBe('prisma://foo');
  });

  it('strips quotes AND whitespace together', () => {
    expect(sanitizeEnvValue('  "prisma://bar"  ')).toBe('prisma://bar');
  });

  it('does not strip internal quotes', () => {
    expect(sanitizeEnvValue('prisma://host?key="val"')).toBe('prisma://host?key="val"');
  });

  it('returns empty string for empty input', () => {
    expect(sanitizeEnvValue('')).toBe('');
  });

  it('handles only-whitespace input', () => {
    expect(sanitizeEnvValue('   ')).toBe('');
  });

  it('leaves clean values unchanged', () => {
    expect(sanitizeEnvValue('prisma://accelerate.prisma-data.net/?api_key=xyz')).toBe(
      'prisma://accelerate.prisma-data.net/?api_key=xyz'
    );
  });
});

describe('getEnvVar', () => {
  it('returns sanitized value for quoted env var', () => {
    const env = { MY_KEY: '"some-value"' };
    expect(getEnvVar(env, 'MY_KEY', true)).toBe('some-value');
  });

  it('returns sanitized value for clean env var', () => {
    const env = { MY_KEY: 'clean-value' };
    expect(getEnvVar(env, 'MY_KEY', true)).toBe('clean-value');
  });

  it('throws MissingEnvError for missing required var', () => {
    const env = {};
    expect(() => getEnvVar(env, 'MY_KEY', true)).toThrow(MissingEnvError);
  });

  it('returns undefined for missing optional var', () => {
    const env = {};
    expect(getEnvVar(env, 'MY_KEY', false)).toBeUndefined();
  });

  it('throws MissingEnvError for empty-after-sanitize value', () => {
    const env = { MY_KEY: '""' };
    expect(() => getEnvVar(env, 'MY_KEY', true)).toThrow(MissingEnvError);
  });
});

describe('validateFunctionEnv', () => {
  it('passes when all required vars are present', () => {
    const env = { DATABASE_URL: 'prisma://foo', CLERK_SECRET_KEY: 'sk_live_bar' };
    expect(() => validateFunctionEnv(env, ['DATABASE_URL', 'CLERK_SECRET_KEY'])).not.toThrow();
  });

  it('throws MissingEnvError when a required var is missing', () => {
    const env = { DATABASE_URL: 'prisma://foo' };
    expect(() => validateFunctionEnv(env, ['DATABASE_URL', 'CLERK_SECRET_KEY'])).toThrow(
      MissingEnvError
    );
  });

  it('throws MissingEnvError for empty string var', () => {
    const env = { DATABASE_URL: '' };
    expect(() => validateFunctionEnv(env, ['DATABASE_URL'])).toThrow(MissingEnvError);
  });

  it('accepts preset requirement keys', () => {
    const env = { DATABASE_URL: 'prisma://foo' };
    expect(() => validateFunctionEnv(env, 'DATABASE')).not.toThrow();
  });
});
