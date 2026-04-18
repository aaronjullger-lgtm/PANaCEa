import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LastReviewedBadge } from './LastReviewedBadge';

const NOW = new Date('2026-04-17T12:00:00Z');
function daysAgo(n: number) {
  return new Date(NOW.getTime() - n * 24 * 60 * 60 * 1000);
}

describe('LastReviewedBadge', () => {
  it('renders fresh state with data-state="fresh"', () => {
    render(<LastReviewedBadge lastReviewedAt={daysAgo(10)} now={NOW} />);
    const badge = screen.getByTestId('last-reviewed-badge');
    expect(badge.getAttribute('data-state')).toBe('fresh');
    expect(badge.textContent ?? '').toMatch(/updated/i);
  });

  it('renders aging state with refresh prompt', () => {
    render(<LastReviewedBadge lastReviewedAt={daysAgo(120)} now={NOW} />);
    const badge = screen.getByTestId('last-reviewed-badge');
    expect(badge.getAttribute('data-state')).toBe('aging');
    expect(badge.textContent ?? '').toMatch(/due for refresh/i);
  });

  it('renders stale state with verify prompt', () => {
    render(<LastReviewedBadge lastReviewedAt={daysAgo(400)} now={NOW} />);
    const badge = screen.getByTestId('last-reviewed-badge');
    expect(badge.getAttribute('data-state')).toBe('stale');
    expect(badge.textContent ?? '').toMatch(/verify against a current source/i);
  });

  it('renders unknown state for null/invalid timestamps', () => {
    render(<LastReviewedBadge lastReviewedAt={null} now={NOW} />);
    const badge = screen.getByTestId('last-reviewed-badge');
    expect(badge.getAttribute('data-state')).toBe('unknown');
    expect(badge.textContent ?? '').toMatch(/never reviewed/i);
  });

  it('uses aria-live="polite" on non-fresh states', () => {
    const { rerender } = render(
      <LastReviewedBadge lastReviewedAt={daysAgo(10)} now={NOW} />
    );
    expect(screen.getByTestId('last-reviewed-badge').getAttribute('aria-live')).toBe('off');

    rerender(<LastReviewedBadge lastReviewedAt={daysAgo(400)} now={NOW} />);
    expect(screen.getByTestId('last-reviewed-badge').getAttribute('aria-live')).toBe('polite');
  });

  it('accepts ISO strings', () => {
    render(<LastReviewedBadge lastReviewedAt={daysAgo(10).toISOString()} now={NOW} />);
    expect(screen.getByTestId('last-reviewed-badge').getAttribute('data-state')).toBe('fresh');
  });
});
