import React from 'react';
import { ExternalLink, BookOpen } from 'lucide-react';

export interface OpenStaxAttributionFooterProps {
  title?: string;
  sourceUrl?: string;
  licenseName?: string;
  licenseUrl?: string;
  className?: string;
}

export function OpenStaxAttributionFooter({
  title = 'OpenStax',
  sourceUrl = 'https://openstax.org',
  licenseName = 'CC BY 4.0',
  licenseUrl = 'https://creativecommons.org/licenses/by/4.0/',
  className = '',
}: Readonly<OpenStaxAttributionFooterProps>) {
  return (
    <div
      className={[
        'mt-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-3 py-2',
        className,
      ].join(' ')}
      role="note"
      aria-label="OpenStax attribution"
    >
      <div className="flex items-start gap-2 text-xs text-[var(--color-text-muted)]">
        <BookOpen className="w-4 h-4 mt-0.5 flex-shrink-0 text-[var(--color-accent)]" />
        <div className="flex-1 leading-relaxed">
          <div className="font-medium text-[var(--color-text-secondary)]">
            Content attribution required
          </div>
          <div>
            <span>Content from </span>
            <a
              href={sourceUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-[var(--color-accent)] hover:underline"
            >
              OpenStax: {title}
              <ExternalLink className="w-3 h-3" aria-hidden="true" />
              <span className="sr-only"> (opens in new tab)</span>
            </a>
            <span>. Licensed under </span>
            <a
              href={licenseUrl}
              target="_blank"
              rel="noreferrer"
              className="text-[var(--color-accent)] hover:underline"
            >
              {licenseName}<span className="sr-only"> (opens in new tab)</span>
            </a>
            <span>.</span>
          </div>
        </div>
      </div>
    </div>
  );
}
