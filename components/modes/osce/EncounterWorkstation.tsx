/**
 * EncounterWorkstation — Clinical EMR-style layout for the active OSCE encounter.
 *
 * Replaces the stacked-panel + modal-overlay pattern with a persistent
 * two-column workstation grid:
 *
 * ┌──────────────────────────────────────────────────────┐
 * │ [VitalsStrip]  [AV Badge]  [PhaseStepper]            │
 * ├────────────────────────────┬──────────────────────────┤
 * │                            │  Sidebar                 │
 * │   Main Content             │  ├─ Rapport Meter        │
 * │   (patient card +          │  ├─ Orders (persistent)  │
 * │    phase inputs)           │  ├─ Exam (persistent)    │
 * │                            │  └─ Encounter Log        │
 * └────────────────────────────┴──────────────────────────┘
 */

import React, { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ClipboardList, Stethoscope, ChevronRight, ChevronLeft } from 'lucide-react';
import { VitalsStrip } from './VitalsStrip';
import { PhaseStepper } from './PhaseStepper';
import type { EncounterPhase } from '@/hooks/useEncounterReducer';
import type { AVState } from '@/types/patient-av-state-machine';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface VitalsData {
  hr: number;
  sbp: number;
  dbp: number;
  rr: number;
  o2: number;
}

interface VitalsHistory {
  hr?: number[];
  sbp?: number[];
  rr?: number[];
  o2?: number[];
}

export interface EncounterWorkstationProps {
  /** Current vitals for VitalsStrip */
  vitals: VitalsData;
  /** Vitals trend history for sparklines */
  vitalsHistory?: VitalsHistory;
  /** Current encounter phase */
  phase: EncounterPhase;
  /** Phase selection handler */
  onPhaseSelect: (phase: EncounterPhase) => void;
  /** AV engine state (shown when non-null) */
  avState: AVState | null;
  /** Whether order panel is expanded in sidebar */
  showOrders: boolean;
  /** Whether exam panel is expanded in sidebar */
  showExam: boolean;
  /** Toggle order panel */
  onToggleOrders: () => void;
  /** Toggle exam panel */
  onToggleExam: () => void;
  /** Main content area — patient card + phase-specific inputs */
  children: React.ReactNode;
  /** Right sidebar content — rapport meter, encounter log, etc. */
  sidebarContent: React.ReactNode;
  /** Order panel component (rendered in sidebar when expanded) */
  orderPanel?: React.ReactNode;
  /** Exam panel component (rendered in sidebar when expanded) */
  examPanel?: React.ReactNode;
}

// ---------------------------------------------------------------------------
// AV State Badge (extracted for readability)
// ---------------------------------------------------------------------------

const AVStateBadge = React.memo(({ avState }: { avState: AVState }) => {
  const severityClass = useMemo(() => {
    if (avState.id.includes('critical') || avState.id.includes('severe')) {
      return 'bg-[var(--color-data-fail)] animate-pulse';
    }
    if (avState.id.includes('distress') || avState.id.includes('worsening')) {
      return 'bg-[var(--color-data-provisional)] animate-pulse';
    }
    return 'bg-[var(--color-data-pass)]';
  }, [avState.id]);

  return (
    <div className="mb-3 flex items-center gap-3 px-4 py-2 rounded-lg bg-[var(--color-bg-secondary)] border border-[var(--color-border)]">
      <div className={`w-2.5 h-2.5 rounded-full ${severityClass}`} />
      <span className="text-sm font-medium text-[var(--color-text-primary)]">
        {avState.name}
      </span>
      <span className="text-xs text-[var(--color-text-muted)] ml-auto">
        {avState.clinicalContext}
      </span>
      {avState.voice?.toneDescriptors?.length > 0 && (
        <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--color-bg-tertiary)] text-[var(--color-text-muted)]">
          {avState.voice.toneDescriptors.slice(0, 2).join(', ')}
        </span>
      )}
    </div>
  );
});
AVStateBadge.displayName = 'AVStateBadge';

