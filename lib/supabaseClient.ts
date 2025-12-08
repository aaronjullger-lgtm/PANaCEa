/**
 * Client-side Supabase Configuration with Clerk Integration
 * 
 * This configuration integrates Supabase with Clerk authentication
 * using session tokens as recommended by Supabase documentation.
 * 
 * Reference: https://supabase.com/docs/guides/auth/sso/clerk
 */

import { createClient } from '@supabase/supabase-js';
import type { Session } from '@clerk/clerk-react';

// Get Supabase configuration from environment
// Note: These should be VITE_ prefixed for client-side access
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

/**
 * Create a Supabase client configured to use Clerk session tokens
 * 
 * @param session - Clerk session object from useSession() hook
 * @returns Configured Supabase client
 */
export function createSupabaseClient(session: Session | null | undefined) {
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
export function createSupabaseClientWithTokenGetter(
  getToken: () => Promise<string | null>
) {
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
  if (!supabaseUrl) {
    return { valid: false, message: 'VITE_SUPABASE_URL is not configured' };
  }
  
  if (!supabaseAnonKey) {
    return { valid: false, message: 'VITE_SUPABASE_ANON_KEY is not configured' };
  }
  
  if (!supabaseUrl.startsWith('https://')) {
    return { valid: false, message: 'VITE_SUPABASE_URL must start with https://' };
  }
  
  return { valid: true, message: 'Supabase configuration is valid' };
}
