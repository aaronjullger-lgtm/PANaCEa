// hooks/__tests__/useQuizTimer.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useQuizTimer } from '../useQuizTimer';

describe('useQuizTimer', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns null when no timeLimitMs is set', () => {
    const onTimeUp = vi.fn();
    const { result } = renderHook(() =>
      useQuizTimer({ timeLimitMs: null, onTimeUp })
    );
    expect(result.current.timeRemainingMs).toBeNull();
    expect(onTimeUp).not.toHaveBeenCalled();
  });

  it('returns null when timeLimitMs is undefined', () => {
    const onTimeUp = vi.fn();
    const { result } = renderHook(() =>
      useQuizTimer({ timeLimitMs: undefined, onTimeUp })
    );
    expect(result.current.timeRemainingMs).toBeNull();
  });

  it('counts down and fires onTimeUp when reaching zero', () => {
    const onTimeUp = vi.fn();
    const { result } = renderHook(() =>
      useQuizTimer({ timeLimitMs: 5000, onTimeUp })
    );

    // After 3 seconds
    act(() => { vi.advanceTimersByTime(3000); });
    expect(result.current.timeRemainingMs).not.toBeNull();
    expect(result.current.timeRemainingMs!).toBeLessThanOrEqual(2001);
    expect(result.current.timeRemainingMs!).toBeGreaterThan(1000);
    expect(onTimeUp).not.toHaveBeenCalled();

    // After another 2 seconds (total 5s)
    act(() => { vi.advanceTimersByTime(2000); });
    expect(result.current.timeRemainingMs).toBe(0);
    expect(onTimeUp).toHaveBeenCalledTimes(1);
  });

  it('provides sessionStartTime ref', () => {
    const onTimeUp = vi.fn();
    const { result } = renderHook(() =>
      useQuizTimer({ timeLimitMs: 10000, onTimeUp })
    );
    expect(result.current.sessionStartTime.current).toBeTypeOf('number');
    expect(result.current.sessionStartTime.current).toBeGreaterThan(0);
  });

  it('adjusts sessionStartTime when tab becomes visible after being hidden', () => {
    const onTimeUp = vi.fn();
    const { result } = renderHook(() =>
      useQuizTimer({ timeLimitMs: 60000, onTimeUp })
    );

    const startTimeBefore = result.current.sessionStartTime.current;

    // Hide tab
    act(() => {
      Object.defineProperty(document, 'hidden', { value: true, writable: true, configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
    });

    // Wait 5 seconds while hidden
    act(() => { vi.advanceTimersByTime(5000); });

    // Show tab
    act(() => {
      Object.defineProperty(document, 'hidden', { value: false, writable: true, configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
    });

    // sessionStartTime should have advanced by ~5000ms to compensate for hidden time
    const adjustment = result.current.sessionStartTime.current - startTimeBefore;
    expect(adjustment).toBeGreaterThanOrEqual(4500);
    expect(adjustment).toBeLessThanOrEqual(5500);
  });

  it('cleans up interval on unmount', () => {
    const onTimeUp = vi.fn();
    const { unmount } = renderHook(() =>
      useQuizTimer({ timeLimitMs: 5000, onTimeUp })
    );

    unmount();

    // Advance past the limit — onTimeUp should NOT fire after unmount
    act(() => { vi.advanceTimersByTime(10000); });
    expect(onTimeUp).not.toHaveBeenCalled();
  });

  it('cleans up visibility listener on unmount', () => {
    const onTimeUp = vi.fn();
    const removeSpy = vi.spyOn(document, 'removeEventListener');

    const { unmount } = renderHook(() =>
      useQuizTimer({ timeLimitMs: 10000, onTimeUp })
    );

    unmount();
    expect(removeSpy).toHaveBeenCalledWith('visibilitychange', expect.any(Function));
    removeSpy.mockRestore();
  });
});
