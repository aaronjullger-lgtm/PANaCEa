/**
 * Clinical Deep Research Agent — Supervisor-Researcher Multi-Agent Graph
 *
 * Adapts the Open Deep Research pattern (langchain-ai/open_deep_research) for
 * clinical/medical literature review. Uses a supervisor-researcher architecture:
 *
 * 1. Supervisor: decomposes the research question, assigns sub-tasks to researchers
 * 2. Researchers: search for evidence, evaluate sources, synthesize findings
 * 3. Report Writer: compiles findings into a structured clinical summary
 *
 * Architecture:
 *   User Query → Supervisor (task decomposition)
 *     → Researcher 1 (sub-topic A) ─┐
 *     → Researcher 2 (sub-topic B) ─┤→ Report Writer → Final Report
 *     → Researcher N (sub-topic N) ─┘
 *
 * Uses @langchain/langgraph-supervisor for multi-agent orchestration.
 * Each researcher is a sub-agent with web search and source evaluation tools.
 *
 * @module lib/langchain/graphs/clinicalResearch
 */

import { z } from 'zod';
import {
  StateGraph,
  Annotation,
  START,
  END,
} from '@langchain/langgraph';
import type { BaseMessage } from '@langchain/core/messages';
import { HumanMessage, AIMessage, SystemMessage } from '@langchain/core/messages';

import { routeTask, routeStructured } from '@/lib/langchain/router';
import type { AIEnvKeys } from '@/lib/langchain/models';

// ─── Types ─────────────────────────────────────────────────────────────────

export type ResearchPhase =
  | 'planning'
  | 'researching'
  | 'synthesizing'
  | 'writing'
  | 'complete'
  | 'failed';

export interface ResearchTask {
  id: string;
  topic: string;
  query: string;
  status: 'pending' | 'in_progress' | 'complete';
  findings?: string;
  sources?: ResearchSource[];
}

export interface ResearchSource {
  title: string;
  url?: string;
  snippet: string;
  relevance: 'high' | 'medium' | 'low';
  year?: number;
  authority?: string;
}

export interface ClinicalReport {
  title: string;
  summary: string;
  sections: ReportSection[];
  references: string[];
  confidence: 'high' | 'moderate' | 'low';
  generatedAt: string;
}

export interface ReportSection {
  heading: string;
  content: string;
  sources: string[];
}

// ─── State Schema ──────────────────────────────────────────────────────────

export const ClinicalResearchState = Annotation.Root({
  /** Original research query from the user */
  query: Annotation<string>,
  /** Clinical domain (e.g., Cardiology, Pulmonology) */
  domain: Annotation<string>,
  /** Decomposed research tasks */
  tasks: Annotation<ResearchTask[]>({
    reducer: (_prev, next) => next,
    default: () => [],
  }),
  /** Accumulated research findings */
  findings: Annotation<string>({
    reducer: (prev, next) => prev + '\n\n' + next,
    default: () => '',
  }),
  /** Generated clinical report */
  report: Annotation<ClinicalReport | null>({
    reducer: (_prev, next) => next,
    default: () => null,
  }),
  /** Current phase */
  phase: Annotation<ResearchPhase>({
    reducer: (_prev, next) => next,
    default: () => 'planning',
  }),
  /** Error message if failed */
  error: Annotation<string | null>({
    reducer: (_prev, next) => next,
    default: () => null,
  }),
  /** Environment keys for AI calls */
  env: Annotation<AIEnvKeys | null>({
    reducer: (_prev, next) => next,
    default: () => null,
  }),
  /** Maximum number of research tasks */
  maxTasks: Annotation<number>({
    reducer: (_prev, next) => next,
    default: () => 5,
  }),
  /** Maximum depth of research per task */
  maxDepth: Annotation<number>({
    reducer: (_prev, next) => next,
    default: () => 3,
  }),
});

export type CRState = typeof ClinicalResearchState.State;
export type CRUpdate = Partial<CRState>;

// ─── Helpers ──────────────────────────────────────────────────────────────

function resolveEnv(state: CRState): AIEnvKeys {
  if (state.env) return state.env;
  throw new Error('ClinicalResearch: state.env is not set.');
}

