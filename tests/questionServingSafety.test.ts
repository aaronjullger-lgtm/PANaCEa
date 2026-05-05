import { describe, expect, it } from 'vitest';
import {
  buildLegacyStudyModeEndpointMetadata,
  withProductionPregeneratedSafety,
  withProductionQuestionSafety,
} from '../lib/services/questionServingSafety';

describe('questionServingSafety', () => {
  it('adds active approved filters to learner-facing Question queries', () => {
    expect(withProductionQuestionSafety({ system: 'Pulmonary' })).toEqual({
      system: 'Pulmonary',
      lifecycleStatus: 'ACTIVE',
      qaStatus: 'APPROVED',
    });
  });

  it('overrides looser Question filters so study modes fail closed', () => {
    expect(
      withProductionQuestionSafety({
        lifecycleStatus: { not: 'RETIRED' },
        qaStatus: 'UNREVIEWED',
      })
    ).toEqual({
      lifecycleStatus: 'ACTIVE',
      qaStatus: 'APPROVED',
    });
  });

  it('adds approved-only filtering to learner-facing PreGeneratedQuestion queries', () => {
    expect(withProductionPregeneratedSafety({ conditionId: 'cond-1' })).toEqual({
      conditionId: 'cond-1',
      validationStatus: 'approved',
    });
  });

  it('marks compatibility endpoints with a canonical replacement', () => {
    expect(
      buildLegacyStudyModeEndpointMetadata({
        replacement: '/api/study/session/generate',
        canonicalRequest: { mode: 'system', system: 'Pulmonary' },
      })
    ).toMatchObject({
      deprecated: true,
      replacement: '/api/study/session/generate',
      canonicalRequest: { mode: 'system', system: 'Pulmonary' },
    });
  });
});
