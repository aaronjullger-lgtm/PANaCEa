/**
 * Unit tests for E2E credential resolution. Uses injected FAKE env values only —
 * never real secrets. Verifies both naming schemes (canonical `E2E_CLERK_TEST_*`
 * and `PANACEA_E2E_*`) resolve, with the canonical name taking precedence.
 */
import { describe, it, expect } from 'vitest';
import {
  getClerkE2ECredentials,
  getClerkE2EAdminCredentials,
  hasClerkBackendAuth,
} from '../e2e/helpers/e2eCredentials';

describe('getClerkE2ECredentials', () => {
  it('returns null when no email in either scheme', () => {
    expect(getClerkE2ECredentials({})).toBeNull();
  });

  it('resolves PANACEA_E2E_* names', () => {
    const c = getClerkE2ECredentials({
      PANACEA_E2E_EMAIL: 'fake-user@example.test',
      PANACEA_E2E_PASSWORD: 'fake-pass',
    } as NodeJS.ProcessEnv);
    expect(c).toEqual({ email: 'fake-user@example.test', password: 'fake-pass' });
  });

  it('resolves canonical E2E_CLERK_TEST_* names', () => {
    const c = getClerkE2ECredentials({
      E2E_CLERK_TEST_EMAIL: 'canon@example.test',
    } as NodeJS.ProcessEnv);
    expect(c).toEqual({ email: 'canon@example.test', password: undefined });
  });

  it('prefers the canonical name over PANACEA_E2E_*', () => {
    const c = getClerkE2ECredentials({
      E2E_CLERK_TEST_EMAIL: 'canon@example.test',
      PANACEA_E2E_EMAIL: 'alt@example.test',
    } as NodeJS.ProcessEnv);
    expect(c?.email).toBe('canon@example.test');
  });
});

describe('getClerkE2EAdminCredentials', () => {
  it('is null without an admin email', () => {
    expect(getClerkE2EAdminCredentials({})).toBeNull();
  });
  it('resolves PANACEA_E2E_ADMIN_* names', () => {
    const c = getClerkE2EAdminCredentials({
      PANACEA_E2E_ADMIN_EMAIL: 'admin@example.test',
      PANACEA_E2E_ADMIN_PASSWORD: 'x',
    } as NodeJS.ProcessEnv);
    expect(c).toEqual({ email: 'admin@example.test', password: 'x' });
  });
});

describe('hasClerkBackendAuth', () => {
  it('requires an email AND CLERK_SECRET_KEY', () => {
    expect(hasClerkBackendAuth({ PANACEA_E2E_EMAIL: 'a@b.test' } as NodeJS.ProcessEnv)).toBe(false);
    expect(
      hasClerkBackendAuth({ PANACEA_E2E_EMAIL: 'a@b.test', CLERK_SECRET_KEY: 'sk_test_fake' } as NodeJS.ProcessEnv)
    ).toBe(true);
    expect(hasClerkBackendAuth({} as NodeJS.ProcessEnv)).toBe(false);
  });
});
