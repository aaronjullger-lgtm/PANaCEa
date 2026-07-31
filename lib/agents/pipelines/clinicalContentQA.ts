/**
 * Clinical Content QA Pipeline
 *
 * Multi-agent pipeline for validating clinical content before it reaches
 * students. Runs three specialized agents in parallel:
 *
 * 1. Clinical Accuracy Agent — verifies medical facts, drug info, dosages
 * 2. Blueprint Alignment Agent — checks NCCPA blueprint coverage
 * 3. Safety Review Agent — flags potentially harmful content
 *
 * Results are merged into a QA report with pass/fail/needs_review status.
 * This pipeline should run on ALL generated content before it enters the
 * staging lake or reaches students.
 *
 * Inspired by DeepAgents' multi-agent review patterns and LangChain's
 * constitutional chain for safety-critical AI output.
 *
 * @module lib/agents/pipelines/clinicalContentQA
 */

import type { AgentContext } from '../shared/types';
import { spawnSubAgents, type SubAgentDefinition, type SubAgentResult } from '../middleware/subagents';
import { createTodoList, executeTodoList, getTodoProgress, type TodoList } from '../middleware/todos';
import { createVirtualFS, offloadToFS, readFile, serializeFSState, type VirtualFS } from '../middleware/filesystem';

// ─── Types ─────────────────────────────────────────────────────────────────

export type QAVerdict = 'pass' | 'fail' | 'needs_review';

export interface ClinicalAccuracyResult {
  verdict: QAVerdict;
  score: number; // 0-1
  issues: Array<{
    severity: 'critical' | 'major' | 'minor';
    field: string;
    description: string;
    suggestion?: string;
  }>;
  summary: string;
}

export interface BlueprintAlignmentResult {
  verdict: QAVerdict;
  organSystem: string;
  taskCategory: string;
  cognitiveLevel: string;
  blueprintMatch: boolean;
  gaps: string[];
  summary: string;
}

export interface SafetyReviewResult {
  verdict: QAVerdict;
  flags: Array<{
    type: 'harmful_content' | 'outdated_guideline' | 'incorrect_dosage' | 'missing_disclaimer' | 'other';
    description: string;
    recommendation: string;
  }>;
  requiresDisclaimer: boolean;
  summary: string;
}

export interface ClinicalContentQAReport {
  /** Unique report ID */
  reportId: string;
  /** What was reviewed */
  contentRef: string;
  /** Overall verdict */
  overallVerdict: QAVerdict;
  /** Individual agent results */
  accuracy: ClinicalAccuracyResult | null;
  blueprint: BlueprintAlignmentResult | null;
  safety: SafetyReviewResult | null;
  /** Pipeline metadata */
  pipeline: {
    durationMs: number;
    agentsRun: number;
    agentsSucceeded: number;
    agentsFailed: number;
    todoProgress: ReturnType<typeof getTodoProgress>;
    fsStats: ReturnType<typeof import('../middleware/filesystem').getFSStats>;
  };
  /** Timestamp */
  reviewedAt: string;
}

export interface ClinicalContentQAInput {
  /** Reference to the content being reviewed */
  contentRef: string;
  /** The content to review */
  content: {
    conditionName?: string;
    organSystem?: string;
    question?: string;
    answer?: string;
    explanation?: string;
    drugName?: string;
    dosage?: string;
    guideline?: string;
    [key: string]: unknown;
  };
  /** Optional: known blueprint context */
  blueprintContext?: {
    organSystem?: string;
    taskCategory?: string;
    cognitiveLevel?: string;
  };
}

// ─── Agent Definitions ─────────────────────────────────────────────────────

function buildAccuracySubAgent(input: ClinicalContentQAInput): SubAgentDefinition {
  return {
    name: 'clinical-accuracy',
    agentName: 'ddx-generator', // Reuse existing agent with clinical prompt
    input: {
      task: 'clinical_accuracy_review',
      content: input.content,
      instructions: `Review this clinical content for medical accuracy:
1. Verify all medical facts, drug names, and dosages
2. Check that explanations are clinically sound
3. Flag any statements that contradict current guidelines
4. Score accuracy from 0 (completely wrong) to 1 (perfect)

Return a JSON object with: verdict ("pass"|"fail"|"needs_review"), score (0-1), issues (array of {severity, field, description, suggestion}), summary (string)`,
    },
    tags: ['qa', 'clinical-accuracy'],
    timeoutMs: 30_000,
  };
}

