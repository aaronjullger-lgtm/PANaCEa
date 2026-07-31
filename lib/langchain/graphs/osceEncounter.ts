/**
 * LangGraph OSCE Encounter Graph
 *
 * Models the stateful lifecycle of an OSCE (Objective Structured Clinical
 * Examination) encounter as a directed graph. Each node represents a phase of
 * the standardized patient interaction; conditional edges route between
 * phases based on the student's classified intent.
 *
 * Phases: intake → history_taking → physical_exam → diagnostic_workup
 *          → assessment → grading → END
 *
 * State is held in LangGraph `Annotation.Root` with append-only transcript
 * and intent log reducers. AI calls (patient response, intent classification,
 * SPBench grading) delegate to `routeTask` / `routeStructured` from
 * `lib/langchain/router` — same model routing, fallback chains, and
 * LangSmith tracing as the rest of the LangChain stack. The SPBench prompt
 * builders are shared with `/api/osce/evaluate` via `lib/ai/prompts/osce`.
 *
 * @module lib/langchain/graphs/osceEncounter
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
import { SpbenchScoreSchema } from '@/lib/ai/schemas/grading';
import {
  INTENT_CLASSIFIER_SYSTEM_PROMPT,
  buildSpbenchSystemPrompt,
  buildSpbenchUserPrompt,
  type SpbenchPromptInput,
} from '@/lib/ai/prompts/osce';
import { StudentIntentSchema, type StudentIntent, type StudentIntentResult } from '@/lib/ai/schemas/intent';

export { StudentIntentSchema } from '@/lib/ai/schemas/intent';
export type { StudentIntent, StudentIntentResult } from '@/lib/ai/schemas/intent';

// ─── Types ──────────────────────────────────────────────────────────────

export type OscePhase =
  | 'intake'
  | 'history_taking'
  | 'physical_exam'
  | 'diagnostic_workup'
  | 'assessment'
  | 'grading';

export interface TranscriptMessage {
  role: 'student' | 'patient' | 'system';
  text: string;
  ts: string;
}

export interface PatientVitals {
  bp?: string;
  hr?: number;
  rr?: number;
  tempC?: number;
  o2?: number;
}

export interface IntentLogEntry {
  intent: StudentIntent;
  studentText: string;
  classifiedAt: string;
}

/**
 * Graph invocation input — required env keys for AI calls plus case context.
 * Set `env` from the Cloudflare context's env in the calling endpoint.
 */
export interface OsceGraphInput extends Partial<OsceState> {
  env: AIEnvKeys;
  correctDiagnosis?: string;
}

// ─── State Schema ───────────────────────────────────────────────────────

export const OsceEncounterState = Annotation.Root({
  sessionId: Annotation<string>,
  clerkUserId: Annotation<string>,
  phase: Annotation<OscePhase>,
  transcript: Annotation<TranscriptMessage[]>({
    reducer: (prev, next) => [...prev, ...next],
    default: () => [],
  }),
  intentLog: Annotation<IntentLogEntry[]>({
    reducer: (prev, next) => [...prev, ...next],
    default: () => [],
  }),
  vitals: Annotation<PatientVitals>,
  diagnosticOrders: Annotation<string[]>({
    reducer: (prev, next) => [...prev, ...next],
    default: () => [],
  }),
  studentDiagnosis: Annotation<string | null>,
  correctDiagnosis: Annotation<string>,
  scores: Annotation<Record<string, number> | null>,
  turnCount: Annotation<number>({
    reducer: (_prev, next) => next,
    default: () => 0,
  }),
  env: Annotation<AIEnvKeys | null>({
    reducer: (_prev, next) => next,
    default: () => null,
  }),
});

export type OsceState = typeof OsceEncounterState.State;
export type OsceUpdate = Partial<OsceState>;

// ─── Helpers ──────────────────────────────────────────────────────────────

function lastStudentTurn(state: OsceState): TranscriptMessage | null {
  return [...state.transcript].reverse().find((m) => m.role === 'student') ?? null;
}

function resolveEnv(state: OsceState): AIEnvKeys {
  if (state.env) return state.env;
  throw new Error(
    'OsceEncounterGraph: state.env is not set. Pass env via OsceGraphInput.',
  );
}

