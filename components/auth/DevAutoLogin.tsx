/**
 * Dev-only auto-login via URL parameter.
 *
 * SECURITY: Only runs when:
 * 1. import.meta.env.DEV is true (Vite development)
 * 2. hostname is localhost/127.0.0.1
 * 3. URL contains dev_auth=cursor_secret_key_999
 *
 * NEVER deploy this logic to production. In production builds this component
 * is effectively a no-op (DEV is false).
 *
 * Usage: http://localhost:3000/?dev_auth=cursor_secret_key_999
 * Wait ~2 seconds after navigating for Clerk auth to complete before testing.
 */

import { useEffect } from 'react';
import { useSignIn, useUser } from '@clerk/clerk-react';

const DEV_AUTH_SECRET = 'cursor_secret_key_999';
const DEV_EMAIL = 'testing@testing123.com';
const DEV_PASSWORD = 'testing123!';

export function DevAutoLogin() {
  const { isSignedIn } = useUser();
  const { isLoaded, signIn, setActive } = useSignIn();

  useEffect(() => {
    // 1. SECURITY: Only run in Vite development mode
    if (!import.meta.env.DEV) return;

    // 2. SECURITY: Only run on localhost
    const hostname =
      typeof window !== 'undefined' ? window.location.hostname : '';
    if (
      hostname !== 'localhost' &&
      hostname !== '127.0.0.1' &&
      hostname !== '0.0.0.0'
    ) {
      return;
    }

    // 3. Skip if already signed in
    if (isSignedIn) return;

    const runAutoLogin = async () => {
      if (!isLoaded || !signIn || !setActive) return;

      const urlParams = new URLSearchParams(window.location.search);
      const devAuthToken = urlParams.get('dev_auth');

      if (devAuthToken !== DEV_AUTH_SECRET) return;

      console.log('🤖 Dev Auth Token detected. Auto-logging in...');

      try {
        const signInAttempt = await signIn.create({
          identifier: DEV_EMAIL,
          password: DEV_PASSWORD,
        });

        if (signInAttempt.status === 'complete') {
          await setActive({
            session: signInAttempt.createdSessionId,
            navigate: () => {
              // Clean URL so dev_auth secret doesn't persist in address bar
              const cleanPath =
                window.location.pathname + (window.location.hash || '');
              window.history.replaceState({}, document.title, cleanPath);
            },
          });
          console.log('✓ Dev auto-login successful');
        } else if (signInAttempt.status === 'needs_second_factor') {
          console.warn(
            '[DevAutoLogin] Clerk Client Trust / 2FA is required. Disable it for the test user in Clerk Dashboard → User & Authentication → Client Trust, or sign in manually.'
          );
        } else {
          console.warn(
            '[DevAutoLogin] Sign-in not complete:',
            signInAttempt.status
          );
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error('[DevAutoLogin] Auto-login failed:', msg);
      }
    };

    runAutoLogin();
  }, [import.meta.env.DEV, isLoaded, signIn, setActive, isSignedIn]);

  return null;
}
