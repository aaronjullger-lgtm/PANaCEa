/**
 * Filesystem Middleware — DeepAgents-inspired virtual filesystem for context offloading.
 *
 * Provides a virtual in-memory filesystem that agents can use to:
 * - Offload large intermediate results (avoid context window bloat)
 * - Store structured data between agent steps
 * - Share state between subagents in a workflow
 * - Implement "scratchpad" patterns for complex reasoning
 *
 * Inspired by the DeepAgents SDK's FilesystemMiddleware which gives agents
 * write_file/read_file/edit_file tools to manage context. This TypeScript
 * implementation provides the same pattern for PANaCEa's agent pipelines.
 *
 * Key differences from a real filesystem:
 * - In-memory only (no disk I/O in Edge runtime)
 * - Scoped to a single pipeline run
 * - JSON-serializable values only
 * - Automatic cleanup on pipeline completion
 *
 * @module lib/agents/middleware/filesystem
 */

// ─── Types ─────────────────────────────────────────────────────────────────

export interface VirtualFile {
  /** File path (namespace/key) */
  path: string;
  /** File contents (must be JSON-serializable) */
  content: unknown;
  /** MIME type hint */
  contentType: string;
  /** When the file was created */
  createdAt: string;
  /** When the file was last modified */
  updatedAt: string;
  /** Size in bytes (approximate, from JSON.stringify) */
  sizeBytes: number;
  /** Optional metadata tags */
  tags?: string[];
}

export interface VirtualFS {
  /** Unique filesystem ID for this pipeline run */
  fsId: string;
  /** All files in the filesystem */
  files: Map<string, VirtualFile>;
  /** Total approximate size in bytes */
  totalSizeBytes: number;
  /** Maximum allowed size (default: 5MB) */
  maxSizeBytes: number;
}

// ─── Filesystem Factory ────────────────────────────────────────────────────

const DEFAULT_MAX_SIZE = 5 * 1024 * 1024; // 5MB

/**
 * Create a new virtual filesystem for a pipeline run.
 */
