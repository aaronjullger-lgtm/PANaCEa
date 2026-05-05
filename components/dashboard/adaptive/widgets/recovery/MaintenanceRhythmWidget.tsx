import React from 'react';
import { ShieldCheck } from 'lucide-react';
import type { VisualToken } from '../../model/visualTokens';
import { VisualTokenSurface } from '../../visuals/VisualTokenProvider';
import type { MaintenanceRhythmData } from '../widgetData';

export function MaintenanceRhythmWidget({ data, visual }: { data: MaintenanceRhythmData; visual: VisualToken }) {
  return (
    <VisualTokenSurface visual={visual} className="p-4" as="section">
      <div className="flex items-start gap-3">
        <ShieldCheck className="mt-0.5 h-5 w-5 text-[var(--color-success)]" aria-hidden="true" />
        <div>
          <p className="text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-[var(--color-text-muted)]">Maintenance rhythm</p>
          <h2 className="text-base font-semibold text-[var(--color-text-primary)]">{data.title}</h2>
          <p className="mt-2 text-sm leading-6 text-[var(--color-text-secondary)]">{data.detail}</p>
          <p className="mt-3 font-mono text-sm font-semibold text-[var(--color-text-primary)]">{data.cadenceLabel}</p>
        </div>
      </div>
    </VisualTokenSurface>
  );
}
