/**
 * EnrichmentFailureBadge
 *
 * Renders when an external evidence-enrichment service (PubMed, ClinicalTrials.gov)
 * is unavailable. Mirrors the `IncompleteFieldBadge` contract but distinguishes
 * "no results found" (caller hides section) from "service failed" (this badge
 * is shown so students don't interpret silent absence as absence of evidence).
 *
 * Aligned with PANaCEa's safety mandate: medical sections must be *complete or
 * visibly marked incomplete*. A failed fetch is an incomplete section.
 *
 * @see lib/services/enrichment/enrichmentResult.ts
 * @see components/library/IncompleteFieldBadge.tsx
 */

import React from 'react';
import { CloudOff } from 'lucide-react';
import type { EnrichmentFailed } from '@/lib/services/enrichment/enrichmentResult';

export interface EnrichmentFailureBadgeProps {
  /** Human-friendly source name, e.g. "PubMed", "ClinicalTrials.gov". */
  source: string;
  /** The typed failure record from an enrichment call. */
  failure: EnrichmentFailed;
  /** Optional retry handler; if provided, a "Retry" button is rendered. */
  onRetry?: () => void;
  className?: string;
}

function reasonBlurb(reason: EnrichmentFailed['reason']): string {
  switch (reason) {
    case 'timeout':
      return 'the request timed out';
    case 'rate_limited':
      return 'rate limits are in effect';
    case 'network':
      return 'the network is unavailable';
    case 'upstream_error':
      return 'the service returned an error';
    case 'invalid_response':
      return 'the response was malformed';
    default:
      return 'an unknown error occurred';
  }
}

export const EnrichmentFailureBadge: React.FC<EnrichmentFailureBadgeProps> = ({
  source,
  failure,
  onRetry,
  className = '',
}) => {
  const blurb = reasonBlurb(failure.reason);

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="enrichment-failure-badge"
      data-reason={failure.reason}
      className={[
        'flex items-start gap-2 rounded-lg border px-3 py-2 text-sm',
        'border-[var(--color-warning,#b45309)]/40',
        'bg-[var(--color-warning,#b45309)]/10',
        'text-[var(--color-warning,#b45309)]',
        className,
      ].join(' ')}
    >
      <CloudOff className="w-4 h-4 flex-shrink-0 mt-0.5" aria-hidden="true" />
      <div className="flex-1 min-w-0">
        <div>
          <strong className="font-semibold">{source} unavailable.</strong>{' '}
          <span className="opacity-90">
            Evidence could not be loaded because {blurb}.
          </span>
        </div>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="mt-1 text-xs underline underline-offset-2 hover:opacity-80 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1"
            aria-label={`Retry loading ${source} evidence`}
          >
            Retry
          </button>
        )}
      </div>
    </div>
  );
};

export default EnrichmentFailureBadge;
