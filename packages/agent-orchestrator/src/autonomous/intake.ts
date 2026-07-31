import { getLLM } from '../clients/llm.js';
import { getCapabilities } from '../config/env.js';
import { enqueueTask } from './workQueue.js';
import { launchPipeline } from './pipelines.js';
import { remember } from '../clients/qdrant.js';

export type IntakeCategory = 'bugfix' | 'feature' | 'content' | 'research' | 'ops' | 'question';

export interface IntakeResult {
  category: IntakeCategory;
  summary: string;
  action: string;
  taskId?: string;
  pipelineLaunched?: string;
  directResponse?: string;
}

const CLASSIFIER_PROMPT = `You classify incoming requests for the StudyPANaCEa autonomous agent fleet.

Classify the request into ONE category:
- bugfix: something is broken, needs fixing
- feature: new functionality to build
- content: medical content creation, validation, or enrichment
- research: investigation, planning, or analysis (no code changes)
- ops: deployment, monitoring, or infrastructure task
- question: a question about the codebase or process (answer directly)

Also provide a concise summary (1 sentence) of what needs to be done.

Reply STRICT JSON: {"category": "<one>", "summary": "<one sentence>"}`;

export async function classifyIntake(message: string): Promise<{ category: IntakeCategory; summary: string }> {
  const caps = getCapabilities();
  if (!caps.langfuse) {
    if (/bug|fix|broken|error|crash|fail/i.test(message)) return { category: 'bugfix', summary: message.slice(0, 200) };
    if (/content|question|clinical|drug|condition/i.test(message)) return { category: 'content', summary: message.slice(0, 200) };
    if (/deploy|monitor|infrastructure|ci/i.test(message)) return { category: 'ops', summary: message.slice(0, 200) };
    return { category: 'feature', summary: message.slice(0, 200) };
  }

  try {
    const llm = await getLLM();
    const { HumanMessage } = await import('@langchain/core/messages');
    const res = await llm.invoke([
      new HumanMessage(`${CLASSIFIER_PROMPT}\n\nREQUEST: ${message.slice(0, 2000)}`),
    ]);
    const text = typeof res.content === 'string' ? res.content : JSON.stringify(res.content);
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      const parsed = JSON.parse(match[0]) as { category?: string; summary?: string };
      const cat = (parsed.category ?? 'feature').toLowerCase() as IntakeCategory;
      const validCats: IntakeCategory[] = ['bugfix', 'feature', 'content', 'research', 'ops', 'question'];
      return {
        category: validCats.includes(cat) ? cat : 'feature',
        summary: (parsed.summary ?? message).slice(0, 300),
      };
    }
  } catch { /* fall through to heuristic */ }

  if (/bug|fix|broken|error|crash|fail/i.test(message)) return { category: 'bugfix', summary: message.slice(0, 200) };
  if (/content|clinical|drug|condition|question|enrich/i.test(message)) return { category: 'content', summary: message.slice(0, 200) };
  if (/deploy|monitor|infrastructure|ci/i.test(message)) return { category: 'ops', summary: message.slice(0, 200) };
  return { category: 'feature', summary: message.slice(0, 200) };
}

export async function processIntake(message: string): Promise<IntakeResult> {
  const { category, summary } = await classifyIntake(message);

  switch (category) {
    case 'bugfix': {
      const task = await enqueueTask({
        type: 'bugfix', title: summary, description: message, priority: 1, tags: ['intake', 'bugfix'],
      });
      return { category, summary, action: 'enqueued as bugfix task', taskId: task.id };
    }
    case 'feature': {
      const result = await launchPipeline('feature-dev', message);
      return { category, summary, action: `launched feature-dev pipeline (${result.enqueued} stages)`, pipelineLaunched: 'feature-dev' };
    }
    case 'content': {
      const result = await launchPipeline('content-quality', message);
      return { category, summary, action: `launched content-quality pipeline (${result.enqueued} stages)`, pipelineLaunched: 'content-quality' };
    }
    case 'research': {
      const task = await enqueueTask({
        type: 'custom', title: summary, description: message, priority: 2, tags: ['intake', 'research'],
      });
      return { category, summary, action: 'enqueued for architecture-planner', taskId: task.id };
    }
    case 'ops': {
      const task = await enqueueTask({
        type: 'monitor', title: summary, description: message, priority: 1, tags: ['intake', 'ops'],
      });
      return { category, summary, action: 'enqueued as ops task', taskId: task.id };
    }
    case 'question': {
      const llm = await getLLM();
      const { HumanMessage } = await import('@langchain/core/messages');
      const res = await llm.invoke([new HumanMessage(message)]);
      const answer = typeof res.content === 'string' ? res.content : JSON.stringify(res.content);
      return { category, summary, action: 'answered directly', directResponse: answer.slice(0, 4000) };
    }
    default: {
      const task = await enqueueTask({ type: 'custom', title: summary, description: message, priority: 3, tags: ['intake'] });
      return { category: 'feature', summary, action: 'enqueued as generic task', taskId: task.id };
    }
  }
}