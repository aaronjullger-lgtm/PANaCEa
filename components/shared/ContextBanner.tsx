/**
 * Context Banner
 * 
 * Persistent banner shown across all modules displaying current clinical context.
 * Always visible at top of screen to maintain situational awareness.
 */

import React from 'react';
import { User, Stethoscope, Clock, Activity } from 'lucide-react';

interface ContextBannerProps {
  patientName?: string;
  patientAge?: number;
  patientSex?: string;
  chiefComplaint?: string;
  workingDiagnosis?: string;
  vitals?: {
    hr?: number;
    bp?: string;
    o2?: number;
    [key: string]: string | number | undefined;
  };
  elapsed?: number; // seconds
  className?: string;
}

export function ContextBanner({
  patientName,
  patientAge,
  patientSex,
  chiefComplaint,
  workingDiagnosis,
  vitals,
  elapsed,
  className = '',
}: ContextBannerProps) {
  // Don't show if no context
  if (!patientName && !chiefComplaint) {
    return null;
  }

  const formatElapsed = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getVitalColorClass = (vital: string, value: number | string | undefined) => {
    if (typeof value !== 'number') return '';
    
    if (vital === 'o2') {
      if (value < 88) return 'text-rose-500 font-semibold';
      if (value < 92) return 'text-amber-500';
    }
    if (vital === 'hr') {
      if (value < 50 || value > 120) return 'text-rose-500 font-semibold';
      if (value < 60 || value > 100) return 'text-amber-500';
    }
    
    return '';
  };

  return (
    <div
      className={`sticky top-0 z-30 bg-[var(--color-bg-secondary)] border-b border-[var(--color-border)] px-4 py-2 ${className}`}
      data-testid="context-banner"
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
        {/* Patient info */}
        {patientName && (
          <div className="flex items-center gap-1.5 text-[var(--color-text-primary)] font-medium">
            <User className="w-4 h-4 text-[var(--color-accent)]" />
            <span>
              {patientName}
              {patientAge && patientSex && `, ${patientAge}yo ${patientSex}`}
            </span>
          </div>
        )}

        {/* Chief complaint */}
        {chiefComplaint && (
          <div className="flex items-center gap-1.5 text-[var(--color-text-secondary)]">
            <Stethoscope className="w-4 h-4 text-[var(--color-accent)]" />
            <span>CC: {chiefComplaint}</span>
          </div>
        )}

        {/* Vitals */}
        {vitals && (
          <div className="flex items-center gap-1.5 text-[var(--color-text-secondary)]">
            <Activity className="w-4 h-4 text-[var(--color-accent)]" />
            <span className="font-mono">
              {vitals.hr && (
                <span className={getVitalColorClass('hr', vitals.hr)}>
                  HR {vitals.hr}
                </span>
              )}
              {vitals.hr && vitals.bp && ' | '}
              {vitals.bp && <span>BP {vitals.bp}</span>}
              {vitals.bp && vitals.o2 && ' | '}
              {vitals.o2 !== undefined && (
                <span className={getVitalColorClass('o2', vitals.o2)}>
                  O2 {vitals.o2}%
                </span>
              )}
            </span>
          </div>
        )}

        {/* Working diagnosis */}
        {workingDiagnosis && (
          <div className="flex items-center gap-1.5 text-[var(--color-text-secondary)]">
            <span className="text-xs text-[var(--color-text-muted)]">Dx:</span>
            <span className="font-medium">{workingDiagnosis}</span>
          </div>
        )}

        {/* Time elapsed */}
        {elapsed !== undefined && (
          <div className="flex items-center gap-1.5 text-[var(--color-text-muted)] ml-auto">
            <Clock className="w-4 h-4" />
            <span className="font-mono">{formatElapsed(elapsed)}</span>
          </div>
        )}
      </div>
    </div>
  );
}
