/**
 * LangSmith Automated Evaluation Runner
 *
 * Wires PANaCEa's eval datasets to LangSmith's experiment runner with
 * quality gate enforcement. Designed for both local dev and CI pipelines.
 *
 * Architecture:
 *   eval datasets (datasets.ts) → target function → LangSmith evaluate()
 *   → quality gate check → pass/fail with structured report
 *
 * Usage:
 *   npx tsx lib/langchain/evals/run-evals.ts           # all agents
 *   npx tsx lib/langchain/evals/run-evals.ts --agent sp # single agent
 *   npx tsx lib/langchain/evals/run-evals.ts --ci       # CI mode (strict gates)
 *
 * @module lib/langchain/evals/runner
 */

import { evaluate } from 'langsmith/evaluation';
import type { EvaluationResult, EvaluationResults } from 'langsmith/evaluation';
import { Client } from 'langsmith';
import type { EvalExample, EvalDataset } from './datasets';
import { allEvalDatasets, getExamplesForAgent } from './datasets';
import { defaultPipelineConfig, type EvalPipelineConfig } from './pipeline';
import { createModel, type AIEnvKeys } from '@/lib/langchain/models';
import { fromProcessEnv } from '@/lib/langchain/envAdapter';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import type { BaseMessage } from '@langchain/core/messages';

// ─── Types ─────────────────────────────────────────────────────────────────

export interface EvalRunConfig {
  /** Agent types to evaluate (default: all) */
  agents?: string[];
  /** CI mode: stricter gates, non-zero exit on failure */
  ci?: boolean;
  /** Override quality gate thresholds */
  gates?: Partial<EvalPipelineConfig['qualityGates']>;
  /** Max concurrency for parallel eval runs */
  maxConcurrency?: number;
  /** Experiment prefix for LangSmith UI */
  experimentPrefix?: string;
  /** Additional metadata for the experiment */
  metadata?: Record<string, unknown>;
}

export interface EvalRunResult {
  /** Per-agent experiment results */
  experiments: Array<{
    agentType: string;
    experimentName: string;
    results: EvaluationResults;
    passed: boolean;
    scores: {
      overall: number;
      medicalAccuracy: number;
      avgLatencyMs: number;
      minExampleScore: number;
    };
  }>;
  /** Overall pass/fail */
  passed: boolean;
  /** Summary report (markdown) */
  report: string;
  /** Total duration */
  durationMs: number;
}

// ─── Target Function Factory ───────────────────────────────────────────────

/**
 * Creates a LangSmith-compatible target function for a given agent type.
 * This is the function that LangSmith calls for each dataset example.
 */
function createTargetFunction(
  agentType: string,
  env: AIEnvKeys,
): (input: Record<string, unknown>) => Promise<Record<string, unknown>> {
  return async (input: Record<string, unknown>) => {
    const messages = input.messages as BaseMessage[] | undefined;
    const userMessage = messages?.[messages.length - 1];
    const content = typeof userMessage?.content === 'string'
      ? userMessage.content
      : JSON.stringify(userMessage?.content ?? input);

    // Route to appropriate model based on agent type
    const modelName = agentTypeToModel(agentType);
    const model = createModel(modelName, env, {
      temperature: 0.3,
      maxOutputTokens: 2048,
    });

    const systemPrompt = getSystemPromptForAgent(agentType);
    const start = Date.now();

    const response = await model.invoke([
      new SystemMessage(systemPrompt),
      new HumanMessage(content),
    ]);

    const latencyMs = Date.now() - start;
    const outputText = typeof response.content === 'string'
      ? response.content
      : JSON.stringify(response.content);

    return {
      output: outputText,
      latencyMs,
      agentType,
      modelName,
    };
  };
}

// ─── Custom Evaluators ─────────────────────────────────────────────────────

/**
 * Medical accuracy evaluator: checks if the output contains expected
 * medical keywords and meets clinical constraints.
 */
