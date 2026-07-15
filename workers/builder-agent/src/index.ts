/**
 * panacea-builder-agent Worker entrypoint.
 */

import { routeAgentRequest } from 'agents';
import { verifyApiKey, AuthError, requirePermission } from '@/lib/builder-agent/auth/policy';
import { verifyWebhookSignature } from '@/lib/builder-agent/auth/webhooks';
import { IntakePayloadSchema } from '@/lib/builder-agent/state/schema';
import { BuilderAgent } from './agent/BuilderAgent';
import { BuildWorkflow } from './workflow/BuildWorkflow';
import { normalizeWebhook } from './webhooks/handlers';
import type { Env } from './env';
import { DEFAULT_WORKSPACE_ID } from './env';

export { BuilderAgent, BuildWorkflow };

function workspaceIdFromRequest(request: Request): string {
  const url = new URL(request.url);
  return url.searchParams.get('workspace') ?? DEFAULT_WORKSPACE_ID;
}

function agentStub(env: Env, workspaceId: string): DurableObjectStub {
  const id = env.BUILDER_AGENT.idFromName(`workspace:${workspaceId}`);
  return env.BUILDER_AGENT.get(id);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // Agents SDK routing (WebSocket + RPC)
    const agentResponse = await routeAgentRequest(request, env, {
      prefix: '/agent',
    });
    if (agentResponse) return agentResponse;

    // Health
    if (url.pathname === '/health' && request.method === 'GET') {
      return Response.json({
        ok: true,
        worker: env.WORKER_LABEL ?? 'panacea-builder-agent',
        dryRun: env.BUILDER_AGENT_DRY_RUN === 'true',
        sandboxEnabled: env.BUILDER_AGENT_SANDBOX_ENABLED === 'true',
      });
    }

    // Webhooks (signature required)
    if (url.pathname.startsWith('/webhooks/') && request.method === 'POST') {
      const provider = url.pathname.split('/')[2];
      if (!provider || !['github', 'linear', 'sentry'].includes(provider)) {
        return new Response('Unknown provider', { status: 404 });
      }

      const body = await request.text();
      const deliveryId =
        request.headers.get('X-GitHub-Delivery') ??
        request.headers.get('Linear-Delivery') ??
        request.headers.get('Sentry-Hook-Resource') ??
        crypto.randomUUID();

      try {
        if (env.BUILDER_AGENT_WEBHOOK_SECRET) {
          await verifyWebhookSignature(
            env.BUILDER_AGENT_WEBHOOK_SECRET,
            body,
            request.headers.get('X-Builder-Signature')
          );
        }
      } catch (err) {
        if (err instanceof AuthError) {
          return new Response(err.message, { status: err.status });
        }
        throw err;
      }

      const payload = JSON.parse(body) as Record<string, unknown>;
      const eventType =
        request.headers.get('X-GitHub-Event') ??
        request.headers.get('Linear-Event') ??
        request.headers.get('Sentry-Hook-Resource') ??
        'unknown';

      const intake = normalizeWebhook(
        provider as 'github' | 'linear' | 'sentry',
        eventType,
        payload
      );
      if (!intake) {
        return Response.json({ ok: true, ignored: true });
      }

      const workspaceId = workspaceIdFromRequest(request);
      const stub = agentStub(env, workspaceId);
      const agent = stub as unknown as {
        recordWebhookDelivery(p: string, d: string): Promise<boolean>;
        createRun(i: typeof intake): Promise<unknown>;
      };

      const isNew = await agent.recordWebhookDelivery(provider, deliveryId);
      if (!isNew) {
        return Response.json({ ok: true, duplicate: true, deliveryId });
      }

      const run = await agent.createRun(intake);
      return Response.json({ ok: true, run }, { status: 201 });
    }

    // Authenticated API
    const auth = verifyApiKey(
      request.headers.get('Authorization'),
      env.BUILDER_AGENT_API_KEY ?? ''
    );

    try {
      if (url.pathname === '/api/runs' && request.method === 'POST') {
        requirePermission(auth, 'write');
        const body = IntakePayloadSchema.parse(await request.json());
        const workspaceId = body.workspaceId ?? workspaceIdFromRequest(request);
        const stub = agentStub(env, workspaceId);
        const run = await (stub as unknown as { createRun(b: typeof body): Promise<unknown> }).createRun(body);
        return Response.json({ run }, { status: 201 });
      }

      if (url.pathname === '/api/runs' && request.method === 'GET') {
        requirePermission(auth, 'read');
        const workspaceId = workspaceIdFromRequest(request);
        const stub = agentStub(env, workspaceId);
        const runs = await (stub as unknown as { listRuns(): Promise<unknown[]> }).listRuns();
        return Response.json({ runs });
      }

      const runMatch = url.pathname.match(/^\/api\/runs\/([^/]+)(?:\/(\w+))?$/);
      if (runMatch) {
        const runId = runMatch[1]!;
        const action = runMatch[2];
        const workspaceId = workspaceIdFromRequest(request);
        const stub = agentStub(env, workspaceId);

        if (request.method === 'GET' && !action) {
          requirePermission(auth, 'read');
          const run = await (stub as unknown as { getRun(id: string): Promise<unknown> }).getRun(runId);
          if (!run) return new Response('Not found', { status: 404 });
          return Response.json({ run });
        }

        if (request.method === 'POST' && action === 'approve') {
          requirePermission(auth, 'write');
          const body = (await request.json()) as {
            approvalId: string;
            approved: boolean;
            resolvedBy: string;
            reason?: string;
          };
          const run = await (
            stub as unknown as {
              approveRun(
                id: string,
                a: string,
                ok: boolean,
                by: string,
                r?: string
              ): Promise<unknown>;
            }
          ).approveRun(runId, body.approvalId, body.approved, body.resolvedBy, body.reason);
          return Response.json({ run });
        }

        if (request.method === 'POST' && action === 'cancel') {
          requirePermission(auth, 'write');
          const body = (await request.json()) as { reason?: string };
          const run = await (
            stub as unknown as { cancelRun(id: string, r?: string): Promise<unknown> }
          ).cancelRun(runId, body.reason);
          return Response.json({ run });
        }

        if (request.method === 'POST' && action === 'merge') {
          requirePermission(auth, 'merge');
          const result = await (
            stub as unknown as { attemptMerge(id: string): Promise<{ allowed: boolean; reason?: string }> }
          ).attemptMerge(runId);
          if (!result.allowed) {
            return Response.json({ error: result.reason }, { status: 403 });
          }
          return Response.json({ error: 'Merge execution not enabled in v1 — approval recorded only' }, { status: 501 });
        }
      }

      return new Response('Not found', { status: 404 });
    } catch (err) {
      if (err instanceof AuthError) {
        return new Response(err.message, { status: err.status });
      }
      const message = err instanceof Error ? err.message : String(err);
      return Response.json({ error: message }, { status: 500 });
    }
  },
};
