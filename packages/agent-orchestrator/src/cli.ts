/**
 * CLI entrypoint — `npm run run <role> [args]` or `tsx src/cli.ts <role> ...`.
 *
 * Supported invocations:
 *   cli content-audit                # default/mock input
 *   cli content-audit --file path.json
 *   cli pr-triage 1234
 *   cli pr-triage 1234 1236            # multiple PRs
 *   cli incident-responder "is:unresolved level:error"
 *   cli content-enrichment "Atrial fibrillation + 2023 ACC/AHA guideline"
 *   cli weekly-report                 # current week
 *   cli weekly-report 2025-W30
 *   cli --smoke                       # run content-audit with mock data, no live calls expected
 *   cli --ensure-collections          # create Qdrant collections if missing
 *   cli --health                      # print env status + capabilities + exit
 *
 * Records each run to Qdrant memory and flushes tracing before exit.
 *
 * @module packages/agent-orchestrator/src/cli
 */

import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

import { AGENT_REGISTRY, ALL_ROLES, describeAgents } from './agents/registry.js';
import { finalResponse } from './orchestrator/factory.js';
import { envStatus, canRunAgents } from './config/env.js';
import { ensureAllCollections, remember } from './clients/qdrant.js';
import { shutdownTracing } from './clients/tracing.js';

function usage(): void {
  console.log(`\n@panacea/agent-orchestrator

Usage:
  npm run run <role> [args...]
  npm run run:content-audit [--file path.json]
  npm run run:pr-triage <pr-number>...
  npm run run:incident-responder [sentry-query]
  npm run run:content-enrichment "brief text"
  npm run run:weekly-report [ISO-week]
  npm run smoke [--ensure-collections] [--health]

Roles:
${describeAgents().map((a) => `  ${a.role.padEnd(22)} ${a.name} — ${a.description}`).join('\n')}

Flags:
  --smoke                run content-audit with mock input (no real audit file needed)
  --ensure-collections   ensure Qdrant memory collections exist, then exit
  --health               print env status + capability flags, then exit
  -h | --help            this help
`);
}

function mockContentAuditPayload(): string {
  return JSON.stringify({
    runAt: new Date().toISOString(),
    findings: [
      { id: 'AUD-001', conditionId: 'cond_atrial_fibrillation', metric: 'missing_first_line', severity: 'high', detail: 'No firstLine field on AFib condition.' },
      { id: 'AUD-002', conditionId: 'cond_pulmonary_embolism', metric: 'ddx_coverage', severity: 'low', detail: 'Differential diagnosis has only 3 of NCCPA-required 6 PE DDx.' },
    ],
    summary: { passed: 2188, failed: 2, skipped: 5 },
  });
}

async function main(): Promise<void> {
  const [, , ...argv] = process.argv;
  const flags = argv.filter((a) => a.startsWith('--'));
  const positional = argv.filter((a) => !a.startsWith('--'));

  if (flags.includes('--help') || flags.includes('-h') || positional.length === 0 && flags.length === 0) {
    usage();
    return;
  }

  if (flags.includes('--health')) {
    console.log(JSON.stringify(envStatus(), null, 2));
    return;
  }

  if (flags.includes('--ensure-collections')) {
    console.log('[agent-orchestrator] Ensuring Qdrant collections…');
    await ensureAllCollections();
    console.log('[agent-orchestrator] Collections ensured.');
    return;
  }

  if (flags.includes('--inspect')) {
    const { inspectCollections } = await import('./clients/qdrant.js');
    const info = await inspectCollections();
    console.log(JSON.stringify(info, null, 2));
    return;
  }

  if (flags.includes('--monitors')) {
    const { provisionMonitors, describeMonitors } = await import('./config/monitors.js');
    console.log('[agent-orchestrator] Provisioning Langfuse monitors…');
    console.log(describeMonitors().map((m) => `  - ${m.name}: ${m.description}`).join('\n'));
    const results = await provisionMonitors();
    for (const r of results) {
      console.log(`  ${r.ok ? '✓' : '✗'} ${r.name}: ${r.status}${r.error ? ` — ${r.error}` : ''}`);
    }
    return;
  }

  // --smoke defaults to content-audit with mock input.
  const smoke = flags.includes('--smoke');
  const role = smoke ? 'content-audit' : (positional[0] as keyof typeof AGENT_REGISTRY);

  if (!role || !(role in AGENT_REGISTRY)) {
    console.error(`Unknown role "${String(role)}". Available: ${ALL_ROLES.join(', ')}`);
    usage();
    process.exit(1);
  }

  if (!canRunAgents()) {
    console.error('[agent-orchestrator] No LLM provider configured. Set GEMINI_API_KEY / OPENAI_API_KEY / ANTHROPIC_API_KEY.');
    process.exit(1);
  }

  // Build the user prompt for the chosen role.
  const args = smoke ? [] : positional.slice(1);
  const userPrompt = buildPrompt(role, args, smoke);
  const def = AGENT_REGISTRY[role];

  console.log(`[agent-orchestrator] Running agent "${def.name}" (${role})…`);
  if (smoke) console.log('[agent-orchestrator] SMOKE mode — mock input, tracing + memory active but no external write commitments.\n');

  const startedAt = new Date().toISOString();
  const runId = `run_${role}_${Date.now()}`;

  try {
    const agent = await def.build({});
    const { messages } = await agent.invoke({
      messages: [{ role: 'user', content: userPrompt }],
      threadId: runId,
    });
    const output = finalResponse(messages);

    console.log('\n──────── Agent output ────────');
    console.log(output);
    console.log('──────────────────────────────\n');

    // Persist run to long-term memory so recall works across runs.
    await remember(
      'runs',
      runId,
      `${role} ${startedAt}: ${output.slice(0, 500)}`,
      { role, startedAt, finishedAt: new Date().toISOString(), outputPreview: output.slice(0, 2000) },
    );
  } catch (err) {
    console.error(`[agent-orchestrator] Agent "${role}" failed:`, err);
    await remember(
      'runs',
      runId,
      `${role} ${startedAt} FAILED: ${err instanceof Error ? err.message : String(err)}`,
      { role, startedAt, error: err instanceof Error ? err.message : String(err) },
    );
    process.exitCode = 1;
  } finally {
    await shutdownTracing();
  }
}

