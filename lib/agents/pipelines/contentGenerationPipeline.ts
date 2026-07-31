/**
 * Content Generation Pipeline
 *
 * Orchestrator-driven batch content generation with integrated QA gates.
 * Combines the LangChain multi-provider content generation with the
 * clinical content QA pipeline to produce validated, blueprint-aligned
 * clinical content at scale.
 *
 * Pipeline stages:
 * 1. PLAN — decompose generation request into todo items
 * 2. GENERATE — spawn subagents for parallel content generation
 * 3. VALIDATE — run clinical content QA on each generated item
 * 4. FILTER — separate pass/fail/needs_review items
 * 5. REPORT — produce a summary with LangSmith tracing
 *
 * Inspired by DeepAgents' structured task planning + subagent spawning,
 * combined with LangChain's multi-provider routing for cost optimization.
 *
 * @module lib/agents/pipelines/contentGenerationPipeline
 */

import type { AgentContext } from '../shared/types';
import { spawnSubAgentsWithConcurrency, type SubAgentDefinition } from '../middleware/subagents';
import { createTodoList, getTodoProgress, serializeTodoList } from '../middleware/todos';
import { createVirtualFS, offloadToFS, serializeFSState, type VirtualFS } from '../middleware/filesystem';
import { runClinicalContentQA, type ClinicalContentQAReport } from './clinicalContentQA';

// ─── Types ─────────────────────────────────────────────────────────────────

export type ContentType = 'condition' | 'lab' | 'imaging' | 'treatment' | 'physiology' | 'question';

export interface GenerationTask {
  /** Unique task ID */
  id: string;
  /** What type of content to generate */
  contentType: ContentType;
  /** The subject/topic name */
  subject: string;
  /** Organ system for blueprint alignment */
  organSystem: string;
  /** Optional subcategory */
  subcategory?: string;
  /** Optional: specific instructions for generation */
  instructions?: string;
  /** Priority for ordering */
  priority: 'high' | 'medium' | 'low';
}

export interface GeneratedItem {
  taskId: string;
  contentType: ContentType;
  subject: string;
  organSystem: string;
  /** The raw generated content */
  content: unknown;
  /** Which model/provider generated it */
  modelUsed?: string;
  provider?: string;
  /** Generation latency */
  latencyMs: number;
  /** QA report (if validation was run) */
  qaReport?: ClinicalContentQAReport;
  /** Status after QA */
  status: 'generated' | 'validated_pass' | 'validated_fail' | 'validated_needs_review' | 'generation_failed';
  error?: string;
}

export interface ContentGenerationPipelineResult {
  /** Unique pipeline run ID */
  runId: string;
  /** All generated items */
  items: GeneratedItem[];
  /** Pipeline summary */
  summary: {
    totalTasks: number;
    generated: number;
    generationFailed: number;
    validatedPass: number;
    validatedFail: number;
    validatedNeedsReview: number;
    totalDurationMs: number;
    modelsUsed: string[];
    providersUsed: string[];
  };
  /** Todo list progress */
  todoProgress: ReturnType<typeof getTodoProgress>;
  /** Pipeline metadata for LangSmith */
  metadata: {
    runId: string;
    pipelineName: string;
    startedAt: string;
    completedAt: string;
    fsStats: Record<string, unknown>;
    todoList: Record<string, unknown>;
  };
}

export interface ContentGenerationPipelineConfig {
  /** Maximum concurrent generations */
  generationConcurrency?: number;
  /** Maximum concurrent QA reviews */
  qaConcurrency?: number;
  /** Whether to run QA validation */
  enableQA?: boolean;
  /** Whether to fail fast on generation errors */
  failFast?: boolean;
  /** Tags for LangSmith tracing */
  tags?: string[];
}

// ─── Defaults ──────────────────────────────────────────────────────────────

const DEFAULT_CONFIG: Required<ContentGenerationPipelineConfig> = {
  generationConcurrency: 3,
  qaConcurrency: 3,
  enableQA: true,
  failFast: false,
  tags: ['content-generation', 'pipeline'],
};

// ─── Pipeline Execution ────────────────────────────────────────────────────

