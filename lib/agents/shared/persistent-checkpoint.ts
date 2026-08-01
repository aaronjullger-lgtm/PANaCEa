/**
 * Persistent Checkpointing for Orchestrator Graphs
 *
 * Replaces the in-memory MemorySaver with SQLite-backed checkpointing
 * for production orchestrator graphs. Enables:
 * - Resumable agent workflows across process restarts
 * - Time travel (rewind to any previous state)
 * - Cross-session thread persistence
 *
 * Uses @langchain/langgraph-checkpoint-sqlite for Edge-compatible
 * SQLite storage (WASM-based, no native Node addons).
 *
 * @module lib/agents/shared/persistent-checkpoint
 */

let _checkpointSaver: unknown = null;
let _initError: string | null = null;

export async function getPersistentCheckpointSaver(): Promise<unknown> {
  if (_checkpointSaver) return _checkpointSaver;
  if (_initError) return null;

  try {
    // Dynamic import — only resolves when @langchain/langgraph-checkpoint-sqlite is installed
    const sqliteModule = await import('@langchain/langgraph-checkpoint-sqlite');
    const { SqliteSaver } = sqliteModule as {
      SqliteSaver: { fromConnString: (path: string) => Promise<unknown> };
    };

    const dbPath = '.langgraph_api/checkpoints.db';
    const saver = await SqliteSaver.fromConnString(dbPath);

    _checkpointSaver = saver;
    return saver;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    _initError = msg;
    console.debug('[Checkpoint] SQLite checkpointing unavailable, using in-memory:', msg);

    try {
      const { MemorySaver } = await import('@langchain/langgraph');
      _checkpointSaver = new MemorySaver();
      return _checkpointSaver;
    } catch {
      return null;
    }
  }
}

export function clearCheckpointCache(): void {
  _checkpointSaver = null;
  _initError = null;
}
