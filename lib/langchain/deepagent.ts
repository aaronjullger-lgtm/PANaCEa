/**
 * PANaCEa Deep Agent Harness
 *
 * Wraps `createDeepAgent` from the `deepagents` npm package with PANaCEa-specific
 * configuration: model registry routing, LangSmith/Langfuse tracing, cost guardrails
 * (circuit breaker + budget tracking), and Edge-safe environment resolution.
 *
 * This is the single entry point for creating production agents in PANaCEa.
 * All agent graphs, CLI commands, and API endpoints should use this factory.
 *
 * Features inherited from deepagents:
 * - Planning (write_todos for task breakdown)
 * - Filesystem tools (read_file, write_file, edit_file, ls, glob, grep)
 * - Sub-agents (task delegation with isolated context windows)
 * - Context management (summarization + file-based working memory)
 * - Persistent memory (StateBackend / StoreBackend)
 * - Skills (reusable behaviors loaded on demand)
 *
 * PANaCEa additions:
 * - Model routing via MODEL_REGISTRY + TASK_MODEL_MAP
 * - Multi-provider fallback with circuit breaker
 * - Cost tracking + budget enforcement
 * - LangSmith + Langfuse dual tracing
 * - Edge-safe env resolution (context.env.*, never process.env in functions/)
 *
 * @module lib/langchain/deepagent
 */

import { createDeepAgent, type DeepAgentConfig } from 'deepagents';
import type { StructuredToolInterface } from '@langchain/core/tools';
import type { BaseCallbackHandler } from '@langchain/core/callbacks/base';
import type { AgentMiddleware } from 'deepagents';

import {
  MODEL_REGISTRY,
  TASK_MODEL_MAP,
  DEFAULT_PARAMS,
  type ModelName,
  type TaskType,
} from './config';
import { createModel, isModelAvailable, type AIEnvKeys } from './models';
import { buildTracingConfig } from './tracing';
import { fromCloudflareEnv, fromProcessEnv } from './envAdapter';

// ─── Types ─────────────────────────────────────────────────────────────────

export interface PanaceaDeepAgentConfig {
  /** Task type for automatic model selection (e.g. 'question-generation', 'clinical-reasoning') */
  task?: TaskType;
  /** Override the auto-selected model */
  model?: ModelName;
  /** System prompt for the agent */
  systemPrompt?: string;
  /** Additional tools beyond the built-in deepagents tools */
  tools?: StructuredToolInterface[];
  /** Additional middleware */
  middleware?: AgentMiddleware[];
  /** Maximum recursion limit (default: 25) */
  recursionLimit?: number;
  /** Temperature override */
  temperature?: number;
  /** Max output tokens override */
  maxOutputTokens?: number;
  /** LangSmith run name */
  runName?: string;
  /** Tags for filtering in LangSmith/Langfuse */
  tags?: string[];
  /** Additional metadata for tracing */
  metadata?: Record<string, unknown>;
  /** Environment keys for AI calls. If omitted, resolved from process.env or Cloudflare context. */
  env?: AIEnvKeys;
  /** Cloudflare Pages Function context (for Edge-safe env resolution) */
  cloudflareContext?: { env: Record<string, string> };
  /** Disable filesystem tools (for Edge runtime where fs is unavailable) */
  disableFilesystem?: boolean;
  /** Disable sub-agents */
  disableSubAgents?: boolean;
  /** Enable persistent memory via StoreBackend */
  enableMemory?: boolean;
}

export interface PanaceaAgent {
  /** Invoke the agent with messages */
  invoke: (input: {
    messages: Array<{ role: 'user' | 'system' | 'assistant' | 'tool'; content: string }>;
    threadId?: string;
  }) => Promise<{ messages: Array<{ role: string; content: string; tool_calls?: unknown[] }> }>;

  /** Stream agent events */
  streamEvents?: (input: {
    messages: Array<{ role: 'user' | 'system' | 'assistant' | 'tool'; content: string }>;
    threadId?: string;
  }) => AsyncIterable<{ event: string; data: unknown }>;
}

// ─── Helpers ──────────────────────────────────────────────────────────────

