import { expect, type Page } from '@playwright/test';
import { clerk as clerkTesting } from '@clerk/testing/playwright';

type ClerkSignInAttempt = {
  status?: string;
  createdSessionId?: string | null;
};

type ClerkSignInResource = ClerkSignInAttempt & {
  create: (params: { identifier: string; password: string }) => Promise<ClerkSignInAttempt>;
};

type ClerkBrowser = {
  load?: () => Promise<void>;
  client?: {
    signIn?: ClerkSignInResource;
  };
  setActive: (params: { session: string }) => Promise<void>;
  session?: {
    getToken: () => Promise<string | null>;
  } | null;
};

declare global {
  interface Window {
    Clerk?: ClerkBrowser;
  }
}

export type ClerkE2ECredentials = {
  email: string;
  password?: string;
};

/**
 * Returns E2E credentials if available.
 * With @clerk/testing backend auth, only email + CLERK_SECRET_KEY is required.
 * Password is optional and used only for the legacy browser-based sign-in fallback.
 */
export function getClerkE2ECredentials(
  env: NodeJS.ProcessEnv = process.env
): ClerkE2ECredentials | null {
  const email = env.E2E_CLERK_TEST_EMAIL?.trim();
  if (!email) return null;
  return { email, password: env.E2E_CLERK_TEST_PASSWORD || undefined };
}

/**
 * Returns true when Clerk backend-based sign-in is available:
 * E2E_CLERK_TEST_EMAIL is set AND CLERK_SECRET_KEY is available.
 * This is the preferred path — it bypasses MFA/second-factor entirely.
 */
export function hasClerkBackendAuth(env: NodeJS.ProcessEnv = process.env): boolean {
  return Boolean(env.E2E_CLERK_TEST_EMAIL?.trim() && env.CLERK_SECRET_KEY?.trim());
}

export function missingClerkE2ECredentialsMessage(): string {
  return (
    'E2E_REQUIRE_AUTH=1 requires E2E_CLERK_TEST_EMAIL.\n' +
    'For backend-based sign-in (recommended, bypasses MFA): also set CLERK_SECRET_KEY.\n' +
    'For legacy browser-based sign-in: also set E2E_CLERK_TEST_PASSWORD.'
  );
}

function incompleteClerkSignInMessage(status: string | undefined): string {
  const resolvedStatus = status ?? 'unknown';
  const secondFactorNote =
    resolvedStatus === 'needs_second_factor'
      ? ' Configure a dedicated Clerk test user with MFA / Client Trust disabled.'
      : '';

  return `Clerk sign-in did not complete. Status: ${resolvedStatus}.${secondFactorNote}`;
}

export async function waitForClerk(page: Page, timeout = 30_000): Promise<void> {
  await page.waitForFunction(() => Boolean(window.Clerk), null, { timeout });
}

/**
 * Signs in via Clerk's backend API (@clerk/testing/playwright).
 * This bypasses the browser sign-in UI and MFA/second-factor entirely.
 * Requires CLERK_SECRET_KEY + E2E_CLERK_TEST_EMAIL in the environment.
 *
 * Falls back with a clear error if the Clerk Backend API user lookup fails.
 */
export async function signInWithClerkBackend(
  page: Page,
  email: string,
  options: { startPath?: string } = {}
): Promise<string> {
  const clerkSecretKey = process.env.CLERK_SECRET_KEY?.trim();
  if (!clerkSecretKey) {
    throw new Error('CLERK_SECRET_KEY is required for Clerk backend sign-in. Set it in .env.');
  }

  await page.goto(options.startPath ?? '/study', { waitUntil: 'domcontentloaded' });
  await waitForClerk(page);

  try {
    await clerkTesting.signIn({ page, emailAddress: email });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes('No user found')) {
      throw new Error(
        `No Clerk user found with email "${email}". ` +
          'Create a dedicated Clerk test user with this email in the Clerk Dashboard, ' +
          'or update E2E_CLERK_TEST_EMAIL in .env to match an existing user.'
      );
    }
    throw new Error(`Clerk backend sign-in failed: ${message}`);
  }

  await expect
    .poll(async () => hasActiveClerkSession(page), {
      timeout: 20_000,
    })
    .toBe(true);

  const token = await page.evaluate(async () => window.Clerk?.session?.getToken() ?? null);
  if (!token) throw new Error('Clerk backend session did not return an API token.');
  return token;
}

export async function hasActiveClerkSession(page: Page): Promise<boolean> {
  return page.evaluate(() => Boolean(window.Clerk?.session)).catch(() => false);
}

export async function signInWithClerkCredentials(
  page: Page,
  credentials: ClerkE2ECredentials,
  options: { startPath?: string } = {}
): Promise<string> {
  await page.goto(options.startPath ?? '/study', { waitUntil: 'domcontentloaded' });
  await waitForClerk(page);

  const result = await page.evaluate(async ({ email, password }) => {
    const clerk = window.Clerk;
    if (!clerk) throw new Error('Clerk is not available on window.');
    if (typeof clerk.load === 'function') await clerk.load();

    const signIn = clerk.client?.signIn;
    if (!signIn || typeof signIn.create !== 'function') {
      throw new Error('Clerk sign-in resource is not available.');
    }

    const attempt = await signIn.create({
      identifier: email,
      password,
    });
    const activeAttempt = clerk.client?.signIn ?? attempt;
    const status = activeAttempt.status ?? attempt.status;

    if (status !== 'complete') {
      return { status, sessionId: null };
    }

    const sessionId = activeAttempt.createdSessionId ?? attempt.createdSessionId ?? null;
    if (!sessionId) {
      throw new Error('Clerk sign-in completed without a session id.');
    }

    await clerk.setActive({ session: sessionId });
    return { status, sessionId };
  }, credentials);

  if (result.status !== 'complete') {
    throw new Error(incompleteClerkSignInMessage(result.status));
  }

  await expect
    .poll(async () => hasActiveClerkSession(page), {
      timeout: 20_000,
    })
    .toBe(true);

  const token = await page.evaluate(async () => window.Clerk?.session?.getToken() ?? null);
  if (!token) throw new Error('Clerk session did not return an API token.');
  return token;
}
