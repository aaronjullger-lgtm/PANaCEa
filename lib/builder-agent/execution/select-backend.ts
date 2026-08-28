/**
 * Central execution backend selection.
 *
 * Worker runtime MUST NOT use LocalDevExecutionBackend — it cannot run shell commands.
 * Test/dry-run runtimes may use LocalDevExecutionBackend explicitly.
 */

import type { ExecutionBackend } from './backend';
import { LocalDevExecutionBackend } from './local-dev-backend';
import { SandboxExecutionBackend } from './sandbox-backend';
import { UnavailableExecutionBackend } from './unavailable-backend';

export type ExecutionRuntime = 'worker' | 'test';

export interface ExecutionBackendEnv {
  BUILDER_AGENT_SANDBOX_ENABLED?: string;
  Sandbox?: unknown;
}

const WORKER_UNAVAILABLE_REASON =
  'No isolated execution backend is available. Enable Cloudflare Sandbox (BUILDER_AGENT_SANDBOX_ENABLED=true with Sandbox binding) before running validation or implementation phases in the Worker.';

export function selectExecutionBackend(
  runtime: ExecutionRuntime,
  env: ExecutionBackendEnv,
  testOptions?: ConstructorParameters<typeof LocalDevExecutionBackend>[0]
): ExecutionBackend {
  if (runtime === 'test') {
    return new LocalDevExecutionBackend(testOptions);
  }

  const sandbox = new SandboxExecutionBackend({
    enabled: env.BUILDER_AGENT_SANDBOX_ENABLED === 'true',
    bindingPresent: Boolean(env.Sandbox),
  });

  if (sandbox.available) {
    return sandbox;
  }

  return new UnavailableExecutionBackend(WORKER_UNAVAILABLE_REASON);
}

export function assertWorkerExecutionAvailable(backend: ExecutionBackend): void {
  if (backend.kind === 'unavailable' || !backend.available) {
    const reason =
      backend.kind === 'unavailable'
        ? (backend as UnavailableExecutionBackend).reason
        : 'Execution backend unavailable';
    throw new Error(reason);
  }
}
