/**
 * panacea-builder-agent Worker entrypoint.
 */

import { routeAgentRequest } from 'agents';
import {
  verifyApiKey,
  AuthError,
  requirePermission,
} from '@/lib/builder-agent/auth/policy';
import {
  verifyWebhookRequest,
  requireWebhookDeliveryId,
} from '@/lib/builder-agent/auth/webhooks';
import {
  parseAllowedWorkspaces,
  resolveAuthorizedWorkspace,
  bindIntakeToWorkspace,
  DEFAULT_WORKSPACE_ID,
} from '@/lib/builder-agent/auth/workspace';
import { IntakePayloadSchema } from '@/lib/builder-agent/state/schema';
import { CAPABILITY_SUMMARY } from '@/lib/builder-agent/capabilities';
import { BuilderAgent } from './agent/BuilderAgent';
import { BuildWorkflow } from './workflow/BuildWorkflow';
import { normalizeWebhook } from './webhooks/handlers';
import type { Env } from './env';

export { BuilderAgent, BuildWorkflow };

function allowedWorkspaces(env: Env): ReadonlySet<string> {
  return parseAllowedWorkspaces(env.BUILDER_AGENT_ALLOWED_WORKSPACES ?? DEFAULT_WORKSPACE_ID);
}

function resolveWorkspace(request: Request, env: Env, bodyWorkspace?: string): string {
  const url = new URL(request.url);
  const requested = bodyWorkspace ?? url.searchParams.get('workspace') ?? undefined;
  return resolveAuthorizedWorkspace(requested, allowedWorkspaces(env));
}

function agentStub(env: Env, workspaceId: string): DurableObjectStub {
  const id = env.BUILDER_AGENT.idFromName(`workspace:${workspaceId}`);
  return env.BUILDER_AGENT.get(id);
}

