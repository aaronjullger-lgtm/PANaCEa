/**
 * LangGraph tool wrappers around the orchestrator's integration clients.
 *
 * Every tool is a `tool()` from `@langchain/core/tools` with a Zod schema, so
 * LangGraph's ToolNode can bind them to the LLM and validate args.
 *
 * Importantly: these tools are the *only* way agents touch external systems.
 * The agent LLM never gets a raw API key; it gets a typed tool surface.
 *
 * @module packages/agent-orchestrator/src/tools
 */

import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import * as composio from '../clients/composio.js';
import * as linear from '../clients/linear.js';
import * as github from '../clients/github.js';
import * as sentry from '../clients/sentry.js';
import * as n8n from '../clients/integrations.js';
import { remember, recall, recallHybrid } from '../clients/qdrant.js';
import { getCapabilities } from '../config/env.js';

// ─── Memory tools (Qdrant) ──────────────────────────────────────────────────

export const recallMemoryTool = tool(
  async ({ query, collection, limit }) => {
    const caps = getCapabilities();
    if (!caps.qdrant) return 'Memory disabled: QDRANT_URL not configured.';
    const col = collection ?? 'decisions';
    // decisions is the only collection with a sparse BM25 index; hybrid RRF
    // gives exact clinical-term matches priority over pure semantic similarity.
    const results = col === 'decisions' ? await recallHybrid(col, query, limit) : await recall(col, query, limit);
    if (results.length === 0) return 'No prior memories matched.';
    return results
      .map((r, i) => `[${i + 1}] score=${r.score.toFixed(3)} — ${JSON.stringify(r.payload)}`)
      .join('\n');
  },
  {
    name: 'recall_memory',
    description:
      'Search long-term agent memory (Qdrant) for prior decisions, run summaries, or ingested context. Use before re-deciding something the agent may have already handled.',
    schema: z.object({
      query: z.string().describe('Natural-language query to embed and search.'),
      collection: z.enum(['runs', 'decisions', 'context']).optional().describe('Which memory collection to search. Defaults to decisions.'),
      limit: z.number().int().min(1).max(20).default(5),
    }),
  },
);

export const rememberDecisionTool = tool(
  async ({ summary, payload }) => {
    const caps = getCapabilities();
    if (!caps.qdrant) return 'Memory disabled: decision not persisted.';
    const id = `dec_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    await remember(
      'decisions',
      id,
      summary,
      { kind: 'decision', ...JSON.parse(payload ?? '{}') },
    );
    return `Decision remembered with id ${id}.`;
  },
  {
    name: 'remember_decision',
    description: 'Persist a structured decision or action item to long-term memory so future runs can recall it.',
    schema: z.object({
      summary: z.string().describe('One-line summary of the decision (this is embedded for search).'),
      payload: z.string().describe('JSON object with full decision context, tags, severity, etc.'),
    }),
  },
);

// ─── Linear tools ────────────────────────────────────────────────────────────

export const createLinearIssueTool = tool(
  async ({ title, description, priority, teamId }) => {
    const issue = await composio.createLinearIssue({ title, description, priority, teamId });
    return issue ? `Created Linear issue ${issue.identifier}: ${issue.url}` : 'Failed to create Linear issue (check orchestrator logs).';
  },
  {
    name: 'create_linear_issue',
    description: 'File a new Linear issue in the StudyPANaCEa team. Use for surfaced bugs, content gaps, or action items that need human follow-up.',
    schema: z.object({
      title: z.string().min(5).describe('Issue title (clear and specific).'),
      description: z.string().optional().describe('Markdown description with evidence, reproduction, and suggested fix.'),
      priority: z.number().int().min(0).max(4).optional().describe('0=urgent,1=high,2=medium,3=low,4=lowest. Default medium.'),
      teamId: z.string().optional().describe('Linear team ID. Defaults to LINEAR_TEAM_ID env var.'),
    }),
  },
);

export const searchLinearIssuesTool = tool(
  async ({ query, limit }) => {
    const issues = await composio.searchLinearIssues(query, limit);
    if (issues.length === 0) return 'No matching Linear issues found.';
    return issues.map((i) => `${i.identifier}: ${i.title} — ${i.url}`).join('\n');
  },
  {
    name: 'search_linear_issues',
    description: 'Search existing Linear issues to de-duplicate before filing a new one.',
    schema: z.object({
      query: z.string().describe('Search query matched against title and description.'),
      limit: z.number().int().min(1).max(50).default(10),
    }),
  },
);

// ─── GitHub tools ───────────────────────────────────────────────────────────

export const getPRInfoTool = tool(
  async ({ prNumber }) => {
    const pr = await github.getPR(prNumber);
    if (!pr) return 'Could not load PR (GITHUB_PAT/GITHUB_REPO not configured or PR not found).';
    const files = await github.getPRFiles(prNumber);
    const summary = `PR #${pr.number}: ${pr.title}\nAuthor: ${pr.user}\nBranch: ${pr.head} → ${pr.base}\nURL: ${pr.url}\n\nChanged files (${files.length}):\n${files
      .map((f) => `- ${f.status}: ${f.filename} (+${f.additions}/-${f.deletions})`)
      .join('\n')}`;
    const patches = files
      .filter((f) => f.patch && f.patch.length < 4000)
      .map((f) => `\n\n@@ ${f.filename} @@\n${f.patch}`)
      .join('');
    return summary + patches;
  },
  {
    name: 'get_pr_info',
    description: 'Pull a GitHub PR’s metadata + per-file diffs for the agent to analyze.',
    schema: z.object({
      prNumber: z.number().int().positive().describe('PR number to inspect.'),
    }),
  },
);

export const postPRReviewTool = tool(
  async ({ prNumber, body, event }) => {
    const ok = await github.postPRReview(prNumber, body, event);
    return ok ? `Review posted on PR #${prNumber}.` : `Failed to post review on PR #${prNumber}.`;
  },
  {
    name: 'post_pr_review',
    description: 'Post a review comment (COMMENT/APPROVE/REQUEST_CHANGES) on a GitHub PR with the agent’s analysis.',
    schema: z.object({
      prNumber: z.number().int().positive(),
      body: z.string().describe('The review body — markdown analysis, findings, suggestions.'),
      event: z.enum(['COMMENT', 'APPROVE', 'REQUEST_CHANGES']).default('COMMENT'),
    }),
  },
);

