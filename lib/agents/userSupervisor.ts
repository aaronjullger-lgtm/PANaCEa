/**
 * User-facing supervisor — the single student entry point into the agent stack.
 *
 * Classifies a student request into one of four intents (tutor / osce / explain
 * / generate) and routes it to the best registered agent:
 *
 * - tutor    → preceptor-pimping     (Socratic teaching, rapid-fire questions)
 * - osce     → standardized-patient  (simulated patient encounters)
 * - explain  → feedback-summarizer   (answer rationale, coaching feedback)
 * - generate → none yet              (question-generator is catalogued in
 *                                     capabilities.ts but not a runtime agent;
 *                                     callers dispatch to generation endpoints)
 *
 * Routing is LLM-first (semantic intent classification via the shared LLM
 * router) with a deterministic keyword fallback when no model is available.
 * This is the student-facing counterpart of `clinical-supervisor-v2`, which
 * routes clinical *encounter* work; this supervisor routes general *study*
 * requests.
 *
 * @module lib/agents/userSupervisor
 */

import type { AgentContext, AgentError, AgentStatus } from './shared/types';
import { listAgents, invokeAgent } from './shared/runtime';
import { registerSupervisorV2 } from './supervisor-v2';
import { routeWithContext, type LLMRouterConfig } from './router/llmRouter';
import { isModelAvailable } from '@/lib/langchain/models';

// ─── Intents ─────────────────────────────────────────────────────────────────

export const USER_INTENTS = ['tutor', 'osce', 'explain', 'generate'] as const;

export type UserIntent = (typeof USER_INTENTS)[number] | 'unknown';

/**
 * Preferred agent per intent. `null` means the intent has no registered agent
 * yet — routing reports the intent and leaves dispatch to the caller.
 */
export const USER_INTENT_AGENTS: Record<UserIntent, string | null> = {
  tutor: 'preceptor-pimping',
  osce: 'standardized-patient',
  explain: 'feedback-summarizer',
  generate: null, // question-generator exists in capabilities.ts only (Phase 3)
  unknown: null,
};

/** Reverse lookup: agent name → intent, used to label LLM routing decisions. */
const AGENT_TO_INTENT: Record<string, UserIntent> = {
  'preceptor-pimping': 'tutor',
  'standardized-patient': 'osce',
  'feedback-summarizer': 'explain',
};

// ─── Deterministic Keyword Classifier ─────────────────────────────────────────

const INTENT_KEYWORDS: Record<Exclude<UserIntent, 'unknown'>, string[]> = {
  tutor: ['tutor', 'teach', 'learn', 'socratic', 'pimp', 'walk me through', 'quiz me', 'help me understand'],
  osce: ['osce', 'standardized patient', 'virtual patient', 'encounter', 'simulation', 'interview the patient', 'history taking', 'patient interview', 'role play'],
  explain: ['explain', 'why', 'rationale', 'break down', 'breakdown', 'feedback', 'review my', 'grade', 'what did i miss', 'coach me'],
  generate: ['generate', 'create', 'write a question', 'write questions', 'new question', 'practice questions', 'make a quiz', 'draft a question'],
};

/**
 * Deterministic keyword-based intent classification.
 *
 * Scores each intent by keyword hits on the lower-cased input; the intent with
 * the most hits wins. Ties break by declaration order (tutor > osce > explain >
 * generate) so behavior is stable. Returns 'unknown' when nothing matches.
 *
 * Pure function — no env, no I/O — safe for unit tests and CLI tools.
 */
export function classifyUserIntent(input: unknown): UserIntent {
  const inputStr = typeof input === 'string' ? input : JSON.stringify(input ?? '');
  const haystack = inputStr.toLowerCase();

  let best: Exclude<UserIntent, 'unknown'> | null = null;
  let bestCount = 0;

  for (const intent of USER_INTENTS) {
    const count = INTENT_KEYWORDS[intent].reduce(
      (acc, kw) => acc + (haystack.includes(kw) ? 1 : 0),
      0,
    );
    if (count > bestCount) {
      bestCount = count;
      best = intent;
    }
  }

  return best ?? 'unknown';
}

