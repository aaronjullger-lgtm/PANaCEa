/**
 * Unified Agent Checkpoint Provider
 *
 * Provides persistent agent state across sessions and process restarts.
 * Selects the appropriate backend based on runtime environment:
 *
 *   Edge (Cloudflare Pages Functions) → D1-backed checkpointing
 *   Node.js (agent-orchestrator, scripts) → SQLite-backed checkpointing
 *   Fallback → MemorySaver (in-process only, no persistence)
 *
 * Usage:
 *   import { getCheckpointSaver } from '@/lib/agents/shared/checkpoint';
 *   const saver = await getCheckpointSaver(env);
 *   const graph = workflow.compile({ checkpointer: saver });
 *
 * Thread-based resume:
 *   const result = await graph.invoke(input, {
 *     configurable: { thread_id: 'session-abc-123' }
 *   });
 *
 * @module lib/agents/shared/checkpoint
 */

import { MemorySaver } from '@langchain/langgraph';
import type { D1Database } from '@/functions/api/_shared/types';

// ─── Types ─────────────────────────────────────────────────────────────────

export interface CheckpointProvider {
  /** Get a checkpoint saver for the given environment. */
  getSaver: () => Promise<CheckpointSaver>;
  /** List active thread IDs (for session management). */
  listThreads?: (prefix?: string) => Promise<string[]>;
  /** Delete a thread's checkpoints (for session cleanup). */
  deleteThread?: (threadId: string) => Promise<void>;
}

/** Minimal interface matching LangGraph's BaseCheckpointSaver shape. */
export interface CheckpointSaver {
  getTuple: (config: { configurable?: { thread_id?: string; checkpoint_id?: string } }) => Promise<unknown>;
  put: (config: { configurable: { thread_id: string } }, checkpoint: unknown, metadata: unknown, newVersions: unknown) => Promise<unknown>;
  list?: (config: { configurable?: { thread_id?: string } }, options?: { limit?: number; before?: unknown }) => Promise<unknown[]>;
}

// ─── Environment Detection ──────────────────────────────────────────────────

function isEdgeRuntime(): boolean {
  return typeof navigator !== 'undefined' && navigator.userAgent === 'Cloudflare-Workers';
}

function isNodeRuntime(): boolean {
  return typeof process !== 'undefined' && process.versions?.node !== undefined;
}

// ─── D1 Checkpoint Saver (Edge) ─────────────────────────────────────────────

/**
 * D1-backed checkpoint saver for Cloudflare Edge runtime.
 *
 * Stores checkpoints in the `agent_checkpoints` D1 table:
 *   thread_id TEXT, checkpoint_id TEXT, parent_id TEXT,
 *   checkpoint TEXT (JSON), metadata TEXT (JSON), created_at INTEGER
 *
 * The table must be created before use:
 *   CREATE TABLE IF NOT EXISTS agent_checkpoints (
 *     thread_id TEXT NOT NULL,
 *     checkpoint_id TEXT NOT NULL,
 *     parent_id TEXT,
 *     checkpoint TEXT NOT NULL,
 *     metadata TEXT NOT NULL DEFAULT '{}',
 *     created_at INTEGER NOT NULL DEFAULT (unixepoch()),
 *     PRIMARY KEY (thread_id, checkpoint_id)
 *   );
 *   CREATE INDEX IF NOT EXISTS idx_agent_checkpoints_thread
 *     ON agent_checkpoints(thread_id, created_at DESC);
 */
class D1CheckpointSaver implements CheckpointSaver {
  private db: D1Database;

  constructor(db: D1Database) {
    this.db = db;
  }

