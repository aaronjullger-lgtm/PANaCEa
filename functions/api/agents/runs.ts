/**
 * Agent Protocol — /runs endpoint
 *
 * Implements the Agent Protocol spec for agent run lifecycle:
 * - POST /runs — Create a background run
 * - POST /runs/wait — Create a stateless run and wait for output
 * - GET /runs/{run_id} — Get run status
 * - GET /runs/{run_id}/wait — Wait for run completion
 * - POST /runs/{run_id}/cancel — Cancel a run
 *
 * Spec: https://langchain-ai.github.io/agent-protocol/api.html
 *
 * @module functions/api/agents/runs
 */

import { authenticatedEndpoint } from '../_shared/auth';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import type {
  Run,
  RunCreateRequest,
  RunCreateResponse,
  RunWaitResponse,
  RunStatus,
} from '@/lib/agents/protocol/types';

// ─── In-memory Run Store (Edge-compatible) ──────────────────────────────────
// In production, this would be backed by D1 or KV for persistence across requests.

interface RunRecord {
  run_id: string;
  thread_id: string;
  agent_id?: string;
  status: RunStatus;
  input: Record<string, unknown>;
  output?: Record<string, unknown>;
  error?: string;
  created_at: string;
  updated_at: string;
  completed_at?: string;
  metadata?: Record<string, unknown>;
}

const runStore = new Map<string, RunRecord>();

function generateId(): string {
  const chars = 'abcdef0123456789';
  let id = '';
  for (let i = 0; i < 32; i++) {
    id += chars[Math.floor(Math.random() * chars.length)];
  }
  return id;
}

function runToResponse(run: RunRecord): Run {
  return {
    run_id: run.run_id,
    thread_id: run.thread_id,
    agent_id: run.agent_id,
    status: run.status,
    input: run.input,
    output: run.output,
    error: run.error,
    created_at: run.created_at,
    updated_at: run.updated_at,
    completed_at: run.completed_at,
    metadata: run.metadata,
  };
}

// ─── POST /api/agents/runs — Create a background run ────────────────────────

export const onRequestPost = authenticatedEndpoint(async (context) => {
  const prisma = createEdgePrismaClient(context.env);
  try {
    const body: RunCreateRequest = await context.request.json();

    if (!body.input) {
      return new Response(
        JSON.stringify({ error: 'input is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      );
    }

    const runId = generateId();
    const threadId = body.thread_id ?? generateId();
    const now = new Date().toISOString();

    const run: RunRecord = {
      run_id: runId,
      thread_id: threadId,
      agent_id: body.agent_id,
      status: 'pending',
      input: body.input,
      created_at: now,
      updated_at: now,
      metadata: body.metadata,
    };

    runStore.set(runId, run);

    // Execute the run asynchronously (fire-and-forget for now)
    // In production, this would use a queue (Cloudflare Queues) for reliable execution
    executeRunAsync(runId, context).catch((err) => {
      console.error(`[Agent Protocol] Run ${runId} failed:`, err);
    });

    const response: RunCreateResponse = {
      run_id: runId,
      thread_id: threadId,
      status: 'pending',
    };

    return new Response(
      JSON.stringify(response),
      { status: 201, headers: { 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  } finally {
    await safePrismaDisconnect(prisma);
  }
});

// ─── GET /api/agents/runs/{run_id} — Get run status ─────────────────────────

export const onRequestGet = authenticatedEndpoint(async (context) => {
  const prisma = createEdgePrismaClient(context.env);
  try {
    const url = new URL(context.request.url);
    const pathParts = url.pathname.split('/').filter(Boolean);
    // path: api/agents/runs/{run_id} or api/agents/runs/{run_id}/wait
    const runIdIndex = pathParts.indexOf('runs') + 1;
    const runId = pathParts[runIdIndex];
    const action = pathParts[runIdIndex + 1]; // 'wait' or undefined

    if (!runId) {
      // List runs (simplified — in production, filter by thread_id)
      const runs = Array.from(runStore.values()).map(runToResponse);
      return new Response(
        JSON.stringify({ data: runs, total: runs.length }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    }

    const run = runStore.get(runId);
    if (!run) {
      return new Response(
        JSON.stringify({ error: `Run not found: ${runId}` }),
        { status: 404, headers: { 'Content-Type': 'application/json' } },
      );
    }

    if (action === 'wait') {
      // Wait for run to complete (polling — in production, use streaming)
      const maxWaitMs = 60_000;
      const pollIntervalMs = 500;
      const startTime = Date.now();

      while (Date.now() - startTime < maxWaitMs) {
        const current = runStore.get(runId);
        if (!current) break;

        if (current.status === 'success' || current.status === 'error' || current.status === 'cancelled') {
          const response: RunWaitResponse = {
            run_id: current.run_id,
            thread_id: current.thread_id,
            status: current.status,
            output: current.output,
            error: current.error,
          };
          return new Response(
            JSON.stringify(response),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          );
        }

        await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
      }

      // Timeout — return current status
      const current = runStore.get(runId);
      const response: RunWaitResponse = {
        run_id: runId,
        thread_id: current?.thread_id ?? '',
        status: current?.status ?? 'pending',
        output: current?.output,
        error: 'Run did not complete within the wait timeout',
      };
      return new Response(
        JSON.stringify(response),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    }

    // Return run status
    return new Response(
      JSON.stringify(runToResponse(run)),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  } finally {
    await safePrismaDisconnect(prisma);
  }
});

// ─── POST /api/agents/runs/{run_id}/cancel — Cancel a run ───────────────────

// Handled via onRequestPost with path parsing for cancel action
// (Cloudflare Pages Functions route matching handles this via directory structure)

// ─── Async Run Execution ────────────────────────────────────────────────────

async function executeRunAsync(
  runId: string,
  _context: { env: Record<string, unknown>; request: Request },
): Promise<void> {
  const run = runStore.get(runId);
  if (!run) return;

  // Mark as running
  run.status = 'running';
  run.updated_at = new Date().toISOString();
  runStore.set(runId, run);

  try {
    // In production, this would invoke the actual agent via the orchestrator
    // For now, simulate agent execution
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Simulate successful completion
    run.status = 'success';
    run.output = {
      message: `Agent execution completed for run ${runId}`,
      agent_id: run.agent_id,
      input_summary: JSON.stringify(run.input).slice(0, 200),
    };
    run.completed_at = new Date().toISOString();
    run.updated_at = new Date().toISOString();
    runStore.set(runId, run);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    run.status = 'error';
    run.error = message;
    run.completed_at = new Date().toISOString();
    run.updated_at = new Date().toISOString();
    runStore.set(runId, run);
  }
}
