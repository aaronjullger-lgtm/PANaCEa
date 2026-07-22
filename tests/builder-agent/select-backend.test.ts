import { describe, expect, it } from 'vitest';
import {
  selectExecutionBackend,
  assertWorkerExecutionAvailable,
} from '@/lib/builder-agent/execution/select-backend';
import { ExecutionUnavailableError } from '@/lib/builder-agent/execution/unavailable-backend';

describe('BuilderAgent execution backend selection', () => {
  it('uses LocalDev only in test runtime', () => {
    const backend = selectExecutionBackend('test', {});
    expect(backend.kind).toBe('local-dev');
    expect(backend.available).toBe(true);
  });

  it('fails closed in worker runtime without Sandbox', () => {
    const backend = selectExecutionBackend('worker', {
      BUILDER_AGENT_SANDBOX_ENABLED: 'false',
    });
    expect(backend.kind).toBe('unavailable');
    expect(backend.available).toBe(false);
    expect(() => assertWorkerExecutionAvailable(backend)).toThrow(/No isolated execution backend/);
  });

  it('selects sandbox in worker runtime when enabled and bound', () => {
    const backend = selectExecutionBackend('worker', {
      BUILDER_AGENT_SANDBOX_ENABLED: 'true',
      Sandbox: {},
    });
    expect(backend.kind).toBe('sandbox');
    expect(backend.available).toBe(true);
  });

  it('sandbox runCommand still throws until fully implemented', async () => {
    const backend = selectExecutionBackend('worker', {
      BUILDER_AGENT_SANDBOX_ENABLED: 'true',
      Sandbox: {},
    });
    const ws = await backend.prepareWorkspace('org/repo', 'main');
    await expect(backend.runCommand(ws, 'npm', ['test'])).rejects.toThrow();
    await backend.dispose(ws);
  });
});
