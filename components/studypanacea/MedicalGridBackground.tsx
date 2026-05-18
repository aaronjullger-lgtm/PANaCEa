import React from 'react';
import { cn } from '@/lib/utils';

export interface MedicalGridBackgroundProps extends React.HTMLAttributes<HTMLDivElement> {
  glow?: boolean;
  noise?: boolean;
}

export function MedicalGridBackground({
  glow = true,
  noise = true,
  className,
  ...props
}: MedicalGridBackgroundProps) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        'pointer-events-none absolute inset-0 -z-10 overflow-hidden atlas-medical-grid',
        glow && 'atlas-radial-glow',
        noise && 'atlas-noise-overlay',
        className,
      )}
      {...props}
    />
  );
}
