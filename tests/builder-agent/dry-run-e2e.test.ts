import { describe, expect, it } from 'vitest';
import { runDryRunLifecycle } from '@/lib/builder-agent/fixtures/dry-run';
import { BUILD_PHASES } from '@/lib/builder-agent/workflow/phases';

describe('BuilderAgent dry-run e2e', () => {
  it('runs full lifecycle: idea → spec → plan → PR → completion', async () => {
    const result = await runDryRunLifecycle(
      {
        taskSource: 'idea',
        objective: 'Add builder agent health endpoint documentation',
        requestingUser: 'test-user',
        dryRun: true,
      },
      { autoApprovePlan: true, revisionCycles: 1, simulateCiFailure: true }
    );

    expect(result.run.status).toBe('completed');
    expect(result.run.dryRun).toBe(true);
    expect(result.run.prUrl).toBeDefined();
    expect(result.run.branchName).toMatch(/^cursor\/builder-/);
    expect(result.run.retryCount).toBeGreaterThanOrEqual(1);
    expect(result.spec).toContain('Specification');
    expect(result.plan).toContain('Plan');
    expect(result.events.some((e) => e.type === 'run.created')).toBe(true);
    expect(result.events.some((e) => e.type === 'pr.created')).toBe(true);
    expect(result.events.some((e) => e.type === 'ci.result')).toBe(true);

    for (const phase of BUILD_PHASES) {
      expect(result.run.completedCheckpoints).toContain(phase.checkpoint);
    }
  });

  it('pauses at plan approval for high-risk work', async () => {
    await expect(
      runDryRunLifecycle({
        taskSource: 'bug',
        objective: 'Apply prisma migration to add UserDailyInsight table',
        requestingUser: 'test-user',
        dryRun: true,
      })
    ).rejects.toThrow(/plan approval/);
  });

  it('fails validation when tests fail', async () => {
    const result = await runDryRunLifecycle(
      {
        taskSource: 'idea',
        objective: 'Small fix',
        requestingUser: 'test-user',
        dryRun: true,
      },
      { autoApprovePlan: true, simulateTestFailure: true }
    );
    expect(result.run.status).toBe('failed');
    expect(result.run.errorSummary).toContain('Validation');
  });
});

describe('BuilderAgent prohibited operations', () => {
  it('does not complete merge without approval in dry-run', async () => {
    const result = await runDryRunLifecycle(
      {
        taskSource: 'idea',
        objective: 'Docs update',
        requestingUser: 'test-user',
      },
      { autoApprovePlan: true, autoApproveMerge: false }
    );
    expect(result.run.status).toBe('completed');
    const mergePending = result.run.pendingApprovals.find((a) => a.kind === 'merge');
    expect(mergePending?.status).toBe('pending');
  });
});
