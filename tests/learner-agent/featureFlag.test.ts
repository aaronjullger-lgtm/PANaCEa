import { describe, it, expect } from 'vitest';
import { isFeatureEnabled, featureDisabledResponse } from '@/functions/api/_shared/feature-flags';
import { LEARNER_AGENT_FLAG } from '@/lib/services/learnerAgent/constants';

describe('learner-agent feature flag', () => {
  it('is disabled when env unset', () => {
    expect(isFeatureEnabled({}, LEARNER_AGENT_FLAG)).toBe(false);
  });

  it('is enabled for true values', () => {
    expect(isFeatureEnabled({ ENABLE_LEARNER_AGENT: 'true' }, LEARNER_AGENT_FLAG)).toBe(true);
    expect(isFeatureEnabled({ ENABLE_LEARNER_AGENT: '1' }, LEARNER_AGENT_FLAG)).toBe(true);
  });

  it('returns 404 envelope when disabled', async () => {
    const res = featureDisabledResponse(undefined, 'Learner Agent is not enabled');
    expect(res.status).toBe(404);
  });
});
