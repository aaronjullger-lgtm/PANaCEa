/**
 * Unified LangChain Agent Entry Point
 *
 * Provides `createAgent()` for building production agents with LangChain.
 * Uses `createReactAgent` from `@langchain/langgraph/prebuilt` for the
 * standard ReAct loop (tool binding, message history, recursion limit).
 *
 * Consolidates the previous custom StateGraph implementation with the
 * agent-orchestrator package's pattern — one agent factory, two call sites.
 *
 * @module lib.langchain.agent
 */

import { SystemMessage, type BaseMessage } from '@langchain/core/messages';
import type { StructuredToolInterface } from '@langchain/core/tools';
import { createReactAgent } from '@langchain/langgraph/prebuilt';

import {
  MODEL_REGISTRY,
  TASK_MODEL_MAP,
  DEFAULT_PARAMS,
  type ModelName,
  type TaskType,
} from './config';
import { createModel, type AIEnvKeys } from './models';
import { buildTracingConfig } from './tracing';

// ─── Agent Configuration ────────────────────────────────────────────────

export interface AgentConfig {
  /** Model name from registry or task type for auto-selection */
  model?: ModelName | TaskType;
  /** System prompt for the agent */
  systemPrompt?: string;
  /** Tools available to the agent */
  tools?: StructuredToolInterface[];
  /** Maximum recursion limit (tool-call loops) */
  recursionLimit?: number;
  /** Temperature override */
  temperature?: number;
  /** Max output tokens override */
  maxOutputTokens?: number;
  /** LangSmith run name */
  runName?: string;
  /** Additional metadata for tracing */
  metadata?: Record<string, unknown>;
  /** Tags for filtering in LangSmith */
  tags?: string[];
}

// ─── Return Type ────────────────────────────────────────────────────────

export interface AgentInstance {
  /** Invoke the agent with messages, returning the full state */
  invoke(
    input: { messages: BaseMessage[] },
    options?: { threadId?: string },
  ): Promise<{ messages: BaseMessage[]; output: string }>;

  /** Stream the agent execution, yielding state chunks */
  stream(
    input: { messages: BaseMessage[] },
    options?: { threadId?: string },
  ): AsyncGenerator<Record<string, unknown>>;
}

// ─── Helpers ──────────────────────────────────────────────────────────────

function resolveModelName(input?: ModelName | TaskType): ModelName {
  if (!input) return 'gemini-2.0-flash';

  // Direct model name
  if (input in MODEL_REGISTRY) return input as ModelName;

  // Task type → primary model
  const taskConfig = TASK_MODEL_MAP[input as TaskType];
  if (taskConfig) return taskConfig.primary;

  return 'gemini-2.0-flash';
}

function getAgentEnv(): AIEnvKeys {
  const env = typeof process !== 'undefined' ? process.env : ({} as Record<string, string | undefined>);
  return {
    GEMINI_API_KEY: env.GEMINI_API_KEY,
    OPENAI_API_KEY: env.OPENAI_API_KEY,
    ANTHROPIC_API_KEY: env.ANTHROPIC_API_KEY,
    DEEPSEEK_API_KEY: env.DEEPSEEK_API_KEY,
    DEEPINFRA_API_KEY: env.DEEPINFRA_API_KEY,
    OPENROUTER_API_KEY: env.OPENROUTER_API_KEY,
    LANGSMITH_API_KEY: env.LANGSMITH_API_KEY,
    LANGSMITH_PROJECT: env.LANGSMITH_PROJECT,
  };
}

/**
 * Extract the final text output from agent messages.
 * Returns the content of the last AI message (skipping tool calls).
 */
function extractOutput(messages: BaseMessage[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i]!;
    const type = msg.getType?.() ?? msg._getType?.() ?? 'unknown';
    if (type === 'ai' || type === 'AIMessage') {
      const content = msg.content;
      if (typeof content === 'string') return content;
      if (Array.isArray(content)) {
        // Find the first text block
        const textBlock = content.find(
          (b: unknown) => typeof b === 'object' && b !== null && (b as Record<string, unknown>).type === 'text',
        ) as { text?: string } | undefined;
        if (textBlock?.text) return textBlock.text;
        return JSON.stringify(content);
      }
      return String(content);
    }
  }
  return '';
}

// ─── Agent Factory ──────────────────────────────────────────────────────

