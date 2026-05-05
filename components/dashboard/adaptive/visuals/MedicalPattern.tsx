import React from 'react';
import type { TexturePattern } from '../model/visualTokens';

type PatternProps = {
  opacity?: number;
  className?: string;
};

function PatternFrame({ children, opacity = 0.12, className = '' }: React.PropsWithChildren<PatternProps>) {
  return (
    <svg
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 h-full w-full ${className}`}
      preserveAspectRatio="none"
      style={{ opacity }}
    >
      {children}
    </svg>
  );
}

export function ClinicalGridPattern(props: PatternProps) {
  return (
    <PatternFrame {...props}>
      <defs>
        <pattern id="clinical-grid-pattern" width="24" height="24" patternUnits="userSpaceOnUse">
          <path d="M 24 0 L 0 0 0 24" fill="none" stroke="currentColor" strokeWidth="0.7" />
          <path d="M 12 0 L 12 24 M 0 12 L 24 12" fill="none" stroke="currentColor" strokeWidth="0.35" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#clinical-grid-pattern)" />
    </PatternFrame>
  );
}

export function EkgPaperPattern(props: PatternProps) {
  return (
    <PatternFrame {...props}>
      <defs>
        <pattern id="ekg-paper-pattern" width="32" height="20" patternUnits="userSpaceOnUse">
          <path d="M0 10 H8 L11 4 L15 16 L19 8 L22 10 H32" fill="none" stroke="currentColor" strokeWidth="0.8" />
          <path d="M0 0 H32 M0 20 H32" fill="none" stroke="currentColor" strokeWidth="0.35" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#ekg-paper-pattern)" />
    </PatternFrame>
  );
}

export function AlveolarPattern(props: PatternProps) {
  return (
    <PatternFrame {...props}>
      <defs>
        <pattern id="alveolar-pattern" width="46" height="38" patternUnits="userSpaceOnUse">
          <circle cx="14" cy="14" r="9" fill="none" stroke="currentColor" strokeWidth="0.9" />
          <circle cx="31" cy="22" r="11" fill="none" stroke="currentColor" strokeWidth="0.9" />
          <circle cx="8" cy="33" r="6" fill="none" stroke="currentColor" strokeWidth="0.7" />
          <path d="M21 17 C25 15 28 16 31 20" fill="none" stroke="currentColor" strokeWidth="0.7" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#alveolar-pattern)" />
    </PatternFrame>
  );
}

export function VascularBranchPattern(props: PatternProps) {
  return (
    <PatternFrame {...props}>
      <defs>
        <pattern id="vascular-branch-pattern" width="76" height="54" patternUnits="userSpaceOnUse">
          <path d="M4 42 C20 30 26 21 42 8" fill="none" stroke="currentColor" strokeWidth="1.1" />
          <path d="M24 28 C37 30 48 36 68 28 M31 22 C43 17 49 12 58 5 M17 35 C27 41 37 45 52 49" fill="none" stroke="currentColor" strokeWidth="0.8" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#vascular-branch-pattern)" />
    </PatternFrame>
  );
}

export function NephronLoopPattern(props: PatternProps) {
  return (
    <PatternFrame {...props}>
      <defs>
        <pattern id="nephron-loop-pattern" width="58" height="64" patternUnits="userSpaceOnUse">
          <path d="M20 4 C7 9 8 22 20 27 C36 34 36 53 21 59" fill="none" stroke="currentColor" strokeWidth="1" />
          <path d="M33 4 C45 12 45 24 33 31 C20 40 21 51 34 60" fill="none" stroke="currentColor" strokeWidth="0.8" />
          <circle cx="20" cy="12" r="6" fill="none" stroke="currentColor" strokeWidth="0.7" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#nephron-loop-pattern)" />
    </PatternFrame>
  );
}

export function SynapticPattern(props: PatternProps) {
  return (
    <PatternFrame {...props}>
      <defs>
        <pattern id="synaptic-pattern" width="66" height="52" patternUnits="userSpaceOnUse">
          <circle cx="14" cy="16" r="3" fill="currentColor" />
          <circle cx="42" cy="11" r="3" fill="currentColor" />
          <circle cx="51" cy="35" r="3" fill="currentColor" />
          <circle cx="20" cy="38" r="3" fill="currentColor" />
          <path d="M17 16 C25 12 32 11 39 11 M44 14 C48 20 50 26 51 32 M48 35 C39 36 30 38 23 38 M20 35 C18 29 16 23 15 19" fill="none" stroke="currentColor" strokeWidth="0.8" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#synaptic-pattern)" />
    </PatternFrame>
  );
}

export function BoneLatticePattern(props: PatternProps) {
  return (
    <PatternFrame {...props}>
      <defs>
        <pattern id="bone-lattice-pattern" width="42" height="42" patternUnits="userSpaceOnUse">
          <path d="M3 21 H39 M21 3 V39 M8 8 L34 34 M34 8 L8 34" fill="none" stroke="currentColor" strokeWidth="0.7" />
          <circle cx="21" cy="21" r="5" fill="none" stroke="currentColor" strokeWidth="0.7" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#bone-lattice-pattern)" />
    </PatternFrame>
  );
}

export function BloodSmearPattern(props: PatternProps) {
  return (
    <PatternFrame {...props}>
      <defs>
        <pattern id="blood-smear-pattern" width="64" height="44" patternUnits="userSpaceOnUse">
          <ellipse cx="13" cy="14" rx="7" ry="5" fill="none" stroke="currentColor" strokeWidth="0.8" />
          <ellipse cx="37" cy="24" rx="8" ry="5" fill="none" stroke="currentColor" strokeWidth="0.8" transform="rotate(-12 37 24)" />
          <ellipse cx="55" cy="9" rx="5" ry="3" fill="none" stroke="currentColor" strokeWidth="0.7" />
          <ellipse cx="22" cy="36" rx="5" ry="3" fill="none" stroke="currentColor" strokeWidth="0.7" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#blood-smear-pattern)" />
    </PatternFrame>
  );
}

export function SkinLayersPattern(props: PatternProps) {
  return (
    <PatternFrame {...props}>
      <defs>
        <pattern id="skin-layers-pattern" width="86" height="44" patternUnits="userSpaceOnUse">
          <path d="M0 9 C16 4 25 14 40 9 S67 4 86 10 M0 22 C16 17 25 27 40 22 S67 17 86 23 M0 35 C16 30 25 40 40 35 S67 30 86 36" fill="none" stroke="currentColor" strokeWidth="0.8" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#skin-layers-pattern)" />
    </PatternFrame>
  );
}

export function MucosalFoldPattern(props: PatternProps) {
  return (
    <PatternFrame {...props}>
      <defs>
        <pattern id="mucosal-fold-pattern" width="76" height="48" patternUnits="userSpaceOnUse">
          <path d="M0 24 C8 8 18 8 26 24 S44 40 52 24 S68 8 76 24" fill="none" stroke="currentColor" strokeWidth="1" />
          <path d="M0 36 C8 20 18 20 26 36 S44 52 52 36 S68 20 76 36" fill="none" stroke="currentColor" strokeWidth="0.6" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#mucosal-fold-pattern)" />
    </PatternFrame>
  );
}

export function SplitContrastPattern(props: PatternProps) {
  return (
    <PatternFrame {...props}>
      <defs>
        <pattern id="split-contrast-pattern" width="28" height="28" patternUnits="userSpaceOnUse">
          <path d="M0 28 L28 0" stroke="currentColor" strokeWidth="0.8" />
          <path d="M-7 28 L28 -7 M7 35 L35 7" stroke="currentColor" strokeWidth="0.45" />
        </pattern>
        <pattern id="split-contrast-grid-pattern" width="24" height="24" patternUnits="userSpaceOnUse">
          <path d="M 24 0 L 0 0 0 24" fill="none" stroke="currentColor" strokeWidth="0.7" />
          <path d="M 12 0 L 12 24 M 0 12 L 24 12" fill="none" stroke="currentColor" strokeWidth="0.35" />
        </pattern>
      </defs>
      <rect x="0" width="50%" height="100%" fill="url(#split-contrast-pattern)" />
      <rect x="50%" width="50%" height="100%" fill="url(#split-contrast-grid-pattern)" />
    </PatternFrame>
  );
}

export function ContourPattern(props: PatternProps) {
  return (
    <PatternFrame {...props}>
      <defs>
        <pattern id="contour-pattern" width="80" height="58" patternUnits="userSpaceOnUse">
          <path d="M6 38 C18 8 55 8 72 34 C52 48 25 55 6 38Z" fill="none" stroke="currentColor" strokeWidth="0.8" />
          <path d="M19 36 C29 18 51 18 62 33 C49 42 32 45 19 36Z" fill="none" stroke="currentColor" strokeWidth="0.7" />
          <path d="M33 34 C39 27 48 27 53 33" fill="none" stroke="currentColor" strokeWidth="0.6" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#contour-pattern)" />
    </PatternFrame>
  );
}

export function HistologyDotsPattern(props: PatternProps) {
  return (
    <PatternFrame {...props}>
      <defs>
        <pattern id="histology-dots-pattern" width="28" height="28" patternUnits="userSpaceOnUse">
          <circle cx="6" cy="8" r="1.5" fill="currentColor" />
          <circle cx="19" cy="14" r="1.2" fill="currentColor" />
          <circle cx="12" cy="23" r="1" fill="currentColor" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#histology-dots-pattern)" />
    </PatternFrame>
  );
}

export function MedicalPattern({ pattern, opacity = 0.12 }: { pattern: TexturePattern; opacity?: number }) {
  switch (pattern) {
    case 'clinical-grid':
      return <ClinicalGridPattern opacity={opacity} />;
    case 'ekg-paper':
      return <EkgPaperPattern opacity={opacity} />;
    case 'alveolar':
      return <AlveolarPattern opacity={opacity} />;
    case 'vascular-branch':
      return <VascularBranchPattern opacity={opacity} />;
    case 'nephron-loop':
      return <NephronLoopPattern opacity={opacity} />;
    case 'synaptic':
      return <SynapticPattern opacity={opacity} />;
    case 'histology-dots':
      return <HistologyDotsPattern opacity={opacity} />;
    case 'mucosal-fold':
      return <MucosalFoldPattern opacity={opacity} />;
    case 'bone-lattice':
      return <BoneLatticePattern opacity={opacity} />;
    case 'contour':
      return <ContourPattern opacity={opacity} />;
    case 'split-contrast':
      return <SplitContrastPattern opacity={opacity} />;
    default:
      return null;
  }
}
