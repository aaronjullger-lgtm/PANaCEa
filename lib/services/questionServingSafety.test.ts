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

  it('requires conditionId or medicalContentId so served questions can persist reviews', () => {
    expect(PROGRESS_LINKAGE_FILTER).toEqual({
      OR: [{ conditionId: { not: null } }, { medicalContentId: { not: null } }],
    });
  });

  it('composes with canonical question safety', () => {
    const where = withProgressLinkage(withProductionQuestionSafety({}));

    expect(where.lifecycleStatus).toBe('ACTIVE');
    expect(where.qaStatus).toBe('APPROVED');
    expect(where.AND).toEqual([PROGRESS_LINKAGE_FILTER]);
  });
});