function buildBlueprintSubAgent(input: ClinicalContentQAInput): SubAgentDefinition {
  return {
    name: 'blueprint-alignment',
    agentName: 'ddx-generator',
    input: {
      task: 'blueprint_alignment_review',
      content: input.content,
      blueprintContext: input.blueprintContext,
      instructions: `Review this content for NCCPA PANCE blueprint alignment:
1. Identify the organ system and task category
2. Verify the cognitive level is appropriate
3. Check if the content maps to a specific blueprint topic
4. Flag any blueprint gaps

Return a JSON object with: verdict ("pass"|"fail"|"needs_review"), organSystem (string), taskCategory (string), cognitiveLevel (string), blueprintMatch (boolean), gaps (string[]), summary (string)`,
    },
    tags: ['qa', 'blueprint-alignment'],
    timeoutMs: 30_000,
  };
}

function buildSafetySubAgent(input: ClinicalContentQAInput): SubAgentDefinition {
  return {
    name: 'safety-review',
    agentName: 'ddx-generator',
    input: {
      task: 'safety_review',
      content: input.content,
      instructions: `Review this clinical content for safety concerns:
1. Flag any content that could cause patient harm if misinterpreted
2. Check for outdated guidelines or treatments
3. Verify drug dosages are within standard ranges
4. Ensure appropriate medical disclaimers are present
5. Flag any content that makes definitive claims without evidence

Return a JSON object with: verdict ("pass"|"fail"|"needs_review"), flags (array of {type, description, recommendation}), requiresDisclaimer (boolean), summary (string)`,
    },
    tags: ['qa', 'safety-review'],
    timeoutMs: 30_000,
  };
}

// ─── Pipeline Execution ────────────────────────────────────────────────────

/**
 * Run the full clinical content QA pipeline on a piece of content.
 *
 * @example
 * ```ts
 * const report = await runClinicalContentQA({
 *   contentRef: 'question_batch_001/q_003',
 *   content: {
 *     conditionName: 'Acute Coronary Syndrome',
 *     question: 'A 55-year-old male presents with...',
 *     answer: 'Aspirin 325mg',
 *     explanation: 'Aspirin reduces mortality in ACS...',
 *   },
 *   blueprintContext: {
 *     organSystem: 'Cardiovascular',
 *     taskCategory: 'Treatment',
 *   },
 * }, ctx);
 * ```
 */
