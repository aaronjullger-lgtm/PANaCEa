import { Annotation, messagesStateReducer } from '@langchain/langgraph';
import { BaseMessage } from '@langchain/core/messages';

export const TutorState = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: messagesStateReducer,
    default: () => [],
  }),

  userId: Annotation<string>(),
  threadId: Annotation<string>(),

  organSystem: Annotation<string | null>(),
  taskCategory: Annotation<string | null>(),
  cognitiveLevel: Annotation<string | null>(),

  weakAreas: Annotation<string[]>({
    reducer: (current, update) => [...current, ...update],
    default: () => [],
  }),

  correctCount: Annotation<number>({
    reducer: (current, update) => current + update,
    default: () => 0,
  }),
  totalCount: Annotation<number>({
    reducer: (current, update) => current + update,
    default: () => 0,
  }),

  currentQuestion: Annotation<string | null>(),
  awaitingAnswer: Annotation<boolean>(),

  explanationDepth: Annotation<'brief' | 'standard' | 'deep'>(),
});

export type TutorStateType = typeof TutorState.State;
