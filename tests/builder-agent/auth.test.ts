import { describe, expect, it } from 'vitest';
import {
  AuthError,
  requirePermission,
  verifyApiKey,
} from '@/lib/builder-agent/auth/policy';

describe('BuilderAgent auth', () => {
  const secret = 'test-api-key-12345';

  it('authenticates valid API key', () => {
    const ctx = verifyApiKey(`Bearer ${secret}`, secret);
    expect(ctx.authenticated).toBe(true);
    expect(ctx.permissions.has('read')).toBe(true);
    expect(ctx.permissions.has('write')).toBe(true);
    expect(ctx.permissions.has('merge')).toBe(false);
  });

  it('rejects missing API key', () => {
    const ctx = verifyApiKey(null, secret);
    expect(ctx.authenticated).toBe(false);
  });

  it('rejects invalid API key', () => {
    const ctx = verifyApiKey('Bearer wrong', secret);
    expect(ctx.authenticated).toBe(false);
  });

  it('throws on missing permission', () => {
    const ctx = verifyApiKey(secret, secret);
    expect(() => requirePermission(ctx, 'merge')).toThrow(AuthError);
  });
});
