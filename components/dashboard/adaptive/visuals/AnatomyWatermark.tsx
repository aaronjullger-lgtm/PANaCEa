import React from 'react';
import type { MedicalMotif } from '../model/visualTokens';

type Props = {
  motif: MedicalMotif;
  className?: string;
};

function WatermarkShell({ children, className = '' }: React.PropsWithChildren<{ className?: string }>) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 120 120"
      className={`pointer-events-none absolute right-3 top-3 h-28 w-28 text-current opacity-[0.08] ${className}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  );
}

export function AnatomyWatermark({ motif, className }: Props) {
  switch (motif) {
    case 'lungs':
    case 'alveoli':
      return (
        <WatermarkShell className={className}>
          <path d="M57 22v64" />
          <path d="M55 37c-17-14-34-4-35 23-1 23 9 38 26 31 9-4 9-17 9-31V37Z" />
          <path d="M65 37c17-14 34-4 35 23 1 23-9 38-26 31-9-4-9-17-9-31V37Z" />
          <path d="M46 65c-8 0-12 4-17 11M74 65c8 0 12 4 17 11" />
        </WatermarkShell>
      );
    case 'heart':
    case 'vascular':
      return (
        <WatermarkShell className={className}>
          <path d="M60 96C32 78 20 62 22 43c2-18 23-24 38-6 15-18 36-12 38 6 2 19-10 35-38 53Z" />
          <path d="M41 58h13l5-13 9 28 6-15h13" />
        </WatermarkShell>
      );
    case 'kidney':
    case 'nephron':
      return (
        <WatermarkShell className={className}>
          <path d="M48 19c-20 8-28 32-20 55 7 20 25 33 39 22 8-6 6-20-2-28-10-10-10-24 2-35 8-8-4-20-19-14Z" />
          <path d="M74 24c16 8 22 28 15 48-5 15-17 25-28 25" />
          <path d="M54 42c14 5 15 21 2 31" />
        </WatermarkShell>
      );
    case 'brain':
    case 'synapse':
      return (
        <WatermarkShell className={className}>
          <path d="M36 79c-13-3-19-15-14-28 3-8 10-13 18-14 3-12 17-18 28-11 12-6 28 2 29 16 10 5 13 19 6 29-6 9-18 12-28 8-9 9-28 10-39 0Z" />
          <path d="M43 49c8 2 15-1 20-8M68 36c2 10 9 17 21 19M47 75c6-8 14-11 25-8" />
        </WatermarkShell>
      );
    case 'gi-folds':
      return (
        <WatermarkShell className={className}>
          <path d="M22 43c22-28 54 28 76 0M22 62c22-28 54 28 76 0M22 81c22-28 54 28 76 0" />
        </WatermarkShell>
      );
    case 'blood-smear':
      return (
        <WatermarkShell className={className}>
          <ellipse cx="38" cy="44" rx="16" ry="11" />
          <ellipse cx="78" cy="66" rx="18" ry="12" transform="rotate(-18 78 66)" />
          <ellipse cx="43" cy="86" rx="11" ry="7" />
        </WatermarkShell>
      );
    case 'skin-layers':
      return (
        <WatermarkShell className={className}>
          <path d="M14 34c18-8 30 8 48 0s30 8 44 1M14 58c18-8 30 8 48 0s30 8 44 1M14 82c18-8 30 8 48 0s30 8 44 1" />
        </WatermarkShell>
      );
    case 'shield':
      return (
        <WatermarkShell className={className}>
          <path d="M60 15 96 29v27c0 24-14 42-36 50-22-8-36-26-36-50V29l36-14Z" />
          <path d="m42 60 12 12 26-30" />
        </WatermarkShell>
      );
    case 'target':
      return (
        <WatermarkShell className={className}>
          <circle cx="60" cy="60" r="38" />
          <circle cx="60" cy="60" r="22" />
          <circle cx="60" cy="60" r="7" />
          <path d="M60 14v18M60 88v18M14 60h18M88 60h18" />
        </WatermarkShell>
      );
    default:
      return null;
  }
}