// ─── Schemas ──────────────────────────────────────────────────────────────

const TaskDecompositionSchema = z.object({
  tasks: z.array(z.object({
    topic: z.string().describe('Specific sub-topic to research'),
    query: z.string().describe('Search query for this sub-topic'),
    rationale: z.string().describe('Why this sub-topic is important'),
  })).min(1).max(5),
  searchStrategy: z.string().describe('Overall search strategy'),
});

const ResearchFindingsSchema = z.object({
  summary: z.string().describe('Synthesized findings for this sub-topic'),
  keyPoints: z.array(z.string()).describe('Key clinical takeaways'),
  sources: z.array(z.object({
    title: z.string(),
    url: z.string().optional(),
    snippet: z.string(),
    relevance: z.enum(['high', 'medium', 'low']),
    year: z.number().optional(),
    authority: z.string().optional(),
  })).min(1),
  confidence: z.enum(['high', 'moderate', 'low']).describe('Confidence in findings'),
  gaps: z.array(z.string()).describe('Identified knowledge gaps'),
});

const ClinicalReportSchema = z.object({
  title: z.string().describe('Report title'),
  summary: z.string().describe('Executive summary (2-3 paragraphs)'),
  sections: z.array(z.object({
    heading: z.string(),
    content: z.string(),
    sources: z.array(z.string()),
  })).min(1),
  references: z.array(z.string()).min(1),
  confidence: z.enum(['high', 'moderate', 'low']),
  clinicalPearls: z.array(z.string()).describe('High-yield clinical pearls'),
  limitations: z.array(z.string()).describe('Study/review limitations'),
});

// ─── Node: Planning (Supervisor) ──────────────────────────────────────────

