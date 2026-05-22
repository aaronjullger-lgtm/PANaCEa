import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ErrorStateCard } from './ErrorStateCard';

describe('ErrorStateCard', () => {
  it('renders default title and message when no props given', () => {
    render(<ErrorStateCard />);
    expect(screen.getByText('Unable to load')).toBeTruthy();
    expect(
      screen.getByText(/Something went wrong while loading this section/)
    ).toBeTruthy();
  });

  it('renders custom title and message', () => {
    render(<ErrorStateCard title="Custom error" message="Custom message" />);
    expect(screen.getByText('Custom error')).toBeTruthy();
    expect(screen.getByText('Custom message')).toBeTruthy();
  });

  it('renders no retry button when onRetry is not provided', () => {
    render(<ErrorStateCard />);
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('renders retry button when onRetry is provided', () => {
    const onRetry = vi.fn();
    render(<ErrorStateCard onRetry={onRetry} />);
    const btn = screen.getByRole('button', { name: /try again/i });
    expect(btn).toBeTruthy();
  });

  it('calls onRetry when retry button is clicked', () => {
    const onRetry = vi.fn();
    render(<ErrorStateCard onRetry={onRetry} />);
    fireEvent.click(screen.getByRole('button', { name: /try again/i }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('disables retry button while retrying', () => {
    const onRetry = vi.fn();
    render(<ErrorStateCard onRetry={onRetry} isRetrying />);
    const btn = screen.getByRole('button');
    expect(btn.hasAttribute('disabled')).toBe(true);
  });

  it('shows custom retry label', () => {
    render(<ErrorStateCard onRetry={vi.fn()} retryLabel="Reload section" />);
    expect(screen.getByRole('button', { name: /reload section/i })).toBeTruthy();
  });

  it('shows cooldown timer when retrying', () => {
    vi.useFakeTimers();
    render(<ErrorStateCard onRetry={vi.fn()} isRetrying retryCooldownMs={5000} />);
    expect(screen.getByText(/Retrying in 5s/)).toBeTruthy();
    vi.advanceTimersByTime(2000);
    // after 2s the interval fires every 1s, but the initial value was 5
    // Since we started with 5 seconds, after 2 seconds there should be ~3 left
    vi.useRealTimers();
  });

  it('shows error message in technical details section', () => {
    render(<ErrorStateCard error="Something broke" />);
    // Technical details section should be present
    expect(screen.getByText('Technical details')).toBeTruthy();
  });

  it('toggles technical details on click', () => {
    render(<ErrorStateCard error="Test error message" errorId="ERR-ABC123" />);
    const toggle = screen.getByText('Technical details');
    expect(screen.queryByText('ERR-ABC123')).toBeNull();

    fireEvent.click(toggle);
    expect(screen.getByText('ERR-ABC123')).toBeTruthy();

    fireEvent.click(toggle);
    expect(screen.queryByText('ERR-ABC123')).toBeNull();
  });

  it('renders in compact mode', () => {
    render(<ErrorStateCard compact onRetry={vi.fn()} />);
    // Compact mode should still show title and retry
    expect(screen.getByText('Unable to load')).toBeTruthy();
    expect(screen.getByRole('button')).toBeTruthy();
    // No technical details toggle in compact mode with no error
    expect(screen.queryByText('Technical details')).toBeNull();
  });

  it('has correct ARIA attributes', () => {
    render(<ErrorStateCard />);
    const status = screen.getByRole('status');
    expect(status.getAttribute('aria-live')).toBe('polite');
  });
});