/**
 * Run the full content generation pipeline.
 *
 * @example
 * ```ts
 * const result = await runContentGenerationPipeline([
 *   { id: 't1', contentType: 'condition', subject: 'CHF', organSystem: 'Cardiovascular' },
 *   { id: 't2', contentType: 'condition', subject: 'COPD', organSystem: 'Pulmonary' },
 *   { id: 't3', contentType: 'lab', subject: 'Troponin', organSystem: 'Cardiovascular' },
 * ], ctx, { enableQA: true });
 * ```
 */
export async function runContentGenerationPipeline(
  tasks: GenerationTask[],
  ctx: AgentContext,
  config: ContentGenerationPipelineConfig = {},
): Promise<ContentGenerationPipelineResult> {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const pipelineStart = Date.now();
  const runId = `gen_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  // Create virtual filesystem for context management
  const fs = createVirtualFS(`gen-${runId}`);

  // Create todo list
  const todoItems: Array<{ content: string; priority: 'high' | 'medium' | 'low'; assignedTo?: string }> = [
    { content: `Generate content for ${tasks.length} items`, priority: 'high', assignedTo: 'generator-agents' },
  ];
  if (cfg.enableQA) {
    todoItems.push({ content: 'Run clinical QA validation on all generated items', priority: 'high', assignedTo: 'qa-pipeline' });
  }
  todoItems.push({ content: 'Compile pipeline report', priority: 'medium', assignedTo: 'orchestrator' });

  const todoList = createTodoList('content-generation', todoItems);

  // Offload tasks to filesystem
  offloadToFS(fs, 'input/tasks', tasks, { tags: ['input', 'tasks'] });

  // ─── Stage 1: Generate ───────────────────────────────────────────────
  const items = await generateContentBatch(tasks, ctx, fs, cfg);

  // ─── Stage 2: Validate (if enabled) ──────────────────────────────────
  if (cfg.enableQA) {
    await validateContentBatch(items, ctx, cfg);
  }

  // ─── Stage 3: Compile Report ─────────────────────────────────────────
  const generated = items.filter((i) => i.status === 'generated' || i.status.startsWith('validated'));
  const generationFailed = items.filter((i) => i.status === 'generation_failed');
  const validatedPass = items.filter((i) => i.status === 'validated_pass');
  const validatedFail = items.filter((i) => i.status === 'validated_fail');
  const validatedNeedsReview = items.filter((i) => i.status === 'validated_needs_review');

  const modelsUsed = [...new Set(items.map((i) => i.modelUsed).filter(Boolean))] as string[];
  const providersUsed = [...new Set(items.map((i) => i.provider).filter(Boolean))] as string[];

  const result: ContentGenerationPipelineResult = {
    runId,
    items,
    summary: {
      totalTasks: tasks.length,
      generated: generated.length,
      generationFailed: generationFailed.length,
      validatedPass: validatedPass.length,
      validatedFail: validatedFail.length,
      validatedNeedsReview: validatedNeedsReview.length,
      totalDurationMs: Date.now() - pipelineStart,
      modelsUsed,
      providersUsed,
    },
    todoProgress: getTodoProgress(todoList),
    metadata: {
      runId,
      pipelineName: 'content-generation',
      startedAt: new Date(pipelineStart).toISOString(),
      completedAt: new Date().toISOString(),
      fsStats: serializeFSState(fs),
      todoList: serializeTodoList(todoList),
    },
  };

  // Offload final report
  offloadToFS(fs, 'output/report', result, { tags: ['output', 'report'] });

  return result;
}

// ─── Stage 1: Content Generation ───────────────────────────────────────────

async function generateContentBatch(
  tasks: GenerationTask[],
  ctx: AgentContext,
  fs: VirtualFS,
  cfg: Required<ContentGenerationPipelineConfig>,
): Promise<GeneratedItem[]> {
  const items: GeneratedItem[] = [];

  // Build subagent definitions for each task
  const subAgentDefs: SubAgentDefinition[] = tasks.map((task) => ({
    name: `gen-${task.id}`,
    agentName: 'ddx-generator', // Reuse existing agent with content-gen prompt
    input: {
      task: 'generate_clinical_content',
      contentType: task.contentType,
      subject: task.subject,
      organSystem: task.organSystem,
      subcategory: task.subcategory,
      instructions: task.instructions,
      systemPrompt: buildGenerationPrompt(task),
    },
    tags: ['content-generation', task.contentType, task.organSystem.toLowerCase()],
    timeoutMs: 60_000,
  }));

  // Execute with concurrency control
  const batch = await spawnSubAgentsWithConcurrency(
    subAgentDefs,
    ctx,
    cfg.generationConcurrency,
  );

  // Process results
  for (let i = 0; i < tasks.length; i++) {
    const task = tasks[i]!;
    const result = batch.results[i];

    if (!result || result.status !== 'ok') {
      items.push({
        taskId: task.id,
        contentType: task.contentType,
        subject: task.subject,
        organSystem: task.organSystem,
        content: null,
        latencyMs: result?.durationMs ?? 0,
        status: 'generation_failed',
        error: result?.error ?? 'Unknown generation error',
      });
      continue;
    }

    const item: GeneratedItem = {
      taskId: task.id,
      contentType: task.contentType,
      subject: task.subject,
      organSystem: task.organSystem,
      content: result.output,
      latencyMs: result.durationMs,
      status: 'generated',
    };

    // Offload to filesystem
    offloadToFS(fs, `generated/${task.id}`, item, {
      tags: ['generated', task.contentType],
    });

    items.push(item);
  }

  return items;
}

// ─── Stage 2: QA Validation ────────────────────────────────────────────────

async function validateContentBatch(
  items: GeneratedItem[],
  ctx: AgentContext,
  cfg: Required<ContentGenerationPipelineConfig>,
): Promise<void> {
  const toValidate = items.filter((i) => i.status === 'generated');

  if (toValidate.length === 0) return;

  // Run QA in parallel batches
  for (let i = 0; i < toValidate.length; i += cfg.qaConcurrency) {
    const batch = toValidate.slice(i, i + cfg.qaConcurrency);

    const qaResults = await Promise.all(
      batch.map((item) =>
        runClinicalContentQA(
          {
            contentRef: `generated/${item.taskId}`,
            content: {
              conditionName: item.subject,
              organSystem: item.organSystem,
              ...(typeof item.content === 'object' && item.content !== null
                ? (item.content as Record<string, unknown>)
                : { raw: item.content }),
            },
            blueprintContext: {
              organSystem: item.organSystem,
            },
          },
          ctx,
        ).catch((err) => {
          // QA itself failed — mark as needs_review
          return null;
        }),
      ),
    );

    // Update item statuses based on QA results
    for (let j = 0; j < batch.length; j++) {
      const item = batch[j]!;
      const qaReport = qaResults[j];

      item.qaReport = qaReport ?? undefined;

      if (!qaReport) {
        item.status = 'validated_needs_review';
      } else {
        switch (qaReport.overallVerdict) {
          case 'pass':
            item.status = 'validated_pass';
            break;
          case 'fail':
            item.status = 'validated_fail';
            break;
          case 'needs_review':
            item.status = 'validated_needs_review';
            break;
        }
      }
    }
  }
}

// ─── Prompt Building ───────────────────────────────────────────────────────

function buildGenerationPrompt(task: GenerationTask): string {
  const base = `You are a clinical content generator for PANaCEa, a PANCE/PANRE exam preparation platform.

Generate high-quality clinical content following these rules:
1. All content must be medically accurate and evidence-based
2. Follow NCCPA PANCE blueprint guidelines
3. Use clear, concise language appropriate for PA students
4. Include clinical pearls and high-yield facts
5. Cite standard guidelines where applicable (e.g., AHA, IDSA, GOLD)`;

  switch (task.contentType) {
    case 'condition':
      return `${base}

Generate a comprehensive condition summary for: ${task.subject}
Organ system: ${task.organSystem}

Include:
- Overview (2-3 sentences)
- Key symptoms (bullet points)
- Diagnostic approach
- First-line treatment
- Clinical pearls (3-5 high-yield facts)
- Red flags / when to refer

Format as a structured JSON object.`;

    case 'lab':
      return `${base}

Generate a lab test summary for: ${task.subject}

Include:
- Description of the test
- Normal reference range
- Common abnormalities and their significance
- Clinical indications
- Limitations and pitfalls

Format as a structured JSON object.`;

    case 'imaging':
      return `${base}

Generate an imaging study summary for: ${task.subject}

Include:
- Description of the imaging modality
- What it's best for evaluating
- Key findings to look for
- Limitations
- Radiation risk (if applicable)
- Cost and availability considerations

Format as a structured JSON object.`;

    case 'treatment':
      return `${base}

Generate a treatment summary for: ${task.subject}

Include:
- Drug class and mechanism of action
- Common indications
- Standard dosing
- Major side effects
- Contraindications
- Monitoring requirements
- Key drug interactions

Format as a structured JSON object.`;

    case 'physiology':
      return `${base}

Generate a physiology concept summary for: ${task.subject}

Include:
- Clear explanation of the mechanism
- Clinical significance
- How it relates to common diseases
- Key regulatory pathways
- Mnemonic or memory aid (if applicable)

Format as a structured JSON object.`;

    case 'question':
      return `${base}

Generate a board-style clinical vignette question about: ${task.subject}
Organ system: ${task.organSystem}

Include:
- Clinical vignette (3-5 sentences)
- Question stem
- 5 answer choices (A-E)
- Correct answer with explanation
- Distractor explanations (why wrong answers are wrong)
- Organ system and task category tags
- Cognitive level (Recall, Application, Analysis)

Format as a structured JSON object.`;

    default:
      return base;
  }
}

// ─── Convenience Functions ─────────────────────────────────────────────────

/**
 * Generate content for a single condition with full QA.
 */
export async function generateConditionWithQA(
  conditionName: string,
  organSystem: string,
  ctx: AgentContext,
): Promise<GeneratedItem> {
  const result = await runContentGenerationPipeline(
    [
      {
        id: `cond_${conditionName.toLowerCase().replace(/\s+/g, '_')}`,
        contentType: 'condition',
        subject: conditionName,
        organSystem,
        priority: 'high',
      },
    ],
    ctx,
    { enableQA: true },
  );

  return result.items[0]!;
}

/**
 * Generate a batch of questions for an organ system with QA.
 */
export async function generateQuestionsWithQA(
  organSystem: string,
  conditions: string[],
  count: number,
  ctx: AgentContext,
): Promise<ContentGenerationPipelineResult> {
  const tasks: GenerationTask[] = [];

  for (let i = 0; i < count; i++) {
    const condition = conditions[i % conditions.length]!;
    tasks.push({
      id: `q_${organSystem.toLowerCase()}_${i + 1}`,
      contentType: 'question',
      subject: condition,
      organSystem,
      priority: 'high',
    });
  }

  return runContentGenerationPipeline(tasks, ctx, {
    enableQA: true,
    generationConcurrency: 2, // Questions are more expensive, limit concurrency
  });
}

/**
 * Format pipeline result as a human-readable summary.
 */
export function formatPipelineResult(result: ContentGenerationPipelineResult): string {
  const s = result.summary;
  const lines: string[] = [
    `=== Content Generation Pipeline Report ===`,
    `Run ID: ${result.runId}`,
    `Duration: ${(s.totalDurationMs / 1000).toFixed(1)}s`,
    ``,
    `Tasks: ${s.totalTasks} total`,
    `  Generated: ${s.generated}`,
    `  Failed: ${s.generationFailed}`,
    ``,
    `QA Results:`,
    `  Passed: ${s.validatedPass}`,
    `  Failed: ${s.validatedFail}`,
    `  Needs Review: ${s.validatedNeedsReview}`,
    ``,
    `Models used: ${s.modelsUsed.join(', ') || 'none'}`,
    `Providers used: ${s.providersUsed.join(', ') || 'none'}`,
    ``,
    `--- Items ---`,
  ];

  for (const item of result.items) {
    const statusIcon = item.status === 'validated_pass' ? '✅' :
      item.status === 'validated_fail' ? '❌' :
      item.status === 'validated_needs_review' ? '⚠️' :
      item.status === 'generation_failed' ? '💥' : '📝';

    lines.push(`  ${statusIcon} [${item.contentType}] ${item.subject} — ${item.status} (${item.latencyMs}ms)`);

    if (item.error) {
      lines.push(`      Error: ${item.error}`);
    }
    if (item.qaReport) {
      lines.push(`      QA: ${item.qaReport.overallVerdict} | Accuracy: ${item.qaReport.accuracy?.score ?? 'N/A'}`);
    }
  }

  return lines.join('\n');
}
