/**
 * LangSmith Evaluation Runner for PANaCEa Agents
 *
 * Runs agents against evaluation datasets and scores outputs using
 * custom evaluators for medical accuracy, consistency, and quality.
 *
 * Usage:
 *   npx tsx lib/langchain/evals/run-evals.ts
 *   npx tsx lib/langchain/evals/run-evals.ts --agent standardized-patient
 *   npx tsx lib/langchain/evals/run-evals.ts --difficulty advanced
 *
 * @module lib.langchain.evals.runner
 */

import { Client } from 'langsmith';
import { HumanMessage } from '@langchain/core/messages';
import { createAgent } from '../agent';
import {
  allEvalDatasets,
  getExamplesForAgent,
  type EvalExample,
} from './datasets';

// ─── Configuration ──────────────────────────────────────────────────────

const LANGSMITH_API_KEY = process.env.LANGSMITH_API_KEY;
const LANGSMITH_PROJECT = process.env.LANGSMITH_PROJECT ?? 'panacea-dev-agents';

if (!LANGSMITH_API_KEY) {
  console.error('LANGSMITH_API_KEY is required');
  process.exit(1);
}

const client = new Client({ apiKey: LANGSMITH_API_KEY });

// ─── Evaluators ─────────────────────────────────────────────────────────

interface EvalResult {
  exampleId: string;
  agentType: string;
  output: string;
  scores: {
    medicalAccuracy: number;
    completeness: number;
    formatCompliance: number;
    overall: number;
  };
  details: string[];
  latencyMs: number;
}

/**
 * Score medical accuracy based on keyword presence and constraints
 */
function scoreMedicalAccuracy(
  output: string,
  example: EvalExample
): { score: number; details: string[] } {
  const details: string[] = [];
  let score = 0;
  const outputLower = output.toLowerCase();

  // Check keywords
  if (example.expected.keywords) {
    const found = example.expected.keywords.filter((kw) =>
      outputLower.includes(kw.toLowerCase())
    );
    const keywordScore = found.length / example.expected.keywords.length;
    score += keywordScore * 0.6;
    details.push(
      `Keywords: ${found.length}/${example.expected.keywords.length} found`
    );
  }

  // Check medical constraints
  if (example.expected.medicalConstraints) {
    const satisfied = example.expected.medicalConstraints.filter((constraint) => {
      const lower = constraint.toLowerCase();
      // Simple heuristic: check if key terms from constraint appear in output
      const terms = lower
        .replace(/must|should|can/g, '')
        .trim()
        .split(' ')
        .filter((t) => t.length > 3);
      return terms.some((t) => outputLower.includes(t));
    });
    const constraintScore =
      satisfied.length / example.expected.medicalConstraints.length;
    score += constraintScore * 0.4;
    details.push(
      `Constraints: ${satisfied.length}/${example.expected.medicalConstraints.length} satisfied`
    );
  }

  return { score: Math.min(score, 1), details };
}

/**
 * Score completeness based on output length
 */
function scoreCompleteness(
  output: string,
  example: EvalExample
): { score: number; details: string[] } {
  const details: string[] = [];
  let score = 1;

  if (example.expected.minLength && output.length < example.expected.minLength) {
    score *= output.length / example.expected.minLength;
    details.push(
      `Output too short: ${output.length}/${example.expected.minLength} chars`
    );
  }

  if (example.expected.maxLength && output.length > example.expected.maxLength) {
    score *= example.expected.maxLength / output.length;
    details.push(
      `Output too long: ${output.length}/${example.expected.maxLength} chars`
    );
  }

  return { score: Math.max(score, 0), details };
}

/**
 * Score format compliance
 */
function scoreFormatCompliance(
  output: string,
  example: EvalExample
): { score: number; details: string[] } {
  const details: string[] = [];
  let score = 1;

  if (example.expected.format === 'json') {
    try {
      JSON.parse(output);
      details.push('Valid JSON');
    } catch {
      score = 0.5;
      details.push('Invalid JSON output');
    }
  }

  if (example.expected.format === 'markdown') {
    const hasHeaders = /^#{1,6}\s/m.test(output);
    const hasLists = /^[-*]\s/m.test(output) || /^\d+\.\s/m.test(output);
    if (hasHeaders || hasLists) {
      details.push('Markdown structure detected');
    } else {
      score *= 0.8;
      details.push('Missing markdown structure');
    }
  }

  return { score, details };
}

// ─── Runner ─────────────────────────────────────────────────────────────