// ─── LLM Router Catalog ───────────────────────────────────────────────────────

/**
 * Student-facing catalog of routeable agents. Descriptions are canonical —
 * they mirror the agent definitions (preceptor.ts, capabilities.ts).
 */
export const USER_AGENT_CATALOG: Record<string, { description: string; capabilities: string[] }> = {
  'preceptor-pimping': {
    description:
      'Simulates a clinical preceptor who asks rapid-fire questions in ED, OR, rounds, or clinic settings. Adapts difficulty based on student performance.',
    capabilities: ['teaching', 'Socratic questioning', 'concept review', 'rapid-fire quiz'],
  },
  'standardized-patient': {
    description: 'Simulates a standardized patient for OSCE encounters',
    capabilities: ['history taking', 'physical exam', 'patient interaction', 'OSCE practice'],
  },
  'feedback-summarizer': {
    description: 'Summarizes clinical encounter feedback into actionable insights',
    capabilities: ['feedback generation', 'coaching', 'rationale explanation', 'performance review'],
  },
};

const USER_SUPERVISOR_PROMPT = `You are the intent router for a PA student study platform (PANaCEa).
Classify each student request into one of four intents and route it to the matching agent:

- tutor → preceptor-pimping: Socratic teaching, concept explanations, quizzes, walking through material
- osce → standardized-patient: simulated patient encounters, history taking, OSCE practice
- explain → feedback-summarizer: feedback on answers, rationale for correct/incorrect choices, coaching

Rules:
1. Choose the agent whose capabilities best match the student's intent.
2. Only pick agents from the catalog below — never invent names.
3. Set confidence based on how clearly the request matches.
4. For ambiguous requests, prefer the most generally helpful agent.
5. Requests that ask for new practice questions (generate intent) have no agent yet — route to the closest match and keep confidence low.
6. Stop after the routing decision — do not answer the student's question yourself.`;

/**
 * Build the LLM router config for student-facing routing.
 *
 * The catalog is filtered to agents that are actually registered, so the LLM
 * can only ever propose a resolvable agent. Pass `registered` explicitly for
 * deterministic tests; defaults to the live runtime registry.
 */
export function buildUserRouterConfig(registered?: Set<string>): LLMRouterConfig {
  const available = registered ?? new Set(listAgents().map((a) => a.name));
  const agents = [...new Set(
    USER_INTENTS
      .map((intent) => USER_INTENT_AGENTS[intent])
      .filter((name): name is string => name !== null && available.has(name)),
  )];

  return {
    agents: agents.map((name) => ({
      name,
      description: USER_AGENT_CATALOG[name]?.description ?? name,
      capabilities: USER_AGENT_CATALOG[name]?.capabilities ?? [],
    })),
    minConfidence: 0.3,
    defaultAgent: agents.includes('feedback-summarizer') ? 'feedback-summarizer' : agents[0],
    systemPrompt: USER_SUPERVISOR_PROMPT,
  };
}

// ─── Keyword Router (supervisor-v2 compatible) ───────────────────────────────

/**
 * Keyword-based fallback router matching the `SupervisorV2Config.keywordRouter`
 * signature `(input, agents) => string | null`.
 */
export function userIntentKeywordRouter(input: unknown, agents: string[]): string | null {
  const intent = classifyUserIntent(input);
  const agent = USER_INTENT_AGENTS[intent];
  return agent && agents.includes(agent) ? agent : null;
}

// ─── Registration ─────────────────────────────────────────────────────────────

/**
 * Register the `user-supervisor-v2` supervisor in the supervisor registry.
 *
 * Only agents that are already registered in the runtime registry are listed,
 * so `runSupervisorV2('user-supervisor-v2', …)` never targets a missing agent.
 * Call this after agent modules have self-registered (registry.ts does).
 */
