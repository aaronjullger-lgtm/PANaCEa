/**
 * RoundsButton - Single primary action to start drill in weakest area
 *
 * Residency Cockpit: Intelligently routes to System Drill with
 * the user's weakest organ system pre-selected.
 */

import React from 'react';
import { Stethoscope, ChevronRight } from 'lucide-react';
import { PrimaryButton } from '@/components/ui/PrimaryButton';

interface RoundsButtonProps {
  weakestSystem: string | null;
  hasData: boolean;
  onStartRounds: (system: string | null) => void;
  disabled?: boolean;
}

const SYSTEM_LABELS: Record<string, string> = {
  CV: 'Cardiovascular',
  PULM: 'Pulmonary',
  GI: 'Gastrointestinal',
  HEENT: 'HEENT',
  NEURO: 'Neurology',
  MSK: 'Musculoskeletal',
  DERM: 'Dermatology',
  ENDO: 'Endocrine',
  GU: 'Genitourinary',
  RENAL: 'Renal',
  REPRO: 'Reproductive',
  HEME: 'Hematology',
  ID: 'Infectious Disease',
  PSYCH: 'Psychiatry',
  PRO: 'Professional Practice',
};

export function RoundsButton({
  weakestSystem,
  hasData,
  onStartRounds,
  disabled = false,
}: RoundsButtonProps) {
  const label = weakestSystem
    ? `Start Rounds: ${SYSTEM_LABELS[weakestSystem] || weakestSystem}`
    : hasData
      ? 'Start Rounds'
      : 'Start Rounds (Build profile first)';

  return (
    <PrimaryButton
      variant="primary"
      size="lg"
      icon={Stethoscope}
      iconRight={ChevronRight}
      onClick={() => onStartRounds(weakestSystem)}
      disabled={disabled}
      className="w-full sm:w-auto"
    >
      {label}
    </PrimaryButton>
  );
}