function createMedicalAccuracyEvaluator(expected: EvalExample['expected']) {
  return async (run: { outputs?: Record<string, unknown>; inputs?: Record<string, unknown> }) => {
    const output = String(run.outputs?.output ?? '');
    const keywords = expected.keywords ?? [];
    const constraints = expected.medicalConstraints ?? [];

    // Keyword match score
    const keywordMatches = keywords.filter((kw) =>
      output.toLowerCase().includes(kw.toLowerCase()),
    );
    const keywordScore = keywords.length > 0
      ? keywordMatches.length / keywords.length
      : 1.0;

    // Constraint satisfaction (heuristic: check for key phrases)
    const constraintMatches = constraints.filter((c) => {
      const keyPhrases = c.toLowerCase().split(' ').filter((w) => w.length > 4);
      return keyPhrases.some((phrase) => output.toLowerCase().includes(phrase));
    });
    const constraintScore = constraints.length > 0
      ? constraintMatches.length / constraints.length
      : 1.0;

    const score = (keywordScore * 0.4 + constraintScore * 0.6);
    const passed = score >= 0.6;

    return {
      key: 'medical_accuracy',
      score,
      comment: passed
        ? `Medical accuracy: ${(score * 100).toFixed(0)}% (${keywordMatches.length}/${keywords.length} keywords, ${constraintMatches.length}/${constraints.length} constraints)`
        : `Medical accuracy below threshold: ${(score * 100).toFixed(0)}%. Missing keywords: ${keywords.filter((k) => !output.toLowerCase().includes(k.toLowerCase())).join(', ')}`,
    };
  };
}

/**
 * Output length evaluator: checks if output meets min/max length constraints.
 */
function createLengthEvaluator(expected: EvalExample['expected']) {
  return async (run: { outputs?: Record<string, unknown> }) => {
    const output = String(run.outputs?.output ?? '');
    const minLength = expected.minLength ?? 0;
    const maxLength = expected.maxLength ?? Infinity;

    if (output.length < minLength) {
      return {
        key: 'output_length',
        score: output.length / Math.max(minLength, 1),
        comment: `Output too short: ${output.length} chars (min: ${minLength})`,
      };
    }

    if (output.length > maxLength) {
      return {
        key: 'output_length',
        score: Math.max(0, 1 - (output.length - maxLength) / maxLength),
        comment: `Output too long: ${output.length} chars (max: ${maxLength})`,
      };
    }

    return {
      key: 'output_length',
      score: 1.0,
      comment: `Output length OK: ${output.length} chars`,
    };
  };
}

/**
 * Latency evaluator: checks if response time is within acceptable bounds.
 */
function createLatencyEvaluator(maxLatencyMs: number) {
  return async (run: { outputs?: Record<string, unknown> }) => {
    const latencyMs = Number(run.outputs?.latencyMs ?? 0);
    const score = latencyMs <= maxLatencyMs ? 1.0 : Math.max(0, 1 - (latencyMs - maxLatencyMs) / maxLatencyMs);

    return {
      key: 'latency',
      score,
      comment: `Latency: ${latencyMs}ms (max: ${maxLatencyMs}ms)`,
    };
  };
}

// ─── Quality Gate Checker ──────────────────────────────────────────────────

interface QualityGateResult {
  passed: boolean;
  failures: string[];
  scores: {
    overall: number;
    medicalAccuracy: number;
    avgLatencyMs: number;
    minExampleScore: number;
  };
}

