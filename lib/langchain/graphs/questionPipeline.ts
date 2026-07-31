/**
 * Question Generation Pipeline — LangGraph Workflow
 *
 * Multi-step pipeline for generating, critiquing, and refining
 * medical questions. Uses `routeTask` / `routeStructured` from
 * the LangChain router — same model routing, fallback chains,
 * and LangSmith tracing as the rest of the stack.
 *
 * Phases: generate → critique → [refine → critique]* → complete
 *
 * @module lib.langchain.graphs.questionPipeline
 */

import { z } from 'zod';
import {
  StateGraph,
  Annotation,
  START,
  END,
} from '@langchain/langgraph';

import { routeTask, routeStructured } from '@/lib/langchain/router';
import type { AIEnvKeys } from '@/lib/langchain/models';

// ─── Types ──────────────────────────────────────────────────────────────

export type PipelinePhase = 'generating' | 'critiquing' | 'refining' | 'complete' | 'failed';

export interface QuestionDraft {
  question: string;
  choices: string[];
  correctAnswer: string;
  explanation: string;
  learningObjective: string;
}

export interface PipelineInput {
  env: AIEnvKeys;
  request: string;
  organSystem?: string;
  taskCategory?: string;
  maxIterations?: number;
}

// ─── State Schema ───────────────────────────────────────────────────────

export const QuestionPipelineState = Annotation.Root({
  /** Original request from the user */
  request: Annotation<string>,
  /** Organ system to focus on */
  organSystem: Annotation<string>,
  /** Task category */
  taskCategory: Annotation<string>,
  /** Generated question draft (JSON string) */
  draft: Annotation<string>,
  /** Critique feedback */
  critique: Annotation<string>,
  /** Final refined question */
  final: Annotation<string>,
  /** Number of refinement iterations */
  iterations: Annotation<number>,
  /** Maximum allowed iterations */
  maxIterations: Annotation<number>,
  /** Pipeline phase */
  phase: Annotation<PipelinePhase>,
  /** Env keys for AI calls */
  env: Annotation<AIEnvKeys | null>,
});

export type QPState = typeof QuestionPipelineState.State;
export type QPUpdate = Partial<QPState>;

// ─── Helpers ──────────────────────────────────────────────────────────────

function resolveEnv(state: QPState): AIEnvKeys {
  if (state.env) return state.env;
  throw new Error('QuestionPipeline: state.env is not set.');
}

const QUESTION_DRAFT_SCHEMA = z.object({
  question: z.string().describe('Clinical vignette or question stem'),
  choices: z.array(z.string()).describe('5 answer choices labeled A–E'),
  correctAnswer: z.string().describe('Letter of correct answer'),
  explanation: z.string().describe('Detailed rationale'),
  learningObjective: z.string().describe('What the student should learn'),
});

// ─── Node: Generate ───────────────────────────────────────────────────────

async function generateNode(state: QPState): Promise<QPUpdate> {
  const env = resolveEnv(state);

  const result = await routeStructured(
    'question-generation',
    env,
    {
      systemPrompt: `You are a medical education expert creating PANCE/PANRE practice questions.

Generate a high-quality multiple-choice question for:
- Organ System: ${state.organSystem}
- Task Category: ${state.taskCategory}
- Request: ${state.request}

Output valid JSON matching the schema.`,
      userPrompt: 'Generate the question now.',
    },
    QUESTION_DRAFT_SCHEMA,
    { runName: 'qp.generate', temperature: 0.7 },
  );

  return {
    draft: JSON.stringify(result.output, null, 2),
    phase: 'critiquing',
    iterations: state.iterations + 1,
  };
}

// ─── Node: Critique ───────────────────────────────────────────────────────

