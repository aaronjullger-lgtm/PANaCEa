/**
 * ExecutionBackend — isolated workspace for builds and tests.
 */

export interface WorkspaceHandle {
  id: string;
  rootPath: string;
  repository: string;
  ref: string;
}

export interface CommandOptions {
  cwd?: string;
  timeoutMs?: number;
  env?: Record<string, string>;
}

export interface CommandResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  success: boolean;
  durationMs: number;
  timedOut?: boolean;
}

export interface ExecutionBackend {
  readonly kind: 'local-dev' | 'sandbox' | 'mock';
  readonly available: boolean;
  prepareWorkspace(repository: string, ref: string): Promise<WorkspaceHandle>;
  runCommand(
    handle: WorkspaceHandle,
    command: string,
    args: string[],
    opts?: CommandOptions
  ): Promise<CommandResult>;
  dispose(handle: WorkspaceHandle): Promise<void>;
}

/** Allowed commands for builder agent execution */
export const ALLOWED_COMMANDS = new Set([
  'npm',
  'npx',
  'node',
  'git',
  'vitest',
  'tsc',
  'eslint',
  'prettier',
]);

export function assertAllowedCommand(command: string): void {
  const base = command.split('/').pop()?.split(' ')[0] ?? command;
  if (!ALLOWED_COMMANDS.has(base)) {
    throw new Error(`Command not allowed: ${command}`);
  }
}

export interface ValidationSuiteResult {
  ok: boolean;
  results: CommandResult[];
}

export async function runValidationSuite(
  backend: ExecutionBackend,
  handle: WorkspaceHandle,
  commands: Array<{ command: string; args: string[] }>
): Promise<ValidationSuiteResult> {
  const results: CommandResult[] = [];
  for (const { command, args } of commands) {
    assertAllowedCommand(command);
    const result = await backend.runCommand(handle, command, args, { timeoutMs: 300_000 });
    results.push(result);
    if (!result.success) {
      return { ok: false, results };
    }
  }
  return { ok: true, results };
}
