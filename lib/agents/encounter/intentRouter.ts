/**
 * Intent Router agent — production encounter tier.
 *
 * Stateless single-node LangGraph that classifies a PA student utterance
 * during an OSCE encounter into one of the canonical `StudentIntent` labels.
 * Used by the encounter orchestrator (`lib/langchain/graphs/osceEncounter.ts`)
 * and any client that wants a quick intent tag without running the full
 * encounter graph.
 *
 * @module lib/agents/encounter/intentRouter
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
import { INTENT_CLASSIFIER_SYSTEM_PROMPT } from '@/lib/ai/prompts/osce';
import type {
  AgentDefinition,
  AgentContext,
  InvokeResult,
} from '@/lib/agents/shared/types';
import { registerAgent } from '@/lib/agents/shared/runtime';
import { StudentIntentSchema } from '@/lib/ai/schemas/intent';

// ─── Public I/O ───────────────────────────────────────────────────────────

export const IntentRouterInputSchema = z.object({
  studentUtterance: z.string().min(1).max(4000),
});
export type IntentRouterInput = z.infer<typeof IntentRouterInputSchema>;

export const IntentRouterOutputSchema = z.object({
  intent: StudentIntentSchema.shape.intent,
});
export type IntentRouterOutput = z.infer<typeof IntentRouterOutputSchema>;

// ─── Graph State ──────────────────────────────────────────────────────────

const IntentState = Annotation.Root({
  studentUtterance: Annotation<string>,
  intent: Annotation<string | null>,
  env: Annotation<AIEnvKeys | null>,
});
type IntentStateType = typeof IntentState.State;

async function classifyNode(state: IntentStateType): Promise<Partial<IntentStateType>> {
  if (!state.env) throw new Error('IntentRouter: env missing from state');
  const result = await routeStructured(
    'extraction',
    state.env,
    {
      systemPrompt: INTENT_CLASSIFIER_SYSTEM_PROMPT,
      userPrompt: state.studentUtterance.slice(0, 1000),
    },
    StudentIntentSchema,
    { runName: 'intent-router', temperature: 0 },
  );
  return { intent: result.output.intent };
}

const intentGraph = new StateGraph(IntentState)
  .addNode('classify', classifyNode)
  .addEdge(START, 'classify')
  .addEdge('classify', END);

const compiledIntent = intentGraph.compile();

// ─── Agent Definition ────────────────────────────────────────────────────

const intentRouterAgent: AgentDefinition<IntentRouterInput, IntentRouterOutput> = {
  name: 'intent-router',
  description:
    'Classifies a PA student utterance during an OSCE encounter into one of eight canonical intent labels. Stateless single-call.',
  tier: 'encounter',
  inputSchema: IntentRouterInputSchema,
  outputSchema: IntentRouterOutputSchema,
  async invoke(input, ctx: AgentContext): Promise<InvokeResult<IntentRouterOutput>> {
    const start = Date.now();
    const parsed = IntentRouterInputSchema.safeParse(input);
    if (!parsed.success) {
      return {
        status: 'schema_invalid',
        output: null,
        error: {
          status: 'schema_invalid',
          message: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
          cause: 'intent-router.input',
        },
        agent: 'intent-router',
        durationMs: Date.now() - start,
      };
    }

    if (!ctx.env?.GEMINI_API_KEY) {
      return {
        status: 'env_missing',
        output: null,
        error: { status: 'env_missing', message: 'GEMINI_API_KEY not provided in agent context.', cause: 'intent-router.env' },
        agent: 'intent-router',
        durationMs: Date.now() - start,
      };
    }

    try {
      const result = await compiledIntent.invoke({
        studentUtterance: parsed.data.studentUtterance,
        intent: null,
        env: ctx.env,
      });

      const intent = result.intent;
      if (!intent) {
        return {
          status: 'internal_error',
          output: null,
          error: { status: 'internal_error', message: 'Classifier returned no intent.', cause: 'intent-router.invoke' },
          agent: 'intent-router',
          durationMs: Date.now() - start,
        };
      }

      const output: IntentRouterOutput = { intent: intent as IntentRouterOutput['intent'] };
      const validated = IntentRouterOutputSchema.safeParse(output);
      if (!validated.success) {
        return {
          status: 'schema_invalid',
          output: null,
          error: { status: 'schema_invalid', message: validated.error.issues.map((i) => i.message).join('; '), cause: 'intent-router.output' },
          agent: 'intent-router',
          durationMs: Date.now() - start,
        };
      }

      return {
        status: 'ok',
        output: validated.data,
        error: null,
        agent: 'intent-router',
        durationMs: Date.now() - start,
        telemetry: { intent: validated.data.intent },
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        status: 'internal_error',
        output: null,
        error: { status: 'internal_error', message, cause: 'intent-router.invoke' },
        agent: 'intent-router',
        durationMs: Date.now() - start,
      };
    }
  },
};

registerAgent(intentRouterAgent);

export { intentRouterAgent };