// ---------------------------------------------------------------------------
// Sidebar Tab Button
// ---------------------------------------------------------------------------

const SidebarTab = React.memo(
  ({
    icon: Icon,
    label,
    isActive,
    onClick,
  }: {
    icon: React.FC<{ className?: string }>;
    label: string;
    isActive: boolean;
    onClick: () => void;
  }) => (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
        isActive
          ? 'bg-[var(--color-accent)]/15 text-[var(--color-accent)] border border-[var(--color-accent)]/30'
          : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-tertiary)]'
      }`}
      title={isActive ? `Hide ${label}` : `Show ${label}`}
    >
      <Icon className="w-4 h-4" />
      <span className="hidden lg:inline">{label}</span>
      {isActive ? <ChevronRight className="w-3 h-3 ml-auto" /> : <ChevronLeft className="w-3 h-3 ml-auto" />}
    </button>
  ),
);
SidebarTab.displayName = 'SidebarTab';

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export const EncounterWorkstation: React.FC<EncounterWorkstationProps> = React.memo(
  ({
    vitals,
    vitalsHistory,
    phase,
    onPhaseSelect,
    avState,
    showOrders,
    showExam,
    onToggleOrders,
    onToggleExam,
    children,
    sidebarContent,
    orderPanel,
    examPanel,
  }) => {
    const hasSidebarPanel = showOrders || showExam;

    return (
      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Status Bar: Vitals + AV State + Phase Stepper */}
        <div className="mb-4">
          <VitalsStrip
            hr={vitals.hr}
            sbp={vitals.sbp}
            dbp={vitals.dbp}
            rr={vitals.rr}
            o2={vitals.o2}
            hrHistory={vitalsHistory?.hr}
            sbpHistory={vitalsHistory?.sbp}
            rrHistory={vitalsHistory?.rr}
            o2History={vitalsHistory?.o2}
          />
        </div>

        {avState && <AVStateBadge avState={avState} />}

        <div className="mb-6 py-3 px-4 rounded-xl bg-data-neutral-bg/80 border border-data-neutral">
          <PhaseStepper currentPhase={phase} onPhaseSelect={onPhaseSelect} compact />
        </div>

        {/* Workstation Grid */}
        <div className="grid md:grid-cols-12 gap-4">
          {/* Main Panel (8 cols, or 7 when sidebar panel is open) */}
          <div className={`${hasSidebarPanel ? 'md:col-span-7' : 'md:col-span-8'} space-y-4 transition-all duration-200`}>
            {children}
          </div>

          {/* Right Sidebar */}
          <div className={`${hasSidebarPanel ? 'md:col-span-5' : 'md:col-span-4'} space-y-3 transition-all duration-200`}>
            {/* Sidebar Panel Tabs */}
            <div className="flex gap-2">
              <SidebarTab
                icon={ClipboardList}
                label="Orders"
                isActive={showOrders}
                onClick={onToggleOrders}
              />
              <SidebarTab
                icon={Stethoscope}
                label="Exam"
                isActive={showExam}
                onClick={onToggleExam}
              />
            </div>

            {/* Persistent Order/Exam Panel (inline, not modal) */}
            <AnimatePresence mode="wait">
              {showOrders && orderPanel && (
                <motion.div
                  key="orders"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)]"
                >
                  <div className="max-h-[50vh] overflow-y-auto">
                    {orderPanel}
                  </div>
                </motion.div>
              )}
              {showExam && examPanel && (
                <motion.div
                  key="exam"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)]"
                >
                  <div className="max-h-[50vh] overflow-y-auto">
                    {examPanel}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Persistent Sidebar Content (Rapport + Encounter Log) */}
            {sidebarContent}
          </div>
        </div>
      </div>
    );
  },
);
EncounterWorkstation.displayName = 'EncounterWorkstation';
