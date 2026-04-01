/**
 * GET /api/admin/refinery/media-signed-url?path={rawStoragePath}
 *
 * Returns a short-lived signed URL for an object in raw-source-vault (private bucket).
 * Used by TriageCard to display images during media verification.
 * Security: Refinery endpoint (approver or admin).
 */

import { z } from 'zod';
import { createClient } from '@supabase/supabase-js';
import {
  refineryEndpoint,
  type AuthenticatedContext,
  type ValidatedContext,
} from '../../_shared/refineryMiddleware';

const RAW_VAULT_BUCKET = 'raw-source-vault';
const SIGNED_URL_EXPIRES_SEC = 300; // 5 minutes

const QuerySchema = z.object({
  path: z.string().min(1, 'path is required'),
});
type Query = z.infer<typeof QuerySchema>;

export const onRequestOptions = async (context: { request: Request; env: unknown }) => {
  const { handleCorsPreflightSecure } = await import('../../_shared/cors');
  return handleCorsPreflightSecure(context.request, context.env as any);
};

export const onRequestGet = refineryEndpoint(
  QuerySchema,
  async (context: AuthenticatedContext & ValidatedContext<Query>) => {
    const { env, validated } = context;
    const path = validated.path;

    if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
      return { status: 503, error: 'Storage not configured' };
    }

    const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data, error } = await supabase.storage
      .from(RAW_VAULT_BUCKET)
      .createSignedUrl(path, SIGNED_URL_EXPIRES_SEC);

    if (error) {
      return { status: 404, error: 'Failed to generate signed URL.' };
    }
    return { data: { url: data?.signedUrl ?? null } };
  },
  { source: 'query' }
);