async function runEvaluation(
  example: EvalExample
): Promise<EvalResult> {
  const startTime = Date.now();

  // Create agent for this example
  const agent = createAgent({
    model: 'gemini-2.0-flash',
    systemPrompt: getSystemPromptForAgent(example.agentType),
    runName: `eval:${example.agentType}:${example.id}`,
    tags: ['evaluation', example.agentType, example.difficulty],
    metadata: {
      exampleId: example.id,
      organSystem: example.organSystem,
      difficulty: example.difficulty,
    },
  });

  // Run agent
  const result = await agent.invoke({ messages: example.input });
  const output = result.output || '';
  const latencyMs = Date.now() - startTime;

  // Score output
  const medicalAccuracy = scoreMedicalAccuracy(output, example);
  const completeness = scoreCompleteness(output, example);
  const formatCompliance = scoreFormatCompliance(output, example);

  const overall =
    medicalAccuracy.score * 0.5 +
    completeness.score * 0.3 +
    formatCompliance.score * 0.2;

  return {
    exampleId: example.id,
    agentType: example.agentType,
    output,
    scores: {
      medicalAccuracy: medicalAccuracy.score,
      completeness: completeness.score,
      formatCompliance: formatCompliance.score,
      overall,
    },
    details: [
      ...medicalAccuracy.details,
      ...completeness.details,
      ...formatCompliance.details,
    ],
    latencyMs,
  };
}

/**
 * Get system prompt for agent type
 */
function getSystemPromptForAgent(agentType: string): string {
  const prompts: Record<string, string> = {
    'standardized-patient':
      'You are a standardized patient encounter simulator for PA students. Provide realistic clinical presentations and assess student responses for medical accuracy.',
    'ddx-generator':
      'You are a differential diagnosis generator for PA students. Generate comprehensive differential diagnoses based on clinical presentations.',
    'soap-note-grader':
      'You are a SOAP note grader for PA students. Evaluate SOAP notes for completeness, accuracy, and clinical reasoning.',
    'feedback-summarizer':
      'You are a feedback summarizer for PA students. Provide constructive, specific feedback on student performance.',
  };

  return prompts[agentType] ?? 'You are a medical education assistant.';
}

// ─── Main ───────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const agentFilter = args.find((a) => a.startsWith('--agent='))?.split('=')[1];
  const difficultyFilter = args
    .find((a) => a.startsWith('--difficulty='))
    ?.split('=')[1];

  console.log('Starting LangSmith evaluation run...');
  console.log(`Project: ${LANGSMITH_PROJECT}`);
  console.log(`Filters: agent=${agentFilter ?? 'all'}, difficulty=${difficultyFilter ?? 'all'}`);

  // Get examples to evaluate
  let examples = allEvalDatasets.flatMap((ds) => ds.examples);

  if (agentFilter) {
    examples = examples.filter((ex) => ex.agentType === agentFilter);
  }

  if (difficultyFilter) {
    examples = examples.filter((ex) => ex.difficulty === difficultyFilter);
  }

  console.log(`Running ${examples.length} evaluations...`);

  // Run evaluations
  const results: EvalResult[] = [];

  for (const example of examples) {
    console.log(`\nEvaluating: ${example.id} (${example.agentType})`);
    try {
      const result = await runEvaluation(example);
      results.push(result);
      console.log(`  Score: ${(result.scores.overall * 100).toFixed(1)}%`);
      console.log(`  Latency: ${result.latencyMs}ms`);
    } catch (error) {
      console.error(`  Error: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('EVALUATION SUMMARY');
  console.log('='.repeat(60));

  const avgOverall =
    results.reduce((sum, r) => sum + r.scores.overall, 0) / results.length;
  const avgMedical =
    results.reduce((sum, r) => sum + r.scores.medicalAccuracy, 0) /
    results.length;
  const avgLatency =
    results.reduce((sum, r) => sum + r.latencyMs, 0) / results.length;

  console.log(`Total evaluations: ${results.length}`);
  console.log(`Average overall score: ${(avgOverall * 100).toFixed(1)}%`);
  console.log(`Average medical accuracy: ${(avgMedical * 100).toFixed(1)}%`);
  console.log(`Average latency: ${avgLatency.toFixed(0)}ms`);

  // Save results to LangSmith
  console.log('\nSaving results to LangSmith...');
  for (const result of results) {
    await client.createRun({
      project_name: LANGSMITH_PROJECT,
      name: `eval:${result.agentType}:${result.exampleId}`,
      run_type: 'chain',
      inputs: { exampleId: result.exampleId },
      outputs: {
        output: result.output,
        scores: result.scores,
        details: result.details,
      },
      extra: { latencyMs: result.latencyMs },
    });
  }

  console.log('Results saved to LangSmith.');
  console.log(`View at: https://smith.langchain.com/projects/${LANGSMITH_PROJECT}`);
}

main().catch(console.error);
