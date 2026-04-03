/**
 * Tests for Reservoir Policy — configuration constants and helper functions.
 */

import { describe, it, expect } from 'vitest';
import {
  RESERVOIR_POLICY,
  computeExpiry,
  deriveScope,
} from '../lib/services/reservoir/reservoirPolicy';

describe('RESERVOIR_POLICY', () => {
  it('has sensible watermark relationship', () => {
    expect(RESERVOIR_POLICY.HIGH_WATER_MARK).toBeGreaterThan(RESERVOIR_POLICY.LOW_WATER_MARK);
    expect(RESERVOIR_POLICY.MAX_RESERVOIR_SIZE).toBeGreaterThanOrEqual(RESERVOIR_POLICY.HIGH_WATER_MARK);
  });

  it('refill batch size bridges the gap between low and high water marks', () => {
    const gap = RESERVOIR_POLICY.HIGH_WATER_MARK - RESERVOIR_POLICY.LOW_WATER_MARK;
    expect(RESERVOIR_POLICY.REFILL_BATCH_SIZE).toBe(gap);
  });

  it('review TTL is shorter than new-item TTL', () => {
    expect(RESERVOIR_POLICY.REVIEW_ITEM_TTL_HOURS).toBeLessThan(RESERVOIR_POLICY.ITEM_TTL_HOURS);
  });

  it('priority values are properly ordered', () => {
    const { PRIORITY } = RESERVOIR_POLICY;
    expect(PRIORITY.OVERDUE_REVIEW).toBeGreaterThan(PRIORITY.DUE_REVIEW);
    expect(PRIORITY.DUE_REVIEW).toBeGreaterThan(PRIORITY.NEW_BLUEPRINT_GAP);
    expect(PRIORITY.NEW_BLUEPRINT_GAP).toBeGreaterThan(PRIORITY.NEW_STANDARD);
    expect(PRIORITY.NEW_STANDARD).toBeGreaterThan(PRIORITY.BACKFILL);
  });
});

describe('computeExpiry', () => {
  it('returns a date in the future for new items', () => {
    const expiry = computeExpiry(false);
    const expectedMs = RESERVOIR_POLICY.ITEM_TTL_HOURS * 3600_000;
    const diff = expiry.getTime() - Date.now();
    // Allow 1 second tolerance
    expect(diff).toBeGreaterThan(expectedMs - 1000);
    expect(diff).toBeLessThan(expectedMs + 1000);
  });

  it('returns a shorter TTL for review items', () => {
    const reviewExpiry = computeExpiry(true);
    const newExpiry = computeExpiry(false);
    expect(reviewExpiry.getTime()).toBeLessThan(newExpiry.getTime());
  });

  it('review TTL matches REVIEW_ITEM_TTL_HOURS', () => {
    const expiry = computeExpiry(true);
    const expectedMs = RESERVOIR_POLICY.REVIEW_ITEM_TTL_HOURS * 3600_000;
    const diff = expiry.getTime() - Date.now();
    expect(diff).toBeGreaterThan(expectedMs - 1000);
    expect(diff).toBeLessThan(expectedMs + 1000);
  });
});

describe('deriveScope', () => {
  it('returns "adaptive" for adaptive mode', () => {
    expect(deriveScope('adaptive', {})).toBe('adaptive');
  });

  it('returns system-scoped string for system mode', () => {
    expect(deriveScope('system', { system: 'CV' })).toBe('system:CV');
  });

  it('returns condition-scoped string for condition mode', () => {
    expect(deriveScope('condition', { conditionId: 'cond-123' })).toBe('condition:cond-123');
  });

  it('falls back to adaptive if system mode has no system', () => {
    expect(deriveScope('system', {})).toBe('adaptive');
  });

  it('falls back to adaptive for unknown modes', () => {
    expect(deriveScope('subcategory', { system: 'CV' })).toBe('adaptive');
  });

  it('falls back to adaptive for review mode', () => {
    expect(deriveScope('review', {})).toBe('adaptive');
  });
});
