import { describe, expect, it } from 'vitest';
import { prohibitedWithoutApproval } from '@/lib/builder-agent/approval/policy';
import { createApprovalRequest, resolveApproval } from '@/lib/builder-agent/approval/gates';
import { createInitialRunState } from '@/lib/builder-agent/state/types';
import { withToolGuard, ToolTimeoutError } from '@/lib/builder-agent/tools/guard';

describe('BuilderAgent prohibited actions', () => {
  const liveRun = () => {
    let run = createInitialRunState(
      { taskSource: 'idea', objective: 'test', requestingUser: 'user', dryRun: false },
      'run_1',
      'corr_1',
      { repository: 'org/repo', baseBranch: 'main', workspaceId: 'panacea' }
    );
    run = { ...run, dryRun: false };
    return run;
  };

  it('blocks deploy without approval', () => {
    expect(prohibitedWithoutApproval('deploy', liveRun())).toContain('deploy approval');
  });

  it('blocks infrastructure without approval', () => {
    expect(prohibitedWithoutApproval('infrastructure', liveRun())).toContain('Infrastructure');
  });

  it('blocks credentials without approval', () => {
    expect(prohibitedWithoutApproval('credentials', liveRun())).toContain('Credential');
  });

  it('allows merge only with explicit merge approval and not dry-run', () => {
    const run = liveRun();
    expect(prohibitedWithoutApproval('merge', run)).toContain('merge approval');
    const approved = {
      ...run,
      pendingApprovals: [resolveApproval(createApprovalRequest('merge'), true, 'admin')],
    };
    expect(prohibitedWithoutApproval('merge', approved)).toBeNull();
  });
});

describe('BuilderAgent tool timeout', () => {
  it('times out slow tool invocations', async () => {
    await expect(
      withToolGuard(
        'slow-tool',
        () => new Promise<string>((resolve) => setTimeout(() => resolve('ok'), 200)),
        { timeoutMs: 50 }
      )
    ).rejects.toThrow(ToolTimeoutError);
  });
});