export async function runClinicalContentQA(
  input: ClinicalContentQAInput,
  ctx: AgentContext,
): Promise<ClinicalContentQAReport> {
  const pipelineStart = Date.now();
  const reportId = `qa_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  // Create virtual filesystem for context offloading
  const fs = createVirtualFS(`qa-${reportId}`);

  // Offload the content to the filesystem so agents can reference it
  offloadToFS(fs, 'input/content', input.content, {
    contentType: 'application/json',
    tags: ['input', 'content'],
  });

  // Create todo list for tracking
  const todoList = createTodoList('clinical-content-qa', [
    { content: 'Run clinical accuracy review', priority: 'high', assignedTo: 'clinical-accuracy' },
    { content: 'Run blueprint alignment check', priority: 'high', assignedTo: 'blueprint-alignment' },
    { content: 'Run safety review', priority: 'high', assignedTo: 'safety-review' },
    { content: 'Merge results into QA report', priority: 'medium', assignedTo: 'orchestrator' },
  ]);

  // Spawn all three QA agents in parallel
  const subAgents: SubAgentDefinition[] = [
    buildAccuracySubAgent(input),
    buildBlueprintSubAgent(input),
    buildSafetySubAgent(input),
  ];

  const batch = await spawnSubAgents(subAgents, ctx);

  // Parse results
  const accuracyResult = parseAgentResult<ClinicalAccuracyResult>(
    batch.results.find((r) => r.name === 'clinical-accuracy'),
    'clinical-accuracy',
  );

  const blueprintResult = parseAgentResult<BlueprintAlignmentResult>(
    batch.results.find((r) => r.name === 'blueprint-alignment'),
    'blueprint-alignment',
  );

  const safetyResult = parseAgentResult<SafetyReviewResult>(
    batch.results.find((r) => r.name === 'safety-review'),
    'safety-review',
  );

  // Determine overall verdict
  const overallVerdict = determineOverallVerdict(
    accuracyResult?.verdict,
    blueprintResult?.verdict,
    safetyResult?.verdict,
  );

  // Store results in filesystem
  if (accuracyResult) offloadToFS(fs, 'results/accuracy', accuracyResult, { tags: ['result', 'accuracy'] });
  if (blueprintResult) offloadToFS(fs, 'results/blueprint', blueprintResult, { tags: ['result', 'blueprint'] });
  if (safetyResult) offloadToFS(fs, 'results/safety', safetyResult, { tags: ['result', 'safety'] });

  const report: ClinicalContentQAReport = {
    reportId,
    contentRef: input.contentRef,
    overallVerdict,
    accuracy: accuracyResult,
    blueprint: blueprintResult,
    safety: safetyResult,
    pipeline: {
      durationMs: Date.now() - pipelineStart,
      agentsRun: batch.results.length,
      agentsSucceeded: batch.successCount,
      agentsFailed: batch.failureCount + batch.timeoutCount,
      todoProgress: getTodoProgress(todoList),
      fsStats: (await import('../middleware/filesystem')).getFSStats(fs),
    },
    reviewedAt: new Date().toISOString(),
  };

  return report;
}

// ─── Batch QA ──────────────────────────────────────────────────────────────

/**
 * Run QA on multiple content items with concurrency control.
 * Uses the todo list pattern for structured progress tracking.
 */
export async function runBatchClinicalContentQA(
  items: ClinicalContentQAInput[],
  ctx: AgentContext,
  concurrency: number = 3,
): Promise<{
  reports: ClinicalContentQAReport[];
  summary: {
    total: number;
    passed: number;
    failed: number;
    needsReview: number;
    totalDurationMs: number;
  };
}> {
  const batchStart = Date.now();
  const reports: ClinicalContentQAReport[] = [];

  // Process in batches
  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency);
    const batchResults = await Promise.all(
      batch.map((item) => runClinicalContentQA(item, ctx)),
    );
    reports.push(...batchResults);
  }

  const passed = reports.filter((r) => r.overallVerdict === 'pass').length;
  const failed = reports.filter((r) => r.overallVerdict === 'fail').length;
  const needsReview = reports.filter((r) => r.overallVerdict === 'needs_review').length;

  return {
    reports,
    summary: {
      total: items.length,
      passed,
      failed,
      needsReview,
      totalDurationMs: Date.now() - batchStart,
    },
  };
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function parseAgentResult<T>(
  result: SubAgentResult | undefined,
  agentName: string,
): T | null {
  if (!result || result.status !== 'ok' || !result.output) {
    return null;
  }

  try {
    // Agent output might be a string (JSON) or already an object
    if (typeof result.output === 'string') {
      return JSON.parse(result.output) as T;
    }
    return result.output as T;
  } catch {
    return null;
  }
}

function determineOverallVerdict(
  accuracyVerdict?: QAVerdict,
  blueprintVerdict?: QAVerdict,
  safetyVerdict?: QAVerdict,
): QAVerdict {
  const verdicts = [accuracyVerdict, blueprintVerdict, safetyVerdict].filter(Boolean);

  // If any agent failed, overall is fail
  if (verdicts.includes('fail')) return 'fail';

  // If any agent needs review, overall needs review
  if (verdicts.includes('needs_review')) return 'needs_review';

  // If we have no results at all
  if (verdicts.length === 0) return 'needs_review';

  // All passed
  return 'pass';
}

// ─── Report Formatting ─────────────────────────────────────────────────────

/**
 * Format a QA report as a human-readable summary string.
 */
export function formatQAReport(report: ClinicalContentQAReport): string {
  const lines: string[] = [
    `=== Clinical Content QA Report ===`,
    `Report ID: ${report.reportId}`,
    `Content: ${report.contentRef}`,
    `Overall Verdict: ${report.overallVerdict.toUpperCase()}`,
    `Reviewed: ${report.reviewedAt}`,
    ``,
    `--- Clinical Accuracy ---`,
    report.accuracy
      ? `Verdict: ${report.accuracy.verdict} | Score: ${(report.accuracy.score * 100).toFixed(0)}%`
      : 'FAILED TO RUN',
  ];

  if (report.accuracy?.issues.length) {
    lines.push(`Issues (${report.accuracy.issues.length}):`);
    for (const issue of report.accuracy.issues) {
      lines.push(`  [${issue.severity}] ${issue.field}: ${issue.description}`);
    }
  }

  lines.push(``, `--- Blueprint Alignment ---`);
  if (report.blueprint) {
    lines.push(
      `Verdict: ${report.blueprint.verdict} | System: ${report.blueprint.organSystem} | Task: ${report.blueprint.taskCategory}`,
    );
    if (report.blueprint.gaps.length) {
      lines.push(`Gaps: ${report.blueprint.gaps.join(', ')}`);
    }
  } else {
    lines.push('FAILED TO RUN');
  }

  lines.push(``, `--- Safety Review ---`);
  if (report.safety) {
    lines.push(`Verdict: ${report.safety.verdict} | Disclaimer needed: ${report.safety.requiresDisclaimer}`);
    if (report.safety.flags.length) {
      lines.push(`Flags (${report.safety.flags.length}):`);
      for (const flag of report.safety.flags) {
        lines.push(`  [${flag.type}] ${flag.description}`);
      }
    }
  } else {
    lines.push('FAILED TO RUN');
  }

  lines.push(
    ``,
    `--- Pipeline Stats ---`,
    `Duration: ${report.pipeline.durationMs}ms`,
    `Agents: ${report.pipeline.agentsSucceeded}/${report.pipeline.agentsRun} succeeded`,
  );

  return lines.join('\n');
}
