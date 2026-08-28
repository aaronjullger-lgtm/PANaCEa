import { describe, expect, it } from 'vitest';
import { redactString, redactUnknown, truncateOutput } from '@/lib/builder-agent/observability/redaction';

describe('BuilderAgent secret redaction', () => {
  it('redacts bearer tokens', () => {
    const out = redactString('Authorization: Bearer ghp_abcdefghijklmnopqrstuvwxyz1234567890');
    expect(out).not.toContain('ghp_');
    expect(out).toContain('[REDACTED]');
  });

  it('redacts sensitive object keys', () => {
    const out = redactUnknown({ password: 'secret123', name: 'safe' }) as Record<string, unknown>;
    expect(out.password).toBe('[REDACTED]');
    expect(out.name).toBe('safe');
  });

  it('truncates long output', () => {
    const out = truncateOutput('x'.repeat(5000), 100);
    expect(out.length).toBeLessThan(200);
    expect(out).toContain('truncated');
  });
});
