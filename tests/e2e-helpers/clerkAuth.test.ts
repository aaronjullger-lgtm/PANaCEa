/**
 * Unit tests for pure Clerk E2E auth helper functions.
 * Covers credential resolution, backend-auth detection, and error messaging.
 * Browser-dependent functions (signIn, waitForClerk) are tested via Playwright E2E.
 */

import { describe, expect, it } from 'vitest';
import {
  getClerkE2ECredentials,
  hasClerkBackendAuth,
  missingClerkE2ECredentialsMessage,
} from '../../e2e/helpers/clerkAuth';

function env(overrides: Record<string, string | undefined> = {}): NodeJS.ProcessEnv {
  return { ...process.env, ...overrides };
}

describe('getClerkE2ECredentials', () => {
  it('returns null when E2E_CLERK_TEST_EMAIL is missing', () => {
    expect(getClerkE2ECredentials(env({ E2E_CLERK_TEST_EMAIL: undefined }))).toBeNull();
  });

  it('returns null when E2E_CLERK_TEST_EMAIL is empty', () => {
    expect(getClerkE2ECredentials(env({ E2E_CLERK_TEST_EMAIL: '' }))).toBeNull();
  });

  it('returns null when E2E_CLERK_TEST_EMAIL is whitespace only', () => {
    expect(getClerkE2ECredentials(env({ E2E_CLERK_TEST_EMAIL: '   ' }))).toBeNull();
  });

  it('returns email-only credentials when password is missing (backend auth mode)', () => {
    const creds = getClerkE2ECredentials(
      env({ E2E_CLERK_TEST_EMAIL: 'test@example.com', E2E_CLERK_TEST_PASSWORD: undefined })
    );
    expect(creds).toEqual({ email: 'test@example.com', password: undefined });
  });

  it('returns email-only credentials when password is empty', () => {
    const creds = getClerkE2ECredentials(
      env({ E2E_CLERK_TEST_EMAIL: 'test@example.com', E2E_CLERK_TEST_PASSWORD: '' })
    );
    expect(creds).toEqual({ email: 'test@example.com', password: undefined });
  });

  it('returns full credentials when both email and password are set', () => {
    const creds = getClerkE2ECredentials(
      env({
        E2E_CLERK_TEST_EMAIL: 'test@example.com',
        E2E_CLERK_TEST_PASSWORD: 'hunter2',
      })
    );
    expect(creds).toEqual({ email: 'test@example.com', password: 'hunter2' });
  });

  it('trims whitespace from email', () => {
    const creds = getClerkE2ECredentials(env({ E2E_CLERK_TEST_EMAIL: '  test@example.com  ' }));
    expect(creds).toEqual({ email: 'test@example.com', password: undefined });
  });
});

describe('hasClerkBackendAuth', () => {
  it('returns false when email is missing', () => {
    expect(
      hasClerkBackendAuth(
        env({
          E2E_CLERK_TEST_EMAIL: undefined,
          CLERK_SECRET_KEY: 'sk_test_valid',
        })
      )
    ).toBe(false);
  });

  it('returns false when CLERK_SECRET_KEY is missing', () => {
    expect(
      hasClerkBackendAuth(
        env({
          E2E_CLERK_TEST_EMAIL: 'test@example.com',
          CLERK_SECRET_KEY: undefined,
        })
      )
    ).toBe(false);
  });

  it('returns false when both are missing', () => {
    expect(hasClerkBackendAuth(env({}))).toBe(false);
  });

  it('returns false when CLERK_SECRET_KEY is empty', () => {
    expect(
      hasClerkBackendAuth(
        env({
          E2E_CLERK_TEST_EMAIL: 'test@example.com',
          CLERK_SECRET_KEY: '',
        })
      )
    ).toBe(false);
  });

  it('returns false when CLERK_SECRET_KEY is whitespace only', () => {
    expect(
      hasClerkBackendAuth(
        env({
          E2E_CLERK_TEST_EMAIL: 'test@example.com',
          CLERK_SECRET_KEY: '   ',
        })
      )
    ).toBe(false);
  });

  it('returns true when both email and secret key are set', () => {
    expect(
      hasClerkBackendAuth(
        env({
          E2E_CLERK_TEST_EMAIL: 'test@example.com',
          CLERK_SECRET_KEY: 'sk_test_abc123',
        })
      )
    ).toBe(true);
  });

  it('trims email before checking', () => {
    expect(
      hasClerkBackendAuth(
        env({
          E2E_CLERK_TEST_EMAIL: '  test@example.com  ',
          CLERK_SECRET_KEY: 'sk_test_abc123',
        })
      )
    ).toBe(true);
  });
});

describe('missingClerkE2ECredentialsMessage', () => {
  it('returns guidance about the backend and legacy auth modes', () => {
    const msg = missingClerkE2ECredentialsMessage();
    expect(msg).toContain('E2E_CLERK_TEST_EMAIL');
    expect(msg).toContain('CLERK_SECRET_KEY');
    expect(msg).toContain('E2E_CLERK_TEST_PASSWORD');
    expect(msg).toContain('bypasses MFA');
  });
});