function formatTranscriptForSpbench(transcript: TranscriptMessage[]): unknown {
  return transcript.map((m) => ({ role: m.role, text: m.text }));
}

// ─── Node: Intake ────────────────────────────────────────────────────────

async function intakeNode(state: OsceState): Promise<OsceUpdate> {
  return {
    phase: 'history_taking',
    turnCount: 0,
    env: state.env,
  };
}

// ─── Node: History Taking ────────────────────────────────────────────────

async function historyTakingNode(state: OsceState): Promise<OsceUpdate> {
  const env = resolveEnv(state);
  const studentTurn = lastStudentTurn(state);

  let intent: StudentIntent = 'history_question';
  if (studentTurn) {
    intent = await classifyStudentIntent(env, studentTurn.text);
  }

  const patientReply = await generatePatientResponse(env, state, studentTurn?.text ?? null);

  const nextPhase = deriveNextPhase(state.phase, intent);
  const nowIso = new Date().toISOString();

  return {
    phase: nextPhase,
    env,
    intentLog:
      studentTurn && intent !== 'small_talk'
        ? [{ intent, studentText: studentTurn.text, classifiedAt: nowIso }]
        : [],
    transcript: patientReply
      ? [{ role: 'patient', text: patientReply, ts: nowIso }]
      : [],
    turnCount: state.turnCount + 1,
  };
}

// ─── Node: Physical Exam ─────────────────────────────────────────────────

async function physicalExamNode(state: OsceState): Promise<OsceUpdate> {
  return {
    phase: 'diagnostic_workup',
    turnCount: state.turnCount + 1,
    env: state.env,
  };
}

// ─── Node: Diagnostic Workup ─────────────────────────────────────────────

async function diagnosticWorkupNode(state: OsceState): Promise<OsceUpdate> {
  const env = resolveEnv(state);
  const studentTurn = lastStudentTurn(state);

  let nextPhase: OscePhase = 'diagnostic_workup';
  let intentLog: IntentLogEntry[] = [];

  if (studentTurn) {
    const intent = await classifyStudentIntent(env, studentTurn.text);
    if (intent === 'assessment_present') {
      nextPhase = 'assessment';
    } else if (intent === 'lab_order' || intent === 'imaging_order') {
      intentLog = [
        { intent, studentText: studentTurn.text, classifiedAt: new Date().toISOString() },
      ];
    }
  }

  return {
    phase: nextPhase,
    env,
    intentLog,
    turnCount: state.turnCount + 1,
  };
}

// ─── Node: Assessment ─────────────────────────────────────────────────────

async function assessmentNode(state: OsceState): Promise<OsceUpdate> {
  const studentTurn = lastStudentTurn(state);
  return {
    phase: 'grading',
    studentDiagnosis: studentTurn?.text ?? null,
    turnCount: state.turnCount + 1,
    env: state.env,
  };
}

// ─── Node: Grading ───────────────────────────────────────────────────────

async function gradingNode(state: OsceState): Promise<OsceUpdate> {
  const env = resolveEnv(state);
  const promptInput: SpbenchPromptInput = {
    transcript: formatTranscriptForSpbench(state.transcript),
    intentLog: state.intentLog.map((e) => ({
      intent: e.intent,
      studentText: e.studentText,
    })),
    studentDiagnosis: state.studentDiagnosis ?? 'not provided',
    correctDiagnosis: state.correctDiagnosis ?? 'unknown',
  };

  try {
    const result = await routeStructured(
      'clinical-reasoning',
      env,
      {
        systemPrompt: buildSpbenchSystemPrompt(promptInput),
        userPrompt: buildSpbenchUserPrompt(promptInput),
      },
      SpbenchScoreSchema,
      {
        runName: 'osce.spbench-grading',
        temperature: 0.2,
        maxOutputTokens: 2048,
        metadata: { sessionId: state.sessionId },
      },
    );

    return {
      phase: 'grading',
      scores: {
        QC: result.output.QC,
        CC: result.output.CC,
        CD: result.output.CD,
        RC: result.output.RC,
        LC: result.output.LC,
        LN: result.output.LN,
        CS: result.output.CS,
        PD: result.output.PD,
        overallScore: result.output.overallScore,
      } as Record<string, number>,
    };
  } catch (err) {
    // A failed grading call should not silently produce 0s; surface the failure
    // by leaving scores null and letting the caller decide whether to persist
    // an "evaluation_unavailable" row or retry.
    console.error('[osceEncounter.gradingNode] routeStructured failed:', err);
    return { phase: 'grading', scores: null };
  }
}