/**
 * Create a LangChain agent with automatic model selection and tracing.
 *
 * Uses `createReactAgent` from `@langchain/langgraph/prebuilt` for the
 * standard ReAct loop — tool binding, message history, and recursion
 * limit are all handled internally.
 *
 * @example
 * ```ts
 * const agent = createAgent({
 *   model: 'question-generation',
 *   systemPrompt: 'You are a medical question writer.',
 * });
 *
 * const result = await agent.invoke({
 *   messages: [new HumanMessage('Generate a cardiology question')],
 * });
 * console.log(result.output);
 * ```
 */
export function createAgent(config: AgentConfig): AgentInstance {
  const env = getAgentEnv();
  const modelName = resolveModelName(config.model);
  const model = createModel(modelName, env, {
    temperature: config.temperature,
    maxOutputTokens: config.maxOutputTokens,
  });

  const tools = config.tools ?? [];
  const systemPrompt = config.systemPrompt;

  // Build the ReAct agent via createReactAgent.
  // This handles: model.bindTools(tools), ToolNode, conditional routing,
  // message history accumulation, and recursion limit internally.
  const graph = createReactAgent({
    llm: model,
    tools,
    messageModifier: systemPrompt ? new SystemMessage(systemPrompt) : undefined,
  });

  const runName = config.runName ?? `agent:${config.model ?? 'default'}`;
  const tags = config.tags ?? [];
  const metadata = config.metadata ?? {};

  return {
    async invoke(input, options) {
      const tracingConfig = buildTracingConfig(env, { runName, tags, metadata });

      const result = await graph.invoke(
        { messages: input.messages },
        {
          configurable: { thread_id: options?.threadId ?? 'default' },
          ...tracingConfig,
          recursionLimit: config.recursionLimit ?? 25,
        },
      );

      const messages: BaseMessage[] = (result.messages ?? []) as BaseMessage[];
      return { messages, output: extractOutput(messages) };
    },

    async *stream(input, options) {
      const tracingConfig = buildTracingConfig(env, { runName, tags, metadata });

      const stream = await graph.stream(
        { messages: input.messages },
        {
          configurable: { thread_id: options?.threadId ?? 'default' },
          ...tracingConfig,
          recursionLimit: config.recursionLimit ?? 25,
          streamMode: 'values',
        },
      );

      for await (const chunk of stream) {
        yield chunk as Record<string, unknown>;
      }
    },
  };
}

// ─── Pre-built Agents ──────────────────────────────────────────────────

/**
 * Create a medical question generation agent.
 */
export function createQuestionGeneratorAgent(): AgentInstance {
  return createAgent({
    model: 'question-generation',
    systemPrompt: `You are a medical education expert creating PANCE/PANRE practice questions.

Follow these rules:
1. Create clinically accurate, board-relevant questions
2. Include appropriate answer choices with rationales
3. Cite sources when possible
4. Follow NCCPA blueprint guidelines

Output format:
{
  "question": "stem text",
  "choices": ["A. ...", "B. ...", "C. ...", "D. ...", "E. ..."],
  "correctAnswer": "A",
  "explanation": "rationale text",
  "organSystem": "Cardiology",
  "taskCategory": "Diagnosis",
  "cognitiveLevel": "Application"
}`,
    runName: 'question-generator',
    tags: ['generation', 'questions'],
  });
}

/**
 * Create a clinical reasoning tutor agent.
 */
export function createTutorAgent(): AgentInstance {
  return createAgent({
    model: 'socratic-tutoring',
    systemPrompt: `You are a Socratic tutor helping PA students prepare for PANCE/PANRE.

Your role:
1. Ask guiding questions rather than giving answers
2. Help students identify knowledge gaps
3. Encourage clinical reasoning
4. Provide feedback on their reasoning process
5. Adapt difficulty based on student performance

Keep responses concise and focused. Use clinical scenarios when possible.`,
    runName: 'clinical-tutor',
    tags: ['tutoring', 'socratic'],
  });
}

/**
 * Create an OSCE encounter agent.
 */
export function createOsceAgent(): AgentInstance {
  return createAgent({
    model: 'osce-chat',
    systemPrompt: `You are a standardized patient in an OSCE (Objective Structured Clinical Examination).

Stay in character throughout the encounter:
1. Respond naturally to student questions
2. Provide realistic symptoms and history
3. React appropriately to physical exam maneuvers
4. Do NOT reveal the diagnosis unless the student asks directly
5. Show appropriate emotional responses

Be consistent with the patient case details provided.`,
    runName: 'osce-encounter',
    tags: ['osce', 'simulation'],
  });
}
