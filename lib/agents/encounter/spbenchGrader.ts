/**
 * SPBench Grader agent — production encounter tier.
 *
 * Post-hoc grading of a completed OSCE encounter against the SPBench
 * 8-dimension rubric. Wraps `routeStructured('clinical-reasoning', ...)`
 * with the shared `SpbenchScoreSchema` and the prompt builders from
 * `lib/ai/prompts/osce.ts` — the SAME prompts the REST endpoint
 * `/api/osce/evaluate` uses, so the grader contract is identical whether
 * the call comes from the endpoint or the agent.
 *
 * Stateless single-node LangGraph: classify → END. No checkpoint needed
 * because grading is a one-shot computation over the transcript.
 *
 * @module lib/agents/encounter/spbenchGrader
 */

import { z } from 'zod';
import {
  StateGraph,
  Annotation,
  START,
  END,
} from '@langchain/langgraph';

import { routeStructured } from '@/lib/langchain/router';
import type { AIEnvKeys } from '@/lib/langchain/models';
import { SpbenchScoreSchema } from '@/lib/ai/schemas/grading';
import {
  buildSpbenchSystemPrompt,
  buildSpbenchUserPrompt,
  type SpbenchPromptInput,
} from '@/lib/ai/prompts/osce';
import type { AgentDefinition, AgentContext, InvokeResult } from '@/lib/agents/shared/types';
import { registerAgent } from '@/lib/agents/shared/runtime';

// ─── Public I/O ───────────────────────────────────────────────────────────

export const SpbenchGraderInputSchema = z.object({
  sessionId: z.string().min(1),
  transcript: z.array(
    z.object({
      role: z.enum(['student', 'patient', 'system']),
      text: z.string(),
      ts: z.string().optional(),
    }),
  ).min(1, 'Transcript must contain at least one message'),
  intentLog: z.array(
    z.object({
      intent: z.string(),
      studentText: z.string(),
    }),
  ).default([]),
  studentDiagnosis: z.string().default('not provided'),
  correctDiagnosis: z.string().default('unknown'),
});
export type SpbenchGraderInput = z.infer<typeof SpbenchGraderInputSchema>;

export const SpbenchGraderOutputSchema = SpbenchScoreSchema.extend({
  /** Model that produced the scores — surfaced for telemetry parity with the REST endpoint. */
  gradedBy: z.string(),
});
export type SpbenchGraderOutput = z.infer<typeof SpbenchGraderOutputSchema>;

// ─── Graph State ──────────────────────────────────────────────────────────

const GraderState = Annotation.Root({
  promptInput: Annotation<SpbenchPromptInput>,
  gradedBy: Annotation<string>,
  scores: Annotation<z.infer<typeof SpbenchScoreSchema> | null>,
  env: Annotation<AIEnvKeys | null>,
});
type GraderStateType = typeof GraderState.State;

async function gradeNode(state: GraderStateType): Promise<Partial<GraderStateType>> {
  if (!state.env) throw new Error('SpbenchGrader: env missing from state');
  const result = await routeStructured(
    'clinical-reasoning',
    state.env,
    {
      systemPrompt: buildSpbenchSystemPrompt(state.promptInput),
      userPrompt: buildSpbenchUserPrompt(state.promptInput),
    },
    SpbenchScoreSchema,
    {
      runName: 'spbench-grader',
      temperature: 0.2,
      maxOutputTokens: 2048,
    },
  );
  return {
    scores: result.output,
    gradedBy: `${result.provider}/${result.model}`,
  };
}

const graderGraph = new StateGraph(GraderState)
  .addNode('grade', gradeNode)
  .addEdge(START, 'grade')
  .addEdge('grade', END);

const compiledGrader = graderGraph.compile();

// ─── Agent Definition ────────────────────────────────────────────────────

const spbenchGraderAgent: AgentDefinition<SpbenchGraderInput, SpbenchGraderOutput> = {
  name: 'spbench-grader',
  description:
    'Post-hoc SPBench 8-dimension rubric grading of a completed OSCE encounter. Shares the same prompt contract as /api/osce/evaluate.',
  tier: 'encounter',
  inputSchema: SpbenchGraderInputSchema,
  outputSchema: SpbenchGraderOutputSchema,
  async invoke(input, ctx: AgentContext): Promise<InvokeResult<SpbenchGraderOutput>> {
    const start = Date.now();
    const parsed = SpbenchGraderInputSchema.safeParse(input);
    if (!parsed.success) {
      return {
        status: 'schema_invalid',
        output: null,
        error: {
          status: 'schema_invalid',
          message: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
          cause: 'spbench-grader.input',
        },
        agent: 'spbench-grader',
        durationMs: Date.now() - start,
      };
    }
    if (!ctx.env?.GEMINI_API_KEY) {
      return {
        status: 'env_missing',
        output: null,
        error: { status: 'env_missing', message: 'GEMINI_API_KEY not provided in agent context.', cause: 'spbench-grader.env' },
        agent: 'spbench-grader',
        durationMs: Date.now() - start,
      };
    }
    try {
      const promptInput: SpbenchPromptInput = {
        transcript: parsed.data.transcript,
        intentLog: parsed.data.intentLog,
        studentDiagnosis: parsed.data.studentDiagnosis,
        correctDiagnosis: parsed.data.correctDiagnosis,
      };

      const result = await compiledGrader.invoke({
        promptInput,
        gradedBy: '',
        scores: null,
        env: ctx.env,
      });

      if (!result.scores) {
        return {
          status: 'internal_error',
          output: null,
          error: { status: 'internal_error', message: 'Grader returned no scores.', cause: 'spbench-grader.invoke' },
          agent: 'spbench-grader',
          durationMs: Date.now() - start,
        };
      }

      const output: SpbenchGraderOutput = {
        ...result.scores,
        gradedBy: result.gradedBy || 'unknown',
      };

      const validated = SpbenchGraderOutputSchema.safeParse(output);
      if (!validated.success) {
        return {
          status: 'schema_invalid',
          output: null,
          error: { status: 'schema_invalid', message: validated.error.issues.map((i) => i.message).join('; '), cause: 'spbench-grader.output' },
          agent: 'spbench-grader',
          durationMs: Date.now() - start,
        };
      }

      return {
        status: 'ok',
        output: validated.data,
        error: null,
        agent: 'spbench-grader',
        durationMs: Date.now() - start,
        telemetry: {
          overallScore: validated.data.overallScore,
          gradedBy: validated.data.gradedBy,
          sessionId: parsed.data.sessionId,
        },
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        status: 'internal_error',
        output: null,
        error: { status: 'internal_error', message, cause: 'spbench-grader.invoke' },
        agent: 'spbench-grader',
        durationMs: Date.now() - start,
      };
    }
  },
};

registerAgent(spbenchGraderAgent);

export { spbenchGraderAgent };