// ─── AI helpers ───────────────────────────────────────────────────────────

async function classifyStudentIntent(
  env: AIEnvKeys,
  studentText: string,
): Promise<StudentIntent> {
  try {
    const result = await routeStructured(
      'extraction',
      env,
      {
        systemPrompt: INTENT_CLASSIFIER_SYSTEM_PROMPT,
        userPrompt: studentText.slice(0, 1000),
      },
      StudentIntentSchema,
      { runName: 'osce.intent-classifier', temperature: 0 },
    );
    return result.output.intent;
  } catch (err) {
    console.warn('[osceEncounter.classifyStudentIntent] failed; defaulting to history_question', err);
    return 'history_question';
  }
}

async function generatePatientResponse(
  env: AIEnvKeys,
  state: OsceState,
  studentUtterance: string | null,
): Promise<string | null> {
  if (!studentUtterance) return null;

  const priorTranscript = state.transcript
    .map((m) => `${m.role === 'student' ? 'Student' : 'Patient'}: ${m.text}`)
    .join('\n');

  const systemPrompt =
    'You are a standardized patient in an OSCE encounter. Stay in character. ' +
    'Answer the student\'s question briefly and in the patient\'s voice. ' +
    'Do not volunteer the diagnosis.';

  const userPrompt = `Prior conversation:\n${priorTranscript}\n\nStudent: ${studentUtterance}\n\nPatient:`;

  try {
    const result = await routeTask(
      'osce-chat',
      env,
      { systemPrompt, userPrompt },
      { runName: 'osce.patient-response', temperature: 0.6, maxOutputTokens: 256 },
    );
    return result.output.trim() || null;
  } catch (err) {
    console.warn('[osceEncounter.generatePatientResponse] failed; no patient reply emitted', err);
    return null;
  }
}

// ─── Edge Routing ──────────────────────────────────────────────────────────

function routeAfterHistory(state: OsceState): OscePhase {
  const lastIntent = state.intentLog[state.intentLog.length - 1]?.intent;
  if (lastIntent === 'exam_request') return 'physical_exam';
  if (lastIntent === 'assessment_present') return 'assessment';
  if (lastIntent === 'closure') return 'grading';
  return 'history_taking';
}

function deriveNextPhase(current: OscePhase, intent: StudentIntent): OscePhase {
  if (intent === 'exam_request') return 'physical_exam';
  if (intent === 'assessment_present') return 'assessment';
  if (intent === 'closure') return 'grading';
  return current;
}

// ─── Graph Build ──────────────────────────────────────────────────────────

const osceEncounterGraph = new StateGraph(OsceEncounterState)
  .addNode('intake', intakeNode)
  .addNode('history_taking', historyTakingNode)
  .addNode('physical_exam', physicalExamNode)
  .addNode('diagnostic_workup', diagnosticWorkupNode)
  .addNode('assessment', assessmentNode)
  .addNode('grading', gradingNode)
  .addEdge(START, 'intake')
  .addEdge('intake', 'history_taking')
  .addConditionalEdges('history_taking', routeAfterHistory, [
    'intake',
    'history_taking',
    'physical_exam',
    'assessment',
    'grading',
  ])
  .addEdge('physical_exam', 'diagnostic_workup')
  .addConditionalEdges('diagnostic_workup', (state: OsceState) => state.phase, [
    'diagnostic_workup',
    'assessment',
  ])
  .addEdge('assessment', 'grading')
  .addEdge('grading', END);

export const compiledOsceGraph = osceEncounterGraph.compile();

export type CompiledOsceGraph = typeof compiledOsceGraph;