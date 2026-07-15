/**
 * SandboxExecutionBackend — Cloudflare Sandbox adapter.
 *
 * Requires Workers Paid plan and BUILDER_AGENT_SANDBOX_ENABLED=true.
 * When unavailable, reports available=false and throws on use.
 */

import type { ExecutionBackend, WorkspaceHandle, CommandOptions, CommandResult } from './backend';
import { LocalDevExecutionBackend } from './local-dev-backend';

export interface SandboxBackendConfig {
  enabled: boolean;
  /** Set when @cloudflare/sandbox binding is present in worker env */
  bindingPresent: boolean;
}

export class SandboxExecutionBackend implements ExecutionBackend {
  readonly kind = 'sandbox' as const;
  readonly available: boolean;

  constructor(private readonly config: SandboxBackendConfig) {
    this.available = config.enabled && config.bindingPresent;
  }

  async prepareWorkspace(repository: string, ref: string): Promise<WorkspaceHandle> {
    if (!this.available) {
      throw new SandboxUnavailableError(
        'Cloudflare Sandbox is not enabled for this account. Set BUILDER_AGENT_SANDBOX_ENABLED=true and deploy with Sandbox binding. Use LocalDevExecutionBackend for dev workflows.'
      );
    }
    // Production implementation would clone repo via sandbox.exec('git clone ...')
    return {
      id: `sandbox_${repository.replace(/\//g, '-')}_${ref}`,
      rootPath: '/workspace',
      repository,
      ref,
    };
  }

  async runCommand(
    _handle: WorkspaceHandle,
    _command: string,
    _args: string[],
    _opts?: CommandOptions
  ): Promise<CommandResult> {
    if (!this.available) {
      throw new SandboxUnavailableError('Sandbox backend unavailable');
    }
    // Stub — real implementation uses getSandbox(env.Sandbox, id).exec(...)
    throw new SandboxUnavailableError(
      'SandboxExecutionBackend.runCommand requires deployed @cloudflare/sandbox binding'
    );
  }

  async dispose(_handle: WorkspaceHandle): Promise<void> {
    // sandbox lifecycle managed by Cloudflare Containers
  }
}

export class SandboxUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SandboxUnavailableError';
  }
}

export function selectExecutionBackend(env: {
  BUILDER_AGENT_SANDBOX_ENABLED?: string;
  sandboxBindingPresent?: boolean;
}): ExecutionBackend {
  const sandbox = new SandboxExecutionBackend({
    enabled: env.BUILDER_AGENT_SANDBOX_ENABLED === 'true',
    bindingPresent: env.sandboxBindingPresent === true,
  });
  if (sandbox.available) return sandbox;

  return new LocalDevExecutionBackend();
}
