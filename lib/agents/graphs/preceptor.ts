/**
 * Preceptor Pimping Bot — Full Implementation
 *
 * Simulates a clinical preceptor who "pimps" (asks rapid-fire clinical
 * questions) during rounds, in the ED, in the OR, or in clinic. Each
 * setting has a distinct personality, question style, and difficulty
 * curve. Registered as an encounter-tier agent for production use.
 *
 * Architecture:
 *   StateGraph (LangGraph) → routeTask (LLM router) → Gemini/fallback
 *   Registered via registerAgent → callable from /api/agents/invoke
 *
 * Settings:
 *   - ED: fast-paced, high-acuity, triage-focused
 *   - OR: anatomy/surgical, procedural, sterile-field mindset
 *   - rounds: comprehensive, systems-based, evidence-driven
 *   - clinic: outpatient, chronic disease, preventive care
 *
 * @module lib/agents/graphs/preceptor
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

// ─── Types ─────────────────────────────────────────────────────────────────

export type PreceptorSetting = 'ED' | 'OR' | 'rounds' | 'clinic';

export const SETTING_LABELS: Record<PreceptorSetting, string> = {
  ED: 'Emergency Department',
  OR: 'Operating Room',
  rounds: 'Inpatient Rounds',
  clinic: 'Outpatient Clinic',
};

// ─── Input / Output Schemas ────────────────────────────────────────────────

export const PreceptorInputSchema = z.object({
  /** Stable session ID for telemetry. */
  sessionId: z.string().min(1),
  /** The clinical setting — determines preceptor personality. */
  setting: z.enum(['ED', 'OR', 'rounds', 'clinic']),
  /** Student's answer to the previous question, or initial greeting. */
  studentUtterance: z.string().min(1).max(4000),
  /** Prior Q&A turns for context. Caller is responsible for windowing. */
  priorTurns: z.array(
    z.object({
      role: z.enum(['preceptor', 'student']),
      text: z.string().max(4000),
    }),
  ).max(50).default([]),
  /** Current difficulty level (1=easy recall, 5=hard analysis). Agent manages this. */
  currentDifficulty: z.number().int().min(1).max(5).default(3),
  /** Current correct streak count. Agent manages this. */
  correctStreak: z.number().int().min(0).default(0),
  /** Optional: focus on a specific organ system. */
  organSystem: z.string().optional(),
  /** Optional: focus on a specific task category (diagnosis, treatment, etc.). */
  taskCategory: z.string().optional(),
  maxOutputTokens: z.number().int().min(64).max(2048).optional(),
});
export type PreceptorInput = z.infer<typeof PreceptorInputSchema>;

export const PreceptorOutputSchema = z.object({
  /** The preceptor's response — either a new question or feedback + next question. */
  preceptorReply: z.string().min(1).max(2000),
  /** Whether the student's last answer was correct. null if this is the first turn. */
  lastAnswerCorrect: z.boolean().nullable(),
  /** Updated difficulty level after adaptation. */
  newDifficulty: z.number().int().min(1).max(5),
  /** Updated correct streak. */
  newCorrectStreak: z.number().int().min(0),
  /** The clinical topic of the current question (for analytics). */
  currentTopic: z.string().optional(),
  /** Whether the preceptor is ending the session. */
  sessionEnding: z.boolean().default(false),
  /** Clinical pearl shared by the preceptor (if any). */
  clinicalPearl: z.string().optional(),
});
export type PreceptorOutput = z.infer<typeof PreceptorOutputSchema>;

// ─── Setting-Specific System Prompts ───────────────────────────────────────

