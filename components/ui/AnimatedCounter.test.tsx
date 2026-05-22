import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { AnimatedCounter } from './AnimatedCounter';

// Mock useReducedMotion
vi.mock('@/hooks/useReducedMotion', () => ({
  useReducedMotion: vi.fn(() => false),
}));

import { useReducedMotion } from '@/hooks/useReducedMotion';

describe('AnimatedCounter', () => {
  beforeEach(() => {
    vi.mocked(useReducedMotion).mockReturnValue(false);
  });

  it('renders initial value as 0 when animation starts', () => {
    render(<AnimatedCounter value={42} />);
    // Initial value should be 0 (animating from 0)
    expect(screen.getByText('0')).toBeTruthy();
  });

  it('renders final value immediately when reduced motion is preferred', () => {
    vi.mocked(useReducedMotion).mockReturnValue(true);
    render(<AnimatedCounter value={42} />);
    expect(screen.getByText('42')).toBeTruthy();
  });

  it('renders with prefix', () => {
    vi.mocked(useReducedMotion).mockReturnValue(true);
    render(<AnimatedCounter value={5} prefix="+" />);
    expect(screen.getByText('+5')).toBeTruthy();
  });

  it('renders with suffix', () => {
    vi.mocked(useReducedMotion).mockReturnValue(true);
    render(<AnimatedCounter value={3} suffix="h" />);
    expect(screen.getByText('3h')).toBeTruthy();
  });

  it('renders with decimals', () => {
    vi.mocked(useReducedMotion).mockReturnValue(true);
    render(<AnimatedCounter value={3.7} decimals={1} suffix="%" />);
    expect(screen.getByText('3.7%')).toBeTruthy();
  });

  it('animates toward target value', async () => {
    vi.useFakeTimers();
    render(<AnimatedCounter value={100} duration={500} />);

    // Initial value should be 0
    expect(screen.getByText('0')).toBeTruthy();

    // After half the duration, should be somewhere between 0 and 100
    await act(() => vi.advanceTimersByTimeAsync(250));
    const midValue = Number(screen.getByText(/\d+/).textContent);
    expect(midValue).toBeGreaterThan(0);
    expect(midValue).toBeLessThan(100);

    // After full duration, should reach target
    await act(() => vi.advanceTimersByTimeAsync(300));
    // Should be very close to 100 (eased)
    const finalValue = Number(screen.getByText(/\d+/).textContent);
    expect(finalValue).toBeGreaterThanOrEqual(99);

    vi.useRealTimers();
  });

  it('accepts className prop', () => {
    vi.mocked(useReducedMotion).mockReturnValue(true);
    render(<AnimatedCounter value={10} className="text-xl font-bold" />);
    const el = screen.getByText('10');
    expect(el.className).toContain('text-xl');
    expect(el.className).toContain('font-bold');
  });
});
