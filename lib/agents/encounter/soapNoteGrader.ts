/**
 * SOAP Note Grader agent — production encounter tier.
 *
 * Grades a free-text SOAP note against the existing `SoapBriefGradeSchema`
 * from `lib/ai/schemas/grading.ts`. Shares the same contract as the REST
 * endpoint that grades SOAP notes, so agent-based and endpoint-based
 * grading produce the same output shape.
 *
 * @module lib/agents/encounter/soapNoteGrader
 */

import { z } from 'zod';
import { StateGraph, Annotation, START, END } from '@langchain/langgraph';
import { routeStructured } from '@/lib/langchain/router';
import type { AIEnvKeys } from '@/lib/langchain/models';
import { SoapBriefGradeSchema, SOAP_BRIEF_GRADE_DESCRIPTION } from '@/lib/ai/schemas/grading';
import type { AgentDefinition, AgentContext, InvokeResult } from '@/lib/agents/shared/types';
import { registerAgent } from '@/lib/agents/shared/runtime';

export const SoapNoteGraderInputSchema = z.object({
  sessionId: z.string().min(1),
  soapNote: z.object({
    subjective: z.string().min(1).max(5000),
    objective: z.string().min(1).max(5000),
    assessment: z.string().min(1).max(5000),
    plan: z.string().min(1).max(5000),
  }),
  caseContext: z.object({
    correctDiagnosis: z.string().optional(),
    chiefComplaint: z.string().optional(),
  }).optional(),
});
export type SoapNoteGraderInput = z.infer<typeof SoapNoteGraderInputSchema>;

export const SoapNoteGraderOutputSchema = SoapBriefGradeSchema;
export type SoapNoteGraderOutput = z.infer<typeof SoapNoteGraderOutputSchema>;

const SoapState = Annotation.Root({
  input: Annotation<SoapNoteGraderInput>(),
  output: Annotation<SoapNoteGraderOutput | null>(),
  env: Annotation<AIEnvKeys | null>(),
});
type SoapStateType = typeof SoapState.State;

async function gradeSoap(state: SoapStateType): Promise<Partial<SoapStateType>> {
  if (!state.env) throw new Error('SoapNoteGrader: env missing');
  const i = state.input;
  const ctx = i.caseContext ? `\nCase context — Correct diagnosis: ${i.caseContext.correctDiagnosis ?? 'N/A'}, Chief complaint: ${i.caseContext.chiefComplaint ?? 'N/A'}` : '';
  const systemPrompt = `You are an OSCE SOAP note grader. Score each section (Subjective, Objective, Assessment, Plan) on a 0-25 scale. totalScore MUST equal the sum. Provide coaching feedback grouped into strengths, missedConcepts, and suggestions (max 5 each).\n\nReturn ONLY this JSON shape:\n${SOAP_BRIEF_GRADE_DESCRIPTION}`;
  const userPrompt = `Subjective:\n${i.soapNote.subjective}\n\nObjective:\n${i.soapNote.objective}\n\nAssessment:\n${i.soapNote.assessment}\n\nPlan:\n${i.soapNote.plan}${ctx}`;
  const result = await routeStructured('clinical-reasoning', state.env, { systemPrompt, userPrompt }, SoapBriefGradeSchema, { runName: 'soap-note-grader', temperature: 0.2, maxOutputTokens: 2048 });
  return { output: result.output };
}

const compiledSoap = new StateGraph(SoapState)
  .addNode('grade', gradeSoap)
  .addEdge(START, 'grade')
  .addEdge('grade', END)
  .compile();

const soapNoteGraderAgent: AgentDefinition<SoapNoteGraderInput, SoapNoteGraderOutput> = {
  name: 'soap-note-grader',
  description: 'Grades a SOAP note against the 4-section rubric (S/O/A/P, 0-25 each). Uses the shared SoapBriefGradeSchema contract.',
  tier: 'encounter',
  async invoke(input, ctx): Promise<InvokeResult<SoapNoteGraderOutput>> {
    const start = Date.now();
    const parsed = SoapNoteGraderInputSchema.safeParse(input);
    if (!parsed.success) return { status: 'schema_invalid', output: null, error: { status: 'schema_invalid', message: parsed.error.issues.map((i) => i.message).join('; '), cause: 'soap-note-grader.input' }, agent: 'soap-note-grader', durationMs: Date.now() - start };
    if (!ctx.env?.GEMINI_API_KEY) return { status: 'env_missing', output: null, error: { status: 'env_missing', message: 'GEMINI_API_KEY not provided.', cause: 'soap-note-grader.env' }, agent: 'soap-note-grader', durationMs: Date.now() - start };
    try {
      const result = await compiledSoap.invoke({ input: parsed.data, output: null, env: ctx.env });
      if (!result.output) return { status: 'internal_error', output: null, error: { status: 'internal_error', message: 'SOAP grader returned no output.', cause: 'soap-note-grader.invoke' }, agent: 'soap-note-grader', durationMs: Date.now() - start };
      const validated = SoapNoteGraderOutputSchema.safeParse(result.output);
      if (!validated.success) return { status: 'schema_invalid', output: null, error: { status: 'schema_invalid', message: validated.error.issues.map((i) => i.message).join('; '), cause: 'soap-note-grader.output' }, agent: 'soap-note-grader', durationMs: Date.now() - start };
      return { status: 'ok', output: validated.data, error: null, agent: 'soap-note-grader', durationMs: Date.now() - start, telemetry: { totalScore: validated.data.totalScore } };
    } catch (err) {
      return { status: 'internal_error', output: null, error: { status: 'internal_error', message: err instanceof Error ? err.message : String(err), cause: 'soap-note-grader.invoke' }, agent: 'soap-note-grader', durationMs: Date.now() - start };
    }
  },
};

registerAgent(soapNoteGraderAgent);
export { soapNoteGraderAgent };