export function createVirtualFS(
  fsId?: string,
  maxSizeBytes: number = DEFAULT_MAX_SIZE,
): VirtualFS {
  return {
    fsId: fsId ?? `fs_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    files: new Map(),
    totalSizeBytes: 0,
    maxSizeBytes,
  };
}

// ─── File Operations ───────────────────────────────────────────────────────

/**
 * Write a file to the virtual filesystem.
 * Overwrites if the path already exists.
 */
export function writeFile(
  fs: VirtualFS,
  path: string,
  content: unknown,
  options?: {
    contentType?: string;
    tags?: string[];
  },
): VirtualFile {
  const now = new Date().toISOString();
  const serialized = JSON.stringify(content);
  const sizeBytes = new TextEncoder().encode(serialized).length;

  // Check size limit
  const existingSize = fs.files.get(path)?.sizeBytes ?? 0;
  const newTotalSize = fs.totalSizeBytes - existingSize + sizeBytes;
  if (newTotalSize > fs.maxSizeBytes) {
    throw new Error(
      `Virtual filesystem full: ${newTotalSize} bytes would exceed ${fs.maxSizeBytes} byte limit`,
    );
  }

  const file: VirtualFile = {
    path,
    content,
    contentType: options?.contentType ?? 'application/json',
    createdAt: fs.files.get(path)?.createdAt ?? now,
    updatedAt: now,
    sizeBytes,
    tags: options?.tags,
  };

  fs.files.set(path, file);
  fs.totalSizeBytes = newTotalSize;

  return file;
}

/**
 * Read a file from the virtual filesystem.
 */
export function readFile(fs: VirtualFS, path: string): VirtualFile | undefined {
  return fs.files.get(path);
}

/**
 * Check if a file exists.
 */
export function fileExists(fs: VirtualFS, path: string): boolean {
  return fs.files.has(path);
}

/**
 * Delete a file from the virtual filesystem.
 */
export function deleteFile(fs: VirtualFS, path: string): boolean {
  const file = fs.files.get(path);
  if (!file) return false;

  fs.totalSizeBytes -= file.sizeBytes;
  return fs.files.delete(path);
}

/**
 * List all files in the virtual filesystem, optionally filtered by tag.
 */
export function listFiles(
  fs: VirtualFS,
  tagFilter?: string,
): VirtualFile[] {
  const files = Array.from(fs.files.values());
  if (tagFilter) {
    return files.filter((f) => f.tags?.includes(tagFilter));
  }
  return files;
}

/**
 * Get filesystem statistics.
 */
export function getFSStats(fs: VirtualFS): {
  fileCount: number;
  totalSizeBytes: number;
  maxSizeBytes: number;
  percentFull: number;
} {
  return {
    fileCount: fs.files.size,
    totalSizeBytes: fs.totalSizeBytes,
    maxSizeBytes: fs.maxSizeBytes,
    percentFull: Math.round((fs.totalSizeBytes / fs.maxSizeBytes) * 100),
  };
}

// ─── Context Offloading ────────────────────────────────────────────────────

/**
 * Offload large content to the virtual filesystem and return a reference.
 * This is the core DeepAgents pattern: when an agent step produces a large
 * result, offload it to the filesystem and pass only a reference to the
 * next step, keeping the context window lean.
 *
 * @example
 * ```ts
 * // Agent step 1: generate a large batch of questions
 * const questions = await generateQuestionBatch(50);
 *
 * // Offload to filesystem — only the reference goes into context
 * const ref = offloadToFS(fs, 'batch_001/questions', questions);
 *
 * // Agent step 2: read from filesystem when needed
 * const stored = readFile(fs, ref.path);
 * ```
 */
export function offloadToFS(
  fs: VirtualFS,
  path: string,
  content: unknown,
  options?: {
    contentType?: string;
    tags?: string[];
  },
): { path: string; summary: string; sizeBytes: number } {
  const file = writeFile(fs, path, content, options);

  const summary = generateSummary(content);

  return {
    path: file.path,
    summary,
    sizeBytes: file.sizeBytes,
  };
}

/**
 * Generate a human-readable summary of offloaded content.
 */
function generateSummary(content: unknown): string {
  if (Array.isArray(content)) {
    return `Array[${content.length} items, ~${estimateSize(content)} bytes]`;
  }
  if (content && typeof content === 'object') {
    const keys = Object.keys(content as object);
    return `Object{${keys.slice(0, 5).join(', ')}${keys.length > 5 ? ', ...' : ''}} [${keys.length} keys, ~${estimateSize(content)} bytes]`;
  }
  if (typeof content === 'string') {
    return `String[${content.length} chars, ~${estimateSize(content)} bytes]`;
  }
  return `${typeof content} [~${estimateSize(content)} bytes]`;
}

function estimateSize(content: unknown): number {
  try {
    return new TextEncoder().encode(JSON.stringify(content)).length;
  } catch {
    return 0;
  }
}

// ─── SubAgent State Sharing ────────────────────────────────────────────────

/**
 * Share state between subagents via the virtual filesystem.
 * Each subagent writes its output to a namespaced path, and the
 * orchestrator reads all outputs for merging.
 *
 * @example
 * ```ts
 * const fs = createVirtualFS();
 *
 * // Subagent 1 writes
 * shareSubAgentOutput(fs, 'cardiology', 'ddx-generator', ddxResult);
 *
 * // Subagent 2 writes
 * shareSubAgentOutput(fs, 'pulmonology', 'ddx-generator', ddxResult);
 *
 * // Orchestrator reads all
 * const allOutputs = collectSubAgentOutputs(fs);
 * ```
 */
export function shareSubAgentOutput(
  fs: VirtualFS,
  namespace: string,
  agentName: string,
  output: unknown,
): VirtualFile {
  const path = `subagents/${namespace}/${agentName}/output.json`;
  return writeFile(fs, path, output, {
    contentType: 'application/json',
    tags: ['subagent-output', namespace, agentName],
  });
}

/**
 * Collect all subagent outputs from the virtual filesystem.
 */
export function collectSubAgentOutputs(
  fs: VirtualFS,
): Array<{ namespace: string; agentName: string; output: unknown }> {
  const subagentFiles = listFiles(fs).filter((f) =>
    f.path.startsWith('subagents/'),
  );

  return subagentFiles.map((f) => {
    const parts = f.path.split('/');
    // subagents/{namespace}/{agentName}/output.json
    const namespace = parts[1] ?? 'unknown';
    const agentName = parts[2] ?? 'unknown';
    return { namespace, agentName, output: f.content };
  });
}

// ─── Cleanup ───────────────────────────────────────────────────────────────

/**
 * Clear all files from the virtual filesystem.
 */
export function clearFS(fs: VirtualFS): void {
  fs.files.clear();
  fs.totalSizeBytes = 0;
}

/**
 * Serialize filesystem state for LangSmith tracing metadata.
 */
export function serializeFSState(fs: VirtualFS): Record<string, unknown> {
  return {
    fsId: fs.fsId,
    stats: getFSStats(fs),
    files: listFiles(fs).map((f) => ({
      path: f.path,
      contentType: f.contentType,
      sizeBytes: f.sizeBytes,
      tags: f.tags,
      created: f.createdAt,
      updated: f.updatedAt,
    })),
  };
}
