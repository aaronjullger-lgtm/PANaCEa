import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useWellnessChecks } from '../useWellnessChecks';

describe('useWellnessChecks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('starts with modal hidden', () => {
    const { result } = renderHook(() => useWellnessChecks());
    expect(result.current.showModal).toBe(false);
    expect(result.current.reason).toBe('manual');
  });

  it('shows wellness modal after threshold questions', () => {
    const { result } = renderHook(() =>
      useWellnessChecks({ wellnessCheckEvery: 3 })
    );

    act(() => result.current.checkAfterAnswer()); // 1
    act(() => result.current.checkAfterAnswer()); // 2
    expect(result.current.showModal).toBe(false);

    act(() => result.current.checkAfterAnswer()); // 3 = threshold
    expect(result.current.showModal).toBe(true);
    expect(result.current.reason).toBe('rapid_questions');
  });

  it('triggers late-night check during night hours', () => {
    vi.spyOn(Date.prototype, 'getHours').mockReturnValue(23);

    const { result } = renderHook(() =>
      useWellnessChecks({ lateNightCheckInterval: 2 })
    );

    act(() => result.current.checkAfterAnswer());
    act(() => result.current.checkAfterAnswer());

    expect(result.current.showModal).toBe(true);
    expect(result.current.reason).toBe('late_night');
  });

  it('does not trigger late-night check during day', () => {
    vi.spyOn(Date.prototype, 'getHours').mockReturnValue(14);

    const { result } = renderHook(() =>
      useWellnessChecks({
        wellnessCheckEvery: 100,
        lateNightCheckInterval: 1,
      })
    );

    act(() => result.current.checkAfterAnswer());
    expect(result.current.showModal).toBe(false);
  });

  it('dismiss resets modal visibility', () => {
    const { result } = renderHook(() =>
      useWellnessChecks({ wellnessCheckEvery: 1 })
    );

    act(() => result.current.checkAfterAnswer());
    expect(result.current.showModal).toBe(true);

    act(() => result.current.dismiss());
    expect(result.current.showModal).toBe(false);
  });

  it('triggerManual shows modal with given reason', () => {
    const { result } = renderHook(() => useWellnessChecks());

    act(() => result.current.triggerManual('manual'));
    expect(result.current.showModal).toBe(true);
    expect(result.current.reason).toBe('manual');
  });

  it('counts questions answered', () => {
    const { result } = renderHook(() =>
      useWellnessChecks({ wellnessCheckEvery: 100 })
    );

    act(() => result.current.checkAfterAnswer());
    act(() => result.current.checkAfterAnswer());
    act(() => result.current.checkAfterAnswer());

    expect(result.current.questionsAnswered.current).toBe(3);
  });
});
