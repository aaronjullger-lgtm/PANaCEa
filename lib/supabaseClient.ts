/**
 * Client-side Supabase Configuration with Clerk Integration
 *
 * This configuration integrates Supabase with Clerk authentication
 * using session tokens as recommended by Supabase documentation.
 *
 * Reference: https://supabase.com/docs/guides/auth/sso/clerk
 */

import { createClient } from '@supabase/supabase-js';
import { validateSupabaseConfigValues } from './supabase/config';

type ViteEnvLike = {
  VITE_SUPABASE_URL?: string;
  VITE_SUPABASE_ANON_KEY?: string;
};

type GlobalThisWithTestEnv = typeof globalThis & {
  __TEST_VITE_ENV__?: ViteEnvLike;
};

interface ImportMetaLike {
  env?: ViteEnvLike;
}

interface ClerkSessionLike {
  lastActiveToken?: {
    jwt?: string;
  } | null;
}

function getRuntimeEnv(): ViteEnvLike {
  const testGlobal = globalThis as GlobalThisWithTestEnv;
  const override = testGlobal.__TEST_VITE_ENV__;
  const meta = import.meta as ImportMetaLike;
  return override || meta.env || {};
}

function getSupabaseUrl(): string {
  return getRuntimeEnv().VITE_SUPABASE_URL || '';
}

function getSupabaseAnonKey(): string {
  return getRuntimeEnv().VITE_SUPABASE_ANON_KEY || '';
}

/**
 * Create a Supabase client configured to use Clerk session tokens
 *
 * @param session - Clerk session object from useSession() hook
 * @returns Configured Supabase client
 */
export function createSupabaseClient(session: ClerkSessionLike) {
  const supabaseUrl = getSupabaseUrl();
  const supabaseAnonKey = getSupabaseAnonKey();
  return createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        // Use Clerk session token for authentication
        Authorization: session?.lastActiveToken?.jwt ? `Bearer ${session.lastActiveToken.jwt}` : '',
      },
    },
    auth: {
      // Disable Supabase's built-in auth since we're using Clerk
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

/**
 * Create a Supabase client that fetches the token from Clerk on each request
 * This is the recommended approach for long-lived clients
 *
 * @param getToken - Function to get current Clerk session token
 * @returns Configured Supabase client
 */
export function createSupabaseClientWithTokenGetter(getToken: () => Promise<string | null>) {
  const supabaseUrl = getSupabaseUrl();
  const supabaseAnonKey = getSupabaseAnonKey();
  return createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      // Fetch will use this function to get the Authorization header
      fetch: async (url, init) => {
        const token = await getToken();

        return fetch(url, {
          ...init,
          headers: {
            ...init?.headers,
            Authorization: token ? `Bearer ${token}` : '',
          },
        });
      },
    },
    auth: {
      // Disable Supabase's built-in auth since we're using Clerk
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

/**
 * Validate client-side Supabase configuration
 */
export function validateSupabaseConfig(): { valid: boolean; message: string } {
  return validateSupabaseConfigValues({
    url: getSupabaseUrl(),
    anonKey: getSupabaseAnonKey(),
  });
}
