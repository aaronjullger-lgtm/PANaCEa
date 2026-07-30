import { DATASETS, DATASET_NAMES, type DatasetCase } from './datasets.js';
import { evalDeterministic, evalLLMJudge, casePassed, type EvalScore, type CaseResult } from './evaluators.js';
import { buildSpecialist, SPECIALIST_ROLES, type SpecialistRole } from '../agents/specialists.js';
import { buildContentAuditAgent } from '../agents/contentAudit.js';
import { remember } from '../clients/qdrant.js';
import { getEnv, getLangfuseHost, getCapabilities } from '../config/env.js';

export interface ExperimentResult {
  dataset: string;
  agentRole: string;
  totalCases: number;
  passed: number;
  failed: number;
  meanScore: number;
  caseResults: CaseResult[];
}

async function getAgent(role: string) {
  if (SPECIALIST_ROLES.includes(role as SpecialistRole)) {
    return buildSpecialist(role as SpecialistRole);
  }
  if (role === 'content-audit') return buildContentAuditAgent({});
  throw new Error(`No builder for role "${role}"`);
}

async function postScoreToLangfuse(traceId: string, score: EvalScore): Promise<void> {
  const caps = getCapabilities();
  if (!caps.langfuse) return;
  const env = getEnv();
  const base = getLangfuseHost() ?? 'https://cloud.langfuse.com';
  try {
    await fetch(`${base}/api/public/scores`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Basic ' + Buffer.from(`${env.LANGFUSE_PUBLIC_KEY}:${env.LANGFUSE_SECRET_KEY}`).toString('base64'),
      },
      body: JSON.stringify({ traceId, name: score.name, value: score.value, comment: score.comment, dataType: 'NUMERIC' }),
    });
  } catch { /* best effort */ }
}

export async function runExperiment(
  datasetName: string,
  opts: { useLLMJudge?: boolean; model?: string } = {},
): Promise<ExperimentResult> {
  const cases = DATASETS[datasetName];
  if (!cases) throw new Error(`Dataset "${datasetName}" not found. Available: ${DATASET_NAMES.join(', ')}`);

  const agentRole = cases[0]?.agentRole ?? 'unknown';
  const agent = await getAgent(agentRole);
  const caseResults: CaseResult[] = [];
  let totalScore = 0;
  let scoreCount = 0;

  for (const tc of cases) {
    process.stdout.write(`  [${tc.id}] running…`);
    try {
      const { messages } = await agent.invoke({ messages: [{ role: 'user', content: tc.input }] });
      const output = messages.at(-1)?.content ?? '';

      const detScores = evalDeterministic(agentRole, output, tc);
      let allScores = detScores;

      if (opts.useLLMJudge) {
        const judgeScore = await evalLLMJudge(agentRole, tc.input, output, opts.model);
        allScores = [...detScores, judgeScore];
      }

      const passed = casePassed(allScores);
      caseResults.push({ caseId: tc.id, passed, scores: allScores, output: output.slice(0, 2000) });

      for (const s of allScores) {
        totalScore += s.value;
        scoreCount++;
      }

      console.log(` ${passed ? '✓ PASS' : '✗ FAIL'} (${allScores.map((s) => `${s.name}=${s.value.toFixed(2)}`).join(', ')})`);

      await remember('context', `eval_${tc.id}_${Date.now()}`, `eval ${agentRole} ${tc.id}: ${passed ? 'PASS' : 'FAIL'}`, {
        kind: 'eval_result', dataset: datasetName, caseId: tc.id, passed, scores: allScores,
      });
    } catch (err) {
      console.log(` ✗ ERROR: ${err instanceof Error ? err.message : String(err)}`);
      caseResults.push({
        caseId: tc.id, passed: false,
        scores: [{ name: 'execution', value: 0, comment: err instanceof Error ? err.message : String(err) }],
        output: '',
      });
    }
  }

  const passed = caseResults.filter((r) => r.passed).length;
  const failed = caseResults.length - passed;
  const meanScore = scoreCount > 0 ? totalScore / scoreCount : 0;

  const result: ExperimentResult = {
    dataset: datasetName, agentRole, totalCases: cases.length, passed, failed, meanScore, caseResults,
  };

  console.log(`\n  Dataset "${datasetName}": ${passed}/${cases.length} passed, mean score ${meanScore.toFixed(3)}`);
  return result;
}

export async function runAllExperiments(opts: { useLLMJudge?: boolean; model?: string } = {}): Promise<ExperimentResult[]> {
  const results: ExperimentResult[] = [];
  for (const name of DATASET_NAMES) {
    console.log(`\n=== Experiment: ${name} ===`);
    const result = await runExperiment(name, opts);
    results.push(result);
  }

  console.log('\n════════ EXPERIMENT SUMMARY ════════');
  for (const r of results) {
    const pct = ((r.passed / r.totalCases) * 100).toFixed(0);
    console.log(`  ${r.dataset.padEnd(22)} ${r.passed}/${r.totalCases} (${pct}%)  mean=${r.meanScore.toFixed(3)}`);
  }
  const totalPass = results.reduce((s, r) => s + r.passed, 0);
  const totalCases = results.reduce((s, r) => s + r.totalCases, 0);
  console.log(`  ${'TOTAL'.padEnd(22)} ${totalPass}/${totalCases} (${((totalPass / totalCases) * 100).toFixed(0)}%)`);

  return results;
}