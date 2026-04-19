import { execFile } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

export interface CapturedCommandOptions {
  command: string;
  args: string[];
  logDirectory: string;
  logSlug: string;
  env?: NodeJS.ProcessEnv;
  cwd?: string;
  maxBuffer?: number;
}

export interface CapturedCommandResult {
  command: string;
  args: string[];
  exitCode: number;
  stdout: string;
  stderr: string;
  combinedOutput: string;
  durationMs: number;
  logPath: string;
}

export async function runCapturedCommand(
  options: CapturedCommandOptions
): Promise<CapturedCommandResult> {
  const start = Date.now();
  const cwd = options.cwd ?? process.cwd();
  const logDirectory = path.join(process.cwd(), options.logDirectory);
  fs.mkdirSync(logDirectory, { recursive: true });

  let stdout = '';
  let stderr = '';
  let exitCode = 0;

  try {
    const result = await execFileAsync(options.command, options.args, {
      cwd,
      env: {
        ...process.env,
        ...options.env,
      },
      maxBuffer: options.maxBuffer ?? 32 * 1024 * 1024,
    });

    stdout = result.stdout;
    stderr = result.stderr;
  } catch (error: any) {
    stdout = error?.stdout ?? '';
    stderr = error?.stderr ?? error?.message ?? '';
    exitCode = Number.isInteger(error?.code) ? Number(error.code) : 1;
  }

  const durationMs = Date.now() - start;
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const logPath = path.join(logDirectory, `${options.logSlug}-${stamp}.log`);
  const combinedOutput = [stdout.trim(), stderr.trim()].filter(Boolean).join('\n\n');

  const header = [
    `command: ${options.command} ${options.args.join(' ')}`.trim(),
    `cwd: ${cwd}`,
    `exitCode: ${exitCode}`,
    `durationMs: ${durationMs}`,
    '',
  ].join('\n');

  fs.writeFileSync(logPath, `${header}${combinedOutput}\n`);

  return {
    command: options.command,
    args: options.args,
    exitCode,
    stdout,
    stderr,
    combinedOutput,
    durationMs,
    logPath,
  };
}

export function tailLines(output: string, lineCount: number = 12): string[] {
  return output
    .split('\n')
    .map((line) => line.trimEnd())
    .filter(Boolean)
    .slice(-lineCount);
}
