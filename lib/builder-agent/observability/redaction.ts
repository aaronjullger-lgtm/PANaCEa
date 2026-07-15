/**
 * Secret and PII redaction for logs and tool output.
 */

const SECRET_PATTERNS: RegExp[] = [
  /Bearer\s+[A-Za-z0-9._~+/=-]+/gi,
  /sk_[a-z]+_[A-Za-z0-9]+/g,
  /pk_[a-z]+_[A-Za-z0-9]+/g,
  /cursor_[A-Za-z0-9]+/gi,
  /ghp_[A-Za-z0-9]+/g,
  /github_pat_[A-Za-z0-9_]+/g,
  /lin_api_[A-Za-z0-9]+/g,
  /postgresql:\/\/[^\s]+/gi,
  /prisma\+postgres:\/\/[^\s]+/gi,
  /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g,
  /AIza[A-Za-z0-9_-]+/g,
];

const SENSITIVE_KEYS = new Set([
  'authorization',
  'cookie',
  'password',
  'secret',
  'token',
  'api_key',
  'apikey',
  'database_url',
  'connection_string',
]);

export function redactString(input: string): string {
  let out = input;
  for (const pattern of SECRET_PATTERNS) {
    out = out.replace(pattern, '[REDACTED]');
  }
  return out;
}

export function redactUnknown(value: unknown, depth = 0): unknown {
  if (depth > 8) return '[MAX_DEPTH]';
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') return redactString(value);
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (Array.isArray(value)) {
    return value.map((v) => redactUnknown(v, depth + 1));
  }
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (SENSITIVE_KEYS.has(k.toLowerCase())) {
        out[k] = '[REDACTED]';
      } else {
        out[k] = redactUnknown(v, depth + 1);
      }
    }
    return out;
  }
  return String(value);
}

export function truncateOutput(input: string, maxChars = 4000): string {
  const redacted = redactString(input);
  if (redacted.length <= maxChars) return redacted;
  return `${redacted.slice(0, maxChars)}… [truncated ${redacted.length - maxChars} chars]`;
}