type AgentRpc = {
  createRun(b: unknown): Promise<unknown>;
  getRun(id: string): Promise<unknown>;
  listRuns(): Promise<unknown[]>;
  approveRun(id: string, a: string, ok: boolean, by: string, r?: string): Promise<unknown>;
  cancelRun(id: string, r?: string): Promise<unknown>;
  attemptMerge(id: string): Promise<{ allowed: boolean; reason?: string }>;
  attemptDeploy(id: string): Promise<{ allowed: boolean; reason?: string }>;
  attemptInfrastructure(id: string): Promise<{ allowed: boolean; reason?: string }>;
  attemptCredentials(id: string): Promise<{ allowed: boolean; reason?: string }>;
  intakeFromWebhook(p: string, d: string, i: unknown): Promise<{ duplicate: boolean; run?: unknown }>;
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    const agentResponse = await routeAgentRequest(request, env, { prefix: '/agent' });
    if (agentResponse) return agentResponse;

    if (url.pathname === '/health' && request.method === 'GET') {
      return Response.json({
        ok: true,
        worker: env.WORKER_LABEL ?? 'panacea-builder-agent',
        dryRunDefault: env.BUILDER_AGENT_DRY_RUN !== 'false',
        sandboxEnabled: env.BUILDER_AGENT_SANDBOX_ENABLED === 'true',
        allowedWorkspaces: [...allowedWorkspaces(env)],
        capabilities: CAPABILITY_SUMMARY,
      });
    }

    // Webhooks — secret required, raw-body signature, delivery id required
    if (url.pathname.startsWith('/webhooks/') && request.method === 'POST') {
      const provider = url.pathname.split('/')[2];
      if (!provider || !['github', 'linear', 'sentry'].includes(provider)) {
        return new Response('Unknown provider', { status: 404 });
      }

      const rawBody = await request.text();

      try {
        if (!env.BUILDER_AGENT_WEBHOOK_SECRET?.trim()) {
          throw new AuthError('BUILDER_AGENT_WEBHOOK_SECRET is not configured', 503);
        }

        await verifyWebhookRequest({
          secret: env.BUILDER_AGENT_WEBHOOK_SECRET,
          rawBody,
          signatureHeader: request.headers.get('X-Builder-Signature'),
          timestampHeader: request.headers.get('X-Builder-Timestamp'),
        });
      } catch (err) {
        if (err instanceof AuthError) {
          return new Response(err.message, { status: err.status });
        }
        throw err;
      }

      let deliveryId: string;
      try {
        deliveryId = requireWebhookDeliveryId(provider, {
          githubDelivery: request.headers.get('X-GitHub-Delivery'),
          linearDelivery: request.headers.get('Linear-Delivery'),
          sentryDelivery: request.headers.get('Sentry-Hook-Resource'),
        });
      } catch (err) {
        if (err instanceof AuthError) {
          return new Response(err.message, { status: err.status });
        }
        throw err;
      }

      const payload = JSON.parse(rawBody) as Record<string, unknown>;
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

      const workspaceId = resolveWorkspace(request, env);
      const bound = bindIntakeToWorkspace(intake, workspaceId);
      const stub = agentStub(env, workspaceId) as unknown as AgentRpc;

      const result = await stub.intakeFromWebhook(provider, deliveryId, bound);
      if (result.duplicate) {
        return Response.json({ ok: true, duplicate: true, deliveryId });
      }
      return Response.json({ ok: true, run: result.run }, { status: 201 });
    }

    // Authenticated API
    let auth;
    try {
      auth = verifyApiKey(request.headers.get('Authorization'), env.BUILDER_AGENT_API_KEY ?? '');
    } catch (err) {
      if (err instanceof AuthError) {
        return new Response(err.message, { status: err.status });
      }
      throw err;
    }

    try {
      if (url.pathname === '/api/runs' && request.method === 'POST') {
        requirePermission(auth, 'write');
        const body = IntakePayloadSchema.parse(await request.json());
        const workspaceId = resolveWorkspace(request, env, body.workspaceId);
        const bound = bindIntakeToWorkspace(body, workspaceId);
        const stub = agentStub(env, workspaceId) as unknown as AgentRpc;
        const run = await stub.createRun(bound);
        return Response.json({ run }, { status: 201 });
      }

      if (url.pathname === '/api/runs' && request.method === 'GET') {
        requirePermission(auth, 'read');
        const workspaceId = resolveWorkspace(request, env);
        const stub = agentStub(env, workspaceId) as unknown as AgentRpc;
        const runs = await stub.listRuns();
        return Response.json({ runs });
      }

      const runMatch = url.pathname.match(/^\/api\/runs\/([^/]+)(?:\/(\w+))?$/);
      if (runMatch) {
        const runId = runMatch[1]!;
        const action = runMatch[2];
        const workspaceId = resolveWorkspace(request, env);
        const stub = agentStub(env, workspaceId) as unknown as AgentRpc;

        if (request.method === 'GET' && !action) {
          requirePermission(auth, 'read');
          const run = await stub.getRun(runId);
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
          const run = await stub.approveRun(
            runId,
            body.approvalId,
            body.approved,
            body.resolvedBy,
            body.reason
          );
          return Response.json({ run });
        }

        if (request.method === 'POST' && action === 'cancel') {
          requirePermission(auth, 'write');
          const body = (await request.json()) as { reason?: string };
          const run = await stub.cancelRun(runId, body.reason);
          return Response.json({ run });
        }

        const prohibitedActions: Record<string, 'merge' | 'deploy' | 'infrastructure' | 'credentials'> = {
          merge: 'merge',
          deploy: 'deploy',
          infrastructure: 'infrastructure',
          credentials: 'credentials',
        };

        if (request.method === 'POST' && action && action in prohibitedActions) {
          const perm = prohibitedActions[action]!;
          requirePermission(auth, perm);
          const methodMap = {
            merge: 'attemptMerge',
            deploy: 'attemptDeploy',
            infrastructure: 'attemptInfrastructure',
            credentials: 'attemptCredentials',
          } as const;
          const result = await stub[methodMap[action as keyof typeof methodMap]](runId);
          if (!result.allowed) {
            return Response.json({ error: result.reason }, { status: 403 });
          }
          return Response.json(
            { error: `${action} execution not enabled in v1 — approval gate passed but action blocked` },
            { status: 501 }
          );
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
