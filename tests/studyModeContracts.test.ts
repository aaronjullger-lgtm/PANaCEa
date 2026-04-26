import { describe, expect, it } from 'vitest';
import { TRAINING_MODES } from '../config/training-modes';
import {
  CORE_PRODUCTION_MODE_IDS,
  getCoreProductionModeContracts,
  getStudyModeContract,
  getTrainingModeContracts,
  requireStudyModeContract,
  validateStudyModeContracts,
} from '../lib/modes/studyModeContracts';

describe('study mode contracts', () => {
  it('has one valid contract for every registered training mode', () => {
    const contracts = getTrainingModeContracts();
    const contractIds = new Set(contracts.map((contract) => contract.modeId));

    expect(contracts).toHaveLength(TRAINING_MODES.length);
    for (const mode of TRAINING_MODES) {
      expect(contractIds.has(mode.id), `missing contract for ${mode.id}`).toBe(true);
      expect(getStudyModeContract(mode.id)?.route).toBe(mode.route);
    }

    expect(validateStudyModeContracts(contracts)).toEqual([]);
  });

  it('defines complete production contracts for the prioritized core workflows', () => {
    const coreContracts = getCoreProductionModeContracts();

    expect(coreContracts.map((contract) => contract.modeId)).toEqual(CORE_PRODUCTION_MODE_IDS);
    expect(coreContracts).toHaveLength(9);

    for (const contract of coreContracts) {
      expect(contract.requiredAuth).toBe('required');
      expect(contract.requiredUserState.length).toBeGreaterThan(0);
      expect(contract.startingApiCall?.path).toMatch(/^\/api\//);
      expect(contract.loadingStateBehavior.title).toBeTruthy();
      expect(contract.emptyStateBehavior.title).toBeTruthy();
      expect(contract.errorStateBehavior.title).toBeTruthy();
      expect(contract.completionBehavior.persistedState.length).toBeGreaterThan(0);
      expect(contract.analyticsEvents.length).toBeGreaterThanOrEqual(3);
    }
  });

  it('documents the practice question happy path through session generation and review submit', () => {
    const contract = requireStudyModeContract('practice_questions');

    expect(contract.productionStatus).toBe('fully_functional');
    expect(contract.route).toBe('/practice');
    expect(contract.startingApiCall?.path).toBe('/api/study/session/generate');
    expect(contract.answerInteractionApiCall?.path).toBe('/api/drills/submit-review');
    expect(contract.answerInteractionApiCall?.persistsData).toBe(true);
    expect(contract.reviewSchedulingBehavior.type).toBe('fsrs_real_review');
    expect(contract.progressUpdateBehavior.writes).toEqual(
      expect.arrayContaining(['QuestionAttempt', 'ReviewLog', 'UserProgress'])
    );
  });

  it('keeps unsafe and disconnected modes visible in the audit contract', () => {
    expect(requireStudyModeContract('patient_encounter').productionStatus).toBe(
      'unsafe_for_production'
    );
    expect(requireStudyModeContract('icd_coding_drill').productionStatus).toBe(
      'frontend_backend_disconnected'
    );
    expect(requireStudyModeContract('polypharmacy_puzzle').productionStatus).toBe(
      'duplicate_obsolete'
    );
  });

  it('throws a clear error when a route asks for an unknown mode contract', () => {
    expect(() => requireStudyModeContract('not_a_real_mode')).toThrow(
      'Study mode contract not found: not_a_real_mode'
    );
  });
});
