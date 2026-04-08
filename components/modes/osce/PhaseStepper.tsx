/**
 * PhaseStepper — Clinical workflow stepper for OSCE encounter phases.
 *
 * Shows a horizontal progression through the 5 OSCE phases:
 *   History → Physical → Diagnostic → Diagnosis → Treatment
 *
 * Features:
 *  - Completed phases show a green check
 *  - Current phase is highlighted with accent color
 *  - Upcoming phases are dimmed
 *  - Optional critical-action warning dot on phases with missed critical actions
 *  - Clicking a completed or current phase calls onPhaseSelect
 *  - CSS-only animations for phase transitions
 */
import React from 'react';
import {
  MessageSquare,
  Stethoscope,
  TestTube,
  ClipboardList,
  Pill,
  Check,
  AlertTriangle,
} from 'lucide-react';

export type EncounterPhase = 'history' | 'physical' | 'diagnostic' | 'diagnosis' | 'treatment';

interface PhaseConfig {
  id: EncounterPhase;
  label: string;
  shortLabel: string;
  icon: React.ReactNode;
}

const PHASES: PhaseConfig[] = [
  { id: 'history', label: 'History', shortLabel: 'Hx', icon: <MessageSquare className="w-4 h-4" /> },
  { id: 'physical', label: 'Physical Exam', shortLabel: 'PE', icon: <Stethoscope className="w-4 h-4" /> },
  { id: 'diagnostic', label: 'Diagnostics', shortLabel: 'Dx', icon: <TestTube className="w-4 h-4" /> },
  { id: 'diagnosis', label: 'Diagnosis', shortLabel: 'DDx', icon: <ClipboardList className="w-4 h-4" /> },
  { id: 'treatment', label: 'Treatment', shortLabel: 'Tx', icon: <Pill className="w-4 h-4" /> },
];

interface PhaseStepperProps {
  currentPhase: EncounterPhase;
  /** Phases that have been visited/completed */
  completedPhases?: EncounterPhase[];
  /** Phases that have missed critical actions (show warning dot) */
  warningPhases?: EncounterPhase[];
  onPhaseSelect?: (phase: EncounterPhase) => void;
  /** Use compact mode for smaller screens */
  compact?: boolean;
}

export const PhaseStepper: React.FC<PhaseStepperProps> = React.memo(({
  currentPhase,
  completedPhases = [],
  warningPhases = [],
  onPhaseSelect,
  compact = false,
}) => {
  const currentIndex = PHASES.findIndex(p => p.id === currentPhase);

  return (
    <div className="flex items-center w-full" role="navigation" aria-label="Encounter phases">
      {PHASES.map((phase, index) => {
        const isCurrent = phase.id === currentPhase;
        const isCompleted = completedPhases.includes(phase.id) || index < currentIndex;
        const isUpcoming = !isCurrent && !isCompleted;
        const hasWarning = warningPhases.includes(phase.id);
        const isClickable = (isCurrent || isCompleted) && onPhaseSelect;

        return (
          <React.Fragment key={phase.id}>
            {/* Connector line */}
            {index > 0 && (
              <div
                className={`flex-1 h-px mx-1 transition-colors duration-300 ${
                  isCompleted || isCurrent ? 'bg-[var(--color-accent)]' : 'bg-[var(--color-border)]'
                }`}
                aria-hidden="true"
              />
            )}

            {/* Phase node */}
            <button
              onClick={() => isClickable && onPhaseSelect?.(phase.id)}
              disabled={!isClickable}
              className={`
                relative flex items-center gap-1.5 rounded-lg transition-all duration-200
                ${compact ? 'px-2 py-1.5' : 'px-3 py-2'}
                ${isCurrent
                  ? 'bg-[var(--color-accent)]/15 border border-[var(--color-accent)]/40 text-[var(--color-accent)] shadow-[0_0_0_1px_var(--color-border),0_1px_2px_0_rgba(0,0,0,0.03)] shadow-[var(--color-accent)]/10'
                  : isCompleted
                    ? 'bg-[var(--color-bg-secondary)] border border-[var(--color-border)] text-[var(--color-text-primary)] hover:bg-[var(--color-bg-tertiary)]'
                    : 'border border-transparent text-[var(--color-text-muted)] opacity-50 cursor-default'
                }
                ${isClickable ? 'cursor-pointer' : 'cursor-default'}
              `}
              aria-current={isCurrent ? 'step' : undefined}
              aria-label={`${phase.label}${isCompleted ? ' (completed)' : isCurrent ? ' (current)' : ''}`}
            >
              {/* Phase icon or check */}
              <span className="flex-shrink-0">
                {isCompleted && !isCurrent ? (
                  <Check className="w-4 h-4 text-[var(--color-data-pass)]" />
                ) : (
                  phase.icon
                )}
              </span>

              {/* Label */}
              <span className={`text-xs font-medium whitespace-nowrap ${compact ? 'hidden sm:inline' : ''}`}>
                {compact ? phase.shortLabel : phase.label}
              </span>

              {/* Warning dot for missed critical actions */}
              {hasWarning && (
                <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5 items-center justify-center">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--color-data-fail)] opacity-40" />
                  <AlertTriangle className="relative w-3 h-3 text-[var(--color-data-fail)]" />
                </span>
              )}
            </button>
          </React.Fragment>
        );
      })}
    </div>
  );
});

PhaseStepper.displayName = 'PhaseStepper';
