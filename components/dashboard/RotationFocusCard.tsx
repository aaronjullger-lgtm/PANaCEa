/**
 * RotationFocusCard — Shows rotation-specific study guidance on the dashboard.
 *
 * When a student sets their current rotation, this card highlights:
 * - Relevant organ systems weighted by rotation focus
 * - High-yield conditions for the rotation
 * - EOR countdown with preparation milestones
 * - Suggested study focus for the current week
 */

import React, { useMemo } from 'react';
import { Stethoscope, Calendar, Target, ChevronRight, BookOpen } from 'lucide-react';
import { findRotation, getRotationHighYield } from '@/lib/constants/pa-curriculum';

interface RotationFocusCardProps {
  rotationName?: string;
  rotationWeek?: number;
  eorDate?: string;        // ISO date string
  systemPerformance?: Record<string, number>; // system abbrev → accuracy (0-1)
  onStartDrill?: (system: string) => void;
  className?: string;
}

export const RotationFocusCard: React.FC<RotationFocusCardProps> = ({
  rotationName,
  rotationWeek,
  eorDate,
  systemPerformance = {},
  onStartDrill,
  className = '',
}) => {
  const rotation = useMemo(
    () => (rotationName ? findRotation(rotationName) : undefined),
    [rotationName]
  );

  if (!rotation) {
    return (
      <div className={`rounded-xl bg-[var(--color-bg-secondary)] p-5 ${className}`} style={{ boxShadow: '0 0 0 1px var(--color-border), 0 1px 2px 0 rgba(0,0,0,0.03)' }}>
        <div className="flex items-center gap-2 mb-2">
          <Stethoscope className="w-5 h-5 text-[var(--color-text-muted)]" />
          <h3 className="font-semibold text-[var(--color-text-primary)]">Rotation Focus</h3>
        </div>
        <p className="text-sm text-[var(--color-text-muted)]">Set your current rotation in Settings to see rotation-specific study guidance.</p>
      </div>
    );
  }

  const highYield = getRotationHighYield(rotationName || '');
  const daysUntilEOR = eorDate
    ? Math.max(0, Math.ceil((new Date(eorDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : null;

  // Find weakest rotation-relevant system
  const weakestSystem = useMemo(() => {
    if (!rotation) return null;
    let worst: { system: string; accuracy: number } | null = null;
    for (const sys of rotation.systems) {
      const acc = systemPerformance[sys];
      if (acc !== undefined && (worst === null || acc < worst.accuracy)) {
        worst = { system: sys, accuracy: acc };
      }
    }
    return worst;
  }, [rotation, systemPerformance]);

  return (
    <div className={`rounded-xl bg-[var(--color-bg-secondary)] p-5 ${className}`} style={{ boxShadow: '0 0 0 1px var(--color-border), 0 1px 2px 0 rgba(0,0,0,0.03)' }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Stethoscope className="w-5 h-5 text-[var(--color-text-secondary)]" />
          <h3 className="font-semibold text-[var(--color-text-primary)]">
            {rotation.name} Rotation
          </h3>
        </div>
        {rotationWeek && (
          <span className="text-sm text-[var(--color-text-muted)]">
            Week {rotationWeek} of {rotation.weeks}
          </span>
        )}
      </div>

      {/* EOR Countdown */}
      {daysUntilEOR !== null && (
        <div className="flex items-center gap-2 mb-4 px-3 py-2 rounded-lg bg-[var(--color-bg-tertiary)]">
          <Calendar className="w-4 h-4 text-[var(--color-accent)]" />
          <span className="text-sm text-[var(--color-text-secondary)]">
            EOR Exam in{' '}
            <span className={`font-semibold ${daysUntilEOR <= 7 ? 'text-[var(--color-data-fail)]' : 'text-[var(--color-text-primary)]'}`}>
              {daysUntilEOR} days
            </span>
          </span>
          {daysUntilEOR <= 14 && (
            <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-[var(--color-data-fail)] text-[var(--color-text-inverse)]">
              Crunch time
            </span>
          )}
        </div>
      )}

      {/* Focus Systems */}
      <div className="mb-4">
        <p className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wide mb-2">
          Focus Systems
        </p>
        <div className="flex flex-wrap gap-1.5">
          {rotation.systems.map((sys) => {
            const acc = systemPerformance[sys];
            const isWeak = acc !== undefined && acc < 0.65;
            return (
              <button
                key={sys}
                onClick={() => onStartDrill?.(sys)}
                aria-label={`Start drill on ${sys}${acc !== undefined ? ` — ${Math.round(acc * 100)}% accuracy` : ''}`}
                className={`
                  px-2.5 py-1 rounded-md text-xs font-medium transition-colors duration-200
                  ${isWeak
                    ? 'bg-[var(--color-data-fail)]/15 text-[var(--color-data-fail)] hover:bg-[var(--color-data-fail)]/25'
                    : 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)]/80'
                  }
                `}
              >
                {sys}
                {acc !== undefined && (
                  <span className="ml-1 opacity-70 tabular-nums">{Math.round(acc * 100)}%</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Weakest System Alert */}
      {weakestSystem && weakestSystem.accuracy < 0.65 && (
        <button
          onClick={() => onStartDrill?.(weakestSystem.system)}
          className="w-full flex items-center gap-3 px-3 py-2.5 mb-4 rounded-lg bg-[var(--color-data-fail)]/10 hover:bg-[var(--color-data-fail)]/15 transition-colors duration-200 group focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2"
        >
          <Target className="w-4 h-4 text-[var(--color-data-fail)]" aria-hidden="true" />
          <span className="text-sm text-[var(--color-text-secondary)]">
            <span className="font-semibold text-[var(--color-data-fail)]">{weakestSystem.system}</span> needs work — <span className="tabular-nums">{Math.round(weakestSystem.accuracy * 100)}%</span> accuracy
          </span>
          <ChevronRight className="w-4 h-4 ml-auto text-[var(--color-text-muted)] group-hover:translate-x-0.5 transition-transform duration-200" aria-hidden="true" />
        </button>
      )}

      {/* High-Yield Conditions */}
      {highYield.length > 0 && (
        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <BookOpen className="w-3.5 h-3.5 text-[var(--color-text-muted)]" />
            <p className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wide">
              High-Yield Conditions
            </p>
          </div>
          <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">
            {highYield.join(' · ')}
          </p>
        </div>
      )}
    </div>
  );
};

export default RotationFocusCard;
