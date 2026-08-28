/**
 * LocalDevExecutionBackend — in-process mock workspace for tests and dry-run.
 * Does not execute real shell commands; simulates validation outcomes.
 */

import type {
  CommandResult,
  CommandOptions,
  ExecutionBackend,
  WorkspaceHandle,
} from './backend';

export interface LocalDevBackendOptions {
  /** Simulated command outcomes keyed by "command arg1 arg2" */
  scriptedResults?: Map<string, Partial<CommandResult>>;
  failCommands?: string[];
}

export class LocalDevExecutionBackend implements ExecutionBackend {
  readonly kind = 'local-dev' as const;
  readonly available = true;

  private readonly handles = new Map<string, WorkspaceHandle>();

  constructor(private readonly options: LocalDevBackendOptions = {}) {}

  async prepareWorkspace(repository: string, ref: string): Promise<WorkspaceHandle> {
    const id = `ws_${crypto.randomUUID()}`;
    const handle: WorkspaceHandle = {
      id,
      rootPath: `/tmp/builder-agent/${id}`,
      repository,
      ref,
    };
    this.handles.set(id, handle);
    return handle;
  }

  async runCommand(
    handle: WorkspaceHandle,
    command: string,
    args: string[],
    opts?: CommandOptions
  ): Promise<CommandResult> {
    const started = Date.now();
    const key = [command, ...args].join(' ');
    const timeoutMs = opts?.timeoutMs ?? 60_000;

    if (this.options.failCommands?.includes(key)) {
      return {
        stdout: '',
        stderr: `Simulated failure for ${key}`,
        exitCode: 1,
        success: false,
        durationMs: Date.now() - started,
      };
    }

    const scripted = this.options.scriptedResults?.get(key);
    if (scripted) {
      return {
        stdout: scripted.stdout ?? '',
        stderr: scripted.stderr ?? '',
        exitCode: scripted.exitCode ?? 0,
        success: scripted.success ?? (scripted.exitCode ?? 0) === 0,
        durationMs: scripted.durationMs ?? Date.now() - started,
        timedOut: scripted.timedOut,
      };
    }

    // Default: simulate success for standard validation commands
    const success = !key.includes('fail');
    return {
      stdout: `[local-dev] ${key} @ ${handle.rootPath}`,
      stderr: '',
      exitCode: success ? 0 : 1,
      success,
      durationMs: Math.min(Date.now() - started + 5, timeoutMs),
    };
  }

  async dispose(handle: WorkspaceHandle): Promise<void> {
    this.handles.delete(handle.id);
  }
}
