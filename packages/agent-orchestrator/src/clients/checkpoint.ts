/**
 * LangGraph checkpoint provider — SQLite-backed resume.
 *
 * Improvement #3 — gives agent runs crash/rate-limit recovery. A run that dies
 * mid-loop (e.g. Gemini 429 on PR #4 of 6) can resume from its last checkpoint
 * by re-invoking the same graph with the same `thread_id`. State lives in a
 * local `.sqlite` file under ./.checkpoint/ (gitignored).
 *
 * Falls back to in-memory MemorySaver when @langchain/langgraph-checkpoint-sqlite
 * is missing OR Qdrant/env says "ephemeral" — the graph still runs, just without
 * cross-process resume.
 *
 * Doc: langchain-ai/langgraphjs deepwiki §3.2 Checkpoint Implementations.
 *
 * @module packages/agent-orchestrator/src/clients/checkpoint
 */

import { getEnv } from '../config/env.js';
import { resolve } from 'node:path';
import { mkdirSync } from 'node:fs';

export type CheckpointSaver = unknown;

let _saver: CheckpointSaver | null = null;
let _tried = false;

export async function getCheckpointSaver(): Promise<CheckpointSaver | null> {
  if (_tried) return _saver;
  _tried = true;

  const env = getEnv();
  // Respect an explicit opt-out (e.g. serverless / ephemeral runs).
  if (env.ORCHESTRATOR_CHECKPOINT === 'off') {
    return null;
  }

  try {
    const dir = resolve(process.cwd(), '.checkpoint');
    mkdirSync(dir, { recursive: true });
    const dbPath = resolve(dir, 'orchestrator.sqlite');
    // SqliteSaver accepts a connection OR a path (v1+). The dynamic import keeps
    // the dep optional so the orchestrator still loads on hosts without it.
    const mod = (await import('@langchain/langgraph-checkpoint-sqlite')) as {
      SqliteSaver: new (opts: { db_path: string } | { checkpoint: unknown }) => CheckpointSaver;
    };
    _saver = new mod.SqliteSaver({ db_path: dbPath });
    return _saver;
  } catch (err) {
    console.warn(
      '[agent-orchestrator] SqliteSaver unavailable — running without cross-process resume. ' +
        'Install @langchain/langgraph-checkpoint-sqlite to enable.',
      err instanceof Error ? err.message : err,
    );
    // Last-resort in-memory saver from core langgraph.
    try {
      const core = (await import('@langchain/langgraph')) as { MemorySaver: new () => CheckpointSaver };
      _saver = new core.MemorySaver();
    } catch {
      _saver = null;
    }
    return _saver;
  }
}