/**
 * Eval CLI entrypoint — `npm run eval:judge [role] [hours]`.
 *
 * Defaults: all roles, last 24h. Single role example: `npm run eval:judge -- incident-responder 168`
 * runs the judge over the last 7 days of incident-responder traces only.
 *
 * @module packages/agent-orchestrator/src/eval/cli
 */

import { runJudge } from './judge.js';
import { shutdownTracing } from '../clients/tracing.js';

async function main(): Promise<void> {
  const [, , roleArg, hoursArg] = process.argv;
  const hours = hoursArg ? parseInt(hoursArg, 10) : 24;
  const role = roleArg && !roleArg.startsWith('--') ? roleArg : undefined;

  if (!Number.isFinite(hours) || hours < 1) {
    console.error('[eval] hours must be a positive integer');
    process.exit(1);
  }

  console.log(`[eval] starting LLM-as-judge${role ? ` for ${role}` : ' (all roles)'} over last ${hours}h`);
  const results = await runJudge(role, hours);

  console.log('\n[eval] summary:');
  for (const r of results) {
    console.log(`  ${r.role}: ${r.judged}/${r.traced} judged, ${r.scoresPosted} scores posted`);
  }
  if (results.length === 0) {
    console.log('  (no Langfuse configured or no traces found)');
  }
}

main()
  .catch((err) => {
    console.error('[eval] failed:', err);
    process.exit(1);
  })
  .finally(() => shutdownTracing());