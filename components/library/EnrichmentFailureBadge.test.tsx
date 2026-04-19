import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { EnrichmentFailureBadge } from './EnrichmentFailureBadge';
import { failed } from '@/lib/services/enrichment/enrichmentResult';

describe('EnrichmentFailureBadge', () => {
  it('renders source name and humanised reason for timeout', () => {
    render(
      <EnrichmentFailureBadge source="PubMed" failure={failed('timeout', 'took 8s')} />
    );
    expect(screen.getByText(/PubMed unavailable\./i)).toBeTruthy();
    expect(screen.getByText(/timed out/i)).toBeTruthy();
  });

  it('renders reason for rate_limited', () => {
    render(
      <EnrichmentFailureBadge
        source="ClinicalTrials.gov"
        failure={failed('rate_limited', '429')}
      />
    );
    expect(screen.getByText(/rate limits are in effect/i)).toBeTruthy();
  });

  it('exposes data-reason attribute for QA hooks', () => {
    render(
      <EnrichmentFailureBadge source="PubMed" failure={failed('network', 'down')} />
    );
    const badge = screen.getByTestId('enrichment-failure-badge');
    expect(badge.getAttribute('data-reason')).toBe('network');
  });

  it('renders a Retry button only when onRetry is provided', () => {
    const onRetry = vi.fn();
    const { rerender } = render(
      <EnrichmentFailureBadge source="PubMed" failure={failed('network', 'x')} />
    );
    expect(screen.queryByRole('button', { name: /retry/i })).toBeNull();

    rerender(
      <EnrichmentFailureBadge
        source="PubMed"
        failure={failed('network', 'x')}
        onRetry={onRetry}
      />
    );
    const btn = screen.getByRole('button', { name: /retry loading pubmed evidence/i });
    fireEvent.click(btn);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('has role="status" with aria-live polite for screen readers', () => {
    render(
      <EnrichmentFailureBadge source="PubMed" failure={failed('unknown', 'x')} />
    );
    const badge = screen.getByTestId('enrichment-failure-badge');
    expect(badge.getAttribute('role')).toBe('status');
    expect(badge.getAttribute('aria-live')).toBe('polite');
  });
});