function buildPrompt(role: keyof typeof AGENT_REGISTRY, args: string[], smoke: boolean): string {
  switch (role) {
    case 'content-audit': {
      if (smoke) {
        return `Run a content audit pass. Here is the daily audit summary (mock):\n\n${mockContentAuditPayload()}\n\nDecide which findings require Linear issues, file them, and summarize.`;
      }
      const fileIdx = args.indexOf('--file');
      const file = fileIdx >= 0 ? args[fileIdx + 1] : undefined;
      if (file) {
        const { readFileSync } = require('node:fs');
        try {
          const text = readFileSync(file, 'utf-8');
          return `Run a content audit pass. Here is the audit summary:\n\n${text}\n\nDecide which findings require Linear issues, file them, and summarize.`;
        } catch (err) {
          throw new Error(`Could not read audit file "${file}":` + (err instanceof Error ? err.message : String(err)));
        }
      }
      return `Run a content audit pass with no provided summary file. Use recall_memory to inspect the latest known audit run from memory; if none, state that and recommend the operator run \`npm run automation:daily:content-audit\` first.`;
    }
    case 'pr-triage': {
      const prs = args.map((a) => parseInt(a, 10)).filter((n) => Number.isFinite(n) && n > 0);
      if (prs.length === 0) return `Triage the most recent open PR. Use get_pr_info. If GITHUB_REPO not configured, state so and stop.`;
      return `Triage the following GitHub PR(s) in StudyPANaCEa. Use get_pr_info for each, then post_pr_review (COMMENT default) and (if needed) file a Linear issue:\n\nPRs: ${prs.join(', ')}`;
    }
    case 'incident-responder': {
      const query = args.join(' ').trim() || 'is:unresolved';
      return `Triage recent Sentry issues. Use list_sentry_issues with query "${query}". File Linear issues for P0-P2, add comments for duplicates, optionally trigger the n8n on-call workflow for any P0. Summarize by severity.`;
    }
    case 'content-enrichment': {
      const brief = args.join(' ').trim();
      if (!brief) return `No brief provided. Ask the operator for a condition name + source URL, then stop. Do not guess.`;
      return `Propose enrichment candidates for: "${brief}". Use recall_memory for prior enrichment decisions on the condition; quote the source; confidence < 0.8 files a Linear issue. Output JSON candidates per the rules.`;
    }
    case 'weekly-report': {
      const week = args[0] ?? `Current ISO week (${getISOWeek(new Date())})`;
      return `Produce the weekly digest for ${week}. Recall agent runs and decisions from memory, count open Linear issues by priority, list top Sentry trends, write recommendations, and remember the digest. Output markdown per the template.`;
    }
    default:
      return 'Run.';
  }
}

function getISOWeek(date: Date): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - dayNum + 3);
  const firstThursday = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  const week = 1 + Math.round((d.getTime() - firstThursday.getTime()) / (7 * 24 * 3600 * 1000));
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

main().catch((err) => {
  console.error('[agent-orchestrator] Unhandled error:', err);
  process.exit(1);
});