  async getTuple(config: { configurable?: { thread_id?: string; checkpoint_id?: string } }): Promise<unknown> {
    const threadId = config.configurable?.thread_id;
    if (!threadId) return undefined;

    try {
      let result: Record<string, unknown> | null;

      if (config.configurable?.checkpoint_id) {
        result = await this.db
          .prepare('SELECT * FROM agent_checkpoints WHERE thread_id = ?1 AND checkpoint_id = ?2')
          .bind(threadId, config.configurable.checkpoint_id)
          .first();
      } else {
        // Get latest checkpoint for this thread
        result = await this.db
          .prepare('SELECT * FROM agent_checkpoints WHERE thread_id = ?1 ORDER BY created_at DESC LIMIT 1')
          .bind(threadId)
          .first();
      }

      if (!result) return undefined;

      return {
        configurable: {
          thread_id: result.thread_id,
          checkpoint_id: result.checkpoint_id,
        },
        checkpoint: typeof result.checkpoint === 'string'
          ? JSON.parse(result.checkpoint as string)
          : result.checkpoint,
        metadata: typeof result.metadata === 'string'
          ? JSON.parse(result.metadata as string)
          : result.metadata,
        parentConfig: result.parent_id
          ? { configurable: { thread_id: threadId, checkpoint_id: result.parent_id } }
          : undefined,
      };
    } catch (err) {
      console.error('[D1CheckpointSaver] getTuple error:', err);
      return undefined;
    }
  }

