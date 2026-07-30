/**
 * Feedback Summarizer agent — production encounter tier.
 *
 * Takes SPBench scores + encounter transcript and produces actionable,
 * student-facing coaching feedback. This is the "so what" layer between
 * the raw rubric scores and what the learner actually reads.
 *
 * @module lib/agents/encounter/feedbackSummarizer
 */

import { z } from 'zod';
import { StateGraph, Annotation, START, END } from '@langchain/langgraph';
import { routeStructured } from '@/lib/langchain/router';
import type { AIEnvKeys } from '@/lib/langchain/models';
import type { AgentDefinition, AgentContext, InvokeResult } from '@/lib/agents/shared/types';
import { registerAgent } from '@/lib/agents/shared/runtime';

export const FeedbackSummarizerInputSchema = z.object({
  sessionId: z.string().min(1),
  scores: z.object({
    QC: z.number(), CC: z.number(), CD: z.number(), RC: z.number(),
    LC: z.number(), LN: z.number(), CS: z.number(), PD: z.number(),
    overallScore: z.number(),
    justification: z.string(),
  }),
  transcript: z.array(z.object({ role: z.string(), text: z.string() })).max(200).default([]),
  correctDiagnosis: z.string().default('unknown'),
  studentDiagnosis: z.string().default('not provided'),
});
export type FeedbackSummarizerInput = z.infer<typeof FeedbackSummarizerInputSchema>;

export const FeedbackSummarizerOutputSchema = z.object({
  overallAssessment: z.string().min(20).max(500),
  strengths: z.array(z.string().min(5).max(300)).min(1).max(5),
  improvements: z.array(z.object({
    area: z.string().min(3).max(100),
    specificFeedback: z.string().min(10).max(400),
    actionableStep: z.string().min(10).max(300),
  })).min(1).max(5),
  studyRecommendation: z.string().min(10).max(500),
  encouragementLevel: z.enum(['needs_work', 'developing', 'competent', 'strong']),
});
export type FeedbackSummarizerOutput = z.infer<typeof FeedbackSummarizerOutputSchema>;

const FbState = Annotation.Root({
  input: Annotation<FeedbackSummarizerInput>(),
  output: Annotation<FeedbackSummarizerOutput | null>(),
  env: Annotation<AIEnvKeys | null>(),
});
type FbStateType = typeof FbState.State;

async function summarize(state: FbStateType): Promise<Partial<FbStateType>> {
  if (!state.env) throw new Error('FeedbackSummarizer: env missing');
  const i = state.input;
  const s = i.scores;
  const lowestDims = Object.entries({ QC: s.QC, CC: s.CC, CD: s.CD, RC: s.RC, LC: s.LC, LN: s.LN, CS: s.CS, PD: s.PD })
    .sort(([, a], [, b]) => a - b).slice(0, 3).map(([k, v]) => `${k}: ${v}/100`);
  const transcriptPreview = i.transcript.slice(-15).map((t) => `${t.role}: ${t.text}`).join('\n');
  const systemPrompt = `You are a clinical education coach. Convert SPBench rubric scores into specific, actionable feedback for a PA student. Be honest but encouraging. For each improvement area, give a concrete next step the student can take. Match the encouragement level to the overall score (below 50 = needs_work, 50-65 = developing, 66-80 = competent, above 80 = strong).`;
  const userPrompt = `Overall score: ${s.overallScore}/100\nLowest dimensions: ${lowestDims.join(', ')}\nRubric justification: ${s.justification}\nStudent's diagnosis: ${i.studentDiagnosis}\nCorrect diagnosis: ${i.correctDiagnosis}\n\nTranscript excerpt (last 15 turns):\n${transcriptPreview}`;
  const result = await routeStructured('content-generation', state.env, { systemPrompt, userPrompt }, FeedbackSummarizerOutputSchema, { runName: 'feedback-summarizer', temperature: 0.4, maxOutputTokens: 2048 });
  return { output: result.output };
}

const compiledFb = new StateGraph(FbState)
  .addNode('summarize', summarize)
  .addEdge(START, 'summarize')
  .addEdge('summarize', END)
  .compile();

const feedbackSummarizerAgent: AgentDefinition<FeedbackSummarizerInput, FeedbackSummarizerOutput> = {
  name: 'feedback-summarizer',
  description: 'Converts SPBench scores + transcript into actionable, student-facing coaching feedback with strengths, improvements, and study recommendations.',
  tier: 'encounter',
  async invoke(input, ctx): Promise<InvokeResult<FeedbackSummarizerOutput>> {
    const start = Date.now();
    const parsed = FeedbackSummarizerInputSchema.safeParse(input);
    if (!parsed.success) return { status: 'schema_invalid', output: null, error: { status: 'schema_invalid', message: parsed.error.issues.map((i) => i.message).join('; '), cause: 'feedback-summarizer.input' }, agent: 'feedback-summarizer', durationMs: Date.now() - start };
    if (!ctx.env?.GEMINI_API_KEY) return { status: 'env_missing', output: null, error: { status: 'env_missing', message: 'GEMINI_API_KEY not provided.', cause: 'feedback-summarizer.env' }, agent: 'feedback-summarizer', durationMs: Date.now() - start };
    try {
      const result = await compiledFb.invoke({ input: parsed.data, output: null, env: ctx.env });
      if (!result.output) return { status: 'internal_error', output: null, error: { status: 'internal_error', message: 'Feedback summarizer returned no output.', cause: 'feedback-summarizer.invoke' }, agent: 'feedback-summarizer', durationMs: Date.now() - start };
      const validated = FeedbackSummarizerOutputSchema.safeParse(result.output);
      if (!validated.success) return { status: 'schema_invalid', output: null, error: { status: 'schema_invalid', message: validated.error.issues.map((i) => i.message).join('; '), cause: 'feedback-summarizer.output' }, agent: 'feedback-summarizer', durationMs: Date.now() - start };
      return { status: 'ok', output: validated.data, error: null, agent: 'feedback-summarizer', durationMs: Date.now() - start, telemetry: { encouragementLevel: validated.data.encouragementLevel, improvementCount: validated.data.improvements.length } };
    } catch (err) {
      return { status: 'internal_error', output: null, error: { status: 'internal_error', message: err instanceof Error ? err.message : String(err), cause: 'feedback-summarizer.invoke' }, agent: 'feedback-summarizer', durationMs: Date.now() - start };
    }
  },
};

registerAgent(feedbackSummarizerAgent);
export { feedbackSummarizerAgent };