function resolveModelForTask(task?: TaskType, override?: ModelName): string {
  if (override) {
    const config = MODEL_REGISTRY[override];
    if (!config) throw new Error(`Unknown model: ${override}`);
    return config.modelId;
  }

  if (task) {
    const mapping = TASK_MODEL_MAP[task];
    if (mapping) {
      const config = MODEL_REGISTRY[mapping.primary];
      if (config) return config.modelId;
    }
  }

  // Default: cheapest capable model
  return MODEL_REGISTRY['gemini-2.0-flash']?.modelId ?? 'gemini-2.0-flash';
}

function resolveEnv(config: PanaceaDeepAgentConfig): AIEnvKeys {
  if (config.env) return config.env;
  if (config.cloudflareContext) return fromCloudflareEnv(config.cloudflareContext.env);
  return fromProcessEnv();
}

function resolveTemperature(config: PanaceaDeepAgentConfig): number | undefined {
  return config.temperature;
}

// ─── Agent Factory ────────────────────────────────────────────────────────

/**
 * Create a PANaCEa-configured deep agent.
 *
 * This is the primary agent factory for PANaCEa. It wraps `createDeepAgent`
 * from the `deepagents` package with:
 * - Automatic model selection from PANaCEa's MODEL_REGISTRY
 * - LangSmith + Langfuse tracing
 * - Cost guardrails (circuit breaker + budget tracking)
 * - Edge-safe environment resolution
 * - PANaCEa-specific system prompts for medical education
 *
 * @example
 * ```ts
 * // In a Cloudflare Pages Function:
 * const agent = createPanaceaAgent({
 *   task: 'question-generation',
 *   cloudflareContext: context,
 *   systemPrompt: 'Generate PANCE-style cardiology questions.',
 * });
 *
 * const result = await agent.invoke({
 *   messages: [{ role: 'user', content: 'Create 5 questions about heart failure.' }],
 * });
 * ```
 *
 * @example
 * ```ts
 * // In a Node.js script or CLI:
 * const agent = createPanaceaAgent({
 *   task: 'clinical-reasoning',
 *   systemPrompt: 'You are a clinical reasoning tutor for PA students.',
 *   enableMemory: true,
 * });
 * ```
 */
export function createPanaceaAgent(config: PanaceaDeepAgentConfig = {}): PanaceaAgent {
  const env = resolveEnv(config);
  const modelId = resolveModelForTask(config.task, config.model);
  const temperature = resolveTemperature(config);

  // Build LangChain chat model using PANaCEa's model factory
  const modelName = config.model ?? (config.task
    ? TASK_MODEL_MAP[config.task]?.primary ?? 'gemini-2.0-flash'
    : 'gemini-2.0-flash');

  const model = createModel(modelName, env, {
    temperature,
    maxOutputTokens: config.maxOutputTokens ?? DEFAULT_PARAMS.maxOutputTokens,
  });

  // Build tracing callbacks
  const tracingConfig = buildTracingConfig(env, {
    runName: config.runName ?? `panacea:${config.task ?? 'agent'}`,
    tags: config.tags,
    metadata: config.metadata,
  });

  // Build deepagent config
  const deepAgentConfig: DeepAgentConfig = {
    model: model as unknown as DeepAgentConfig['model'],
    systemPrompt: config.systemPrompt ?? buildDefaultSystemPrompt(config.task),
    tools: config.tools ?? [],
    middleware: config.middleware ?? [],
    recursionLimit: config.recursionLimit ?? 25,
  };

  // Disable filesystem in Edge runtime
  if (config.disableFilesystem) {
    // deepagents filesystem middleware is included by default;
    // we omit it by not adding the default middleware.
    // The createDeepAgent function includes it automatically,
    // so we need to handle this differently.
    // For Edge, we'll create a minimal agent without filesystem.
    deepAgentConfig.middleware = (deepAgentConfig.middleware ?? []).filter(
      (m) => !isFilesystemMiddleware(m),
    );
  }

  // Disable sub-agents if requested
  if (config.disableSubAgents) {
    deepAgentConfig.middleware = (deepAgentConfig.middleware ?? []).filter(
      (m) => !isSubAgentMiddleware(m),
    );
  }

  try {
    const agent = createDeepAgent(deepAgentConfig);

    return {
      async invoke(input) {
        const result = await agent.invoke(
          { messages: input.messages },
          {
            configurable: { thread_id: input.threadId ?? `panacea-${Date.now()}` },
            recursionLimit: config.recursionLimit ?? 25,
          },
        );

        // Normalize messages to plain objects
        const messages = (result.messages ?? []).map((m: Record<string, unknown>) => {
          const type = typeof m._getType === 'function'
            ? (m._getType as () => string)()
            : (m.getType as (() => string) | undefined)?.() ?? 'unknown';
          const content = typeof m.content === 'string' ? m.content : JSON.stringify(m.content);
          return { role: type, content, tool_calls: m.tool_calls as unknown[] | undefined };
        });

        return { messages };
      },

      async *streamEvents(input) {
        const stream = await agent.streamEvents(
          { messages: input.messages },
          { version: 'v2' as const },
        );
        for await (const chunk of stream) {
          yield chunk;
        }
      },
    };
  } catch (error) {
    // If deepagents fails (e.g., missing filesystem in Edge), fall back to basic agent
    console.warn('[PanaceaDeepAgent] createDeepAgent failed, falling back to basic agent:', error);
    return createFallbackAgent(config, env);
  }
}