  async put(
    config: { configurable: { thread_id: string } },
    checkpoint: unknown,
    metadata: unknown,
    _newVersions: unknown,
  ): Promise<unknown> {
    const threadId = config.configurable.thread_id;
    const checkpointId = `ckpt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    try {
      await this.db
        .prepare(
          'INSERT OR REPLACE INTO agent_checkpoints (thread_id, checkpoint_id, parent_id, checkpoint, metadata, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)',
        )
        .bind(
          threadId,
          checkpointId,
          null, // parent_id — could be extracted from checkpoint if needed
          JSON.stringify(checkpoint),
          JSON.stringify(metadata),
          Math.floor(Date.now() / 1000),
        )
        .run();

      return { configurable: { thread_id: threadId, checkpoint_id: checkpointId } };
    } catch (err) {
      console.error('[D1CheckpointSaver] put error:', err);
      throw err;
    }
  }

  async list(
    config: { configurable?: { thread_id?: string } },
    options?: { limit?: number; before?: unknown },
  ): Promise<unknown[]> {
    const threadId = config.configurable?.thread_id;
    if (!threadId) return [];

    try {
      const limit = options?.limit ?? 10;
      const { results } = await this.db
        .prepare('SELECT * FROM agent_checkpoints WHERE thread_id = ?1 ORDER BY created_at DESC LIMIT ?2')
        .bind(threadId, limit)
        .all();

      return ((results ?? []) as Record<string, unknown>[]).map((r) => ({
        configurable: {
          thread_id: r.thread_id,
          checkpoint_id: r.checkpoint_id,
        },
        checkpoint: typeof r.checkpoint === 'string' ? JSON.parse(r.checkpoint as string) : r.checkpoint,
        metadata: typeof r.metadata === 'string' ? JSON.parse(r.metadata as string) : r.metadata,
      }));
    } catch (err) {
      console.error('[D1CheckpointSaver] list error:', err);
      return [];
    }
  }
}

// ─── SQLite Checkpoint Saver (Node.js) ──────────────────────────────────────

/**
 * SQLite-backed checkpoint saver for Node.js runtime.
 * Uses @langchain/langgraph-checkpoint-sqlite when available.
 */
async function createSqliteSaver(): Promise<CheckpointSaver | null> {
  try {
    // Dynamic import — @langchain/langgraph-checkpoint-sqlite is an optional
    // dependency only available in the agent-orchestrator package (Node.js).
    // It is NOT installed at the repo root, so we use a raw import string
    // that TypeScript won't resolve at compile time.
    const { resolve } = await import('node:path');
    const { mkdirSync } = await import('node:fs');

    const dir = resolve(process.cwd(), '.checkpoint');
    mkdirSync(dir, { recursive: true });
    const dbPath = resolve(dir, 'agent-checkpoints.sqlite');

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const mod = await (Function('return import(module)') as (module: string) => Promise<{
      SqliteSaver: new (opts: { db_path: string }) => CheckpointSaver;
    }>)('@langchain/langgraph-checkpoint-sqlite');
    return new mod.SqliteSaver({ db_path: dbPath });
  } catch (err) {
    console.warn('[checkpoint] SqliteSaver unavailable:', err instanceof Error ? err.message : err);
    return null;
  }
}

// ─── Unified Provider ───────────────────────────────────────────────────────

let _cachedSaver: CheckpointSaver | null = null;
let _initPromise: Promise<CheckpointSaver> | null = null;

/**
 * Get the appropriate checkpoint saver for the current runtime.
 *
 * @param env - Optional environment with D1 binding for Edge runtime.
 *              Pass `context.env` in Cloudflare Pages Functions.
 * @returns A checkpoint saver (D1, SQLite, or MemorySaver fallback).
 */
export async function getCheckpointSaver(
  env?: { EDGE_DB?: D1Database },
): Promise<CheckpointSaver> {
  // Return cached saver if available
  if (_cachedSaver) return _cachedSaver;

  // Deduplicate concurrent init calls
  if (_initPromise) return _initPromise;

  _initPromise = (async () => {
    // Edge runtime: use D1
    if (isEdgeRuntime() && env?.EDGE_DB) {
      console.log('[checkpoint] Using D1-backed checkpoint saver (Edge runtime)');
      _cachedSaver = new D1CheckpointSaver(env.EDGE_DB);
      return _cachedSaver;
    }

    // Node.js runtime: use SQLite
    if (isNodeRuntime()) {
      const sqlite = await createSqliteSaver();
      if (sqlite) {
        console.log('[checkpoint] Using SQLite-backed checkpoint saver (Node.js runtime)');
        _cachedSaver = sqlite;
        return _cachedSaver;
      }
    }

    // Fallback: in-memory only
    console.log('[checkpoint] Using MemorySaver (no persistence)');
    _cachedSaver = new MemorySaver() as unknown as CheckpointSaver;
    return _cachedSaver;
  })();

  return _initPromise;
}

/**
 * Reset the cached saver (useful for testing).
 */
export function resetCheckpointSaver(): void {
  _cachedSaver = null;
  _initPromise = null;
}

/**
 * Create a D1 checkpoint saver directly (for explicit Edge usage).
 */
export function createD1CheckpointSaver(db: D1Database): CheckpointSaver {
  return new D1CheckpointSaver(db);
}

/**
 * List active agent sessions (threads) from D1.
 * Edge-only — returns empty array in Node.js.
 */
export async function listAgentSessions(
  db: D1Database | undefined,
  prefix?: string,
): Promise<Array<{ threadId: string; lastCheckpointAt: number; checkpointCount: number }>> {
  if (!db) return [];

  try {
    let query = `
      SELECT
        thread_id,
        MAX(created_at) as last_checkpoint_at,
        COUNT(*) as checkpoint_count
      FROM agent_checkpoints
    `;
    const params: unknown[] = [];

    if (prefix) {
      query += ' WHERE thread_id LIKE ?1';
      params.push(`${prefix}%`);
    }

    query += ' GROUP BY thread_id ORDER BY last_checkpoint_at DESC LIMIT 50';

    const stmt = db.prepare(query);
    if (params.length > 0) {
      stmt.bind(...params);
    }

    const { results } = await stmt.all<{
      thread_id: string;
      last_checkpoint_at: number;
      checkpoint_count: number;
    }>();

    return (results ?? []).map((r) => ({
      threadId: r.thread_id,
      lastCheckpointAt: r.last_checkpoint_at,
      checkpointCount: r.checkpoint_count,
    }));
  } catch (err) {
    console.error('[checkpoint] listAgentSessions error:', err);
    return [];
  }
}

/**
 * Delete all checkpoints for a thread (session cleanup).
 */
export async function deleteAgentSession(
  db: D1Database | undefined,
  threadId: string,
): Promise<number> {
  if (!db) return 0;

  try {
    const result = await db
      .prepare('DELETE FROM agent_checkpoints WHERE thread_id = ?1')
      .bind(threadId)
      .run();

    return (result.meta?.changes as number) ?? 0;
  } catch (err) {
    console.error('[checkpoint] deleteAgentSession error:', err);
    return 0;
  }
}

/**
 * Purge old checkpoints (older than maxAgeSeconds).
 */
export async function purgeOldCheckpoints(
  db: D1Database | undefined,
  maxAgeSeconds: number = 7 * 24 * 3600, // 7 days default
): Promise<number> {
  if (!db) return 0;

  try {
    const cutoff = Math.floor(Date.now() / 1000) - maxAgeSeconds;
    const result = await db
      .prepare('DELETE FROM agent_checkpoints WHERE created_at < ?1')
      .bind(cutoff)
      .run();

    return (result.meta?.changes as number) ?? 0;
  } catch (err) {
    console.error('[checkpoint] purgeOldCheckpoints error:', err);
    return 0;
  }
}