function checkQualityGates(
  results: EvaluationResults,
  gates: EvalPipelineConfig['qualityGates'],
): QualityGateResult {
  const failures: string[] = [];
  const evalResults = Array.isArray(results) ? results : (results as EvaluationResult[]);

  // Compute aggregate scores
  const medicalScores = evalResults
    .map((r) => r.feedback?.find((f) => f.key === 'medical_accuracy')?.score)
    .filter((s): s is number => s !== undefined);

  const lengthScores = evalResults
    .map((r) => r.feedback?.find((f) => f.key === 'output_length')?.score)
    .filter((s): s is number => s !== undefined);

  const latencies = evalResults
    .map((r) => Number(r.outputs?.latencyMs ?? 0))
    .filter((l) => l > 0);

  const avgMedicalAccuracy = medicalScores.length > 0
    ? medicalScores.reduce((a, b) => a + b, 0) / medicalScores.length
    : 0;

  const avgLength = lengthScores.length > 0
    ? lengthScores.reduce((a, b) => a + b, 0) / lengthScores.length
    : 0;

  const avgLatencyMs = latencies.length > 0
    ? latencies.reduce((a, b) => a + b, 0) / latencies.length
    : 0;

  const overallScore = (avgMedicalAccuracy * 0.6 + avgLength * 0.4);
  const minExampleScore = Math.min(
    ...evalResults.map((r) => {
      const med = r.feedback?.find((f) => f.key === 'medical_accuracy')?.score ?? 0;
      const len = r.feedback?.find((f) => f.key === 'output_length')?.score ?? 0;
      return med * 0.6 + len * 0.4;
    }),
    1,
  );

  // Check gates
  if (overallScore < gates.minOverallScore) {
    failures.push(
      `Overall score ${(overallScore * 100).toFixed(1)}% < ${(gates.minOverallScore * 100).toFixed(1)}%`,
    );
  }

  if (avgMedicalAccuracy < gates.minMedicalAccuracy) {
    failures.push(
      `Medical accuracy ${(avgMedicalAccuracy * 100).toFixed(1)}% < ${(gates.minMedicalAccuracy * 100).toFixed(1)}%`,
    );
  }

  if (avgLatencyMs > gates.maxLatencyMs) {
    failures.push(
      `Average latency ${avgLatencyMs.toFixed(0)}ms > ${gates.maxLatencyMs}ms`,
    );
  }

  if (minExampleScore < gates.minExampleScore) {
    failures.push(
      `Min example score ${(minExampleScore * 100).toFixed(1)}% < ${(gates.minExampleScore * 100).toFixed(1)}%`,
    );
  }

  return {
    passed: failures.length === 0,
    failures,
    scores: {
      overall: overallScore,
      medicalAccuracy: avgMedicalAccuracy,
      avgLatencyMs,
      minExampleScore,
    },
  };
}

// ─── Main Runner ───────────────────────────────────────────────────────────

/**
 * Run LangSmith evaluations for specified agent types.
 *
 * @example
 * ```ts
 * const result = await runEvals({
 *   agents: ['standardized-patient', 'ddx-generator'],
 *   ci: true,
 * });
 *
 * if (!result.passed) {
 *   console.error(result.report);
 *   process.exit(1);
 * }
 * ```
 */
