import { spawn } from 'node:child_process';
import path from 'node:path';
import { FatalError } from 'workflow';

export interface ScriptStepResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  durationMs: number;
}

export interface RunScriptOptions {
  /** Repo-root-relative script path, e.g. `scripts/validate_database.ts` */
  script: string;
  args?: string[];
  /** When true, non-zero exit fails the step (retries apply). */
  critical?: boolean;
  cwd?: string;
}

/**
 * Run a tsx script from the repo root. Steps have full Node.js access.
 */
export async function runTsxScript(options: RunScriptOptions): Promise<ScriptStepResult> {
  'use step';

  const { script, args = [], critical = true, cwd = process.cwd() } = options;
  const scriptPath = path.join(cwd, script);
  const start = Date.now();

  const result = await new Promise<ScriptStepResult>((resolve, reject) => {
    const proc = spawn('npx', ['tsx', scriptPath, ...args], {
      cwd,
      env: process.env,
      shell: false,
    });

    let stdout = '';
    let stderr = '';

    proc.stdout?.on('data', (chunk: Buffer) => {
      stdout += chunk.toString();
    });
    proc.stderr?.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    proc.on('error', (error) => {
      reject(error);
    });

    proc.on('close', (code) => {
      resolve({
        exitCode: code ?? 1,
        stdout,
        stderr,
        durationMs: Date.now() - start,
      });
    });
  });

  if (critical && result.exitCode !== 0) {
    const tail = (result.stderr || result.stdout).trim().slice(-2000);
    throw new FatalError(`Script failed (${script}): exit ${result.exitCode}\n${tail}`);
  }

  return result;
}

export interface RunNpmOptions {
  script: string;
  args?: string[];
  critical?: boolean;
  cwd?: string;
}

/**
 * Run an npm script defined in package.json.
 */
export async function runNpmScript(options: RunNpmOptions): Promise<ScriptStepResult> {
  'use step';

  const { script, args = [], critical = true, cwd = process.cwd() } = options;
  const start = Date.now();

  const result = await new Promise<ScriptStepResult>((resolve, reject) => {
    const proc = spawn('npm', ['run', script, '--', ...args], {
      cwd,
      env: process.env,
      shell: false,
    });

    let stdout = '';
    let stderr = '';

    proc.stdout?.on('data', (chunk: Buffer) => {
      stdout += chunk.toString();
    });
    proc.stderr?.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    proc.on('error', (error) => {
      reject(error);
    });

    proc.on('close', (code) => {
      resolve({
        exitCode: code ?? 1,
        stdout,
        stderr,
        durationMs: Date.now() - start,
      });
    });
  });

  if (critical && result.exitCode !== 0) {
    const tail = (result.stderr || result.stdout).trim().slice(-2000);
    throw new FatalError(`npm run ${script} failed: exit ${result.exitCode}\n${tail}`);
  }

  return result;
}