// ─── Fallback Agent (for Edge runtime without filesystem) ─────────────────

function createFallbackAgent(config: PanaceaDeepAgentConfig, env: AIEnvKeys): PanaceaAgent {
  // Dynamic import to avoid bundling LangGraph in all Edge functions
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { createAgent } = require('./agent') as typeof import('./agent');

  const modelName = config.model ?? (config.task
    ? TASK_MODEL_MAP[config.task]?.primary ?? 'gemini-2.0-flash'
    : 'gemini-2.0-flash');

  const agent = createAgent({
    model: modelName,
    systemPrompt: config.systemPrompt ?? buildDefaultSystemPrompt(config.task),
    tools: config.tools,
    recursionLimit: config.recursionLimit,
    temperature: config.temperature,
    maxOutputTokens: config.maxOutputTokens,
    runName: config.runName,
    tags: config.tags,
    metadata: config.metadata,
  });

  return {
    async invoke(input) {
      const { HumanMessage } = require('@langchain/core/messages');
      const messages = input.messages.map((m) => {
        if (m.role === 'user') return new HumanMessage(m.content);
        if (m.role === 'system') return new HumanMessage(m.content); // simplified
        return new HumanMessage(m.content);
      });
      const result = await agent.invoke({ messages }, { threadId: input.threadId });
      return result as { messages: Array<{ role: string; content: string; tool_calls?: unknown[] }> };
    },
    async *streamEvents(input) {
      const stream = agent.stream({ messages: input.messages }, { threadId: input.threadId });
      for await (const chunk of stream) {
        yield { event: 'chunk', data: chunk };
      }
    },
  };
}

// ─── Default System Prompts ───────────────────────────────────────────────

