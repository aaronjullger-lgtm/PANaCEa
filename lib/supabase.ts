/**
 * Supabase Client Configuration
 *
 * Provides Supabase client instances for database and storage operations.
 * Uses connection pooling and environment-based configuration.
 */

import { createClient } from '@supabase/supabase-js';

// Get Supabase configuration from environment
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

/**
 * Public Supabase client (uses anon key)
 * Use this for client-side operations and authenticated user operations
 */
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
  },
});

/**
 * Admin Supabase client (uses service role key)
 * Use this for server-side operations that bypass RLS policies
 * IMPORTANT: Only use on the server, never expose to client
 */
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

/**
 * Get the Supabase URL for direct access
 */
export function getSupabaseUrl(): string {
  return supabaseUrl;
}

/**
 * Get the Supabase Storage URL for a given bucket and path
 */
export function getStorageUrl(bucket: string, path: string): string {
  return `${supabaseUrl}/storage/v1/object/public/${bucket}/${path}`;
}

/**
 * Health check for Supabase connection
 */
export async function checkSupabaseConnection(): Promise<boolean> {
  try {
    // Simple query to test connection - using lowercase table name as per Prisma convention
    const { error } = await supabase.from('user').select('count', { count: 'exact', head: true });
    return !error;
  } catch (error) {
    console.error('Supabase connection check failed:', error);
    return false;
  }
}

/**
 * Validate Supabase configuration
 */
export function validateSupabaseConfig(): { valid: boolean; message: string } {
  if (!supabaseUrl) {
    return { valid: false, message: 'SUPABASE_URL is not configured' };
  }

  if (!supabaseAnonKey) {
    return { valid: false, message: 'SUPABASE_ANON_KEY is not configured' };
  }

  if (!supabaseUrl.startsWith('https://')) {
    return { valid: false, message: 'SUPABASE_URL must start with https://' };
  }

  return { valid: true, message: 'Supabase configuration is valid' };
}
