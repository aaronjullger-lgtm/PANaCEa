/**
 * Fail-closed execution backend — used in Worker runtime when Sandbox is unavailable.
 */

import type {
  CommandOptions,
  CommandResult,
  ExecutionBackend,
  WorkspaceHandle,
} from './backend';

export class ExecutionUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ExecutionUnavailableError';
  }
}

export class UnavailableExecutionBackend implements ExecutionBackend {
  readonly kind = 'unavailable' as const;
  readonly available = false;
  readonly reason: string;

  constructor(reason: string) {
    this.reason = reason;
  }

  async prepareWorkspace(_repository: string, _ref: string): Promise<WorkspaceHandle> {
    throw new ExecutionUnavailableError(this.reason);
  }

  async runCommand(
    _handle: WorkspaceHandle,
    _command: string,
    _args: string[],
    _opts?: CommandOptions
  ): Promise<CommandResult> {
    throw new ExecutionUnavailableError(this.reason);
  }

  async dispose(_handle: WorkspaceHandle): Promise<void> {
    // no-op
  }
}
