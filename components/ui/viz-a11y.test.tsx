import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Sparkline, SparklineBar, TrendIndicator } from './Sparkline';
import { AnimatedCounter } from './AnimatedCounter';
import { EpistemicGauge } from './EpistemicGauge';

// jsdom does not implement matchMedia; useReducedMotion (used by AnimatedCounter)
// relies on it. Use a plain function (not vi.fn) assigned per-test so it survives
// any global mock-reset in the shared vitest setup. reduced-motion on → final value.
beforeEach(() => {
  window.matchMedia = ((query: string) => ({
    matches: true,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
});

describe('Sparkline a11y', () => {
  it('exposes an img role with an auto-summarized accessible label', () => {
    render(<Sparkline data={[1, 2, 3, 4]} />);
    const img = screen.getByRole('img');
    expect(img.getAttribute('aria-label')).toContain('4 points');
    expect(img.getAttribute('aria-label')).toContain('latest 4.0');
  });

  it('honors a custom ariaLabel', () => {
    render(<Sparkline data={[10, 20]} ariaLabel="Glucose trend" />);
    expect(screen.getByRole('img').getAttribute('aria-label')).toBe('Glucose trend');
  });

  it('SparklineBar exposes an img role with label', () => {
    render(<SparklineBar data={[1, 2, 3]} />);
    expect(screen.getByRole('img').getAttribute('aria-label')).toContain('3 bars');
  });
});

describe('AnimatedCounter a11y', () => {
  it('announces the stable target value via aria-label', () => {
    const { container } = render(<AnimatedCounter value={42} suffix="%" prefix="+" />);
    const span = container.querySelector('span[aria-label]');
    expect(span?.getAttribute('aria-label')).toBe('+42%');
    // Inner visual span is hidden from assistive tech
    expect(container.querySelector('span[aria-hidden="true"]')).toBeTruthy();
  });
});

describe('TrendIndicator a11y', () => {
  it('announces trend direction via screen-reader-only text and hides the glyph', () => {
    const { container } = render(<TrendIndicator current={80} previous={70} />);
    // Decorative arrow is hidden from AT
    expect(container.querySelector('span[aria-hidden="true"]')).toBeTruthy();
    // Direction word is available to AT
    expect(container.querySelector('span.sr-only')?.textContent).toContain('Trending up');
  });

  it('announces a declining trend', () => {
    const { container } = render(<TrendIndicator current={60} previous={80} />);
    expect(container.querySelector('span.sr-only')?.textContent).toContain('Trending down');
  });

  it('announces a stable trend', () => {
    const { container } = render(<TrendIndicator current={70} previous={70} />);
    expect(container.querySelector('span.sr-only')?.textContent).toContain('Trend stable');
  });
});

describe('EpistemicGauge a11y', () => {
  it('exposes a meter role with value + confidence context', () => {
    render(<EpistemicGauge value={0.8} dataPoints={30} label="Cardiology" />);
    const meter = screen.getByRole('meter');
    expect(meter.getAttribute('aria-valuenow')).toBe('80');
    expect(meter.getAttribute('aria-valuemin')).toBe('0');
    expect(meter.getAttribute('aria-valuemax')).toBe('100');
    expect(meter.getAttribute('aria-label')).toBe('Cardiology');
    expect(meter.getAttribute('aria-valuetext')).toContain('30 data points');
  });
});
