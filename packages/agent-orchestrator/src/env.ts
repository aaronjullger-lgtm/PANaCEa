/**
 * Typed environment access for the agent-orchestrator package.
 *
 * Loads `.env.agents` (next to this package) then falls back to process.env.
 * Failures are surfaced explicitly via `assertEnv()` so a missing key never
 * silently disables tracing or memory — it shows up in the agent's run log.
 *
 * @module packages/agent-orchestrator/src/env
 */
import { config as loadDotenv } from "dotenv";
import { resolve } from "node:path";

// Load .env.agents first (package-local), then let existing process.env win.
loadDotenv({ path: resolve(process.cwd(), ".env.agents") });

export type EnvSource = "process" | "missing";

export interface AgentEnv {
  // ── LLM providers ───────────────────────────────────────────────────
  GEMINI_API_KEY?: string;
  ANTHROPIC_API_KEY?: string;
  OPENAI_API_KEY?: string;
  ZHIPU_API_KEY?: string;
  /** Default provider: "gemini" | "anthropic" | "openai" | "zhipu" */
  AGENT_DEFAULT_PROVIDER: string;
  /** Default model id under the chosen provider */
  AGENT_DEFAULT_MODEL: string;

  // ── Tracing (Langfuse + LangSmith) ───────────────────────────────────
  LANGFUSE_PUBLIC_KEY?: string;
  LANGFUSE_SECRET_KEY?: string;
  LANGFUSE_BASE_URL?: string;
  LANGFUSE_HOST?: string;
  LANGSMITH_API_KEY?: string;
  LANGSMITH_PERSONAL_ACCESS_TOKEN?: string;
  LANGSMITH_TRACING?: string;
  LANGSMITH_PROJECT?: string;
  LANGSMITH_ENDPOINT?: string;

  // ── Qdrant (long-term vector memory) ────────────────────────────────
  QDRANT_URL?: string;
  QDRANT_API_KEY?: string;
  /** Embedding provider: "openai" | "google" */
  AGENT_EMBEDDING_PROVIDER?: string;

  // ── Composio (curated tool actions) ─────────────────────────────────
  COMPOSIO_API_KEY?: string;

  // ── Linear (issue triage + audit filing) ────────────────────────────
  LINEAR_API_KEY?: string;
  LINEAR_ACCESS_TOKEN?: string;
  LINEAR_DEFAULT_TEAM_ID?: string;

  // ── n8n (workflow trigger tools) ───────────────────────────────────
  N8N_API_URL?: string;
  N8N_API_KEY?: string;

  // ── Vercel (dashboard deploy / project metadata) ────────────────────
  VERCEL_TOKEN?: string;
  VERCEL_PROJECT_ID?: string;

  // ── GitHub (PR triage bot posting comments) ─────────────────────────
  GITHUB_TOKEN?: string;
  GITHUB_PAT?: string;

  // ── Sentry (incident responder) ─────────────────────────────────────
  SENTRY_AUTH_TOKEN?: string;
  SENTRY_ORG?: string;

  // ── Clerk (reuse PANaCEa auth for dashboard gating) ────────────────
  CLERK_SECRET_KEY?: string;
  CLERK_JWT_ISSUER?: string;

  // ── PANaCEa host repo (so tools can run automation scripts) ─────────
  PANACEA_REPO_ROOT?: string;
}

const raw = process.env as Record<string, string | undefined>;

function get(key: string): string | undefined {
  const v = raw[key];
  return v && v.length > 0 ? v : undefined;
}

export function readEnv(): AgentEnv {
  return {
    GEMINI_API_KEY: get("GEMINI_API_KEY"),
    ANTHROPIC_API_KEY: get("ANTHROPIC_API_KEY"),
    OPENAI_API_KEY: get("OPENAI_API_KEY"),
    ZHIPU_API_KEY: get("ZHIPU_API_KEY"),
    AGENT_DEFAULT_PROVIDER: get("AGENT_DEFAULT_PROVIDER") ?? "gemini",
    AGENT_DEFAULT_MODEL:
      get("AGENT_DEFAULT_MODEL") ?? "gemini-2.0-flash",
    LANGFUSE_PUBLIC_KEY: get("LANGFUSE_PUBLIC_KEY"),
    LANGFUSE_SECRET_KEY: get("LANGFUSE_SECRET_KEY"),
    LANGFUSE_BASE_URL: get("LANGFUSE_BASE_URL"),
    LANGFUSE_HOST: get("LANGFUSE_HOST") ?? get("LANGFUSE_BASE_URL"),
    LANGSMITH_API_KEY: get("LANGSMITH_API_KEY"),
    LANGSMITH_PERSONAL_ACCESS_TOKEN: get("LANGSMITH_PERSONAL_ACCESS_TOKEN"),
    LANGSMITH_TRACING: get("LANGSMITH_TRACING"),
    LANGSMITH_PROJECT: get("LANGSMITH_PROJECT") ?? "panacea-agents",
    LANGSMITH_ENDPOINT: get("LANGSMITH_ENDPOINT"),
    QDRANT_URL: get("QDRANT_URL"),
    QDRANT_API_KEY: get("QDRANT_API_KEY"),
    AGENT_EMBEDDING_PROVIDER: get("AGENT_EMBEDDING_PROVIDER") ?? "google",
    COMPOSIO_API_KEY: get("COMPOSIO_API_KEY"),
    LINEAR_API_KEY: get("LINEAR_API_KEY") ?? get("LINEAR_ACCESS_TOKEN"),
    LINEAR_ACCESS_TOKEN: get("LINEAR_ACCESS_TOKEN") ?? get("LINEAR_API_KEY"),
    LINEAR_DEFAULT_TEAM_ID: get("LINEAR_DEFAULT_TEAM_ID"),
    N8N_API_URL: get("N8N_API_URL"),
    N8N_API_KEY: get("N8N_API_KEY"),
    VERCEL_TOKEN: get("VERCEL_TOKEN"),
    VERCEL_PROJECT_ID: get("VERCEL_PROJECT_ID"),
    GITHUB_TOKEN: get("GITHUB_TOKEN") ?? get("GITHUB_PAT"),
    GITHUB_PAT: get("GITHUB_PAT"),
    SENTRY_AUTH_TOKEN: get("SENTRY_AUTH_TOKEN"),
    SENTRY_ORG: get("SENTRY_ORG"),
    CLERK_SECRET_KEY: get("CLERK_SECRET_KEY"),
    CLERK_JWT_ISSUER: get("CLERK_JWT_ISSUER"),
    PANACEA_REPO_ROOT: get("PANACEA_REPO_ROOT") ?? resolve(process.cwd()),
  };
}

export interface EnvCheck {
  key: keyof AgentEnv;
  requiredFor: string;
}

/**
 * Assert that required env keys for a given capability are present.
 * Returns the missing keys (does not throw — caller decides how loud to be).
 */
export function missingKeys(checks: EnvCheck[]): string[] {
  const env = readEnv();
  return checks
    .filter((c) => !env[c.key])
    .map((c) => `${c.key} (required for ${c.requiredFor})`);
}