const SETTING_PROMPTS: Record<PreceptorSetting, string> = {
  ED: `You are an Emergency Department attending physician precepting a PA student.
Your style is FAST, DIRECT, and HIGH-STAKES. Every second counts.

Rules:
- Ask ONE rapid-fire clinical question at a time
- Focus on: triage decisions, life-threatening differentials, immediate interventions
- Push the student to think about what kills first (ABCDE approach)
- Use ED slang occasionally ("what's the dispo?", "what's your gestalt?")
- If the student is wrong, correct them bluntly but teach the pearl
- Keep responses under 3 sentences — this is the ED, not grand rounds
- End with "Good work. Go see the next one." when wrapping up`,

  OR: `You are a surgical attending precepting a PA student in the operating room.
Your style is PRECISE, ANATOMICAL, and PROCEDURAL. Sterile field mindset.

Rules:
- Ask ONE surgical/anatomy question at a time
- Focus on: surgical anatomy, procedural steps, sterile technique, complications
- Reference specific anatomical landmarks and layers
- Use surgical terminology appropriately
- If the student is wrong, correct them precisely — surgery has no room for error
- Keep responses crisp and technical
- End with "Scrub out. Good case." when wrapping up`,

  rounds: `You are an internal medicine attending precepting a PA student on inpatient rounds.
Your style is COMPREHENSIVE, EVIDENCE-BASED, and SYSTEMS-ORIENTED.

Rules:
- Ask ONE clinical reasoning question at a time
- Focus on: differential diagnosis, evidence-based management, guideline-directed therapy
- Push the student to justify their reasoning ("What's your evidence?")
- Reference landmark trials and guidelines when teaching
- If the student is wrong, guide them through the reasoning — teach them how to think
- Connect findings across organ systems
- End with "Strong work today. Keep reading." when wrapping up`,

  clinic: `You are a primary care attending precepting a PA student in outpatient clinic.
Your style is PRACTICAL, PREVENTIVE, and PATIENT-CENTERED.

Rules:
- Ask ONE outpatient medicine question at a time
- Focus on: chronic disease management, preventive care, screening guidelines, patient education
- Emphasize USPSTF guidelines and evidence-based screening
- Consider cost-effectiveness and patient preferences
- If the student is wrong, teach the outpatient approach — what actually matters in clinic
- Keep it practical — what would you actually do for this patient today?
- End with "Great clinic day. See you tomorrow." when wrapping up`,
};

// ─── LangGraph State ───────────────────────────────────────────────────────

const PreceptorState = Annotation.Root({
  sessionId: Annotation<string>,
  setting: Annotation<PreceptorSetting>,
  studentUtterance: Annotation<string>,
  priorTurns: Annotation<{ role: string; text: string }[]>,
  currentDifficulty: Annotation<number>({
    reducer: (_, next) => next,
    default: () => 3,
  }),
  correctStreak: Annotation<number>({
    reducer: (_, next) => next,
    default: () => 0,
  }),
  organSystem: Annotation<string | undefined>(),
  taskCategory: Annotation<string | undefined>(),
  maxOutputTokens: Annotation<number>(),
  env: Annotation<AIEnvKeys | null>(),

  // Output fields
  preceptorReply: Annotation<string>(),
  lastAnswerCorrect: Annotation<boolean | null>(),
  newDifficulty: Annotation<number>(),
  newCorrectStreak: Annotation<number>(),
  currentTopic: Annotation<string | undefined>(),
  sessionEnding: Annotation<boolean>(),
  clinicalPearl: Annotation<string | undefined>(),
});
type PreceptorStateType = typeof PreceptorState.State;

// ─── Difficulty Adaptation ─────────────────────────────────────────────────

/**
 * Adapt difficulty based on correct streak.
 * - Streak ≥ 3: increase difficulty (cap at 5)
 * - Streak = 0 (wrong): decrease difficulty (floor at 1)
 * - Otherwise: maintain current difficulty
 */
function adaptDifficulty(
  currentDifficulty: number,
  correctStreak: number,
  lastCorrect: boolean | null,
): number {
  if (lastCorrect === null) return currentDifficulty; // First turn
  if (lastCorrect && correctStreak >= 3) {
    return Math.min(5, currentDifficulty + 1);
  }
  if (!lastCorrect) {
    return Math.max(1, currentDifficulty - 1);
  }
  return currentDifficulty;
}