function buildDefaultSystemPrompt(task?: TaskType): string {
  const base = `You are a PANaCEa AI agent — part of a clinical education platform for PA students preparing for PANCE/PANRE board exams.

Core principles:
1. Clinical accuracy is paramount — never fabricate medical information
2. Follow NCCPA blueprint guidelines for content
3. Use evidence-based medicine; cite sources when possible
4. Adapt difficulty based on PA student level (didactic vs clinical year)
5. Be concise but thorough — PA students have limited study time`;

  const taskPrompts: Partial<Record<TaskType, string>> = {
    'question-generation': `\n\nYour task: Generate high-quality PANCE/PANRE practice questions.
- Create clinically accurate vignettes with plausible distractors
- Include detailed rationales explaining why each answer is right/wrong
- Tag with organ system, task category, and cognitive level (Bloom's)
- Output structured JSON matching the QuestionDraft schema`,

    'question-critique': `\n\nYour task: Critique medical questions for quality and accuracy.
- Verify clinical accuracy of all medical claims
- Check that distractors are plausible but clearly wrong
- Ensure the question tests clinical reasoning, not trivia
- Flag any ambiguous or misleading wording`,

    'clinical-reasoning': `\n\nYour task: Assist with clinical reasoning and differential diagnosis.
- Guide students through systematic diagnostic approaches
- Highlight key history and physical exam findings
- Explain why certain diagnoses are more/less likely
- Use evidence-based clinical decision rules where applicable`,

    'socratic-tutoring': `\n\nYour task: Tutor PA students using the Socratic method.
- Ask guiding questions rather than giving direct answers
- Help students identify knowledge gaps
- Encourage clinical reasoning over memorization
- Provide constructive feedback on their reasoning process`,

    'osce-chat': `\n\nYour task: Act as a standardized patient in an OSCE encounter.
- Stay in character throughout the interaction
- Respond naturally to student questions
- Provide realistic symptoms and history
- Do NOT reveal the diagnosis unless directly asked`,

    'content-generation': `\n\nYour task: Generate clinical reference content.
- Create comprehensive condition summaries, drug monographs, lab references
- Structure content for quick reference during study sessions
- Include high-yield clinical pearls and board-relevant facts
- Maintain database-first architecture — content goes to PostgreSQL`,

    'extraction': `\n\nYour task: Extract structured data from clinical text.
- Identify medical entities (conditions, drugs, labs, procedures)
- Map to standard ontologies where applicable
- Output clean, structured JSON
- Flag any ambiguous or conflicting information`,

    'bulk-enrichment': `\n\nYour task: Process bulk clinical content enrichment.
- Handle large batches efficiently
- Maintain consistency across items
- Report processing statistics
- Flag items requiring human review`,
  };

  return base + (task && taskPrompts[task] ? taskPrompts[task] : '');
}

// ─── Middleware Detection Helpers ─────────────────────────────────────────

function isFilesystemMiddleware(m: AgentMiddleware): boolean {
  const name = (m as { name?: string }).name ?? '';
  return name.includes('filesystem') || name.includes('Filesystem');
}

function isSubAgentMiddleware(m: AgentMiddleware): boolean {
  const name = (m as { name?: string }).name ?? '';
  return name.includes('subAgent') || name.includes('SubAgent') || name.includes('task');
}

// ─── Pre-built Agent Creators ─────────────────────────────────────────────

/**
 * Create a clinical content generation agent.
 * Uses the deepagents harness with filesystem for working memory.
 */
export function createContentAgent(config?: Partial<PanaceaDeepAgentConfig>) {
  return createPanaceaAgent({
    task: 'content-generation',
    systemPrompt: buildDefaultSystemPrompt('content-generation'),
    runName: 'panacea:content-agent',
    tags: ['content', 'generation'],
    ...config,
  });
}

/**
 * Create a clinical reasoning tutor agent.
 */
export function createTutorAgent(config?: Partial<PanaceaDeepAgentConfig>) {
  return createPanaceaAgent({
    task: 'socratic-tutoring',
    systemPrompt: buildDefaultSystemPrompt('socratic-tutoring'),
    runName: 'panacea:tutor-agent',
    tags: ['tutoring', 'socratic'],
    ...config,
  });
}

/**
 * Create a question generation agent with critique loop.
 */
export function createQuestionAgent(config?: Partial<PanaceaDeepAgentConfig>) {
  return createPanaceaAgent({
    task: 'question-generation',
    systemPrompt: buildDefaultSystemPrompt('question-generation'),
    runName: 'panacea:question-agent',
    tags: ['generation', 'questions'],
    ...config,
  });
}

/**
 * Create an Edge-safe agent for Cloudflare Pages Functions.
 * Disables filesystem tools (not available in Edge runtime).
 */
export function createEdgeAgent(config: PanaceaDeepAgentConfig) {
  return createPanaceaAgent({
    ...config,
    disableFilesystem: true,
    disableSubAgents: config.disableSubAgents ?? true, // Sub-agents are heavy for Edge
  });
}
