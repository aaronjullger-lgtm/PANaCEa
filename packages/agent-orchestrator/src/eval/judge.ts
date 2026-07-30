/**
 * LLM-as-judge eval pipeline — scores stored Langfuse traces.
 *
 * Improvement #1 — converts "we have traces" into "we have evidence of agent
 * output quality". Pulls recent traces tagged with a given agent role, runs an
 * LLM judge against the final assistant output using a role-specific rubric,
 * and posts a `correctness` score (0-1) + a `severity_appropriateness` score
 * back to the trace via the Langfuse score API.
 *
 * Run: `npm run eval:judge` (defaults to last 24h across all roles) or
 *      `npm run eval:judge -- incident-responder` (single role, last 7d).
 *
 * Cost guardrail: one judge LLM call per trace. Bounded by the trace window.
 *
 * Doc: langfuse/langfuse deepwiki §10 Evaluation System + §9.4 Datasets.
 * REST: GET /api/public/traces, POST /api/public/scores.
 *
 * @module packages/agent-orchestrator/src/eval/judge
 */

import { getEnv, getLangfuseHost, getCapabilities } from '../config/env.js';
import { getLLM } from '../clients/llm.js';

interface LangfuseTrace {
  id: string;
  name: string;
  tags?: string[];
  input?: unknown;
  output?: unknown;
  userId?: string;
  timestamp: string;
}

const RUBRICS: Record<string, string> = {
  'content-audit':
    'Score whether the agent filed actionable Linear issues for real findings (not noise), ' +
    'de-duplicated against existing issues, and correctly prioritized incorrect clinical content as urgent. ' +
    '0 = filed nothing useful / wrong priorities; 0.5 = partial; 1 = correct triage + filing.',
  'pr-triage':
    'Score whether the agent correctly applied PANaCEa hard rules (no Node APIs in functions/, no Prisma in ' +
    'client, no static JSON >5 items, no Hard/Easy FSRS) and chose the right review verdict. ' +
    '0 = missed violations or wrong verdict; 0.5 = partial; 1 = caught real issues + correct approve/comment/block.',
  'incident-responder':
    'Score severity assignment (P0/P1/P2 mapping) and de-duplication against existing Linear issues. ' +
    '0 = wrong severity or duplicates filed; 0.5 = partial; 1 = correct severity + no dupes + cited Sentry URL.',
  'content-enrichment':
    'Score whether candidates are structured JSON with a source citation and confidence gating. ' +
    '0 = no structure / no citation / asserted medical claim; 0.5 = partial; 1 = well-structured + sourced + gated.',
  'weekly-report':
    'Score completeness: agent activity counts, open issues by priority, top Sentry trends, recommendations. ' +
    '0 = missing sections; 0.5 = partial; 1 = all sections present + recommendations actionable.',
};

function authHeader(): string {
  const env = getEnv();
  return 'Basic ' + Buffer.from(`${env.LANGFUSE_PUBLIC_KEY}:${env.LANGFUSE_SECRET_KEY}`).toString('base64');
}

async function listTraces(tags: string[], since: string, limit = 50): Promise<LangfuseTrace[]> {
  const base = getLangfuseHost() ?? 'https://cloud.langfuse.com';
  const url = new URL(`${base}/api/public/traces`);
  url.searchParams.set('limit', String(limit));
  url.searchParams.set('fromTimestamp', since);
  for (const t of tags) url.searchParams.append('tags', t);
  const res = await fetch(url, { headers: { Authorization: authHeader() } });
  if (!res.ok) {
    throw new Error(`Langfuse traces list HTTP ${res.status}`);
  }
  const j = (await res.json()) as { data?: LangfuseTrace[] } | LangfuseTrace[];
  return Array.isArray(j) ? j : (j.data ?? []);
}

async function postScore(traceId: string, name: string, value: number, comment: string): Promise<void> {
  const base = getLangfuseHost() ?? 'https://cloud.langfuse.com';
  const env = getEnv();
  const res = await fetch(`${base}/api/public/scores`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: authHeader() },
    body: JSON.stringify({
      traceId,
      name,
      value,
      comment,
      dataType: 'NUMERIC',
      ...(env.LANGSMITH_PROJECT ? {} : {}),
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    console.warn(`[eval] score post failed for ${traceId}/${name}: HTTP ${res.status} ${body.slice(0, 120)}`);
  }
}

async function judgeTrace(trace: LangfuseTrace, role: string): Promise<{ correctness: number; severity: number; comment: string }> {
  const rubric = RUBRICS[role] ?? RUBRICS['content-audit'];
  const output = typeof trace.output === 'string' ? trace.output : JSON.stringify(trace.output ?? '');
  const input = typeof trace.input === 'string' ? trace.input : JSON.stringify(trace.input ?? '');

  const llm = await getLLM();
  const { HumanMessage } = await import('@langchain/core/messages');
  const prompt = `You are an evaluator. Score this ${role} agent run on a 0-1 scale.

Rubric: ${rubric}

=== INPUT ===
${input.slice(0, 4000)}

=== OUTPUT ===
${output.slice(0, 4000)}

Reply with STRICT JSON only: {"correctness": <0..1>, "severity": <0..1>, "comment": "<one sentence>"}`;

  try {
    const res = await llm.invoke([new HumanMessage(prompt)]);
    const text = typeof res.content === 'string' ? res.content : JSON.stringify(res.content);
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return { correctness: 0.5, severity: 0.5, comment: 'judge returned no JSON' };
    const parsed = JSON.parse(match[0]) as { correctness?: number; severity?: number; comment?: string };
    return {
      correctness: clamp(parsed.correctness),
      severity: clamp(parsed.severity),
      comment: (parsed.comment ?? '').slice(0, 300),
    };
  } catch (err) {
    return { correctness: 0.5, severity: 0.5, comment: `judge error: ${err instanceof Error ? err.message : String(err)}`.slice(0, 300) };
  }
}

function clamp(n: unknown): number {
  const v = typeof n === 'number' ? n : Number(n);
  if (!Number.isFinite(v)) return 0.5;
  return Math.max(0, Math.min(1, v));
}

export interface JudgeRunResult {
  role: string;
  traced: number;
  judged: number;
  scoresPosted: number;
}

export async function runJudge(roleFilter?: string, hours = 24): Promise<JudgeRunResult[]> {
  const caps = getCapabilities();
  if (!caps.langfuse) {
    console.warn('[eval] Langfuse not configured — cannot fetch traces. Skipping.');
    return [];
  }
  const since = new Date(Date.now() - hours * 3600_000).toISOString();
  const roles = roleFilter ? [roleFilter] : Object.keys(RUBRICS);
  const out: JudgeRunResult[] = [];

  for (const role of roles) {
    console.log(`[eval] judging ${role} traces since ${since}…`);
    const traces = await listTraces([role, 'panacea'], since);
    let scoresPosted = 0;
    for (const t of traces) {
      const { correctness, severity, comment } = await judgeTrace(t, role);
      await postScore(t.id, 'correctness', correctness, comment);
      await postScore(t.id, 'severity_appropriateness', severity, comment);
      scoresPosted += 2;
    }
    out.push({ role, traced: traces.length, judged: traces.length, scoresPosted });
    console.log(`[eval]   ${role}: ${traces.length} judged, ${scoresPosted} scores posted`);
  }
  return out;
}