export async function runEvals(config: EvalRunConfig = {}): Promise<EvalRunResult> {
  const start = Date.now();
  const env = fromProcessEnv();

  if (!env.LANGSMITH_API_KEY) {
    console.warn('[EvalRunner] LANGSMITH_API_KEY not set — skipping LangSmith eval run.');
    return {
      experiments: [],
      passed: true,
      report: '## Eval Run Skipped\n\nLANGSMITH_API_KEY not configured. Set it to run automated evaluations.',
      durationMs: Date.now() - start,
    };
  }

  const client = new Client({
    apiKey: env.LANGSMITH_API_KEY,
    apiUrl: env.LANGSMITH_ENDPOINT ?? 'https://api.smith.langchain.com',
  });

  const pipelineConfig = defaultPipelineConfig;
  const gates = { ...pipelineConfig.qualityGates, ...config.gates };
  const agentsToEval = config.agents ?? pipelineConfig.agentTypes;
  const experiments: EvalRunResult['experiments'] = [];
  let allPassed = true;

  for (const agentType of agentsToEval) {
    const dataset = allEvalDatasets.find((ds) => ds.name === agentType);
    if (!dataset || dataset.examples.length === 0) {
      console.warn(`[EvalRunner] No examples found for agent: ${agentType}`);
      continue;
    }

    const experimentPrefix = config.experimentPrefix ?? `panacea-agent`;
    const experimentName = `${experimentPrefix}-${agentType}`;

    console.log(`\n[EvalRunner] Running eval for: ${agentType} (${dataset.examples.length} examples)`);

    try {
      // Create or get dataset in LangSmith
      const datasetName = `panacea-${agentType}-evals`;
      await ensureDataset(client, datasetName, dataset);

      // Build evaluators
      const evaluators = dataset.examples.map((example) => {
        const medicalEval = createMedicalAccuracyEvaluator(example.expected);
        const lengthEval = createLengthEvaluator(example.expected);
        const latencyEval = createLatencyEvaluator(gates.maxLatencyMs);

        // Return a composite evaluator
        return async (run: { outputs?: Record<string, unknown>; inputs?: Record<string, unknown> }) => {
          const [medResult, lenResult, latResult] = await Promise.all([
            medicalEval(run),
            lengthEval(run),
            latencyEval(run),
          ]);
          return [medResult, lenResult, latResult];
        };
      });

      // Run the evaluation
      const results = await evaluate(
        createTargetFunction(agentType, env),
        {
          data: datasetName,
          evaluators: [async (run) => {
            const allFeedback = await Promise.all(
              evaluators.map((e) => e(run)),
            );
            return allFeedback.flat();
          }],
          experimentPrefix: experimentName,
          maxConcurrency: config.maxConcurrency ?? 2,
          metadata: {
            agentType,
            ...config.metadata,
          },
        },
      );

      // Check quality gates
      const gateResult = checkQualityGates(results, gates);

      experiments.push({
        agentType,
        experimentName,
        results,
        passed: gateResult.passed,
        scores: gateResult.scores,
      });

      if (!gateResult.passed) {
        allPassed = false;
        console.warn(`[EvalRunner] ${agentType}: QUALITY GATE FAILED`);
        gateResult.failures.forEach((f) => console.warn(`  - ${f}`));
      } else {
        console.log(`[EvalRunner] ${agentType}: PASSED (overall: ${(gateResult.scores.overall * 100).toFixed(0)}%)`);
      }
    } catch (error) {
      console.error(`[EvalRunner] ${agentType} eval failed:`, error);
      experiments.push({
        agentType,
        experimentName,
        results: [],
        passed: false,
        scores: { overall: 0, medicalAccuracy: 0, avgLatencyMs: 0, minExampleScore: 0 },
      });
      allPassed = false;
    }
  }

  const durationMs = Date.now() - start;
  const report = generateReport(experiments, allPassed, durationMs);

  return { experiments, passed: allPassed, report, durationMs };
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function agentTypeToModel(agentType: string): import('@/lib/langchain/config').ModelName {
  const map: Record<string, import('@/lib/langchain/config').ModelName> = {
    'standardized-patient': 'claude-sonnet-5',
    'ddx-generator': 'claude-sonnet-5',
    'soap-note-grader': 'gpt-4.1',
    'feedback-summarizer': 'gpt-4.1-mini',
  };
  return map[agentType] ?? 'gemini-2.0-flash';
}

function getSystemPromptForAgent(agentType: string): string {
  const prompts: Record<string, string> = {
    'standardized-patient':
      'You are a standardized patient in an OSCE encounter. Respond naturally to the student\'s questions. Stay in character. Do not reveal the diagnosis unless asked directly.',
    'ddx-generator':
      'You are a clinical reasoning expert. Generate a comprehensive differential diagnosis based on the patient presentation. List diagnoses from most to least likely with brief rationale.',
    'soap-note-grader':
      'You are a medical education grader. Evaluate the SOAP note for completeness, clinical accuracy, and appropriate management. Provide specific feedback.',
    'feedback-summarizer':
      'You are a medical education feedback specialist. Summarize the student\'s performance, highlighting strengths and areas for improvement. Be constructive and specific.',
  };
  return prompts[agentType] ?? 'You are a medical education AI assistant.';
}

async function ensureDataset(
  client: Client,
  datasetName: string,
  dataset: EvalDataset,
): Promise<void> {
  try {
    // Check if dataset exists
    const existing = await client.readDataset({ datasetName });
    if (existing) {
      console.log(`[EvalRunner] Dataset "${datasetName}" already exists`);
      return;
    }
  } catch {
    // Dataset doesn't exist — create it
    console.log(`[EvalRunner] Creating dataset: ${datasetName}`);
    await client.createDataset(datasetName, {
      description: dataset.description,
    });

    // Add examples
    for (const example of dataset.examples) {
      await client.createExample(
        { messages: example.input },
        {
          datasetName,
          ...example.expected,
        },
      );
    }
  }
}

function generateReport(
  experiments: EvalRunResult['experiments'],
  allPassed: boolean,
  durationMs: number,
): string {
  const lines: string[] = [
    `# PANaCEa Agent Evaluation Report`,
    '',
    `**Date:** ${new Date().toISOString()}`,
    `**Duration:** ${(durationMs / 1000).toFixed(1)}s`,
    `**Overall:** ${allPassed ? '✅ PASSED' : '❌ FAILED'}`,
    '',
    '## Results by Agent',
    '',
    '| Agent | Overall | Medical Accuracy | Latency | Min Score | Status |',
    '|-------|---------|-----------------|---------|-----------|--------|',
  ];

  for (const exp of experiments) {
    const status = exp.passed ? '✅' : '❌';
    lines.push(
      `| ${exp.agentType} | ${(exp.scores.overall * 100).toFixed(0)}% | ${(exp.scores.medicalAccuracy * 100).toFixed(0)}% | ${exp.scores.avgLatencyMs.toFixed(0)}ms | ${(exp.scores.minExampleScore * 100).toFixed(0)}% | ${status} |`,
    );
  }

  if (!allPassed) {
    lines.push('', '## Failures', '');
    for (const exp of experiments) {
      if (!exp.passed) {
        lines.push(`### ${exp.agentType}`);
        lines.push(`- Overall: ${(exp.scores.overall * 100).toFixed(0)}%`);
        lines.push(`- Medical Accuracy: ${(exp.scores.medicalAccuracy * 100).toFixed(0)}%`);
        lines.push(`- Avg Latency: ${exp.scores.avgLatencyMs.toFixed(0)}ms`);
        lines.push('');
      }
    }
  }

  lines.push('', '---', '', `*Report generated by PANaCEa Eval Runner*`);
  return lines.join('\n');
}

// ─── CLI Entry Point ───────────────────────────────────────────────────────

/**
 * CLI entry point for running evals from npm scripts.
 * Parses command-line arguments and exits with appropriate code.
 */
export async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const ci = args.includes('--ci');
  const agentArg = args.find((a) => a.startsWith('--agent='));
  const agents = agentArg ? [agentArg.split('=')[1]!] : undefined;

  console.log('[EvalRunner] Starting PANaCEa agent evaluations...');
  console.log(`[EvalRunner] Mode: ${ci ? 'CI (strict)' : 'dev'}`);
  if (agents) console.log(`[EvalRunner] Agents: ${agents.join(', ')}`);

  const result = await runEvals({ agents, ci });

  console.log('\n' + result.report);

  if (!result.passed && ci) {
    console.error('\n❌ Quality gates failed in CI mode. Exiting with code 1.');
    process.exit(1);
  }

  if (!result.passed) {
    console.warn('\n⚠️  Quality gates failed. Run with --ci for strict enforcement.');
  }

  process.exit(0);
}

// Allow direct execution
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('runner.ts')) {
  main().catch((err) => {
    console.error('[EvalRunner] Fatal error:', err);
    process.exit(1);
  });
}
