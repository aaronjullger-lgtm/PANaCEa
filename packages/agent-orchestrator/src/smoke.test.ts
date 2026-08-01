/**
 * Offline orchestration smoke — verifies the agent graph compiles and tools bind
 * without making any LLM/API call.
 *
 * Sets a dummy LLM key so canRunAgents() passes, then:
 *   1. loads env + tracing (dynamic @langfuse import path — should degrade gracefully w/o creds)
 *   2. builds each agent's tool bundle
 *   3. builds each agent graph via createReactAgent
 *   4. asserts the graph has a callable .invoke
 *
 * Does NOT call .invoke (that would hit Gemini and cost money / need real creds).
 */

import { describe, it, expect } from 'vitest';
import 'dotenv/config';

process.env.GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'smoke-dummy-key';
process.env.ORCHESTRATOR_ENV = process.env.ORCHESTRATOR_ENV || 'smoke';

import { envStatus, canRunAgents } from './config/env.js';
import { getTracingCallbacks } from './clients/tracing.js';
import { AGENT_REGISTRY, ALL_ROLES } from './agents/registry.js';

describe('orchestration smoke', () => {
  it('env is configured and canRunAgents() passes', () => {
    const status = envStatus();
    expect(status.llm).toBe('gemini');
    expect(canRunAgents()).toBe(true);
  });

  it('tracing callbacks degrades gracefully without real keys', async () => {
    const callbacks = await getTracingCallbacks();
    expect(Array.isArray(callbacks)).toBe(true);
    // Without real keys we expect 0 or 1 callback (the fallback handler)
    expect(callbacks.length).toBeLessThanOrEqual(1);
  });

  it('all agent graphs compile and have callable .invoke', async () => {
    let built = 0;
    for (const role of ALL_ROLES) {
      const def = AGENT_REGISTRY[role];
      const agent = await def.build({});
      expect(typeof agent.invoke).toBe('function');
      built++;
    }
    expect(built).toBe(ALL_ROLES.length);
  });
});