export function registerUserSupervisorV2(): void {
  const registered = new Set(listAgents().map((a) => a.name));
  const agentNames = [...new Set(
    USER_INTENTS
      .map((intent) => USER_INTENT_AGENTS[intent])
      .filter((name): name is string => name !== null && registered.has(name)),
  )];

  registerSupervisorV2({
    name: 'user-supervisor-v2',
    description: 'Student-facing intent router — tutor / OSCE / explain / generate',
    agentNames,
    preferLLM: true,
    routerConfig: buildUserRouterConfig(registered),
    keywordRouter: userIntentKeywordRouter,
  });
}

// ─── Routing ──────────────────────────────────────────────────────────────────

export interface UserRoutingDecision {
  intent: UserIntent;
  /** Agent to invoke, or null when no registered agent serves the intent. */
  agent: string | null;
  confidence: number;
  reasoning: string;
  routingMethod: 'llm' | 'keyword';
}

/**
 * Route a student request to an agent — LLM-first with keyword fallback.
 *
 * When a model is available, semantic routing decides; the decision's agent is
 * validated against the live registry before acceptance. Without a model, the
 * deterministic keyword classifier handles it.
 */
export async function routeUserIntent(
  input: unknown,
  ctx: AgentContext,
): Promise<UserRoutingDecision> {
  const inputStr = typeof input === 'string' ? input : JSON.stringify(input ?? '');
  const registered = new Set(listAgents().map((a) => a.name));
  const config = buildUserRouterConfig(registered);

  if (config.agents.length > 0 && isModelAvailable('gemini-2.0-flash', ctx.env)) {
    try {
      const decision = await routeWithContext(inputStr, config, ctx);
      if (decision.agent && registered.has(decision.agent)) {
        return {
          intent: AGENT_TO_INTENT[decision.agent] ?? classifyUserIntent(inputStr),
          agent: decision.agent,
          confidence: decision.confidence,
          reasoning: decision.reasoning,
          routingMethod: 'llm',
        };
      }
    } catch {
      // LLM routing failed — fall through to the keyword classifier
    }
  }

  const intent = classifyUserIntent(inputStr);
  const agent = USER_INTENT_AGENTS[intent];
  const hasAgent = agent !== null && registered.has(agent);

  return {
    intent,
    agent: hasAgent ? agent : null,
    confidence: hasAgent ? 0.55 : 0,
    reasoning: hasAgent
      ? `Keyword match: "${intent}" → ${agent}`
      : `No registered agent for intent "${intent}"`,
    routingMethod: 'keyword',
  };
}

// ─── Execution ────────────────────────────────────────────────────────────────

export interface UserSupervisorResult {
  supervisor: 'user-supervisor-v2';
  intent: UserIntent;
  /** Agent invoked, or null when no registered agent serves the intent. */
  agent: string | null;
  routingMethod: 'llm' | 'keyword';
  confidence: number;
  reasoning: string;
  status: AgentStatus | 'no_agent';
  output: unknown;
  error: AgentError | null;
  durationMs: number;
}

/**
 * End-to-end student request handling: route, then invoke the chosen agent.
 *
 * When the routed intent has no registered agent (currently `generate`), the
 * result carries `status: 'no_agent'` with the classified intent so callers can
 * dispatch to the appropriate endpoint instead.
 */
export async function runUserSupervisor(
  input: unknown,
  ctx: AgentContext,
): Promise<UserSupervisorResult> {
  const start = Date.now();
  const routing = await routeUserIntent(input, ctx);

  if (!routing.agent) {
    return {
      supervisor: 'user-supervisor-v2',
      intent: routing.intent,
      agent: null,
      routingMethod: routing.routingMethod,
      confidence: routing.confidence,
      reasoning: routing.reasoning,
      status: 'no_agent',
      output: null,
      error: null,
      durationMs: Date.now() - start,
    };
  }

  const result = await invokeAgent(routing.agent, input, ctx);

  return {
    supervisor: 'user-supervisor-v2',
    intent: routing.intent,
    agent: routing.agent,
    routingMethod: routing.routingMethod,
    confidence: routing.confidence,
    reasoning: routing.reasoning,
    status: result.status,
    output: result.output,
    error: result.error,
    durationMs: Date.now() - start,
  };
}
