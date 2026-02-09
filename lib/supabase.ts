/**
 * Supabase Client — Safe barrel (anon only)
 *
 * Re-exports only the anonymous client and URL helpers. Safe for UI and shared code.
 * For service-role (admin) access, import from '@/lib/supabase/admin' in server/edge code only.
 */

export {
  supabase,
  getSupabaseUrl,
  getStorageUrl,
  checkSupabaseConnection,
  validateSupabaseConfig,
} from './supabase/client';
