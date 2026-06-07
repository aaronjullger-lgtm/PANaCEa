/**
 * Supabase Anonymous Client (safe for UI and server)
 *
 * Exports only the anon-key client. Safe to use in:
 * - UI components (with RLS enforcing auth)
 * - Edge/Node API routes that act as anonymous or delegate to RLS
 * - Scripts that only need public or RLS-protected access
 *
 * For service-role (bypass RLS) use @/lib/supabase/admin — never in client views.
 */

import { createClient } from '@supabase/supabase-js';
import { logger } from '@/lib/logger';
import type { SupabaseConfigValidationCode } from './config';
import { validateSupabaseConfigValues } from './config';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

/**
 * Public Supabase client (anon key only).
 * Use for client-side or server-side operations that respect RLS.
 */
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
  },
});

/**
 * Supabase project URL (no secrets).
 */
export function getSupabaseUrl(): string {
  return supabaseUrl;
}

/**
 * Public storage URL for a bucket and path.
 * Use for public-assets bucket; do not use for raw-source-vault.
 */
export function getStorageUrl(bucket: string, path: string): string {
  return `${supabaseUrl}/storage/v1/object/public/${bucket}/${path}`;
}

/**
 * Health check using anon client (no service role).
 */
export async function checkSupabaseConnection(): Promise<boolean> {
  try {
    const { error } = await supabase.from('user').select('count', { count: 'exact', head: true });
    return !error;
  } catch (error) {
    logger.error('Supabase connection check failed', { error });
    return false;
  }
}

/**
 * Validate anon/client configuration (no service key).
 */
export function validateSupabaseConfig(): { valid: boolean; message: string } {
  const result = validateSupabaseConfigValues({
    url: supabaseUrl,
    anonKey: supabaseAnonKey,
  });

  if (result.valid) return result;

  const codeToMessage: Record<SupabaseConfigValidationCode, string> = {
    VALID: 'Supabase configuration is valid',
    MISSING_URL: 'SUPABASE_URL (or VITE_SUPABASE_URL) is not configured',
    MISSING_ANON_KEY: 'SUPABASE_ANON_KEY (or VITE_SUPABASE_ANON_KEY) is not configured',
    INVALID_URL: 'SUPABASE_URL must start with https://',
  };

  return { valid: false, message: codeToMessage[result.code] || result.message };
}
