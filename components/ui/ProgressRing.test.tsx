import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import ProgressRing from './ProgressRing';

describe('ProgressRing', () => {
  it('exposes progressbar role with correct ARIA value attributes', () => {
    render(<ProgressRing score={72} />);
    const bar = screen.getByRole('progressbar');
    expect(bar.getAttribute('aria-valuenow')).toBe('72');
    expect(bar.getAttribute('aria-valuemin')).toBe('0');
    expect(bar.getAttribute('aria-valuemax')).toBe('100');
    expect(bar.getAttribute('aria-valuetext')).toBe('72%');
  });

  it('rounds the score for the accessible value', () => {
    render(<ProgressRing score={72.6} />);
    const bar = screen.getByRole('progressbar');
    expect(bar.getAttribute('aria-valuenow')).toBe('73');
    expect(bar.getAttribute('aria-valuetext')).toBe('73%');
  });

  it('clamps out-of-range scores to [0, 100]', () => {
    const { rerender } = render(<ProgressRing score={-10} />);
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('0');
    rerender(<ProgressRing score={150} />);
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('100');
  });

  it('includes the provided label in the accessible name', () => {
    render(<ProgressRing score={88} label="PANCE readiness" />);
    const bar = screen.getByRole('progressbar');
    expect(bar.getAttribute('aria-label')).toBe('PANCE readiness: 88%');
  });

  it('falls back to a generic accessible name without a label', () => {
    render(<ProgressRing score={40} />);
    expect(screen.getByRole('progressbar').getAttribute('aria-label')).toBe('40%');
  });

  it('marks decorative SVG as aria-hidden to avoid double announcement', () => {
    const { container } = render(<ProgressRing score={50} />);
    const svg = container.querySelector('svg');
    expect(svg?.getAttribute('aria-hidden')).toBe('true');
  });
});
