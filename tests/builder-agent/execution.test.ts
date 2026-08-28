import { describe, expect, it } from 'vitest';
import { LocalDevExecutionBackend } from '@/lib/builder-agent/execution/local-dev-backend';
import { SandboxExecutionBackend, SandboxUnavailableError } from '@/lib/builder-agent/execution/sandbox-backend';
import { assertAllowedCommand } from '@/lib/builder-agent/execution/backend';

describe('BuilderAgent execution backend', () => {
  it('rejects disallowed commands', () => {
    expect(() => assertAllowedCommand('rm')).toThrow(/not allowed/);
    expect(() => assertAllowedCommand('npm')).not.toThrow();
  });

  it('runs local-dev validation commands', async () => {
    const backend = new LocalDevExecutionBackend();
    const ws = await backend.prepareWorkspace('org/repo', 'main');
    const result = await backend.runCommand(ws, 'npm', ['test']);
    expect(result.success).toBe(true);
    await backend.dispose(ws);
  });

  it('simulates command failure', async () => {
    const backend = new LocalDevExecutionBackend({ failCommands: ['npm test'] });
    const ws = await backend.prepareWorkspace('org/repo', 'main');
    const result = await backend.runCommand(ws, 'npm', ['test']);
    expect(result.success).toBe(false);
    await backend.dispose(ws);
  });

  it('reports sandbox unavailable when not enabled', () => {
    const backend = new SandboxExecutionBackend({ enabled: false, bindingPresent: false });
    expect(backend.available).toBe(false);
    expect(backend.kind).toBe('sandbox');
  });

  it('throws on sandbox use when unavailable', async () => {
    const backend = new SandboxExecutionBackend({ enabled: false, bindingPresent: false });
    await expect(backend.prepareWorkspace('org/repo', 'main')).rejects.toThrow(SandboxUnavailableError);
  });
});
