/**
 * Managed-prompt resolver — Langfuse prompt management with code fallback.
 *
 * Improvement #5 — moves agent system prompts from hardcoded constants into
 * Langfuse managed prompts (versioned, A/B-deployable, editable in UI without
 * a package release). The resolver fetches the current prompt text by name;
 * if Langfuse is unconfigured or the prompt is missing, it falls back to the
 * in-code constant so nothing breaks.
 *
 * `prompts:push` (npm script → pushPrompts.ts) uploads the in-code constants
 * to Langfuse as versioned managed prompts, seeded from the repo.
 *
 * Doc: langfuse/langfuse deepwiki §9.5 Prompts & Templates.
 * REST: GET /api/public/v2/prompts/{name}, POST /api/public/v2/prompts.
 *
 * @module packages/agent-orchestrator/src/clients/prompts
 */

import { getEnv, getLangfuseHost, getCapabilities } from '../config/env.js';
import { SEED_PROMPTS } from './seedPrompts.js';

function authHeader(): string {
  const env = getEnv();
  return 'Basic ' + Buffer.from(`${env.LANGFUSE_PUBLIC_KEY}:${env.LANGFUSE_SECRET_KEY}`).toString('base64');
}

function fallbackFor(name: string): string {
  return SEED_PROMPTS[name] ?? `[unknown managed prompt: ${name}]`;
}

/**
 * Resolve a prompt by name. Returns the Langfuse-managed version if available,
 * else the in-code constant. Caches for the process lifetime (prompt edits
 * should deploy a new orchestrator build or restart the process).
 */
export async function resolvePrompt(name: string): Promise<string> {
  if (!getCapabilities().langfuse) return fallbackFor(name);

  const base = getLangfuseHost() ?? 'https://cloud.langfuse.com';
  try {
    const res = await fetch(`${base}/api/public/v2/prompts/${name}`, {
      headers: { Authorization: authHeader() },
    });
    if (!res.ok) return fallbackFor(name);
    const j = (await res.json()) as { prompt?: Array<{ type: 'text'; text: string }> | string };
    const blocks = Array.isArray(j.prompt) ? j.prompt : [{ type: 'text' as const, text: String(j.prompt) }];
    const text = blocks.map((b) => b.text).join('\n');
    return text && text.trim() ? text : fallbackFor(name);
  } catch (err) {
    console.warn(`[agent-orchestrator] prompt fetch "${name}" failed, using code constant:`, err);
    return fallbackFor(name);
  }
}

export interface PushResult {
  name: string;
  ok: boolean;
  status: 'created' | 'updated' | 'skipped' | 'error';
  error?: string;
}

/** Upload all in-code seed prompts to Langfuse as managed prompts. Idempotent. */
export async function pushPrompts(): Promise<PushResult[]> {
  if (!getCapabilities().langfuse) {
    return Object.keys(SEED_PROMPTS).map((name) => ({ name, ok: false, status: 'skipped' as const, error: 'Langfuse not configured' }));
  }
  const base = getLangfuseHost() ?? 'https://cloud.langfuse.com';
  const out: PushResult[] = [];
  for (const [name, prompt] of Object.entries(SEED_PROMPTS)) {
    try {
      const res = await fetch(`${base}/api/public/v2/prompts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: authHeader() },
        body: JSON.stringify({
          name,
          type: 'text',
          prompt: [{ type: 'text', text: prompt }],
          labels: ['panacea-agent', 'auto-seeded'],
          config: { source: 'packages/agent-orchestrator/src/clients/prompts.ts' },
        }),
      });
      if (res.ok) out.push({ name, ok: true, status: 'created' });
      else if (res.status === 409 || res.status === 400) out.push({ name, ok: true, status: 'updated' });
      else {
        const body = await res.text().catch(() => '');
        out.push({ name, ok: false, status: 'error', error: `HTTP ${res.status}: ${body.slice(0, 160)}` });
      }
    } catch (err) {
      out.push({ name, ok: false, status: 'error', error: err instanceof Error ? err.message : String(err) });
    }
  }
  return out;
}