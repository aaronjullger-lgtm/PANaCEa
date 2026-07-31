import { Annotation } from '@langchain/langgraph';
import type { AIEnvKeys } from '@/lib/langchain/models';

export const PANaCEaAgentState = Annotation.Root({
  env: Annotation<AIEnvKeys | null>({
    reducer: (_prev, next) => next,
    default: () => null,
  }),
  sessionId: Annotation<string>,
  output: Annotation<unknown>({
    reducer: (_prev, next) => next,
    default: () => null,
  }),
});

export type PANaCEaAgentStateType = typeof PANaCEaAgentState.State;