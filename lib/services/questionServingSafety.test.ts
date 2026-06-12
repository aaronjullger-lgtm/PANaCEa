import { describe, expect, it } from 'vitest';
import {
  PROGRESS_LINKAGE_FILTER,
  withProductionPregeneratedSafety,
  withProductionQuestionSafety,
  withProgressLinkage,
} from './questionServingSafety';

describe('withProgressLinkage', () => {
  it('appends the progress-linkage filter without clobbering existing conditions', () => {
    const where = withProgressLinkage(withProductionPregeneratedSafety({ system: 'CV' }));

    expect(where.system).toBe('CV');
    expect(where.validationStatus).toBe('approved');
    expect(where.AND).toEqual([PROGRESS_LINKAGE_FILTER]);
  });

  it('preserves a pre-existing AND clause', () => {
    const where = withProgressLinkage({ AND: [{ difficulty: 'medium' }] });

    expect(where.AND).toEqual([{ difficulty: 'medium' }, PROGRESS_LINKAGE_FILTER]);
  });

  it('requires conditionId so served questions match what the review writer can schedule', () => {
    // The FSRS writer's progress reads are keyed on conditionId; serving must
    // not admit rows the writer cannot schedule (medicalContentId-only rows
    // are excluded until the writer is re-keyed — 0 such rows exist live).
    expect(PROGRESS_LINKAGE_FILTER).toEqual({ conditionId: { not: null } });
  });

  it('composes with canonical question safety', () => {
    const where = withProgressLinkage(withProductionQuestionSafety({}));

    expect(where.lifecycleStatus).toBe('ACTIVE');
    expect(where.qaStatus).toBe('APPROVED');
    expect(where.AND).toEqual([PROGRESS_LINKAGE_FILTER]);
  });
});
