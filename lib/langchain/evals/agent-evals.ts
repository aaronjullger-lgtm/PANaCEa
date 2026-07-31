/**
 * Agent Evaluation Runner
 *
 * Runs LangSmith eval datasets against Edge agents to measure
 * quality, correctness, and latency. Integrates with the existing
 * eval infrastructure in lib/langchain/evals/.
 *
 * Each agent type can have one or more eval datasets. The runner
 * executes each dataset, collects scores, and reports results
 * to LangSmith for dashboard visualization.
 *
 * @module lib/langchain/evals/agent-evals
 */

import type { AgentContext, InvokeResult } from '@/lib/agents/shared/types';
import { invokeUnifiedAgent } from '@/lib/agents/unified';
import type { AIEnvKeys } from '@/lib/langchain/models';

export interface EvalCase {
  name: string;
  input: unknown;
  expectedOutput?: unknown;
  expectedAgent?: string;
  metadata?: Record<string, unknown>;
}

export interface EvalDataset {
  name: string;
  description: string;
  agentName: string;
  cases: EvalCase[];
}

export interface EvalResult {
  caseName: string;
  passed: boolean;
  score: number;
  output: unknown;
  expectedOutput?: unknown;
  durationMs: number;
  error?: string;
}

export interface EvalRun {
  datasetName: string;
  agentName: string;
  results: EvalResult[];
  passRate: number;
  avgScore: number;
  avgDurationMs: number;
  totalDurationMs: number;
}

export interface EvalRunnerConfig {
  env: AIEnvKeys;
  ctx: AgentContext;
  datasets: EvalDataset[];
  timeoutMs?: number;
}

function scoreOutput(output: unknown, expected?: unknown): number {
  if (expected === undefined) return 1.0;

  if (typeof expected === 'string' && typeof output === 'string') {
    const outputLower = output.toLowerCase();
    const expectedLower = expected.toLowerCase();
    if (outputLower.includes(expectedLower)) return 1.0;
    const words = expectedLower.split(/\s+/);
    const matchedWords = words.filter((w) => outputLower.includes(w));
    return matchedWords.length / words.length;
  }

  if (typeof expected === 'object' && typeof output === 'object') {
    try {
      const outputStr = JSON.stringify(output);
      const expectedStr = JSON.stringify(expected);
      if (outputStr === expectedStr) return 1.0;
      const outputKeys = Object.keys(output as Record<string, unknown>);
      const expectedKeys = Object.keys(expected as Record<string, unknown>);
      const matchedKeys = expectedKeys.filter((k) => k in (output as Record<string, unknown>));
      return matchedKeys.length / expectedKeys.length;
    } catch {
      return 0;
    }
  }

  return 0;
}

export async function runEvalDataset(
  dataset: EvalDataset,
  config: EvalRunnerConfig,
): Promise<EvalRun> {
  const results: EvalResult[] = [];
  const start = Date.now();

  for (const testCase of dataset.cases) {
    const caseStart = Date.now();

    try {
      const result: InvokeResult<unknown> = await invokeUnifiedAgent({
        name: dataset.agentName,
        input: testCase.input,
        ctx: config.ctx,
        trace: {
          name: `eval/${dataset.name}/${testCase.name}`,
          tags: ['eval', dataset.agentName],
          metadata: testCase.metadata,
        },
      });

      const score = scoreOutput(result.output, testCase.expectedOutput);

      results.push({
        caseName: testCase.name,
        passed: result.status === 'ok' && score >= 0.5,
        score,
        output: result.output,
        expectedOutput: testCase.expectedOutput,
        durationMs: Date.now() - caseStart,
        error: result.error?.message,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      results.push({
        caseName: testCase.name,
        passed: false,
        score: 0,
        output: null,
        expectedOutput: testCase.expectedOutput,
        durationMs: Date.now() - caseStart,
        error: message,
      });
    }
  }

  const passed = results.filter((r) => r.passed);
  const totalScore = results.reduce((sum, r) => sum + r.score, 0);

  return {
    datasetName: dataset.name,
    agentName: dataset.agentName,
    results,
    passRate: results.length > 0 ? passed.length / results.length : 0,
    avgScore: results.length > 0 ? totalScore / results.length : 0,
    avgDurationMs: results.length > 0
      ? results.reduce((sum, r) => sum + r.durationMs, 0) / results.length
      : 0,
    totalDurationMs: Date.now() - start,
  };
}

export async function runAllEvals(config: EvalRunnerConfig): Promise<EvalRun[]> {
  const runs: EvalRun[] = [];

  for (const dataset of config.datasets) {
    const run = await runEvalDataset(dataset, config);
    runs.push(run);
  }

  return runs;
}

export function summarizeEvalRuns(runs: EvalRun[]): string {
  const lines: string[] = [];
  let totalPassed = 0;
  let totalCases = 0;

  for (const run of runs) {
    const passed = run.results.filter((r) => r.passed).length;
    totalPassed += passed;
    totalCases += run.results.length;

    lines.push(
      `  ${run.datasetName} (${run.agentName}): ${passed}/${run.results.length} passed (${(run.passRate * 100).toFixed(0)}%), avg score ${run.avgScore.toFixed(2)}, avg ${run.avgDurationMs.toFixed(0)}ms`,
    );
  }

  const overallRate = totalCases > 0 ? ((totalPassed / totalCases) * 100).toFixed(0) : 'N/A';
  return [
    `Agent Eval Results: ${totalPassed}/${totalCases} passed (${overallRate}%)`,
    ...lines,
  ].join('\n');
}

export const CLINICAL_AGENT_EVAL_DATASETS: EvalDataset[] = [
  {
    name: 'ddx-generator-basic',
    description: 'Basic differential diagnosis generation',
    agentName: 'ddx-generator',
    cases: [
      {
        name: 'chest-pain-ddx',
        input: { condition: 'chest pain', patientAge: 55, patientSex: 'male' },
        expectedOutput: 'myocardial infarction',
      },
      {
        name: 'abdominal-pain-ddx',
        input: { condition: 'acute abdominal pain', patientAge: 35, patientSex: 'female' },
        expectedOutput: 'appendicitis',
      },
      {
        name: 'headache-ddx',
        input: { condition: 'severe headache', patientAge: 40, patientSex: 'female' },
        expectedOutput: 'migraine',
      },
    ],
  },
  {
    name: 'soap-note-grader-basic',
    description: 'Basic SOAP note grading',
    agentName: 'soap-note-grader',
    cases: [
      {
        name: 'complete-soap-note',
        input: {
          subjective: 'Patient reports chest pain for 3 hours',
          objective: 'BP 140/90, HR 95, O2 97%',
          assessment: 'Possible ACS',
          plan: 'EKG, troponin, cardiology consult',
        },
        expectedOutput: 'complete',
      },
    ],
  },
];

export const OPS_AGENT_EVAL_DATASETS: EvalDataset[] = [
  {
    name: 'call-gemini-auditor-basic',
    description: 'Basic Gemini API audit',
    agentName: 'call-gemini-auditor',
    cases: [
      {
        name: 'audit-request',
        input: { action: 'audit', target: 'gemini-api-calls' },
        expectedOutput: 'audit',
      },
    ],
  },
  {
    name: 'env-var-auditor-basic',
    description: 'Basic environment variable audit',
    agentName: 'env-var-auditor',
    cases: [
      {
        name: 'check-env-vars',
        input: { action: 'check', target: 'environment-variables' },
        expectedOutput: 'environment',
      },
    ],
  },
];
