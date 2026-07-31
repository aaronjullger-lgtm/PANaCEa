/**
 * Unified LangChain Agent Entry Point
 *
 * Provides `createAgent()` for building production agents with LangChain.
 * Handles model selection, tool execution, and state management.
 *
 * Follows the same patterns as `osceEncounter.ts` — `Annotation.Root`,
 * method chaining, `routeTask`/`routeStructured` from the router.
 *
 * @module lib.langchain.agent
 */

import { HumanMessage, SystemMessage, AIMessage, type BaseMessage } from '@langchain/core/messages';
import type { StructuredTool } from '@langchain/core/tools';
import {
  StateGraph,
  Annotation,
  START,
  END,
} from '@langchain/langgraph';

import {
  MODEL_REGISTRY,
  TASK_MODEL_MAP,
  DEFAULT_PARAMS,
  type ModelName,
  type TaskType,
} from './config';
import { createModel, isModelAvailable, type AIEnvKeys } from './models';
import { buildTracingConfig } from './tracing';

// ─── Agent State Schema ─────────────────────────────────────────────────

export const AgentState = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: (prev, next) => [...prev, ...next],
    default: () => [],
  }),
  context: Annotation<Record<string, unknown>>({
    reducer: (_prev, next) => next,
    default: () => ({}),
  }),
  output: Annotation<string>({
    reducer: (_prev, next) => next,
    default: () => '',
  }),
  metadata: Annotation<Record<string, unknown>>({
    reducer: (_prev, next) => next,
    default: () => ({}),
  }),
  env: Annotation<AIEnvKeys | null>({
    reducer: (_prev, next) => next,
    default: () => null,
  }),
});

export type AgentStateType = typeof AgentState.State;
export type AgentUpdate = Partial<AgentStateType>;

// ─── Agent Configuration ────────────────────────────────────────────────

export interface AgentConfig {
  /** Model name from registry or task type for auto-selection */
  model?: ModelName | TaskType;
  /** System prompt for the agent */
  systemPrompt?: string;
  /** Tools available to the agent */
  tools?: StructuredTool[];
  /** Maximum recursion limit */
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
  const env = typeof process !== 'undefined' ? process.env : {};
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

function resolveEnv(state: AgentStateType): AIEnvKeys {
  if (state.env) return state.env;
  return getAgentEnv();
}

// ─── Agent Node ──────────────────────────────────────────────────────────

function createAgentNodeFn(systemPrompt?: string) {
  return async (state: AgentStateType): Promise<AgentUpdate> => {
    const env = resolveEnv(state);
    const modelName = resolveModelName();

    const model = createModel(modelName, env, {
      temperature: 0.7,
      maxOutputTokens: DEFAULT_PARAMS.maxOutputTokens,
    });

    const messages: BaseMessage[] = [];
    if (systemPrompt) {
      messages.push(new SystemMessage(systemPrompt));
    }
    messages.push(...state.messages);

    const response = await model.invoke(messages);

    return { messages: [response] };
  };
}

function createToolNodeFn(tools: StructuredTool[]) {
  return async (state: AgentStateType): Promise<AgentUpdate> => {
    const lastMessage = state.messages[state.messages.length - 1];

    if (!lastMessage || !('tool_calls' in lastMessage) || !Array.isArray(lastMessage.tool_calls)) {
      return { messages: [] };
    }

    const toolResults: BaseMessage[] = [];

    for (const toolCall of lastMessage.tool_calls) {
      const tool = tools.find((t) => t.name === toolCall.name);
      if (!tool) {
        toolResults.push(
          new AIMessage({
            content: `Tool "${toolCall.name}" not found`,
          })
        );
        continue;
      }

      try {
        const result = await tool.invoke(toolCall.args);
        toolResults.push(
          new AIMessage({
            content: typeof result === 'string' ? result : JSON.stringify(result),
          })
        );
      } catch (error) {
        toolResults.push(
          new AIMessage({
            content: `Tool error: ${error instanceof Error ? error.message : String(error)}`,
          })
        );
      }
    }

    return { messages: toolResults };
  };
}

// ─── Agent Factory ──────────────────────────────────────────────────────

/**
 * Create a LangChain agent with automatic model selection and tracing.
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
 * ```
 */
export function createAgent(config: AgentConfig) {
  const env = getAgentEnv();

  const workflow = new StateGraph(AgentState)
    .addNode('agent', createAgentNodeFn(config.systemPrompt))
    .addNode('tools', createToolNodeFn(config.tools ?? []))
    .addEdge(START, 'agent')
    .addConditionalEdges(
      'agent',
      (state: AgentStateType) => {
        const lastMessage = state.messages[state.messages.length - 1];
        if (lastMessage && 'tool_calls' in lastMessage && Array.isArray(lastMessage.tool_calls) && lastMessage.tool_calls.length > 0) {
          return 'tools';
        }
        return '__end__';
      },
      ['tools', '__end__']
    )
    .addEdge('tools', 'agent');

  const compiled = workflow.compile();

  return {
    async invoke(input: { messages: BaseMessage[] }, options?: { threadId?: string }) {
      const tracingConfig = buildTracingConfig(env, {
        runName: config.runName ?? `agent:${config.model ?? 'default'}`,
        tags: config.tags,
        metadata: config.metadata,
      });

      return compiled.invoke(
        { ...input, env },
        {
          configurable: { thread_id: options?.threadId ?? 'default' },
          ...tracingConfig,
          recursionLimit: config.recursionLimit ?? 25,
        },
      );
    },

    async *stream(input: { messages: BaseMessage[] }, options?: { threadId?: string }) {
      const tracingConfig = buildTracingConfig(env, {
        runName: config.runName ?? `agent:${config.model ?? 'default'}`,
        tags: config.tags,
        metadata: config.metadata,
      });

      const readable = await compiled.stream(
        { ...input, env },
        {
          configurable: { thread_id: options?.threadId ?? 'default' },
          ...tracingConfig,
          recursionLimit: config.recursionLimit ?? 25,
        },
      );

      for await (const chunk of readable) {
        yield chunk;
      }
    },
  };
}

// ─── Pre-built Agents ──────────────────────────────────────────────────

/**
 * Create a medical question generation agent.
 */
export function createQuestionGeneratorAgent() {
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
export function createTutorAgent() {
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
export function createOsceAgent() {
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
