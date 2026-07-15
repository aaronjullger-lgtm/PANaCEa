/**
 * A11y regression for SystemComparison view-mode toggles.
 * The bar/radar toggle buttons must expose an accessible name and their
 * pressed state (aria-pressed) so screen-reader users know the active view.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import SystemComparison, { type SystemMasterySummary } from './SystemComparison';

beforeAll(() => {
  if (!(globalThis as any).ResizeObserver) {
    (globalThis as any).ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
});

const summary: SystemMasterySummary[] = [
  { system: 'CV', questionsAnswered: 40, masteryScore: 0.72 },
  { system: 'PULM', questionsAnswered: 25, masteryScore: 0.55 },
];

describe('SystemComparison view-toggle a11y', () => {
  it('exposes accessible names and aria-pressed reflecting the active view', () => {
    render(<SystemComparison summary={summary} />);
    const bar = screen.getByRole('button', { name: 'Bar chart view' });
    const radar = screen.getByRole('button', { name: 'Radar chart view' });

    // Default view is bar.
    expect(bar.getAttribute('aria-pressed')).toBe('true');
    expect(radar.getAttribute('aria-pressed')).toBe('false');

    // Switching updates the pressed state.
    fireEvent.click(radar);
    expect(screen.getByRole('button', { name: 'Bar chart view' }).getAttribute('aria-pressed')).toBe('false');
    expect(screen.getByRole('button', { name: 'Radar chart view' }).getAttribute('aria-pressed')).toBe('true');
  });
});