// ─── Graph Nodes ───────────────────────────────────────────────────────────

/**
 * Generate the preceptor's response: evaluate the student's answer (if any)
 * and produce the next question or wrap-up.
 */
async function preceptorNode(state: PreceptorStateType): Promise<Partial<PreceptorStateType>> {
  const env = state.env;
  if (!env) throw new Error('Preceptor: env missing from state');

  const settingPrompt = SETTING_PROMPTS[state.setting];
  const isFirstTurn = state.priorTurns.length === 0;

  // Build the conversation history
  const historyBlock = state.priorTurns.length > 0
    ? state.priorTurns.map((t) =>
        `${t.role === 'preceptor' ? 'Preceptor' : 'Student'}: ${t.text}`
      ).join('\n') + '\n\n'
    : '';

  // Build the evaluation context
  const evalContext = isFirstTurn
    ? 'This is the first interaction. Greet the student and ask your first pimp question.'
    : `The student just answered. Evaluate their answer for clinical correctness, then respond appropriately:
- If CORRECT: acknowledge briefly, share a quick clinical pearl, then ask the next question at the same or higher difficulty.
- If PARTIALLY CORRECT: acknowledge what was right, correct what was wrong, then ask a follow-up.
- If INCORRECT: correct them directly (this is ${state.setting} — be honest), teach the key point, then ask an easier question.

Current difficulty: ${state.currentDifficulty}/5
Correct streak: ${state.correctStreak}
${state.organSystem ? `Focus organ system: ${state.organSystem}` : ''}
${state.taskCategory ? `Focus task category: ${state.taskCategory}` : ''}

After 8+ turns, consider wrapping up the session. Signal session end by including "[SESSION_END]" at the end of your reply.`;

  const userPrompt = `${historyBlock}Student: ${state.studentUtterance}\n\n${evalContext}\n\nPreceptor:`;

  const result = await routeTask(
    'osce-chat', // Reuse OSCE chat task type — clinical conversation
    env,
    { systemPrompt: settingPrompt, userPrompt },
    {
      runName: `preceptor-${state.setting}`,
      temperature: 0.7,
      maxOutputTokens: state.maxOutputTokens || 512,
    },
  );

  const reply = result.output.trim();

  // Parse the response
  const sessionEnding = reply.includes('[SESSION_END]');
  const cleanReply = reply.replace('[SESSION_END]', '').trim();

  // Determine correctness from the preceptor's response
  const lowerReply = cleanReply.toLowerCase();
  const isCorrect =
    lowerReply.includes('correct') && !lowerReply.includes('incorrect') && !lowerReply.includes('not correct')
      ? true
      : lowerReply.includes('incorrect') || lowerReply.includes('not correct') || lowerReply.includes('wrong')
        ? false
        : isFirstTurn
          ? null
          : null; // Ambiguous — treat as null

  // Adapt difficulty
  const newStreak = isCorrect === true ? state.correctStreak + 1 : isCorrect === false ? 0 : state.correctStreak;
  const newDiff = adaptDifficulty(state.currentDifficulty, newStreak, isCorrect);

  // Extract clinical pearl if present
  const pearlMatch = cleanReply.match(/\[PEARL:\s*(.+?)\]/i);
  const clinicalPearl = pearlMatch ? pearlMatch[1]!.trim() : undefined;
  const finalReply = cleanReply.replace(/\[PEARL:\s*.+?\]/gi, '').trim();

  return {
    preceptorReply: finalReply,
    lastAnswerCorrect: isCorrect,
    newDifficulty: newDiff,
    newCorrectStreak: newStreak,
    sessionEnding,
    clinicalPearl,
    currentTopic: state.organSystem || 'general',
  };
}

// ─── Build Graph ───────────────────────────────────────────────────────────

