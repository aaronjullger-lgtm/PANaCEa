import { StateGraph, END, START, MemorySaver, Annotation, messagesStateReducer } from '@langchain/langgraph';
import { BaseMessage } from '@langchain/core/messages';

/**
 * Preceptor Pimping Bot — State Definition
 *
 * Simulates a clinical preceptor who "pimps" (asks rapid-fire questions)
 * during rounds, in the ED, or in the OR. Each setting has a different
 * personality and question style.
 */

export type PreceptorSetting = 'ED' | 'OR' | 'rounds' | 'clinic';

export const PreceptorState = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: messagesStateReducer,
    default: () => [],
  }),
  setting: Annotation<PreceptorSetting>(),
  difficulty: Annotation<number>({
    reducer: (_, next) => next,
    default: () => 3,
  }),
  correctStreak: Annotation<number>({
    reducer: (curr, next) => curr + next,
    default: () => 0,
  }),
});

export const preceptorGraph = new StateGraph(PreceptorState)
  .addNode('grill', async (state) => {
    return {
      messages: [{
        role: 'assistant' as const,
        content: `[${state.setting} preceptor graph — implementation pending. See roadmap Phase 2.]`,
      }] as any,
    };
  })
  .addEdge(START, 'grill')
  .addEdge('grill', END)
  .compile({ checkpointer: new MemorySaver() });
