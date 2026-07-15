import { describe, expect, it } from 'vitest';
import {
  canMerge,
  classifyRisk,
  prohibitedWithoutApproval,
} from '@/lib/builder-agent/approval/policy';
import { createApprovalRequest, resolveApproval } from '@/lib/builder-agent/approval/gates';
import { createInitialRunState } from '@/lib/builder-agent/state/types';

describe('BuilderAgent approval', () => {
  it('classifies schema changes as high risk', () => {
    const risk = classifyRisk('Update prisma schema with new migration');
    expect(risk.level).toBe('high');
    expect(risk.requiresPlanApproval).toBe(true);
  });

  it('classifies small ideas as low risk', () => {
    const risk = classifyRisk('Fix typo in README');
    expect(risk.level).toBe('low');
    expect(risk.requiresPlanApproval).toBe(false);
  });

  it('blocks merge without approval', () => {
    const run = createInitialRunState(
      {
        taskSource: 'idea',
        objective: 'test',
        requestingUser: 'user',
      },
      'run_1',
      'corr_1',
      { repository: 'org/repo', baseBranch: 'main', workspaceId: 'panacea' }
    );
    expect(canMerge(run)).toBe(false);
    expect(prohibitedWithoutApproval('merge', run)).toContain('merge approval');
  });

  it('allows merge with approved merge gate', () => {
    let run = createInitialRunState(
      {
        taskSource: 'idea',
        objective: 'test',
        requestingUser: 'user',
      },
      'run_1',
      'corr_1',
      { repository: 'org/repo', baseBranch: 'main', workspaceId: 'panacea' }
    );
    const approval = resolveApproval(createApprovalRequest('merge'), true, 'admin');
    run = { ...run, pendingApprovals: [approval] };
    expect(canMerge(run)).toBe(true);
  });

  it('pauses at plan approval when risk requires it', () => {
    const approval = createApprovalRequest('plan');
    expect(approval.status).toBe('pending');
    expect(approval.expiresAt).toBeDefined();
  });
});
