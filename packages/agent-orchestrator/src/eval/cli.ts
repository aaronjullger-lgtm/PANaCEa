/**
 * Eval CLI entrypoint — `npm run eval:judge [role] [hours]`.
 *
 * Defaults: all roles, last 24h. Single role example: `npm run eval:judge -- incident-responder 168`
 * runs the judge over the last 7 days of incident-responder traces only.
 *
 * @module packages/agent-orchestrator/src/eval/cli
 */

import { describeDatasets, DATASET_NAMES } from './datasets.js';
import { runExperiment, runAllExperiments } from './experiments.js';
import { runJudge } from './judge.js';
import { shutdownTracing } from '../clients/tracing.js';

async function main(): Promise<void> {
  const [, , subcommand, ...args] = process.argv;

  switch (subcommand) {
    case 'datasets': {
      console.log('\nAvailable datasets:');
      for (const d of describeDatasets()) {
        console.log(`  ${d.name.padEnd(22)} ${d.caseCount} cases  (agent: ${d.agentRole})`);
      }
      break;
    }
    case 'run': {
      const datasetName = args[0];
      const useJudge = args.includes('--judge');
      const modelIdx = args.indexOf('--model');
      const model = modelIdx >= 0 ? args[modelIdx + 1] : undefined;
      if (!datasetName || !DATASET_NAMES.includes(datasetName)) {
        console.error(`Usage: eval:run <dataset-name> [--judge] [--model <name>]\nDatasets: ${DATASET_NAMES.join(', ')}`);
        process.exit(1);
      }
      console.log(`\nRunning experiment: ${datasetName}${useJudge ? ' (with LLM judge)' : ''}`);
      const result = await runExperiment(datasetName, { useLLMJudge: useJudge, model });
      console.log(`\nDone: ${result.passed}/${result.totalCases} passed, mean=${result.meanScore.toFixed(3)}`);
      break;
    }
    case 'all': {
      const useJudge = args.includes('--judge');
      console.log('\nRunning ALL experiments…');
      await runAllExperiments({ useLLMJudge: useJudge });
      break;
    }
    case 'judge': {
      const role = args[0];
      const hours = args[1] ? parseInt(args[1], 10) : 24;
      console.log(`\nRunning LLM-as-judge${role ? ` for ${role}` : ' (all roles)'} over last ${hours}h`);
      await runJudge(role, hours);
      break;
    }
    default: {
      console.log(`Usage: eval <command> [args]

Commands:
  datasets              List all available datasets + case counts
  run <name> [--judge]  Run one dataset experiment (optionally with LLM judge)
  all [--judge]         Run all dataset experiments
  judge [role] [hours]  Score stored Langfuse traces (LLM-as-judge)

Datasets: ${DATASET_NAMES.join(', ')}`);
      break;
    }
  }
}

main()
  .catch((err) => { console.error('[eval] failed:', err); process.exit(1); })
  .finally(() => shutdownTracing());