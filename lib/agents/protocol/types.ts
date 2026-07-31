/**
 * Agent Protocol Types
 *
 * TypeScript implementation of the LangChain Agent Protocol spec.
 * Provides framework-agnostic types for agent runs, threads, and long-term memory.
 *
 * Spec: https://github.com/langchain-ai/agent-protocol
 * OpenAPI: https://langchain-ai.github.io/agent-protocol/api.html
 *
 * @module lib/agents/protocol/types
 */

// ─── Core Identifiers ───────────────────────────────────────────────────────

export type RunId = string;
export type ThreadId = string;
export type AgentId = string;

// ─── Run Status ─────────────────────────────────────────────────────────────

export type RunStatus =
  | 'pending'
  | 'running'
  | 'success'
  | 'error'
  | 'cancelled'
  | 'interrupted';

// ─── Thread Status ──────────────────────────────────────────────────────────

export type ThreadStatus =
  | 'idle'
  | 'running'
  | 'interrupted'
  | 'errored'
  | 'finished';

// ─── Message Types ──────────────────────────────────────────────────────────

export interface AgentMessage {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  /** Optional tool call data */
  tool_calls?: Array<{
    id: string;
    name: string;
    args: Record<string, unknown>;
  }>;
  /** Optional tool call result */
  tool_call_id?: string;
  /** Message metadata */
  metadata?: Record<string, unknown>;
}

// ─── Run Types ──────────────────────────────────────────────────────────────

export interface RunInput {
  /** Agent to invoke */
  agent_id?: AgentId;
  /** Input messages or payload */
  input: Record<string, unknown>;
  /** Optional configuration overrides */
  config?: RunConfig;
  /** Metadata for filtering/searching */
  metadata?: Record<string, unknown>;
}

export interface RunConfig {
  /** Tags for filtering */
  tags?: string[];
  /** Maximum recursion limit */
  recursion_limit?: number;
  /** Model override */
  model?: string;
  /** Temperature override */
  temperature?: number;
  /** Whether to enable streaming */
  stream?: boolean;
}

export interface Run {
  run_id: RunId;
  thread_id: ThreadId;
  agent_id?: AgentId;
  status: RunStatus;
  input: Record<string, unknown>;
  output?: Record<string, unknown>;
  error?: string;
  created_at: string;
  updated_at: string;
  completed_at?: string;
  metadata?: Record<string, unknown>;
  config?: RunConfig;
}

export interface RunCreateRequest {
  /** Create a new thread for this run (stateless) */
  thread_id?: ThreadId;
  /** Agent to invoke */
  agent_id?: AgentId;
  /** Input payload */
  input: Record<string, unknown>;
  /** Configuration */
  config?: RunConfig;
  /** Metadata */
  metadata?: Record<string, unknown>;
}

export interface RunCreateResponse {
  run_id: RunId;
  thread_id: ThreadId;
  status: RunStatus;
}

export interface RunWaitResponse {
  run_id: RunId;
  thread_id: ThreadId;
  status: RunStatus;
  output?: Record<string, unknown>;
  messages?: AgentMessage[];
  error?: string;
}

// ─── Thread Types ───────────────────────────────────────────────────────────

export interface Thread {
  thread_id: ThreadId;
  status: ThreadStatus;
  values?: Record<string, unknown>;
  messages?: AgentMessage[];
  metadata?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface ThreadCreateRequest {
  thread_id?: ThreadId;
  values?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export interface ThreadUpdateRequest {
  values?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export interface ThreadSearchRequest {
  /** Filter by metadata fields */
  metadata?: Record<string, unknown>;
  /** Filter by status */
  status?: ThreadStatus;
  /** Max results */
  limit?: number;
  /** Pagination offset */
  offset?: number;
}

export interface ThreadHistoryEntry {
  revision_id: string;
  thread_id: ThreadId;
  values: Record<string, unknown>;
  messages?: AgentMessage[];
  created_at: string;
  /** Which run created this revision */
  run_id?: RunId;
}

// ─── Store Types (Long-term Memory) ─────────────────────────────────────────

export interface StoreItem {
  namespace: string[];
  key: string;
  value: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface StorePutRequest {
  namespace: string[];
  key: string;
  value: Record<string, unknown>;
}

export interface StoreSearchRequest {
  namespace?: string[];
  /** Text search query */
  query?: string;
  /** Filter by metadata fields */
  filter?: Record<string, unknown>;
  /** Max results */
  limit?: number;
  /** Pagination offset */
  offset?: number;
}

// ─── Agent Introspection ────────────────────────────────────────────────────

export interface AgentInfo {
  agent_id: AgentId;
  name: string;
  description: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

export interface AgentSchema {
  agent_id: AgentId;
  input_schema: Record<string, unknown>;
  output_schema: Record<string, unknown>;
  config_schema?: Record<string, unknown>;
  state_schema?: Record<string, unknown>;
}

// ─── Streaming Types ────────────────────────────────────────────────────────

export type StreamEventType =
  | 'messages'
  | 'updates'
  | 'custom'
  | 'events'
  | 'debug';

export interface StreamEvent {
  event: StreamEventType;
  data: unknown;
  timestamp: string;
  run_id?: RunId;
}

// ─── API Response Envelopes ─────────────────────────────────────────────────

export interface ApiResponse<T> {
  data: T;
  error?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  limit: number;
  offset: number;
}

// ─── Error Types ────────────────────────────────────────────────────────────

export interface AgentProtocolError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export const AGENT_PROTOCOL_ERRORS = {
  AGENT_NOT_FOUND: 'AGENT_NOT_FOUND',
  THREAD_NOT_FOUND: 'THREAD_NOT_FOUND',
  RUN_NOT_FOUND: 'RUN_NOT_FOUND',
  RUN_ALREADY_RUNNING: 'RUN_ALREADY_RUNNING',
  INVALID_INPUT: 'INVALID_INPUT',
  STORE_KEY_NOT_FOUND: 'STORE_KEY_NOT_FOUND',
  RATE_LIMITED: 'RATE_LIMITED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;