// ─── Sentry tools ───────────────────────────────────────────────────────────

export const listSentryIssuesTool = tool(
  async ({ query, limit }) => {
    const issues = await composio.listSentryIssues(limit, query);
    if (issues.length === 0) return 'No matching Sentry issues (or Sentry not configured).';
    return issues
      .map(
        (i) =>
          `${i.shortId} [${i.level}/${i.status}] (×${i.count}) in ${i.project.slug}: ${i.title}\n  culprit: ${i.culprit}\n  last seen: ${i.lastSeen}\n  ${i.url}`,
      )
      .join('\n\n');
  },
  {
    name: 'list_sentry_issues',
    description: 'List recent unresolved Sentry issues in the configured org.',
    schema: z.object({
      query: z.string().default('is:unresolved').describe('Sentry search query. Default unresolved issues.'),
      limit: z.number().int().min(1).max(100).default(10),
    }),
  },
);

// ─── n8n tools ──────────────────────────────────────────────────────────────

export const triggerN8nWorkflowTool = tool(
  async ({ target, payload }) => {
    const result = await n8n.triggerN8nWorkflow(target, JSON.parse(payload ?? '{}'));
    return result.success
      ? `Triggered n8n workflow ${result.workflowId}${result.executionId ? ` (execution ${result.executionId})` : ''}.`
      : `n8n trigger failed: ${result.error ?? 'unknown'}`;
  },
  {
    name: 'trigger_n8n_workflow',
    description: 'Trigger an n8n workflow by webhook URL or workflow ID with a JSON payload.',
    schema: z.object({
      target: z.string().describe('Either an n8n webhook URL (https://...) or a workflow ID for the REST execute endpoint.'),
      payload: z.string().describe('JSON-encoded payload to send to the workflow.'),
    }),
  },
);

// ─── Tool bundles ───────────────────────────────────────────────────────────

/**
 * Aggregate tool sets per agent role so each agent only sees the tools it needs
 * (smaller schema = better LLM tool-calling accuracy).
 */
export function toolsForRole(role: AgentRole) {
  switch (role) {
    case 'content-audit':
      return [createLinearIssueTool, searchLinearIssuesTool, rememberDecisionTool, recallMemoryTool, triggerN8nWorkflowTool];
    case 'pr-triage':
      return [getPRInfoTool, postPRReviewTool, searchLinearIssuesTool, createLinearIssueTool, rememberDecisionTool, recallMemoryTool];
    case 'incident-responder':
      return [listSentryIssuesTool, searchLinearIssuesTool, createLinearIssueTool, rememberDecisionTool, recallMemoryTool, triggerN8nWorkflowTool];
    case 'content-enrichment':
      return [rememberDecisionTool, recallMemoryTool, createLinearIssueTool];
    case 'weekly-report':
      return [recallMemoryTool, searchLinearIssuesTool, listSentryIssuesTool, rememberDecisionTool];
    case 'weekly-report-supervisor':
      return [recallMemoryTool, searchLinearIssuesTool, listSentryIssuesTool, rememberDecisionTool];
    default:
      return [rememberDecisionTool, recallMemoryTool];
  }
}

export type AgentRole = 'content-audit' | 'pr-triage' | 'incident-responder' | 'content-enrichment' | 'weekly-report' | 'weekly-report-supervisor';