/**
 * Pure E2E credential resolution (no Playwright imports so it is unit-testable).
 *
 * Accepts either the canonical `E2E_CLERK_TEST_*` names or the `PANACEA_E2E_*`
 * names. Values are read from the environment only and are never logged.
 */

export type ClerkE2ECredentials = {
  email: string;
  password?: string;
};

/** Non-admin test credentials, from either naming scheme (canonical wins). */
export function getClerkE2ECredentials(
  env: NodeJS.ProcessEnv = process.env
): ClerkE2ECredentials | null {
  const email = (env.E2E_CLERK_TEST_EMAIL || env.PANACEA_E2E_EMAIL)?.trim();
  if (!email) return null;
  const password = env.E2E_CLERK_TEST_PASSWORD || env.PANACEA_E2E_PASSWORD || undefined;
  return { email, password };
}

/** Optional admin test credentials (for admin-allowed flows), if provided. */
export function getClerkE2EAdminCredentials(
  env: NodeJS.ProcessEnv = process.env
): ClerkE2ECredentials | null {
  const email = (env.E2E_CLERK_ADMIN_EMAIL || env.PANACEA_E2E_ADMIN_EMAIL)?.trim();
  if (!email) return null;
  const password =
    env.E2E_CLERK_ADMIN_PASSWORD || env.PANACEA_E2E_ADMIN_PASSWORD || undefined;
  return { email, password };
}

/**
 * True when Clerk backend-based sign-in is available (bypasses MFA):
 * a test email (either scheme) AND CLERK_SECRET_KEY.
 */
export function hasClerkBackendAuth(env: NodeJS.ProcessEnv = process.env): boolean {
  const email = (env.E2E_CLERK_TEST_EMAIL || env.PANACEA_E2E_EMAIL)?.trim();
  return Boolean(email && env.CLERK_SECRET_KEY?.trim());
}
