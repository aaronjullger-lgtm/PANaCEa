import type { TrainingModeId } from '@/config/training-modes';
import { getStudyModeContract } from './studyModeContracts';

export type ModeReadinessState = 'discoverable' | 'hidden' | 'deferred' | 'blocked';

export interface ModeReadiness {
  modeId: string;
  state: ModeReadinessState;
  discoverable: boolean;
  mountedComponent: 'real' | 'productionDeferred' | 'unknown';
  reasons: string[];
}

/**
 * Modes currently exported from config/lazyComponents.tsx via productionDeferred.
 * Public discovery must fail closed until a real mounted slice replaces the
 * placeholder and the mode contract is production-ready.
 */
export const PRODUCTION_DEFERRED_MODE_IDS = new Set<TrainingModeId>([
  'photo_drill',
  'rapid_recall',
  'ddx_compare',
  'mini_lab',
  'first_line_treatment',
  'guideline_drill',
  'pharmacology',
  'subcategory_drill',
  'ventilator_hero',
  'physiology_drill',
  'anatomy_review',
  'fluid_electrolyte',
  'antibiotic_mode',
  'patient_encounter',
  'code_blue_speed',
  'grand_rounds',
  'contrastive_drill',
  'reasoning_tutor',
  'commuter_mode',
  'cram_mode',
  'polypharmacy_puzzle',
  'medical_wordle',
  'diagnostic_puzzle',
  'full_sit_down_test',
  'panre_la',
  'pance_simulator',
  'elaboration_drill',
  'icd_coding_drill',
  'teach_back_drill',
]);

export const REAL_MOUNTED_MODE_IDS = new Set<TrainingModeId>([
  'core_adaptive',
  'system_drill',
  'condition_drill',
]);

export function getModeReadiness(modeId: string): ModeReadiness {
  const contract = getStudyModeContract(modeId);
  const reasons: string[] = [];
  const typedModeId = modeId as TrainingModeId;
  const isDeferred = PRODUCTION_DEFERRED_MODE_IDS.has(typedModeId);
  const isMounted = REAL_MOUNTED_MODE_IDS.has(typedModeId);

  if (!contract) {
    return {
      modeId,
      state: 'hidden',
      discoverable: false,
      mountedComponent: isMounted ? 'real' : isDeferred ? 'productionDeferred' : 'unknown',
      reasons: ['No study-mode contract exists for this mode.'],
    };
  }

  if (contract.productionStatus !== 'fully_functional') {
    reasons.push(`Contract status is ${contract.productionStatus}.`);
  }
  if (contract.blockingIssues.length > 0) {
    reasons.push(...contract.blockingIssues);
  }
  if (isDeferred) {
    reasons.push('Mounted component is still productionDeferred.');
  }
  if (!isMounted && !isDeferred) {
    reasons.push('Mounted component readiness has not been audited.');
  }

  const discoverable =
    contract.productionStatus === 'fully_functional' &&
    contract.blockingIssues.length === 0 &&
    isMounted &&
    !isDeferred;

  return {
    modeId,
    state: discoverable ? 'discoverable' : isDeferred ? 'deferred' : 'blocked',
    discoverable,
    mountedComponent: isMounted ? 'real' : isDeferred ? 'productionDeferred' : 'unknown',
    reasons,
  };
}

export function isModeDiscoverable(modeId: string): boolean {
  return getModeReadiness(modeId).discoverable;
}
