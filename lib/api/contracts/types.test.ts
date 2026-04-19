/**
 * Tests for contract infrastructure: `defineContract` + `interpolatePath`.
 *
 * These cover the pure helpers that underpin every typed API call. The
 * network-boundary behavior lives in `lib/sdk/__tests__/callApi.test.ts`.
 */

import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { defineContract, interpolatePath } from './types';
import { ErrorCode } from '../../../functions/api/_shared/error-catalog';

// ─── defineContract ──────────────────────────────────────────────────────────

describe('defineContract', () => {
  it('defaults source to "body" for POST with a request schema', () => {
    const c = defineContract({
      method: 'POST',
      path: '/api/foo',
      request: z.object({ x: z.number() }),
      response: z.object({ ok: z.boolean() }),
      description: 'test',
    });
    expect(c.source).toBe('body');
  });

  it('defaults source to "query" for GET with a request schema', () => {
    const c = defineContract({
      method: 'GET',
      path: '/api/foo',
      request: z.object({ q: z.string() }),
      response: z.object({ results: z.array(z.string()) }),
      description: 'test',
    });
    expect(c.source).toBe('query');
  });

  it('defaults source to "query" for DELETE with a request schema', () => {
    const c = defineContract({
      method: 'DELETE',
      path: '/api/foo',
      request: z.object({ id: z.string() }),
      response: z.object({ deleted: z.boolean() }),
      description: 'test',
    });
    expect(c.source).toBe('query');
  });

  it('defaults source to "none" when no request schema is provided', () => {
    const c = defineContract({
      method: 'GET',
      path: '/api/ping',
      response: z.object({ ok: z.boolean() }),
      description: 'test',
    });
    expect(c.source).toBe('none');
    expect(c.request).toBeNull();
  });

  it('respects explicit source override', () => {
    const c = defineContract({
      method: 'POST',
      path: '/api/upload',
      source: 'none', // e.g. multipart handled outside the contract
      response: z.object({ uploaded: z.boolean() }),
      description: 'test',
    });
    expect(c.source).toBe('none');
  });

  it('defaults errors to empty array when omitted', () => {
    const c = defineContract({
      method: 'GET',
      path: '/api/foo',
      response: z.object({}),
      description: 'test',
    });
    expect(c.errors).toEqual([]);
  });

  it('preserves errors when provided', () => {
    const c = defineContract({
      method: 'POST',
      path: '/api/foo',
      request: z.object({ x: z.number() }),
      response: z.object({}),
      errors: [ErrorCode.UNAUTHORIZED, ErrorCode.VALIDATION_FAILED],
      description: 'test',
    });
    expect(c.errors).toEqual([
      ErrorCode.UNAUTHORIZED,
      ErrorCode.VALIDATION_FAILED,
    ]);
  });

  it('stores params schema when provided', () => {
    const paramsSchema = z.object({ id: z.string() });
    const c = defineContract({
      method: 'GET',
      path: '/api/conditions/:id',
      params: paramsSchema,
      response: z.object({ name: z.string() }),
      description: 'test',
    });
    expect(c.params).toBe(paramsSchema);
  });

  it('leaves params as null when omitted', () => {
    const c = defineContract({
      method: 'GET',
      path: '/api/foo',
      response: z.object({}),
      description: 'test',
    });
    expect(c.params).toBeNull();
  });
});

// ─── interpolatePath ─────────────────────────────────────────────────────────

describe('interpolatePath', () => {
  it('returns path as-is when no placeholders and no params', () => {
    expect(interpolatePath('/api/health', undefined)).toBe('/api/health');
    expect(interpolatePath('/api/health', {})).toBe('/api/health');
  });

  it('substitutes a single :param', () => {
    expect(
      interpolatePath('/api/conditions/:id', { id: 'abc123' }),
    ).toBe('/api/conditions/abc123');
  });

  it('substitutes multiple :params', () => {
    expect(
      interpolatePath('/api/conditions/:id/drugs/:drugId', {
        id: 'abc',
        drugId: 'xyz',
      }),
    ).toBe('/api/conditions/abc/drugs/xyz');
  });

  it('URL-encodes param values', () => {
    expect(
      interpolatePath('/api/search/:query', { query: 'otitis media' }),
    ).toBe('/api/search/otitis%20media');
  });

  it('URL-encodes slashes and special chars', () => {
    expect(
      interpolatePath('/api/items/:id', { id: 'a/b?c=1' }),
    ).toBe('/api/items/a%2Fb%3Fc%3D1');
  });

  it('stringifies numeric params', () => {
    expect(
      interpolatePath('/api/items/:id', { id: 42 }),
    ).toBe('/api/items/42');
  });

  it('throws when a placeholder is missing from params', () => {
    expect(() =>
      interpolatePath('/api/conditions/:id', {}),
    ).toThrow(/missing param ":id"/);
  });

  it('throws when path has placeholders but no params provided', () => {
    expect(() =>
      interpolatePath('/api/conditions/:id', undefined),
    ).toThrow(/has parameters but no params were provided/);
  });

  it('does not rewrite paths with no placeholders even when params provided', () => {
    // Extra params are ignored (forward-compat: callers may pass a larger
    // object than the path consumes).
    expect(
      interpolatePath('/api/health', { id: 'abc' }),
    ).toBe('/api/health');
  });
});
