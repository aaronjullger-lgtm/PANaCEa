/**
 * Differential Diagnosis Generator agent — production encounter tier.
 *
 * Takes HPI + exam findings + vitals and returns a ranked differential
 * diagnosis list with probability estimates and next-step reasoning.
 *
 * @module lib/agents/encounter/ddxGenerator
 */

import { z } from 'zod';
import { StateGraph, Annotation, START, END } from '@langchain/langgraph';
import { routeStructured } from '@/lib/langchain/router';
import type { AIEnvKeys } from '@/lib/langchain/models';
import type { AgentDefinition, AgentContext, InvokeResult } from '@/lib/agents/shared/types';
import { registerAgent } from '@/lib/agents/shared/runtime';

export const DdxGeneratorInputSchema = z.object({
  sessionId: z.string().min(1),
  chiefComplaint: z.string().min(1).max(2000),
  hpiFindings: z.string().max(8000),
  examFindings: z.string().max(8000).default(''),
  vitals: z.object({
    bp: z.string().optional(),
    hr: z.number().optional(),
    rr: z.number().optional(),
    tempC: z.number().optional(),
    o2: z.number().optional(),
  }).optional(),
  patientAge: z.number().int().min(0).max(120).optional(),
  patientSex: z.enum(['M', 'F']).optional(),
});
export type DdxGeneratorInput = z.infer<typeof DdxGeneratorInputSchema>;

const DdxItemSchema = z.object({
  diagnosis: z.string().min(1).max(200),
  probability: z.enum(['high', 'moderate', 'low']),
  supportingFindings: z.array(z.string()).max(10),
  nextStep: z.string().max(300),
});

export const DdxGeneratorOutputSchema = z.object({
  differentials: z.array(DdxItemSchema).min(1).max(8),
  mustNotMiss: z.array(z.string()).max(5).default([]),
  reasoningSummary: z.string().min(10).max(1000),
});
export type DdxGeneratorOutput = z.infer<typeof DdxGeneratorOutputSchema>;

const DdxState = Annotation.Root({
  input: Annotation<DdxGeneratorInput>,
  output: Annotation<DdxGeneratorOutput | null>,
  env: Annotation<AIEnvKeys | null>(),
});
type DdxStateType = typeof DdxState.State;

async function generateDdx(state: DdxStateType): Promise<Partial<DdxStateType>> {
  if (!state.env) throw new Error('DdxGenerator: env missing');
  const i = state.input;
  const vitalsStr = i.vitals
    ? `BP ${i.vitals.bp ?? 'N/A'}, HR ${i.vitals.hr ?? 'N/A'}, RR ${i.vitals.rr ?? 'N/A'}, T ${i.vitals.tempC ?? 'N/A'}°C, O2 ${i.vitals.o2 ?? 'N/A'}%`
    : 'Not available';
  const demo = [i.patientAge ? `${i.patientAge}yo` : '', i.patientSex ?? ''].filter(Boolean).join(' ');
  const systemPrompt = `You are a clinical reasoning assistant for PA students. Generate a ranked differential diagnosis. For each diagnosis, estimate probability (high/moderate/low), list supporting findings, and recommend the next diagnostic step. Also flag any "must not miss" diagnoses for this presentation.`;
  const userPrompt = `Patient: ${demo}\nChief complaint: ${i.chiefComplaint}\nVitals: ${vitalsStr}\n\nHPI:\n${i.hpiFindings}\n\nExam findings:\n${i.examFindings || 'Not yet performed'}`;
  const result = await routeStructured('clinical-reasoning', state.env, { systemPrompt, userPrompt }, DdxGeneratorOutputSchema, { runName: 'ddx-generator', temperature: 0.3, maxOutputTokens: 2048 });
  return { output: result.output };
}

const compiledDdx = new StateGraph(DdxState)
  .addNode('generate', generateDdx)
  .addEdge(START, 'generate')
  .addEdge('generate', END)
  .compile();

const ddxGeneratorAgent: AgentDefinition<DdxGeneratorInput, DdxGeneratorOutput> = {
  name: 'ddx-generator',
  description: 'Generates a ranked differential diagnosis list from HPI, exam findings, and vitals. Flags must-not-miss diagnoses.',
  tier: 'encounter',
  async invoke(input, ctx): Promise<InvokeResult<DdxGeneratorOutput>> {
    const start = Date.now();
    const parsed = DdxGeneratorInputSchema.safeParse(input);
    if (!parsed.success) return { status: 'schema_invalid', output: null, error: { status: 'schema_invalid', message: parsed.error.issues.map((i) => i.message).join('; '), cause: 'ddx-generator.input' }, agent: 'ddx-generator', durationMs: Date.now() - start };
    if (!ctx.env?.GEMINI_API_KEY) return { status: 'env_missing', output: null, error: { status: 'env_missing', message: 'GEMINI_API_KEY not provided.', cause: 'ddx-generator.env' }, agent: 'ddx-generator', durationMs: Date.now() - start };
    try {
      const result = await compiledDdx.invoke({ input: parsed.data, output: null, env: ctx.env });
      if (!result.output) return { status: 'internal_error', output: null, error: { status: 'internal_error', message: 'DDx generation returned no output.', cause: 'ddx-generator.invoke' }, agent: 'ddx-generator', durationMs: Date.now() - start };
      const validated = DdxGeneratorOutputSchema.safeParse(result.output);
      if (!validated.success) return { status: 'schema_invalid', output: null, error: { status: 'schema_invalid', message: validated.error.issues.map((i) => i.message).join('; '), cause: 'ddx-generator.output' }, agent: 'ddx-generator', durationMs: Date.now() - start };
      return { status: 'ok', output: validated.data, error: null, agent: 'ddx-generator', durationMs: Date.now() - start, telemetry: { ddxCount: validated.data.differentials.length, mustNotMissCount: validated.data.mustNotMiss.length } };
    } catch (err) {
      return { status: 'internal_error', output: null, error: { status: 'internal_error', message: err instanceof Error ? err.message : String(err), cause: 'ddx-generator.invoke' }, agent: 'ddx-generator', durationMs: Date.now() - start };
    }
  },
};

registerAgent(ddxGeneratorAgent);
export { ddxGeneratorAgent };