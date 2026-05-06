import React from 'react';
import { getToneClass, type VisualToken } from '../model/visualTokens';
import { MedicalPattern } from './MedicalPattern';
import { AnatomyWatermark } from './AnatomyWatermark';

export function VisualTokenSurface({
  visual,
  children,
  className = '',
  as: Component = 'section',
}: React.PropsWithChildren<{
  visual: VisualToken;
  className?: string;
  as?: 'section' | 'div' | 'article';
}>) {
  return (
    <Component className={`relative overflow-hidden rounded-xl border ${getToneClass(visual.tone)} ${className}`}>
      <div className="absolute inset-0 text-current">
        <MedicalPattern pattern={visual.texture} opacity={visual.density === 'quiet' ? 0.07 : 0.1} />
        <AnatomyWatermark motif={visual.motif} />
      </div>
      <div className="relative">{children}</div>
    </Component>
  );
}
