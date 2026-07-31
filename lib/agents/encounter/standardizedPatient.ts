/**
 * Standardized Patient agent — production encounter tier.
 *
 * Stateless agent that generates the standardized patient (SP) reply for a
 * single student utterance. The caller MUST pass the full conversation
 * history in `priorTurns` so the SP has context. This agent does NOT hold
 * per-session memory — on Cloudflare Pages Functions, isolates are evicted
 * within seconds and are not sticky per user/session, so an in-process
 * MemorySaver cannot provide cross-request continuity. Passing the history
 * explicitly is the honest contract.
 *
 * @module lib/agents/encounter/standardizedPatient
 */

import { z } from 'zod';
import {
  StateGraph,
  Annotation,
  START,
  END,
} from '@langchain/langgraph';

import { routeTask } from '@/lib/langchain/router';
import type { AIEnvKeys } from '@/lib/langchain/models';
import type {
  AgentDefinition,
  AgentContext,
  InvokeResult,
} from '@/lib/agents/shared/types';
import { registerAgent } from '@/lib/agents/shared/runtime';

export const StandardizedPatientInputSchema = z.object({
  /** Stable session ID for telemetry only — NOT used for memory lookup. */
  sessionId: z.string().min(1),
  studentUtterance: z.string().min(1).max(4000),
  /** Full prior conversation so the SP has context. Caller is responsible for windowing. */
  priorTurns: z.array(
    z.object({
      role: z.enum(['student', 'patient']),
      text: z.string().max(4000),
    }),
  ).max(100).default([]),
  maxOutputTokens: z.number().int().min(64).max(2048).optional(),
});
export type StandardizedPatientInput = z.infer<typeof StandardizedPatientInputSchema>;

export const StandardizedPatientOutputSchema = z.object({
  patientReply: z.string().min(1).max(2000),
  closureRequested: z.boolean().default(false),
});
export type StandardizedPatientOutput = z.infer<typeof StandardizedPatientOutputSchema>;

const SpState = Annotation.Root({
  studentUtterance: Annotation<string>,
  priorTurns: Annotation<{ role: string; text: string }[]>,
  maxOutputTokens: Annotation<number>,
  patientReply: Annotation<string>,
  closureRequested: Annotation<boolean>,
  env: Annotation<AIEnvKeys | null>,
});
type SpStateType = typeof SpState.State;

async function spNode(state: SpStateType): Promise<Partial<SpStateType>> {
  const env = state.env;
  if (!env) throw new Error('StandardizedPatient: env missing from state');
  const systemPrompt =
    'You are a standardized patient in an OSCE encounter. Stay in character. ' +
      'Answer briefly in the patient\'s own voice. Do not volunteer the diagnosis.';
  const historyBlock = state.priorTurns.length > 0
    ? state.priorTurns.map((t) => `${t.role === 'student' ? 'Student' : 'Patient'}: ${t.text}`).join('\n') + '\n\n'
    : '';
  const userPrompt = `${historyBlock}Student: ${state.studentUtterance}\n\nPatient:`;
  const result = await routeTask(
    'osce-chat',
    env,
    { systemPrompt, userPrompt },
    {
      runName: 'standardized-patient',
      temperature: 0.6,
      maxOutputTokens: state.maxOutputTokens,
    },
  );
  const trimmed = result.output.trim();
  const lower = trimmed.toLowerCase();
  const closureRequested =
    lower.includes('[end') || lower.includes('end of encounter') || lower.startsWith('(end)');
  return { patientReply: trimmed, closureRequested };
}

const spGraph = new StateGraph(SpState)
  .addNode('respond', spNode)
  .addEdge(START, 'respond')
  .addEdge('respond', END);

const compiledSp = spGraph.compile();

const standardizedPatientAgent: AgentDefinition<StandardizedPatientInput, StandardizedPatientOutput> = {
  name: 'standardized-patient',
  description:
    'Generates the standardized patient reply for one student utterance. Stateless — caller passes full priorTurns for context.',
  tier: 'encounter',
  inputSchema: StandardizedPatientInputSchema,
  outputSchema: StandardizedPatientOutputSchema,
  async invoke(input, ctx: AgentContext): Promise<InvokeResult<StandardizedPatientOutput>> {
    const start = Date.now();
    const parsed = StandardizedPatientInputSchema.safeParse(input);
    if (!parsed.success) {
      return {
        status: 'schema_invalid',
        output: null,
        error: {
          status: 'schema_invalid',
          message: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
          cause: 'standardized-patient.input',
        },
        agent: 'standardized-patient',
        durationMs: Date.now() - start,
      };
    }
    if (!ctx.env?.GEMINI_API_KEY) {
      return {
        status: 'env_missing',
        output: null,
        error: { status: 'env_missing', message: 'GEMINI_API_KEY not provided in agent context.', cause: 'standardized-patient.env' },
        agent: 'standardized-patient',
        durationMs: Date.now() - start,
      };
    }
    try {
      const result = await compiledSp.invoke(
        {
          studentUtterance: parsed.data.studentUtterance,
          priorTurns: parsed.data.priorTurns,
          maxOutputTokens: parsed.data.maxOutputTokens ?? 256,
          env: ctx.env,
        },
      );
      const output: StandardizedPatientOutput = {
        patientReply: result.patientReply ?? '',
        closureRequested: Boolean(result.closureRequested),
      };
      const validated = StandardizedPatientOutputSchema.safeParse(output);
      if (!validated.success) {
        return {
          status: 'schema_invalid',
          output: null,
          error: { status: 'schema_invalid', message: validated.error.issues.map((i) => i.message).join('; '), cause: 'standardized-patient.output' },
          agent: 'standardized-patient',
          durationMs: Date.now() - start,
        };
      }
      return {
        status: 'ok',
        output: validated.data,
        error: null,
        agent: 'standardized-patient',
        durationMs: Date.now() - start,
        telemetry: { threadId: parsed.data.sessionId, closureRequested: validated.data.closureRequested },
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        status: 'internal_error',
        output: null,
        error: { status: 'internal_error', message, cause: 'standardized-patient.invoke' },
        agent: 'standardized-patient',
        durationMs: Date.now() - start,
      };
    }
  },
};

registerAgent(standardizedPatientAgent);

export { standardizedPatientAgent };