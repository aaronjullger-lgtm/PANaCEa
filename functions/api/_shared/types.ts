/**
 * Cloudflare Workers/Functions Type Definitions
 *
 * Provides comprehensive type safety for Cloudflare edge functions.
 * Import these types instead of using `any` for context and env.
 */

import type { KVNamespace as WorkersKVNamespace } from '@cloudflare/workers-types';

// ============================================================================
// ENVIRONMENT TYPES
// ============================================================================

/**
 * Environment bindings available to all Cloudflare Functions
 * Must match wrangler.toml bindings and Cloudflare Dashboard env vars.
 * Add new environment variables here as the project grows.
 */
export interface CloudflareEnv {
  // Database
  DATABASE_URL?: string;

  // Authentication
  CLERK_SECRET_KEY?: string;
  CLERK_PUBLISHABLE_KEY?: string;

  // AI/ML APIs
  GEMINI_API_KEY?: string;
  GOOGLE_API_KEY?: string;
  OPENAI_API_KEY?: string;
  ANTHROPIC_API_KEY?: string;
  DEEPSEEK_API_KEY?: string;

  // LangSmith Observability
  LANGSMITH_API_KEY?: string;
  LANGSMITH_PROJECT?: string;

  // Supabase (storage, media) — set in Dashboard
  SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;

  // Observability
  SENTRY_DSN?: string;
  ENVIRONMENT?: string;

  // Langfuse (legacy — retained for agent-orchestrator compat, not used by the main app)
  LANGFUSE_PUBLIC_KEY?: string;
  LANGFUSE_SECRET_KEY?: string;
  LANGFUSE_BASE_URL?: string;

  // Optional feature flags
  ENABLE_LOGGING?: string;
  LOG_LEVEL?: string;

  // KV bindings (names must match wrangler.toml [kv_namespaces] binding)
  CACHE?: WorkersKVNamespace;
  RATE_LIMIT_KV?: WorkersKVNamespace;

  // Optional D1 binding (for future use)
  DB?: D1Database;

  // Optional R2 bucket (for media storage)
  MEDIA_BUCKET?: R2Bucket;
}

/**
 * Legacy Env alias for backward compatibility
 * @deprecated Use CloudflareEnv instead
 */
export type Env = CloudflareEnv;

// ============================================================================
// CONTEXT TYPES
// ============================================================================

/**
 * Cloudflare Pages Functions context
 * Use this type for functions in the /functions directory
 */
export interface CloudflareContext<E extends CloudflareEnv = CloudflareEnv> {
  request: Request;
  env: E;
  params: Record<string, string>;
  waitUntil: (promise: Promise<unknown>) => void;
  passThroughOnException: () => void;
  next: (input?: Request | string, init?: RequestInit) => Promise<Response>;
  data: Record<string, unknown>;
}

/**
 * Authenticated context with user information
 * Extends base context after auth middleware runs
 */
export interface AuthenticatedContext<
  E extends CloudflareEnv = CloudflareEnv,
> extends CloudflareContext<E> {
  data: {
    userId: string;
    clerkId: string;
    [key: string]: unknown;
  };
}

// ============================================================================
// REQUEST/RESPONSE TYPES
// ============================================================================

/**
 * Standard API response envelope
 */
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  timestamp?: string;
}

/**
 * Paginated response for list endpoints
 */
export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

/**
 * Error response with optional details
 */
export interface ApiError {
  success: false;
  error: string;
  code?: string;
  details?: Record<string, unknown>;
  timestamp?: string;
}

// ============================================================================
// COMMON REQUEST BODY TYPES
// ============================================================================

/**
 * Performance record sync payload
 */
export interface SyncPerformancePayload {
  performanceRecords?: Array<{
    questionId: string;
    conditionId?: string;
    system: string;
    correct: boolean;
    timestamp: string;
    difficulty?: number;
    timeSpent?: number;
  }>;
  missedQuestions?: string[];
  flaggedQuestions?: string[];
}

/**
 * SRS item update payload
 */
export interface SrsUpdatePayload {
  itemId: string;
  rating: number; // 1-4 (Again, Hard, Good, Easy)
  responseTimeMs?: number;
}

/**
 * Gemini proxy request
 */
