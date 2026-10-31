import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { debounce, createDebouncedFunction } from '@/lib/utils/debounce';

describe('debounce', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('delays execution until after the delay elapses', () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 100);

    debounced();
    expect(fn).not.toHaveBeenCalled();

    vi.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('collapses multiple rapid invocations into one', () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 100);

    debounced(1);
    vi.advanceTimersByTime(50);
    debounced(2);
    vi.advanceTimersByTime(50);
    expect(fn).not.toHaveBeenCalled();

    vi.advanceTimersByTime(50);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith(2);
  });

  it('passes arguments through to the wrapped function', () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 10);

    debounced('a', 42);
    vi.advanceTimersByTime(10);

    expect(fn).toHaveBeenCalledWith('a', 42);
  });

  it('schedules again after a completed invocation', () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 10);

    debounced();
    vi.advanceTimersByTime(10);
    debounced();
    vi.advanceTimersByTime(10);

    expect(fn).toHaveBeenCalledTimes(2);
  });
});

describe('createDebouncedFunction', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('debounces like debounce()', () => {
    const fn = vi.fn();
    const { debounced } = createDebouncedFunction(fn, 100);

    debounced();
    debounced();
    vi.advanceTimersByTime(100);

    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('cancel() prevents the pending invocation', () => {
    const fn = vi.fn();
    const { debounced, cancel } = createDebouncedFunction(fn, 100);

    debounced();
    cancel();
    vi.advanceTimersByTime(200);

    expect(fn).not.toHaveBeenCalled();
  });

  it('cancel() after execution is a no-op', () => {
    const fn = vi.fn();
    const { debounced, cancel } = createDebouncedFunction(fn, 10);

    debounced();
    vi.advanceTimersByTime(10);
    expect(fn).toHaveBeenCalledTimes(1);

    expect(() => cancel()).not.toThrow();
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('a canceled timer does not block later invocations', () => {
    const fn = vi.fn();
    const { debounced, cancel } = createDebouncedFunction(fn, 10);

    debounced();
    cancel();
    debounced();
    vi.advanceTimersByTime(10);

    expect(fn).toHaveBeenCalledTimes(1);
  });
});
