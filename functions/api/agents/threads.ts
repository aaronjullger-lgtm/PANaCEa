/**
 * Agent Protocol — /threads endpoint
 *
 * Implements the Agent Protocol spec for multi-turn conversation threads:
 * - POST /threads — Create a thread
 * - GET /threads/{thread_id} — Get thread state
 * - PATCH /threads/{thread_id} — Update thread values
 * - DELETE /threads/{thread_id} — Delete a thread
 * - GET /threads/{thread_id}/history — Browse thread revision history
 * - POST /threads/search — Search threads
 *
 * Spec: https://langchain-ai.github.io/agent-protocol/api.html
 *
 * @module functions/api/agents/threads
 */

import { z } from 'zod';
import { authenticatedEndpoint } from '../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import type {
  Thread,
  ThreadCreateRequest,
  ThreadUpdateRequest,
  ThreadSearchRequest,
  ThreadHistoryEntry,
  ThreadStatus,
  AgentMessage,
} from '@/lib/agents/protocol/types';

// ─── In-memory Thread Store (Edge-compatible) ───────────────────────────────
// In production, this would be backed by D1 with proper indexing.

interface ThreadRecord {
  thread_id: string;
  status: ThreadStatus;
  values: Record<string, unknown>;
  messages: AgentMessage[];
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  /** Revision history (append-only log) */
  history: ThreadHistoryEntry[];
}

const threadStore = new Map<string, ThreadRecord>();

function generateId(): string {
  const chars = 'abcdef0123456789';
  let id = '';
  for (let i = 0; i < 32; i++) {
    id += chars[Math.floor(Math.random() * chars.length)];
  }
  return id;
}

function threadToResponse(thread: ThreadRecord): Thread {
  return {
    thread_id: thread.thread_id,
    status: thread.status,
    values: thread.values,
    messages: thread.messages,
    metadata: thread.metadata,
    created_at: thread.created_at,
    updated_at: thread.updated_at,
  };
}

// ─── POST /api/agents/threads — Create a thread ─────────────────────────────

export const onRequestPost = authenticatedEndpoint(z.object({}), async (context) => {
  const prisma = createEdgePrismaClient(context.env);
  try {
    const body: ThreadCreateRequest = await context.request.json();

    const threadId = body.thread_id ?? generateId();
    const now = new Date().toISOString();

    if (threadStore.has(threadId)) {
      return new Response(
        JSON.stringify({ error: `Thread already exists: ${threadId}` }),
        { status: 409, headers: { 'Content-Type': 'application/json' } },
      );
    }

    const thread: ThreadRecord = {
      thread_id: threadId,
      status: 'idle',
      values: body.values ?? {},
      messages: [],
      metadata: body.metadata ?? {},
      created_at: now,
      updated_at: now,
      history: [],
    };

    threadStore.set(threadId, thread);

    return new Response(
      JSON.stringify(threadToResponse(thread)),
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

// ─── GET /api/agents/threads/{thread_id} — Get thread ───────────────────────

export const onRequestGet = authenticatedEndpoint(z.object({}), async (context) => {
  const prisma = createEdgePrismaClient(context.env);
  try {
    const url = new URL(context.request.url);
    const pathParts = url.pathname.split('/').filter(Boolean);
    // path: api/agents/threads/{thread_id} or api/agents/threads/{thread_id}/history
    const threadIdIndex = pathParts.indexOf('threads') + 1;
    const threadId = pathParts[threadIdIndex];
    const action = pathParts[threadIdIndex + 1]; // 'history' or undefined

    if (!threadId) {
      // List threads (simplified)
      const threads = Array.from(threadStore.values()).map(threadToResponse);
      return new Response(
        JSON.stringify({ data: threads, total: threads.length }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    }

    const thread = threadStore.get(threadId);
    if (!thread) {
      return new Response(
        JSON.stringify({ error: `Thread not found: ${threadId}` }),
        { status: 404, headers: { 'Content-Type': 'application/json' } },
      );
    }

    if (action === 'history') {
      // Return revision history
      return new Response(
        JSON.stringify({ data: thread.history, total: thread.history.length }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    }

    return new Response(
      JSON.stringify(threadToResponse(thread)),
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

// ─── PATCH /api/agents/threads/{thread_id} — Update thread ──────────────────

export const onRequestPatch = authenticatedEndpoint(z.object({}), async (context) => {
  const prisma = createEdgePrismaClient(context.env);
  try {
    const url = new URL(context.request.url);
    const pathParts = url.pathname.split('/').filter(Boolean);
    const threadIdIndex = pathParts.indexOf('threads') + 1;
    const threadId = pathParts[threadIdIndex];

    if (!threadId) {
      return new Response(
        JSON.stringify({ error: 'thread_id is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      );
    }

    const thread = threadStore.get(threadId);
    if (!thread) {
      return new Response(
        JSON.stringify({ error: `Thread not found: ${threadId}` }),
        { status: 404, headers: { 'Content-Type': 'application/json' } },
      );
    }

    const body: ThreadUpdateRequest = await context.request.json();
    const now = new Date().toISOString();

    // Save current state to history before updating
    thread.history.push({
      revision_id: generateId(),
      thread_id: threadId,
      values: { ...thread.values },
      messages: [...thread.messages],
      created_at: now,
    });

    // Apply updates
    if (body.values) {
      thread.values = { ...thread.values, ...body.values };
    }
    if (body.metadata) {
      thread.metadata = { ...thread.metadata, ...body.metadata };
    }
    thread.updated_at = now;

    threadStore.set(threadId, thread);

    return new Response(
      JSON.stringify(threadToResponse(thread)),
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

// ─── DELETE /api/agents/threads/{thread_id} — Delete thread ─────────────────

export const onRequestDelete = authenticatedEndpoint(z.object({}), async (context) => {
  const prisma = createEdgePrismaClient(context.env);
  try {
    const url = new URL(context.request.url);
    const pathParts = url.pathname.split('/').filter(Boolean);
    const threadIdIndex = pathParts.indexOf('threads') + 1;
    const threadId = pathParts[threadIdIndex];

    if (!threadId) {
      return new Response(
        JSON.stringify({ error: 'thread_id is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      );
    }

    const existed = threadStore.delete(threadId);
    if (!existed) {
      return new Response(
        JSON.stringify({ error: `Thread not found: ${threadId}` }),
        { status: 404, headers: { 'Content-Type': 'application/json' } },
      );
    }

    return new Response(
      JSON.stringify({ deleted: true, thread_id: threadId }),
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

// ─── POST /api/agents/threads/search — Search threads ───────────────────────

// Handled via onRequestPost with path parsing for search action
// (Cloudflare Pages Functions route matching handles this via directory structure)
