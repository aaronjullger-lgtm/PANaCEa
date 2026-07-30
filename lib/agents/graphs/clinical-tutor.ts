import { StateGraph, END, START, MemorySaver } from '@langchain/langgraph';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { HumanMessage, AIMessage, SystemMessage } from '@langchain/core/messages';
import { TutorState } from '../state/tutor-state';

const TUTOR_SYSTEM_PROMPT = `You are an adaptive clinical tutor for PA students preparing for the PANCE exam.

Rules:
- Ask ONE clinical question at a time at the appropriate cognitive level
- After the student answers, provide targeted feedback with the correct answer
- Adapt difficulty based on performance: struggling → recall questions, thriving → application/analysis
- Connect each question to the NCCPA blueprint organ system and task category
- Keep explanations concise — 2-3 sentences max unless the student asks for more
- Never diagnose real patients — this is educational only`;

function getModel() {
  return new ChatGoogleGenerativeAI({
    model: 'gemini-2.5-flash',
    apiKey: process.env.GEMINI_API_KEY,
    temperature: 0.7,
  });
}

async function generateQuestion(state: typeof TutorState.State) {
  const model = getModel();

  const systemContext = `Current focus: ${state.organSystem ?? 'mixed organ systems'}
Task category: ${state.taskCategory ?? 'general'}
Performance: ${state.correctCount}/${state.totalCount} correct
Weak areas: ${state.weakAreas.length > 0 ? state.weakAreas.join(', ') : 'none identified yet'}
Explanation depth: ${state.explanationDepth ?? 'standard'}

Generate a clinical vignette question. Return ONLY the question — no answer yet.`;

  const response = await model.invoke([
    new SystemMessage(TUTOR_SYSTEM_PROMPT),
    new SystemMessage(systemContext),
    ...state.messages.slice(-6),
    new HumanMessage('Generate the next question.'),
  ]);

  return {
    messages: [response],
    currentQuestion: response.content.toString(),
    awaitingAnswer: true,
  };
}

async function evaluateAnswer(state: typeof TutorState.State) {
  const model = getModel();
  const lastHuman = state.messages.filter((m) => m._getType() === 'human').pop();

  if (!lastHuman || !state.currentQuestion) {
    return { awaitingAnswer: false };
  }

  const response = await model.invoke([
    new SystemMessage(TUTOR_SYSTEM_PROMPT),
    new SystemMessage(`The student was asked: ${state.currentQuestion}`),
    new HumanMessage(`Student answer: ${lastHuman.content}

Evaluate the answer. Is it correct? Provide:
1. CORRECT or INCORRECT
2. The correct answer with a brief explanation
3. The organ system and task category this covers`),
  ]);

  const isCorrect = response.content.toString().toUpperCase().includes('CORRECT')
    && !response.content.toString().toUpperCase().includes('INCORRECT');

  return {
    messages: [response],
    awaitingAnswer: false,
    correctCount: isCorrect ? 1 : 0,
    totalCount: 1,
    currentQuestion: null,
  };
}

function routeTurn(state: typeof TutorState.State): string {
  if (state.awaitingAnswer) {
    return 'evaluate';
  }
  if (state.totalCount >= 10) {
    return END;
  }
  return 'question';
}

const workflow = new StateGraph(TutorState)
  .addNode('question', generateQuestion)
  .addNode('evaluate', evaluateAnswer)
  .addEdge(START, 'question')
  .addConditionalEdges('evaluate', routeTurn)
  .addEdge('question', END);

export const clinicalTutorGraph = workflow.compile({
  checkpointer: new MemorySaver(),
});
