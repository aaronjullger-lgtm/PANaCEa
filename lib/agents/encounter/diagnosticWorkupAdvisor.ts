/**
 * Diagnostic Workup Advisor agent — production encounter tier.
 *
 * Takes HPI + vitals and recommends lab/imaging studies with rationale,
 * prioritized by clinical urgency.
 *
 * @module lib/agents/encounter/diagnosticWorkupAdvisor
 */

import { z } from 'zod';
import { StateGraph, Annotation, START, END } from '@langchain/langgraph';
import { routeStructured } from '@/lib/langchain/router';
import type { AIEnvKeys } from '@/lib/langchain/models';
import type { AgentDefinition, AgentContext, InvokeResult } from '@/lib/agents/shared/types';
import { registerAgent } from '@/lib/agents/shared/runtime';

export const DiagnosticWorkupInputSchema = z.object({
  sessionId: z.string().min(1),
  chiefComplaint: z.string().min(1).max(2000),
  hpiFindings: z.string().max(8000),
  workingDdx: z.array(z.string()).max(10).default([]),
  vitals: z.object({
    bp: z.string().optional(), hr: z.number().optional(),
    rr: z.number().optional(), tempC: z.number().optional(), o2: z.number().optional(),
  }).optional(),
});
export type DiagnosticWorkupInput = z.infer<typeof DiagnosticWorkupInputSchema>;

const WorkupItemSchema = z.object({
  study: z.string().min(1).max(200),
  category: z.enum(['lab', 'imaging', 'bedside', 'other']),
  priority: z.enum(['stat', 'urgent', 'routine']),
  rationale: z.string().min(5).max(500),
  expectedFinding: z.string().max(300),
});

export const DiagnosticWorkupOutputSchema = z.object({
  recommendations: z.array(WorkupItemSchema).min(1).max(15),
  totalEstimatedCost: z.enum(['low', 'moderate', 'high']),
  summary: z.string().min(10).max(800),
});
export type DiagnosticWorkupOutput = z.infer<typeof DiagnosticWorkupOutputSchema>;

const WorkupState = Annotation.Root({
  input: Annotation<DiagnosticWorkupInput>(),
  output: Annotation<DiagnosticWorkupOutput | null>(),
  env: Annotation<AIEnvKeys | null>(),
});
type WorkupStateType = typeof WorkupState.State;

async function advise(state: WorkupStateType): Promise<Partial<WorkupStateType>> {
  if (!state.env) throw new Error('DiagnosticWorkupAdvisor: env missing');
  const i = state.input;
  const vitalsStr = i.vitals ? Object.entries(i.vitals).filter(([, v]) => v != null).map(([k, v]) => `${k}: ${v}`).join(', ') : 'Not available';
  const ddxStr = i.workingDdx.length > 0 ? i.workingDdx.join(', ') : 'Not yet established';
  const systemPrompt = `You are a clinical workup advisor for PA students. Recommend diagnostic studies (labs, imaging, bedside tests) that would help differentiate the working diagnoses or rule out must-not-miss conditions. Prioritize by clinical urgency. Include rationale and expected findings for each study.`;
  const userPrompt = `Chief complaint: ${i.chiefComplaint}\nVitals: ${vitalsStr}\nWorking DDx: ${ddxStr}\n\nHPI:\n${i.hpiFindings}`;
  const result = await routeStructured('clinical-reasoning', state.env, { systemPrompt, userPrompt }, DiagnosticWorkupOutputSchema, { runName: 'workup-advisor', temperature: 0.2, maxOutputTokens: 2048 });
  return { output: result.output };
}

const compiledWorkup = new StateGraph(WorkupState)
  .addNode('advise', advise)
  .addEdge(START, 'advise')
  .addEdge('advise', END)
  .compile();

const diagnosticWorkupAdvisorAgent: AgentDefinition<DiagnosticWorkupInput, DiagnosticWorkupOutput> = {
  name: 'diagnostic-workup-advisor',
  description: 'Recommends prioritized labs/imaging/bedside studies from HPI, vitals, and working DDx. Includes rationale per study.',
  tier: 'encounter',
  async invoke(input, ctx): Promise<InvokeResult<DiagnosticWorkupOutput>> {
    const start = Date.now();
    const parsed = DiagnosticWorkupInputSchema.safeParse(input);
    if (!parsed.success) return { status: 'schema_invalid', output: null, error: { status: 'schema_invalid', message: parsed.error.issues.map((i) => i.message).join('; '), cause: 'workup-advisor.input' }, agent: 'diagnostic-workup-advisor', durationMs: Date.now() - start };
    if (!ctx.env?.GEMINI_API_KEY) return { status: 'env_missing', output: null, error: { status: 'env_missing', message: 'GEMINI_API_KEY not provided.', cause: 'workup-advisor.env' }, agent: 'diagnostic-workup-advisor', durationMs: Date.now() - start };
    try {
      const result = await compiledWorkup.invoke({ input: parsed.data, output: null, env: ctx.env });
      if (!result.output) return { status: 'internal_error', output: null, error: { status: 'internal_error', message: 'Workup advisor returned no output.', cause: 'workup-advisor.invoke' }, agent: 'diagnostic-workup-advisor', durationMs: Date.now() - start };
      const validated = DiagnosticWorkupOutputSchema.safeParse(result.output);
      if (!validated.success) return { status: 'schema_invalid', output: null, error: { status: 'schema_invalid', message: validated.error.issues.map((i) => i.message).join('; '), cause: 'workup-advisor.output' }, agent: 'diagnostic-workup-advisor', durationMs: Date.now() - start };
      return { status: 'ok', output: validated.data, error: null, agent: 'diagnostic-workup-advisor', durationMs: Date.now() - start, telemetry: { studyCount: validated.data.recommendations.length } };
    } catch (err) {
      return { status: 'internal_error', output: null, error: { status: 'internal_error', message: err instanceof Error ? err.message : String(err), cause: 'workup-advisor.invoke' }, agent: 'diagnostic-workup-advisor', durationMs: Date.now() - start };
    }
  },
};

registerAgent(diagnosticWorkupAdvisorAgent);
export { diagnosticWorkupAdvisorAgent };