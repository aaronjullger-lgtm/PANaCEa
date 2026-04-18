import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getLastApiTraceId,
  resetLastApiTraceId,
  setLastApiTraceId,
} from '../lastTraceId';

describe('lastTraceId', () => {
  beforeEach(() => {
    resetLastApiTraceId();
  });

  afterEach(() => {
    vi.useRealTimers();
    resetLastApiTraceId();
  });

  it('returns null before any trace id is captured', () => {
    expect(getLastApiTraceId()).toBeNull();
  });

  it('stores and returns the most recent trace id', () => {
    setLastApiTraceId('trace-abc-123');
    expect(getLastApiTraceId()).toBe('trace-abc-123');
  });

  it('overwrites older ids with newer ones', () => {
    setLastApiTraceId('trace-old');
    setLastApiTraceId('trace-new');
    expect(getLastApiTraceId()).toBe('trace-new');
  });

  it('ignores null / undefined / empty / non-string inputs', () => {
    setLastApiTraceId('trace-valid');
    setLastApiTraceId(null);
    setLastApiTraceId(undefined);
    setLastApiTraceId('');
    // @ts-expect-error — intentionally passing a non-string to verify the guard.
    setLastApiTraceId(12345);
    // The valid id is still the most recent real write.
    expect(getLastApiTraceId()).toBe('trace-valid');
  });

  it('reset clears the stored id', () => {
    setLastApiTraceId('trace-will-be-reset');
    resetLastApiTraceId();
    expect(getLastApiTraceId()).toBeNull();
  });

  it('respects the maxAgeMs staleness window', () => {
    // Use fake timers so we can precisely age the stored id.
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-17T12:00:00Z'));

    setLastApiTraceId('trace-fresh');

    // Immediately within window → returned.
    expect(getLastApiTraceId(60_000)).toBe('trace-fresh');

    // Advance 30s — still within 60s window.
    vi.advanceTimersByTime(30_000);
    expect(getLastApiTraceId(60_000)).toBe('trace-fresh');

    // Advance another 31s — now older than 60s window.
    vi.advanceTimersByTime(31_000);
    expect(getLastApiTraceId(60_000)).toBeNull();

    // But calling without the window still returns the id (id is not deleted,
    // just hidden by the staleness filter).
    expect(getLastApiTraceId()).toBe('trace-fresh');
  });

  it('ignores non-positive maxAgeMs values', () => {
    setLastApiTraceId('trace-anything');
    // Zero and negative windows fall through to the unfiltered read.
    expect(getLastApiTraceId(0)).toBe('trace-anything');
    expect(getLastApiTraceId(-1)).toBe('trace-anything');
  });

  it('treats non-number maxAgeMs as "no window" (no crash)', () => {
    setLastApiTraceId('trace-nonnumber-case');
    // @ts-expect-error — intentionally passing wrong type to verify the guard.
    expect(getLastApiTraceId('not-a-number')).toBe('trace-nonnumber-case');
  });
});
