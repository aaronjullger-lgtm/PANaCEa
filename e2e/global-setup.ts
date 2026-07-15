import { clerkSetup } from '@clerk/testing/playwright';

/**
 * Optional Clerk testing bootstrap for backend sign-in (bypasses MFA).
 * Skips gracefully when publishable + secret keys are absent (e.g. CI without secrets).
 * Maps VITE_CLERK_PUBLISHABLE_KEY → CLERK_PUBLISHABLE_KEY for local/Vite env naming.
 */
export default async function globalSetup(): Promise<void> {
  if (!process.env.CLERK_PUBLISHABLE_KEY?.trim() && process.env.VITE_CLERK_PUBLISHABLE_KEY?.trim()) {
    process.env.CLERK_PUBLISHABLE_KEY = process.env.VITE_CLERK_PUBLISHABLE_KEY;
  }

  const hasPublishable = Boolean(process.env.CLERK_PUBLISHABLE_KEY?.trim());
  const hasSecret = Boolean(process.env.CLERK_SECRET_KEY?.trim());

  if (!hasPublishable || !hasSecret) {
    console.warn(
      '[e2e] Skipping clerkSetup — set CLERK_PUBLISHABLE_KEY (or VITE_CLERK_PUBLISHABLE_KEY) and CLERK_SECRET_KEY for backend auth.'
    );
    return;
  }

  await clerkSetup();
}
