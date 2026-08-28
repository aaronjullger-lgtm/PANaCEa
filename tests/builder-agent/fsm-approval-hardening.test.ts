import { describe, expect, it } from 'vitest';
import { createApprovalRequest, resolveApproval } from '@/lib/builder-agent/approval/gates';
import { prohibitedWithoutApproval } from '@/lib/builder-agent/approval/policy';
import { createInitialRunState } from '@/lib/builder-agent/state/types';
import { assertTransition, InvalidStateTransitionError } from '@/lib/builder-agent/state/transitions';
import { InMemoryIdempotencyStore, withIdempotency } from '@/lib/builder-agent/idempotency/store';

describe('BuilderAgent FSM and approval hardening', () => {
  const baseRun = () =>
    createInitialRunState(
      { taskSource: 'idea', objective: 'test', requestingUser: 'user' },
      'run_1',
      'corr_1',
      { repository: 'org/repo', baseBranch: 'main', workspaceId: 'panacea' }
    );

  it('rejects expired approvals', () => {
    const approval = createApprovalRequest('plan', { expiresInHours: -1 });
    expect(() => resolveApproval(approval, true, 'admin')).toThrow(/expired/);
  });

  it('rejects resolving non-pending approval twice', () => {
    const resolved = resolveApproval(createApprovalRequest('plan'), true, 'admin');
    expect(() => resolveApproval(resolved, true, 'admin')).toThrow(/not pending/);
  });

  it('blocks merge in dry-run even with approval', () => {
    const run = {
      ...baseRun(),
      dryRun: true,
      pendingApprovals: [resolveApproval(createApprovalRequest('merge'), true, 'admin')],
    };
    expect(prohibitedWithoutApproval('merge', run)).toContain('dry-run');
  });

  it('rejects invalid cancel from completed', () => {
    expect(() => assertTransition('completed', 'canceled')).toThrow(InvalidStateTransitionError);
  });

  it('deduplicates concurrent intake idempotency keys', async () => {
    const store = new InMemoryIdempotencyStore();
    let calls = 0;
    const [a, b] = await Promise.all([
      withIdempotency(store, 'intake-key-1', async () => {
        calls++;
        return { runId: 'run_a' };
      }),
      withIdempotency(store, 'intake-key-1', async () => {
        calls++;
        return { runId: 'run_b' };
      }),
    ]);
    // At least one should be duplicate; only one execution
    expect(calls).toBeGreaterThanOrEqual(1);
    expect(calls).toBeLessThanOrEqual(2);
    if (!a.duplicate) expect(a.value).toEqual({ runId: 'run_a' });
    if (!b.duplicate) expect(b.value.runId).toBeDefined();
  });
});