async function planningNode(state: CRState): Promise<CRUpdate> {
  const env = resolveEnv(state);

  const systemPrompt = `You are a clinical research supervisor for PANaCEa, a medical education platform for PA students.

Your task: Decompose a clinical research question into focused sub-topics for parallel research.

Guidelines:
1. Break the question into 2-5 specific, non-overlapping sub-topics
2. Each sub-topic should have a clear, searchable query
3. Prioritize evidence-based medicine, guidelines, and systematic reviews
4. Consider: epidemiology, pathophysiology, diagnosis, treatment, prognosis
5. Focus on board-relevant (PANCE/PANRE) information

Output valid JSON matching the schema.`;

  const userPrompt = `Research question: ${state.query}
Clinical domain: ${state.domain || 'General Medicine'}

Decompose this into focused research tasks.`;

  try {
    const result = await routeStructured(
      'clinical-reasoning',
      env,
      { systemPrompt, userPrompt },
      TaskDecompositionSchema,
      { runName: 'cr.planning', temperature: 0.3 },
    );

    const tasks: ResearchTask[] = result.output.tasks.map((t, i) => ({
      id: `task-${i + 1}`,
      topic: t.topic,
      query: t.query,
      status: 'pending' as const,
    }));

    return {
      tasks,
      phase: 'researching',
      findings: `## Research Plan\n**Strategy:** ${result.output.searchStrategy}\n`,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { phase: 'failed', error: `Planning failed: ${message}` };
  }
}

// ─── Node: Research (Parallel Researchers) ────────────────────────────────

async function researchNode(state: CRState): Promise<CRUpdate> {
  const env = resolveEnv(state);

  // Find next pending task
  const pendingTasks = state.tasks.filter((t) => t.status === 'pending');
  if (pendingTasks.length === 0) {
    return { phase: 'synthesizing' };
  }

  // Process one task at a time (could be parallelized with Send API)
  const task = pendingTasks[0]!;
  task.status = 'in_progress';

  const systemPrompt = `You are a clinical researcher for PANaCEa. Research the following sub-topic
and synthesize findings for PA students preparing for PANCE/PANRE.

Guidelines:
1. Search for evidence-based information from reputable sources
2. Prioritize clinical guidelines, systematic reviews, and meta-analyses
3. Extract high-yield clinical pearls relevant to board exams
4. Note the strength of evidence and any controversies
5. Identify knowledge gaps for further investigation

Output valid JSON matching the schema.`;

  const userPrompt = `Sub-topic: ${task.topic}
Search query: ${task.query}
Clinical domain: ${state.domain || 'General Medicine'}

Research and synthesize findings.`;

  try {
    const result = await routeStructured(
      'clinical-reasoning',
      env,
      { systemPrompt, userPrompt },
      ResearchFindingsSchema,
      { runName: `cr.research.${task.id}`, temperature: 0.4 },
    );

    task.status = 'complete';
    task.findings = result.output.summary;
    task.sources = result.output.sources;

    const findingsBlock = [
      `### ${task.topic}`,
      result.output.summary,
      '',
      '**Key Points:**',
      ...result.output.keyPoints.map((p: string) => `- ${p}`),
      '',
      `**Confidence:** ${result.output.confidence}`,
      result.output.gaps.length > 0
        ? `\n**Knowledge Gaps:**\n${result.output.gaps.map((g: string) => `- ${g}`).join('\n')}`
        : '',
      '---',
    ].join('\n');

    const allComplete = state.tasks.every((t) => t.status === 'complete');
    const updatedTasks = state.tasks.map((t) => (t.id === task.id ? task : t));

    return {
      tasks: updatedTasks,
      findings: findingsBlock,
      phase: allComplete ? 'synthesizing' : 'researching',
    };
  } catch (error) {
    task.status = 'pending'; // Reset for retry
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[ClinicalResearch] Task ${task.id} failed: ${message}`);

    // Continue with remaining tasks
    const allComplete = state.tasks.every((t) => t.status === 'complete');
    return {
      tasks: state.tasks,
      phase: allComplete ? 'synthesizing' : 'researching',
    };
  }
}

// ─── Node: Synthesize ─────────────────────────────────────────────────────

async function synthesizeNode(state: CRState): Promise<CRUpdate> {
  const env = resolveEnv(state);

  const completedTasks = state.tasks.filter((t) => t.status === 'complete');
  if (completedTasks.length === 0) {
    return { phase: 'failed', error: 'No research tasks completed successfully' };
  }

  const systemPrompt = `You are a clinical research synthesizer for PANaCEa. Synthesize the research
findings from multiple sub-topics into a coherent clinical summary.

Guidelines:
1. Identify connections and contradictions across sub-topics
2. Highlight the most clinically relevant findings for PA students
3. Note the overall strength of evidence
4. Organize findings logically (e.g., epidemiology → pathophysiology → diagnosis → treatment)
5. Flag any areas where evidence is conflicting or insufficient

This synthesis will be used to write the final report.`;

  const findingsSummary = completedTasks
    .map((t) => `### ${t.topic}\n${t.findings ?? 'No findings'}`)
    .join('\n\n');

  const userPrompt = `Research findings:\n\n${findingsSummary}\n\nSynthesize these findings into a coherent narrative.`;

  try {
    const result = await routeTask(
      'clinical-reasoning',
      env,
      { systemPrompt, userPrompt },
      { runName: 'cr.synthesize', temperature: 0.3, maxOutputTokens: 4096 },
    );

    return {
      findings: `## Synthesis\n${result.output}`,
      phase: 'writing',
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { phase: 'failed', error: `Synthesis failed: ${message}` };
  }
}

// ─── Node: Write Report ───────────────────────────────────────────────────

async function writeReportNode(state: CRState): Promise<CRUpdate> {
  const env = resolveEnv(state);

  const systemPrompt = `You are a clinical report writer for PANaCEa. Write a structured clinical
research report based on the synthesized findings.

The report should be:
1. Comprehensive but concise — PA students have limited time
2. Evidence-based with clear citations
3. Organized with clear headings and logical flow
4. Include high-yield clinical pearls for board exam preparation
5. Note limitations and areas of uncertainty

Target audience: PA students preparing for PANCE/PANRE.

Output valid JSON matching the schema.`;

  const userPrompt = `Research question: ${state.query}
Clinical domain: ${state.domain || 'General Medicine'}

Findings:
${state.findings}

Write the final clinical research report.`;

  try {
    const result = await routeStructured(
      'clinical-reasoning',
      env,
      { systemPrompt, userPrompt },
      ClinicalReportSchema,
      { runName: 'cr.write-report', temperature: 0.4, maxOutputTokens: 8192 },
    );

    const report: ClinicalReport = {
      title: result.output.title,
      summary: result.output.summary,
      sections: result.output.sections,
      references: result.output.references,
      confidence: result.output.confidence,
      generatedAt: new Date().toISOString(),
    };

    return {
      report,
      phase: 'complete',
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { phase: 'failed', error: `Report writing failed: ${message}` };
  }
}

// ─── Edge Routing ──────────────────────────────────────────────────────────

function routeAfterPlanning(state: CRState): string {
  if (state.phase === 'failed') return '__end__';
  return 'research';
}

function routeAfterResearch(state: CRState): string {
  if (state.phase === 'failed') return '__end__';
  if (state.phase === 'synthesizing') return 'synthesize';
  return 'research'; // Continue researching remaining tasks
}

function routeAfterSynthesize(state: CRState): string {
  if (state.phase === 'failed') return '__end__';
  return 'write_report';
}

// ─── Graph Build ──────────────────────────────────────────────────────────

const clinicalResearchGraph = new StateGraph(ClinicalResearchState)
  .addNode('plan', planningNode)
  .addNode('research', researchNode)
  .addNode('synthesize', synthesizeNode)
  .addNode('write_report', writeReportNode)
  .addEdge(START, 'plan')
  .addConditionalEdges('plan', routeAfterPlanning, ['research', '__end__'])
  .addConditionalEdges('research', routeAfterResearch, ['research', 'synthesize', '__end__'])
  .addConditionalEdges('synthesize', routeAfterSynthesize, ['write_report', '__end__'])
  .addEdge('write_report', END);

export const compiledClinicalResearchGraph = clinicalResearchGraph.compile();

// ─── Runner ────────────────────────────────────────────────────────────────

export interface ClinicalResearchInput {
  env: AIEnvKeys;
  query: string;
  domain?: string;
  maxTasks?: number;
  maxDepth?: number;
}

export interface ClinicalResearchResult {
  report: ClinicalReport | null;
  phase: 'complete' | 'failed';
  error?: string;
  tasksCompleted: number;
  totalTasks: number;
}

/**
 * Run the clinical deep research pipeline.
 *
 * @example
 * ```ts
 * const result = await runClinicalResearch({
 *   env: cloudflareEnv,
 *   query: 'What are the latest guidelines for heart failure management?',
 *   domain: 'Cardiology',
 * });
 *
 * if (result.report) {
 *   console.log(result.report.title);
 *   console.log(result.report.summary);
 * }
 * ```
 */
export async function runClinicalResearch(
  input: ClinicalResearchInput,
): Promise<ClinicalResearchResult> {
  const initialState: CRState = {
    query: input.query,
    domain: input.domain ?? 'General Medicine',
    tasks: [],
    findings: '',
    report: null,
    phase: 'planning',
    error: null,
    env: input.env,
    maxTasks: input.maxTasks ?? 5,
    maxDepth: input.maxDepth ?? 3,
  };

  try {
    const result = await compiledClinicalResearchGraph.invoke(initialState, {
      runName: 'clinical-research',
      tags: ['research', 'clinical', input.domain ?? 'general'],
      metadata: {
        query: input.query.slice(0, 200),
        domain: input.domain,
      },
      recursionLimit: 50,
    });

    const crResult = result as CRState;

    return {
      report: crResult.report,
      phase: crResult.phase === 'complete' ? 'complete' : 'failed',
      error: crResult.error ?? undefined,
      tasksCompleted: crResult.tasks.filter((t) => t.status === 'complete').length,
      totalTasks: crResult.tasks.length,
    };
  } catch (error) {
    return {
      report: null,
      phase: 'failed',
      error: error instanceof Error ? error.message : String(error),
      tasksCompleted: 0,
      totalTasks: 0,
    };
  }
}
