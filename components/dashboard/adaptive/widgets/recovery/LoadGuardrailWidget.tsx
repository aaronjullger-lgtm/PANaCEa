import React from 'react';
import { Gauge } from 'lucide-react';
import type { VisualToken } from '../../model/visualTokens';
import { VisualTokenSurface } from '../../visuals/VisualTokenProvider';
import type { LoadGuardrailData } from '../widgetData';

export function LoadGuardrailWidget({ data, visual }: { data: LoadGuardrailData; visual: VisualToken }) {
  return (
    <VisualTokenSurface visual={visual} className="p-4" as="section">
      <div className="flex items-start gap-3">
        <Gauge className="mt-0.5 h-5 w-5 text-[var(--color-risk)]" aria-hidden="true" />
        <div>
          <p className="text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-[var(--color-text-muted)]">Load guardrail</p>
          <h2 className="text-base font-semibold text-[var(--color-text-primary)]">{data.title}</h2>
          <p className="mt-2 text-sm leading-6 text-[var(--color-text-secondary)]">{data.detail}</p>
        </div>
      </div>
      <div className="mt-4 flex gap-1" role="img" aria-label={`Load guardrail ${Math.round(data.loadIndex * 100)} percent`}>
        {Array.from({ length: 5 }, (_, index) => (
          <span key={index} className={`h-2 flex-1 rounded-full ${index / 5 < data.loadIndex ? 'bg-[var(--color-risk)]' : 'bg-[var(--color-bg-tertiary)]'}`} />
        ))}
      </div>
    </VisualTokenSurface>
  );
}