const preceptorWorkflow = new StateGraph(PreceptorState)
  .addNode('preceptor', preceptorNode)
  .addEdge(START, 'preceptor')
  .addEdge('preceptor', END);

const compiledPreceptor = preceptorWorkflow.compile();

// ─── Agent Definition ──────────────────────────────────────────────────────

const preceptorAgent: AgentDefinition<PreceptorInput, PreceptorOutput> = {
  name: 'preceptor-pimping',
  description:
    'Simulates a clinical preceptor who asks rapid-fire questions in ED, OR, rounds, or clinic settings. Adapts difficulty based on student performance.',
  tier: 'encounter',
  inputSchema: PreceptorInputSchema,
  outputSchema: PreceptorOutputSchema,
  async invoke(input, ctx: AgentContext): Promise<InvokeResult<PreceptorOutput>> {
    const start = Date.now();

    // Validate input
    const parsed = PreceptorInputSchema.safeParse(input);
    if (!parsed.success) {
      return {
        status: 'schema_invalid',
        output: null,
        error: {
          status: 'schema_invalid',
          message: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
          cause: 'preceptor-pimping.input',
        },
        agent: 'preceptor-pimping',
        durationMs: Date.now() - start,
      };
    }

    // Check env
    if (!ctx.env?.GEMINI_API_KEY) {
      return {
        status: 'env_missing',
        output: null,
        error: {
          status: 'env_missing',
          message: 'GEMINI_API_KEY not provided in agent context.',
          cause: 'preceptor-pimping.env',
        },
        agent: 'preceptor-pimping',
        durationMs: Date.now() - start,
      };
    }

    try {
      const result = await compiledPreceptor.invoke({
        sessionId: parsed.data.sessionId,
        setting: parsed.data.setting,
        studentUtterance: parsed.data.studentUtterance,
        priorTurns: parsed.data.priorTurns,
        currentDifficulty: parsed.data.currentDifficulty,
        correctStreak: parsed.data.correctStreak,
        organSystem: parsed.data.organSystem,
        taskCategory: parsed.data.taskCategory,
        maxOutputTokens: parsed.data.maxOutputTokens ?? 512,
        env: ctx.env,
      });

      const output: PreceptorOutput = {
        preceptorReply: result.preceptorReply ?? '',
        lastAnswerCorrect: result.lastAnswerCorrect ?? null,
        newDifficulty: result.newDifficulty ?? parsed.data.currentDifficulty,
        newCorrectStreak: result.newCorrectStreak ?? parsed.data.correctStreak,
        currentTopic: result.currentTopic,
        sessionEnding: Boolean(result.sessionEnding),
        clinicalPearl: result.clinicalPearl,
      };

      // Validate output
      const validated = PreceptorOutputSchema.safeParse(output);
      if (!validated.success) {
        return {
          status: 'schema_invalid',
          output: null,
          error: {
            status: 'schema_invalid',
            message: validated.error.issues.map((i) => i.message).join('; '),
            cause: 'preceptor-pimping.output',
          },
          agent: 'preceptor-pimping',
          durationMs: Date.now() - start,
        };
      }

      return {
        status: 'ok',
        output: validated.data,
        error: null,
        agent: 'preceptor-pimping',
        durationMs: Date.now() - start,
        telemetry: {
          sessionId: parsed.data.sessionId,
          setting: parsed.data.setting,
          difficulty: validated.data.newDifficulty,
          correctStreak: validated.data.newCorrectStreak,
          sessionEnding: validated.data.sessionEnding,
        },
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        status: 'internal_error',
        output: null,
        error: { status: 'internal_error', message, cause: 'preceptor-pimping.invoke' },
        agent: 'preceptor-pimping',
        durationMs: Date.now() - start,
      };
    }
  },
};

registerAgent(preceptorAgent);

export { preceptorAgent, compiledPreceptor as preceptorGraph };
export default compiledPreceptor;
