import { describe, expect, it } from 'vitest';
import {
  bindIntakeToWorkspace,
  parseAllowedWorkspaces,
  resolveAuthorizedWorkspace,
} from '@/lib/builder-agent/auth/workspace';
import { AuthError } from '@/lib/builder-agent/auth/policy';

describe('BuilderAgent workspace isolation', () => {
  const allowed = parseAllowedWorkspaces('panacea,staging');

  it('allows workspaces in allowlist', () => {
    expect(resolveAuthorizedWorkspace('panacea', allowed)).toBe('panacea');
    expect(resolveAuthorizedWorkspace('staging', allowed)).toBe('staging');
  });

  it('rejects cross-workspace access via query param', () => {
    expect(() => resolveAuthorizedWorkspace('other-team', allowed)).toThrow(AuthError);
    expect(() => resolveAuthorizedWorkspace('other-team', allowed)).toThrow(/not authorized/);
  });

  it('rejects intake workspace mismatch', () => {
    expect(() =>
      bindIntakeToWorkspace(
        { workspaceId: 'staging', objective: 'x', taskSource: 'idea', requestingUser: 'u' },
        'panacea'
      )
    ).toThrow(/Workspace mismatch/);
  });

  it('binds intake to authorized workspace', () => {
    const bound = bindIntakeToWorkspace(
      { objective: 'x', taskSource: 'idea', requestingUser: 'u' },
      'panacea'
    );
    expect(bound.workspaceId).toBe('panacea');
  });
});
