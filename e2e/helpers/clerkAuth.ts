import { expect, type Page } from '@playwright/test';

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
  password: string;
};

export function getClerkE2ECredentials(
  env: NodeJS.ProcessEnv = process.env
): ClerkE2ECredentials | null {
  const email = env.E2E_CLERK_TEST_EMAIL?.trim();
  const password = env.E2E_CLERK_TEST_PASSWORD;

  return email && password ? { email, password } : null;
}

export function missingClerkE2ECredentialsMessage(): string {
  return 'E2E_REQUIRE_AUTH=1 requires E2E_CLERK_TEST_EMAIL and E2E_CLERK_TEST_PASSWORD.';
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
