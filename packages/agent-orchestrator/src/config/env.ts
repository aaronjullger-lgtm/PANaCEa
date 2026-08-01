/**
 * Typed environment configuration for the agent orchestrator.
 *
 * Loads from (in priority order):
 *   1. process.env (already set by the host / 1Password injection)
 *   2. packages/agent-orchestrator/.env (local dev)
 *   3. repo-root .env (fallback — read-only, never writes)
 *
 * Every access is typed + validated. Missing required vars throw a clear error
 * at startup, not at first agent run.
 *
 * @module packages/agent-orchestrator/src/config/env
 */

import { config as loadDotenv } from 'dotenv';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync, readFileSync } from 'node:fs';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load local orchestrator .env first
const localEnvPath = resolve(__dirname, '../../.env.agents');
if (existsSync(localEnvPath)) loadDotenv({ path: localEnvPath });

// Fallback to repo root .env (read-only — let loadDotenv override nothing already set)
const rootEnvPath = resolve(__dirname, '../../../../.env');
if (existsSync(rootEnvPath)) loadDotenv({ path: rootEnvPath, override: false });

// ─── Env types ────────────────────────────────────────────────────────────

export interface AgentEnv {
  // LLM provider keys (agent model defaults to Gemini since PANaCEa already uses it)
  GEMINI_API_KEY?: string;
  OPENAI_API_KEY?: string;
  ANTHROPIC_API_KEY?: string;
  ANTHROPIC_AUTH_TOKEN?: string;

  // Langfuse (primary tracing — open-source, free cloud tier)
  LANGFUSE_PUBLIC_KEY?: string;
  LANGFUSE_SECRET_KEY?: string;
  LANGFUSE_HOST?: string; // defaults to https://cloud.langfuse.com
  LANGFUSE_BASE_URL?: string; // 1Password alias → LANGFUSE_HOST
  LANGFUSE_MONITOR_WEBHOOK_URL?: string; // Slack/Discord webhook for monitor alerts

  // LangSmith (secondary tracing for LangChain/LangGraph native traces)
  LANGSMITH_API_KEY?: string;
  LANGSMITH_PROJECT?: string;
  LANGSMITH_ENDPOINT?: string;
  LANGSMITH_TRACING?: string;
  LANGCHAIN_API_KEY?: string; // 1Password alias → LANGSMITH_API_KEY
  LANG_PAT?: string; // 1Password alias → LANGSMITH personal access token

  // Qdrant (long-term vector memory)
  QDRANT_URL?: string; // orchestrator name
  QDRANT_ENDPOINT?: string; // 1Password alias → QDRANT_URL
  QDRANT_API_KEY?: string;
  QDRANT_CLUSTER_ID?: string;
  QDRANT_COLLECTION_PREFIX?: string; // defaults to "panacea_agents_"

  // Composio (MCP-style tool aggregator — GitHub, Linear, Sentry, etc. as tools)
  COMPOSIO_API_KEY?: string;
  COMPOSIO_CONNECTED_USER?: string; // stable user-id Composio recognizes for connected-account routing

  // Linear (issue tracking — direct SDK for reliability over Composio)
  LINEAR_API_KEY?: string;
  LINEAR_TEAM_ID?: string;

  // n8n (workflow trigger)
  N8N_API_URL?: string;
  N8N_API_KEY?: string;

  // GitHub (PR triage, file Linear issues from diffs)
  GITHUB_PAT?: string;
  GITHUB_REPO?: string; // owner/repo for StudyPANaCEa

  // Sentry (incident responder)
  SENTRY_AUTH_TOKEN?: string;
  SENTRY_ORG?: string;
  SENTRY_PROJECT?: string;

  // Vercel (dashboard deploy — optional)
  VERCEL_TOKEN?: string; // orchestrator name
  VERCEL_API_KEY?: string; // 1Password alias → VERCEL_TOKEN
  VERCEL_PROJECT_ID?: string;

  // Cloudflare (used by MCP config, not orchestrator directly)
  CLOUDFLARE_API_TOKEN?: string;
  CLOUDFLARE_ACCOUNT_ID?: string;
  CLOUDFLARE_GLOBAL_API_TOKEN?: string;