async function critiqueNode(state: QPState): Promise<QPUpdate> {
  const env = resolveEnv(state);

  const critiquePrompt = `You are a medical education quality reviewer. Critique the following question for:

1. Clinical accuracy — Is the medical information correct?
2. Question quality — Is the stem clear and unambiguous?
3. Answer choices — Are distractors plausible?
4. Explanation — Is the rationale comprehensive?
5. Board relevance — Would this appear on PANCE/PANRE?

Be specific about issues and suggest improvements.

Question to critique:
${state.draft}

${state.critique ? `Previous critiques:\n${state.critique}` : ''}`;

  const result = await routeTask(
    'question-critique',
    env,
    {
      systemPrompt: 'You are a meticulous medical education reviewer.',
      userPrompt: critiquePrompt,
    },
    { runName: 'qp.critique', temperature: 0.3 },
  );

  const critique = result.output.trim();
  const passes =
    critique.toLowerCase().includes('no major issues') ||
    critique.toLowerCase().includes('passes') ||
    critique.toLowerCase().includes('acceptable');

  return {
    critique,
    phase: passes ? 'complete' : 'refining',
  };
}

// ─── Node: Refine ─────────────────────────────────────────────────────────

async function refineNode(state: QPState): Promise<QPUpdate> {
  const env = resolveEnv(state);

  const result = await routeStructured(
    'question-generation',
    env,
    {
      systemPrompt: `You are a medical education expert. Refine the following question based on the critique.

Original Question:
${state.draft}

Critique:
${state.critique}

Fix all issues mentioned in the critique. Maintain clinical accuracy. Keep the question challenging but fair.

Output valid JSON matching the schema.`,
      userPrompt: 'Refine the question now.',
    },
    QUESTION_DRAFT_SCHEMA,
    { runName: 'qp.refine', temperature: 0.5 },
  );

  return {
    draft: JSON.stringify(result.output, null, 2),
    phase: 'critiquing',
  };
}

// ─── Conditional Edge Router ──────────────────────────────────────────────

function routeAfterCritique(state: QPState): string {
  if (state.phase === 'refining' && state.iterations < state.maxIterations) {
    return 'refine';
  }
  return '__end__';
}

// ─── Graph Build ──────────────────────────────────────────────────────────

const questionPipelineGraph = new StateGraph(QuestionPipelineState)
  .addNode('generate', generateNode)
  .addNode('critique', critiqueNode)
  .addNode('refine', refineNode)
  .addEdge(START, 'generate')
  .addEdge('generate', 'critique')
  .addConditionalEdges('critique', routeAfterCritique, [
    'refine',
    '__end__',
  ])
  .addEdge('refine', 'critique');

export const compiledQuestionPipeline = questionPipelineGraph.compile();

// ─── Pipeline Runner ──────────────────────────────────────────────────────

export interface PipelineResult {
  question: string;
  critique: string;
  iterations: number;
  phase: 'complete' | 'failed';
  error?: string;
}

/**
 * Run the question generation pipeline.
 *
 * @example
 * ```ts
 * const result = await runQuestionPipeline({
 *   env: cloudflareEnv,
 *   request: 'Create a question about heart failure management',
 *   organSystem: 'Cardiology',
 *   taskCategory: 'Management',
 * });
 * ```
 */
export async function runQuestionPipeline(input: PipelineInput): Promise<PipelineResult> {
  const initialState: QPState = {
    request: input.request,
    organSystem: input.organSystem ?? 'General',
    taskCategory: input.taskCategory ?? 'Diagnosis',
    draft: '',
    critique: '',
    final: '',
    iterations: 0,
    maxIterations: input.maxIterations ?? 3,
    phase: 'generating',
    env: input.env,
  };

  try {
    const result = await compiledQuestionPipeline.invoke(initialState, {
      runName: 'question-pipeline',
      tags: ['pipeline', 'generation', input.organSystem ?? 'general'],
      metadata: {
        organSystem: input.organSystem,
        taskCategory: input.taskCategory,
        request: input.request.slice(0, 200),
      },
      recursionLimit: 20,
    });

    return {
      question: result.final || result.draft,
      critique: result.critique,
      iterations: result.iterations,
      phase: result.phase as 'complete' | 'failed',
    };
  } catch (error) {
    return {
      question: '',
      critique: '',
      iterations: 0,
      phase: 'failed',
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
