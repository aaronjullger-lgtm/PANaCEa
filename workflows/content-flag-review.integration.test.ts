import { describe, expect, it } from 'vitest';
import { getRun, resumeHook, start } from 'workflow/api';
import { waitForHook } from '@workflow/vitest';
import { contentFlagReviewWorkflow } from './content-flag-review';

describe('contentFlagReviewWorkflow', () => {
  it('suspends on hook and resumes with an admin decision', async () => {
    const flagId = 'test-flag-integration-001';
    const run = await start(contentFlagReviewWorkflow, [
      {
        flagId,
        questionId: 'q-test-001',
        flagType: 'low_discrimination',
        reviewTimeout: '1h',
      },
    ]);

    const token = `content-flag-review:${flagId}`;
    await waitForHook(run, { token });

    await resumeHook(token, {
      decision: 'reject',
      reviewerId: 'test-admin',
      notes: 'Integration test rejection',
    });

    const result = await run.returnValue;

    expect(result.flagId).toBe(flagId);
    expect(result.decision).toBe('reject');
    expect(result.reviewerId).toBe('test-admin');
    expect(result.timedOut).toBe(false);
    // DB may be unavailable in CI — workflow should still complete
    expect(typeof result.applied).toBe('boolean');
    expect(result.reportPaths.jsonPath).toContain('artifacts/workflows');
  });
});

describe('workflow smoke', () => {
  it('exposes run status after start', async () => {
    const flagId = 'test-flag-status-001';
    const run = await start(contentFlagReviewWorkflow, [
      {
        flagId,
        questionId: 'q-test-002',
        flagType: 'distractor_issue',
        reviewTimeout: '1h',
      },
    ]);

    expect(run.runId).toBeTruthy();

    const token = `content-flag-review:${flagId}`;
    await waitForHook(run, { token });
    await resumeHook(token, {
      decision: 'approve',
      reviewerId: 'test-admin',
    });

    await run.returnValue;

    const tracked = getRun(run.runId);
    const status = await tracked.status;
    expect(status).toBe('completed');
  });
});
