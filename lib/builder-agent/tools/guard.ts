/**
 * Tool invocation guards — timeout, output bounds, redaction.
 */

import { truncateOutput } from '../observability/redaction';

export class ToolTimeoutError extends Error {
  constructor(
    public readonly tool: string,
    public readonly timeoutMs: number
  ) {
    super(`Tool "${tool}" timed out after ${timeoutMs}ms`);
    this.name = 'ToolTimeoutError';
  }
}

export class ToolRateLimitError extends Error {
  constructor(public readonly tool: string) {
    super(`Tool "${tool}" rate limit exceeded`);
    this.name = 'ToolRateLimitError';
  }
}

export interface ToolGuardOptions {
  timeoutMs?: number;
  maxOutputChars?: number;
}

const DEFAULT_TOOL_TIMEOUT_MS = 30_000;
const DEFAULT_MAX_OUTPUT = 8_000;

export async function withToolGuard<T>(
  tool: string,
  fn: () => Promise<T>,
  opts?: ToolGuardOptions
): Promise<T> {
  const timeoutMs = opts?.timeoutMs ?? DEFAULT_TOOL_TIMEOUT_MS;
  return Promise.race([
    fn(),
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new ToolTimeoutError(tool, timeoutMs)), timeoutMs);
    }),
  ]);
}

export function boundToolOutput(output: unknown, maxChars = DEFAULT_MAX_OUTPUT): unknown {
  if (typeof output === 'string') {
    return truncateOutput(output, maxChars);
  }
  if (output && typeof output === 'object') {
    return JSON.parse(truncateOutput(JSON.stringify(output), maxChars));
  }
  return output;
}

/** Simple in-memory per-tool rate limiter for adapter guards. */
export function createToolRateLimiter(maxPerWindow: number, windowMs: number) {
  const windows = new Map<string, { count: number; resetAt: number }>();

  return {
    check(tool: string, now = Date.now()): void {
      const entry = windows.get(tool);
      if (!entry || now >= entry.resetAt) {
        windows.set(tool, { count: 1, resetAt: now + windowMs });
        return;
      }
      if (entry.count >= maxPerWindow) {
        throw new ToolRateLimitError(tool);
      }
      entry.count += 1;
    },
    reset(tool?: string): void {
      if (tool) windows.delete(tool);
      else windows.clear();
    },
  };
}
