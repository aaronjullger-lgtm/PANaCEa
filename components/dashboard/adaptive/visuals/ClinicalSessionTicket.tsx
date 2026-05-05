import React from 'react';
import { MedicalPattern } from './MedicalPattern';
import { AnatomyWatermark } from './AnatomyWatermark';
import type { VisualToken } from '../model/visualTokens';

export function ClinicalSessionTicket({
  visual,
  children,
  className = '',
  style,
  ...sectionProps
}: React.PropsWithChildren<{ visual: VisualToken; className?: string } & React.HTMLAttributes<HTMLElement>>) {
  return (
    <section
      {...sectionProps}
      className={`relative overflow-hidden rounded-xl border bg-[var(--color-surface)] text-[var(--color-text-primary)] shadow-[var(--shadow-surface)] ${className}`}
      style={{
        ...style,
        borderColor:
          style?.borderColor ?? 'color-mix(in srgb, var(--color-accent) 22%, var(--color-border))',
      }}
    >
      <div className="absolute inset-y-0 left-0 w-2 bg-[var(--color-accent)]" aria-hidden="true" />
      <div className="absolute inset-0 text-[var(--color-accent)]">
        <MedicalPattern pattern={visual.texture} opacity={visual.density === 'rich' ? 0.14 : 0.09} />
        <AnatomyWatermark motif={visual.motif} />
      </div>
      <div className="relative pl-7">{children}</div>
    </section>
  );
}
