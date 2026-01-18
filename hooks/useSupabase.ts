/**
 * Supabase Hook with Clerk Integration
 *
 * Provides a Supabase client that automatically uses Clerk session tokens
 * for authentication. This allows Row Level Security (RLS) policies in
 * Supabase to use Clerk JWT claims.
 *
 * Usage:
 * ```tsx
 * import { useSupabase } from './hooks/useSupabase';
 *
 * function MyComponent() {
 *   const supabase = useSupabase();
 *
 *   // Use supabase client as normal
 *   const { data, error } = await supabase
 *     .from('my_table')
 *     .select('*');
 * }
 * ```
 */

import { useMemo } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { createSupabaseClientWithTokenGetter } from '../lib/supabaseClient';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Hook to get a Supabase client configured with Clerk authentication
 *
 * The client will automatically include the current Clerk session token
 * in all requests to Supabase, allowing RLS policies to use JWT claims.
 *
 * @returns Supabase client configured with Clerk session tokens
 */
export function useSupabase(): SupabaseClient {
  const { getToken } = useAuth();

  // Create Supabase client with token getter
  // useMemo with empty deps ensures client is created once per component lifecycle
  // The getToken function from Clerk is stable across renders
  const supabase = useMemo(() => {
    return createSupabaseClientWithTokenGetter(async () => {
      try {
        const token = await getToken();
        return token;
      } catch (error) {
        console.error('Failed to get Clerk token for Supabase:', error);
        return null;
      }
    });
    // Empty deps array: client is created once and reused
    // getToken from Clerk is called fresh on each Supabase request
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return supabase;
}

/**
 * Hook variant that returns null when user is not authenticated
 * Useful for components that should only work with authenticated users
 *
 * @returns Supabase client or null if not authenticated
 */
export function useAuthenticatedSupabase(): SupabaseClient | null {
  const { isSignedIn } = useAuth();
  const supabase = useSupabase();

  if (!isSignedIn) {
    return null;
  }

  return supabase;
}