export interface GeminiProxyRequest {
  modelName?: string;
  prompt: string;
  temperature?: number;
  maxTokens?: number;
}

/**
 * Content approval/transition payload
 */
export interface ContentTransitionPayload {
  contentId: string;
  newStatus: 'draft' | 'pending_review' | 'approved' | 'published' | 'archived';
  reviewNotes?: string;
}

// ============================================================================
// TYPE GUARDS
// ============================================================================

/**
 * Type guard to check if context is authenticated
 */
export function isAuthenticatedContext(
  context: CloudflareContext
): context is AuthenticatedContext {
  return typeof context.data?.userId === 'string' && context.data.userId.length > 0;
}

/**
 * Type guard for API error response
 */
export function isApiError(response: ApiResponse | ApiError): response is ApiError {
  return response.success === false && 'error' in response;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Create a successful JSON response
 */
export function jsonResponse<T>(data: T, status = 200): Response {
  return new Response(
    JSON.stringify({
      success: true,
      data,
      timestamp: new Date().toISOString(),
    } satisfies ApiResponse<T>),
    {
      status,
      headers: { 'Content-Type': 'application/json' },
    }
  );
}

/**
 * Create an error JSON response
 */
export function errorResponse(
  error: string,
  status = 400,
  details?: Record<string, unknown>
): Response {
  return new Response(
    JSON.stringify({
      success: false,
      error,
      details,
      timestamp: new Date().toISOString(),
    } satisfies ApiError),
    {
      status,
      headers: { 'Content-Type': 'application/json' },
    }
  );
}

/**
 * Parse JSON body with type safety
 */
export async function parseJsonBody<T>(request: Request): Promise<T | null> {
  try {
    return (await request.json()) as T;
  } catch {
    return null;
  }
}

// ============================================================================
// CLOUDFLARE BINDINGS (type stubs for when not using wrangler types)
// ============================================================================

/**
 * KV Namespace binding stub (for backward compatibility)
 * Use WorkersKVNamespace from @cloudflare/workers-types in new code
 * @deprecated Use import { KVNamespace } from '@cloudflare/workers-types' instead
 */
export interface KVNamespace {
  get(
    key: string,
    options?: { type?: 'text' | 'json' | 'arrayBuffer' | 'stream' }
  ): Promise<string | null>;
  put(
    key: string,
    value: string | ReadableStream | ArrayBuffer,
    options?: { expirationTtl?: number }
  ): Promise<void>;
  delete(key: string): Promise<void>;
  list(options?: {
    prefix?: string;
    limit?: number;
    cursor?: string;
  }): Promise<{ keys: { name: string }[]; cursor?: string }>;
}

/**
 * D1 Database binding stub
 * Full types available from @cloudflare/workers-types
 */
export interface D1Database {
  prepare(query: string): D1PreparedStatement;
  batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]>;
  exec(query: string): Promise<D1ExecResult>;
}

interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = unknown>(colName?: string): Promise<T | null>;
  all<T = unknown>(): Promise<D1Result<T>>;
  run(): Promise<D1Result>;
}

interface D1Result<T = unknown> {
  results?: T[];
  success: boolean;
  error?: string;
  meta?: Record<string, unknown>;
}

interface D1ExecResult {
  count: number;
  duration: number;
}

/**
 * R2 Bucket binding stub
 * Full types available from @cloudflare/workers-types
 */
export interface R2Bucket {
  get(key: string): Promise<R2Object | null>;
  put(
    key: string,
    value: ReadableStream | ArrayBuffer | string,
    options?: R2PutOptions
  ): Promise<R2Object>;
  delete(keys: string | string[]): Promise<void>;
  list(options?: R2ListOptions): Promise<R2Objects>;
}

interface R2Object {
  key: string;
  body: ReadableStream;
  bodyUsed: boolean;
  arrayBuffer(): Promise<ArrayBuffer>;
  text(): Promise<string>;
  json<T>(): Promise<T>;
}

interface R2PutOptions {
  httpMetadata?: Record<string, string>;
  customMetadata?: Record<string, string>;
}

interface R2ListOptions {
  prefix?: string;
  limit?: number;
  cursor?: string;
}

interface R2Objects {
  objects: Array<{ key: string; size: number }>;
  truncated: boolean;
  cursor?: string;
}
