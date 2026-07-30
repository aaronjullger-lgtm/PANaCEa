/**
 * Offline orchestration smoke — verifies the agent graph compiles and tools bind
 * without making any LLM/API call. Run: `tsx src/smoke.test.ts`
 *
 * Sets a dummy LLM key so canRunAgents() passes, then:
 *   1. loads env + tracing (dynamic @langfuse import path — should degrade gracefully w/o creds)
 *   2. builds each agent's tool bundle
 *   3. builds each agent graph via createReactAgent
 *   4. asserts the graph has a callable .invoke
 *
 * Does NOT call .invoke (that would hit Gemini and cost money / need real creds).
 */

import 'dotenv/config';

process.env.GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'smoke-dummy-key';
process.env.ORCHESTRATOR_ENV = process.env.ORCHESTRATOR_ENV || 'smoke';

import { envStatus, canRunAgents } from './config/env.js';
import { getTracingCallbacks } from './clients/tracing.js';
import { AGENT_REGISTRY, ALL_ROLES } from './agents/registry.js';

async function main(): Promise<void> {
  console.log('[smoke] env status:', JSON.stringify(envStatus()));
  if (!canRunAgents()) throw new Error('canRunAgents() false even with dummy key');

  // Tracing callbacks should degrade to [] since @langfuse/langchain is installed
  // but no real keys — confirm it returns an array.
  const callbacks = await getTracingCallbacks();
  console.log('[smoke] tracing callbacks count:', callbacks.length);

  let built = 0;
  for (const role of ALL_ROLES) {
    const def = AGENT_REGISTRY[role];
    const agent = await def.build({});
    if (typeof agent.invoke !== 'function') {
      throw new Error(`agent ${role} missing .invoke`);
    }
    console.log(`[smoke] ✓ built agent "${role}" — traceName="${agent.traceName}"`);
    built++;
  }

  if (built !== ALL_ROLES.length) {
    throw new Error(`built ${built} agents, expected ${ALL_ROLES.length}`);
  }

  console.log(`\n[smoke] PASS — all ${built} agent graphs compiled + tools bound`);
}

main().catch((err) => {
  console.error('[smoke] FAIL:', err);
  process.exit(1);
});