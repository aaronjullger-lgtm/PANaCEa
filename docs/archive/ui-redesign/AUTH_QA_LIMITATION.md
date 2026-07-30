# Auth QA Limitation

Last updated: 2026-05-20

## What Blocked Clerk Authenticated QA

Manual Clerk authenticated QA was not used as a blocker for this UI redesign because prior local auth setup hit Clerk Client Trust / second-factor behavior. The current repo helper also confirms this risk: `e2e/helpers/clerkAuth.ts` throws a targeted message when Clerk sign-in returns `needs_second_factor`.

Current repo state:

- `@clerk/clerk-react` is installed.
- `@playwright/test` is installed.
- `@clerk/testing` is not installed.
- `e2e/auth.setup.ts` currently uses a custom `window.Clerk.client.signIn.create({ identifier, password })` helper.
- Existing env names for that legacy helper are `E2E_CLERK_TEST_EMAIL` and `E2E_CLERK_TEST_PASSWORD`.

## Visual QA Completed Through Guest Mode

Local guest mode was used to complete the UI QA possible without Clerk second-factor login.

Final guest-mode captures were generated for:

- `/study`
- `/study/review`
- `/practice`
- `/study/path`
- `/study/knowledge`
- `/study/utilities`
- `/clinical-profile`
- `/gap-analysis`
- `/clinical-eye`
- `/progress`
- `/medical-database`
- `/study?modal=settings`

Viewports:

- `1280x800`
- `1440x900`
- `1512x982`
- `1728x1117`
- `1920x1080`

Results:

- `60` final screenshots generated.
- No final screenshot reports document-level horizontal overflow.
- No final screenshot reports an auth wall.
- No final screenshot reports a private-beta gate.
- No final screenshot reports alert/status-role banners.
- No final screenshot capture has console errors or bad HTTP responses in guest mode.

Artifacts:

- `docs/ui-redesign/screenshots/final/`
- `docs/ui-redesign/screenshots/final/qa-results.json`

## Env Vars Needed For Official Authenticated Playwright QA

Clerk's current Playwright docs recommend `@clerk/testing/playwright` and `clerk.signIn({ page, emailAddress })` for authenticated tests. Clerk documents that this path uses a server-side token, bypasses verification/MFA, and requires `CLERK_SECRET_KEY`.

Required local environment variables for the recommended path:

- `CLERK_SECRET_KEY`
- `E2E_CLERK_USER_EMAIL`
- `E2E_CLERK_USER_PASSWORD` only if a legacy/custom password-based setup is still used
- Existing app Clerk publishable key env, such as `VITE_CLERK_PUBLISHABLE_KEY`

Recommended dedicated test user:

- Use a Clerk dev/test user only.
- Prefer a `+clerk_test` email pattern when possible.
- Do not use a personal account.
- Do not commit any secret or generated auth storage file.

Reference:

- Clerk authenticated Playwright state guide: https://clerk.com/docs/guides/development/testing/playwright/test-authenticated-flows
- Clerk Playwright test helpers: https://clerk.com/docs/guides/development/testing/playwright/test-helpers

## Recommended Auth Setup Shape

After installing `@clerk/testing` as a dev dependency, create or migrate setup to the official helper:

```ts
import { clerk, clerkSetup } from '@clerk/testing/playwright';
import { test as setup } from '@playwright/test';
import path from 'path';

setup.describe.configure({ mode: 'serial' });

const authFile = path.join(__dirname, '../playwright/.auth/user.json');

setup('configure Clerk testing', async () => {
  await clerkSetup();
});

setup('authenticate and save state', async ({ page }) => {
  if (!process.env.CLERK_SECRET_KEY || !process.env.E2E_CLERK_USER_EMAIL) {
    throw new Error('Set CLERK_SECRET_KEY and E2E_CLERK_USER_EMAIL for authenticated Clerk QA.');
  }

  await page.goto('/');
  await clerk.signIn({
    page,
    emailAddress: process.env.E2E_CLERK_USER_EMAIL,
  });

  await page.goto('/study');
  await page.context().storageState({ path: authFile });
});
```

## Safest Next Step

Create a dedicated Clerk development/test user, set `CLERK_SECRET_KEY` and `E2E_CLERK_USER_EMAIL` locally, install `@clerk/testing`, and migrate `e2e/auth.setup.ts` to the official helper. Keep `E2E_CLERK_USER_PASSWORD` local-only if any legacy password-based setup remains during the migration. Then rerun authenticated Playwright smoke against `/study`, `/practice`, `/study/review`, answer submission, review submission, and progress updates.
