/**
 * Debug: God Mode — User count and basic diagnostics (admin only)
 *
 * GET /api/debug/god-mode
 * Returns { userCount: number } (and optional diagnostics).
 * Requires authentication and admin role.
 *
 * In production, restrict via ENVIRONMENT=development to disable entirely if desired.
 */

import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { getCorsHeaders, handleCorsPreflightSecure } from '../_shared/cors';
import { authenticateRequest } from '../_shared/auth';

interface Env {
  DATABASE_URL?: string;
  CLERK_SECRET_KEY?: string;
  ENVIRONMENT?: string;
  ADMIN_USER_IDS?: string;
  SUPERADMIN_USER_IDS?: string;
}

interface CloudflareContext {
  request: Request;
  env: Env;
}

async function requireAdmin(context: CloudflareContext): Promise<Response | null> {
  const auth = await authenticateRequest(context.request, context.env);
  if (!auth) {
    return new Response(JSON.stringify({ ok: false, error: 'Authentication required' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { env } = context;
  const adminIds =
    env.ADMIN_USER_IDS?.split(',')
      .map((id) => id.trim())
      .filter(Boolean) ?? [];
  const superadminIds =
    env.SUPERADMIN_USER_IDS?.split(',')
      .map((id) => id.trim())
      .filter(Boolean) ?? [];

  if (superadminIds.includes(auth.userId) || adminIds.includes(auth.userId)) {
    return null;
  }

  if (env.DATABASE_URL) {
    const prisma = createEdgePrismaClient(env.DATABASE_URL);
    try {
      const user = await prisma.user.findUnique({
        where: { clerkId: auth.userId },
        select: { role: true },
      });
      const role = (user?.role as string)?.toLowerCase();
      if (role === 'admin' || role === 'superadmin') {
        return null;
      }
    } finally {
      await safePrismaDisconnect(prisma);
    }
  }

  return new Response(JSON.stringify({ ok: false, error: 'Admin access required' }), {
    status: 403,
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function onRequestGet(context: CloudflareContext): Promise<Response> {
  const corsHeaders = getCorsHeaders(context.request) || {};

  const adminError = await requireAdmin(context);
  if (adminError) {
    return new Response(adminError.body, {
      status: adminError.status,
      headers: { ...Object.fromEntries(adminError.headers), ...corsHeaders },
    });
  }

  if (!context.env.DATABASE_URL) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: 'DATABASE_URL not set',
        userCount: null,
      }),
      {
        status: 503,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    );
  }

  let prisma: ReturnType<typeof createEdgePrismaClient> | null = null;

  try {
    prisma = createEdgePrismaClient(context.env.DATABASE_URL);
    const userCount = await prisma.user.count();

    const body = {
      ok: true,
      userCount,
      timestamp: new Date().toISOString(),
    };

    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return new Response(
      JSON.stringify({
        ok: false,
        error: message,
        userCount: null,
        timestamp: new Date().toISOString(),
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    );
  } finally {
    await safePrismaDisconnect(prisma);
  }
}

export async function onRequestOptions(context: CloudflareContext): Promise<Response> {
  return handleCorsPreflightSecure(context.request, context.env);
}
