/**
 * Env vars forwarded to the Vite dev server spawned by Playwright.
 * Vite only inlines VITE_* at dev-server startup — CI must pass these explicitly.
 */
export function playwrightWebServerEnv(): Record<string, string> {
  const env: Record<string, string> = {};

  const publishable =
    process.env.VITE_CLERK_PUBLISHABLE_KEY?.trim() ||
    process.env.CLERK_PUBLISHABLE_KEY?.trim();
  if (publishable) {
    env.VITE_CLERK_PUBLISHABLE_KEY = publishable;
  }

  for (const key of [
    'CLERK_SECRET_KEY',
    'PANACEA_E2E_EMAIL',
    'PANACEA_E2E_PASSWORD',
    'E2E_CLERK_TEST_EMAIL',
    'E2E_CLERK_TEST_PASSWORD',
  ] as const) {
    const value = process.env[key]?.trim();
    if (value) env[key] = value;
  }

  return env;
}