  // Orchestrator runtime
  ORCHESTRATOR_PORT?: string; // defaults to 4100
  ORCHESTRATOR_MODEL?: string; // defaults to gemini-2.5-flash
  ORCHESTRATOR_ENV?: string; // development | staging | production
  ORCHESTRATOR_API_TOKEN?: string; // Bearer token for the HTTP API (optional)
  ORCHESTRATOR_CHECKPOINT?: string; // "off" to disable SQLite resume; default on
}

// ─── Loader ────────────────────────────────────────────────────────────────

const env = process.env as unknown as AgentEnv;

export function getEnv(): AgentEnv {
  return env;
}

export function requireEnv(key: keyof AgentEnv): string {
  const value = env[key];
  if (!value || value.trim() === '') {
    throw new Error(
      `[agent-orchestrator] Missing required env var: ${String(key)}. ` +
        `Set it in .env.agents or your 1Password PANaCEa Environment. ` +
        `See packages/agent-orchestrator/.env.agents.example for the full list.`,
    );
  }
  return value;
}

export function optionalEnv(key: keyof AgentEnv, fallback: string): string {
  const value = env[key];
  return value && value.trim() !== '' ? value : fallback;
}

/** Alias-aware Langfuse base URL (LANGFUSE_HOST or LANGFUSE_BASE_URL). */
export function getLangfuseHost(): string | undefined {
  return env.LANGFUSE_HOST ?? env.LANGFUSE_BASE_URL;
}

/** Alias-aware Qdrant URL (QDRANT_URL or QDRANT_ENDPOINT). */
export function getQdrantUrl(): string | undefined {
  return env.QDRANT_URL ?? env.QDRANT_ENDPOINT;
}

/** Alias-aware Vercel token (VERCEL_TOKEN or VERCEL_API_KEY). */
export function getVercelToken(): string | undefined {
  return env.VERCEL_TOKEN ?? env.VERCEL_API_KEY;
}

/** Alias-aware LangSmith API key (LANGSMITH_API_KEY or LANGCHAIN_API_KEY). */
export function getLangsmithKey(): string | undefined {
  return env.LANGSMITH_API_KEY ?? env.LANGCHAIN_API_KEY;
}

/** Alias-aware Anthropic key (ANTHROPIC_API_KEY or ANTHROPIC_AUTH_TOKEN). */
export function getAnthropicKey(): string | undefined {
  return env.ANTHROPIC_API_KEY ?? env.ANTHROPIC_AUTH_TOKEN;
}

// ─── Capability flags ──────────────────────────────────────────────────────

/** Which capabilities are actually configured (drives graceful degradation). */
export function getCapabilities() {
  return {
    langfuse: !!(env.LANGFUSE_PUBLIC_KEY && env.LANGFUSE_SECRET_KEY && getLangfuseHost()),
    langsmith: !!getLangsmithKey(),
    qdrant: !!getQdrantUrl(),
    composio: !!env.COMPOSIO_API_KEY,
    linear: !!env.LINEAR_API_KEY,
    n8n: !!(env.N8N_API_URL && env.N8N_API_KEY),
    github: !!env.GITHUB_PAT,
    sentry: !!(env.SENTRY_AUTH_TOKEN && env.SENTRY_ORG),
    vercel: !!getVercelToken(),
  };
}

/** True if the minimal set to run any agent (one LLM key) is present. */
export function canRunAgents(): boolean {
  return !!(env.GEMINI_API_KEY || env.OPENAI_API_KEY || env.ANTHROPIC_API_KEY);
}

/** Human-readable status report for the /health endpoint and CLI --smoke. */
export function envStatus(): Record<string, boolean | string> {
  const caps = getCapabilities();
  const llm = env.GEMINI_API_KEY
    ? 'gemini'
    : env.OPENAI_API_KEY
      ? 'openai'
      : env.ANTHROPIC_API_KEY
        ? 'anthropic'
        : 'none';
  return {
    llm,
    model: optionalEnv('ORCHESTRATOR_MODEL', 'gemini-2.5-flash'),
    environment: optionalEnv('ORCHESTRATOR_ENV', 'development'),
    ...caps,
    runnable: canRunAgents(),
  };
}

// Re-export for tests
export { readFileSync };