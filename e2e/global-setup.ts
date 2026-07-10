import { clerkSetup } from '@clerk/testing/playwright';

/**
 * Required once before @clerk/testing backend sign-in (bypasses MFA).
 * Loads CLERK_SECRET_KEY + publishable key from .env / process env.
 */
export default async function globalSetup(): Promise<void> {
  await clerkSetup();
}
