/**
 * Supabase Service Role Client — SERVER / EDGE ONLY
 *
 * DO NOT import this file in:
 * - React components
 * - Client-side hooks
 * - Any code that is bundled for the browser (e.g. Vite client entry)
 *
 * This client bypasses Row Level Security and has full access. Use only in:
 * - Cloudflare Pages Functions (functions/api/*)
 * - Node/TS scripts (scripts/*)
 * - Server-side services (e.g. services/domain/*) that run in Node or Edge
 *
 * If your framework supports "server-only", add: import 'server-only';
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (typeof window !== 'undefined') {
  throw new Error(
    '[lib/supabase/admin] Service role client must not be used in the browser. Import @/lib/supabase/client for UI code.'
  );
}

/**
 * Admin Supabase client (service_role key). Bypasses RLS.
 * Only use in server/edge contexts; never expose to client bundles.
 */
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});
