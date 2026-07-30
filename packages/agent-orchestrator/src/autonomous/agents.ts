import { resolvePrompt } from '../clients/prompts.js';
import { getLLM } from '../clients/llm.js';
import { getTracingCallbacks } from '../clients/tracing.js';
import { getCheckpointSaver } from '../clients/checkpoint.js';
import { optionalEnv } from '../config/env.js';
import type { StructuredToolInterface } from '@langchain/core/tools';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import type { BaseCallbackHandler } from '@langchain/core/callbacks/base';
import { AUTONOMOUS_SYSTEM_PROMPT } from './guardrails.js';
import { createWorktree, destroyWorktree, commitInWorktree, getDiff, type Worktree } from './worktree.js';
import { createCodebaseTools } from '../tools/codebase.js';
import { getRepo } from '../clients/github.js';
import { enqueueTask, claimNextTask, completeTask, failTask, type WorkTask } from './workQueue.js';
import { remember } from '../clients/qdrant.js';

interface CompiledGraph {
  invoke: (input: unknown, config?: { callbacks?: BaseCallbackHandler[]; recursionLimit?: number; configurable?: { thread_id?: string } }) => Promise<{
    messages: Array<{ _getType: () => string; content: unknown; tool_calls?: unknown[] }>;
  }>;
}

async function runAgent(
  systemPrompt: string,
  tools: StructuredToolInterface[],
  userMessage: string,
  traceName: string,
  tags: string[],
  recursionLimit: number,
  model?: string,
): Promise<{ messages: Array<{ role: string; content: string }> }> {
  const llm: BaseChatModel = await getLLM(model);
  const callbacks: BaseCallbackHandler[] = await getTracingCallbacks();
  const checkpointSaver = await getCheckpointSaver();

  const { createReactAgent } = await import('@langchain/langgraph/prebuilt');
  const { SystemMessage } = await import('@langchain/core/messages');

  type CreateReactParams = Parameters<typeof createReactAgent>[0];
  const params: CreateReactParams = { llm, tools, messageModifier: new SystemMessage(systemPrompt) };
  if (checkpointSaver) (params as { checkpointSaver?: unknown }).checkpointSaver = checkpointSaver;

  const graph = (await createReactAgent(params)) as unknown as CompiledGraph;
  const result = await graph.invoke(
    { messages: [{ role: 'user', content: userMessage }] },
    { callbacks, recursionLimit, configurable: { thread_id: `${traceName}-${Date.now()}` } },
  );

  return {
    messages: (result.messages ?? []).map((m) => {
      const type = typeof m._getType === 'function' ? m._getType() : 'unknown';
      const content = typeof m.content === 'string' ? m.content : JSON.stringify(m.content);
      return { role: type, content };
    }),
  };
}

function extractFinal(messages: Array<{ role: string; content: string }>): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i]?.role === 'ai' || messages[i]?.role === 'assistant') return messages[i]?.content ?? '';
  }
  return messages.at(-1)?.content ?? '';
}

// ─── Code Developer ──────────────────────────────────────────────────────────

export async function runDeveloperAgent(task: WorkTask, model?: string): Promise<{ task: WorkTask; output: string; worktree?: Worktree; diff?: string }> {
  const prompt = await resolvePrompt('panacea-code-developer');
  const wt = await createWorktree('main', task.id);
  const tools = createCodebaseTools(wt);

  const userMsg = `TASK: ${task.title}\n\n${task.description}\n\nWorktree: ${wt.path} (branch: ${wt.branch})\n\nUse read_file/search_code to understand the codebase, write_file to make changes, run_command to typecheck, git_commit when ready, and get_diff to review your changes. ALWAYS run typecheck before committing.`;

  const { messages } = await runAgent(
    prompt + '\n\n' + AUTONOMOUS_SYSTEM_PROMPT,
    tools,
    userMsg,
    'panacea:code-developer',
    ['panacea', 'autonomous', 'code-developer', optionalEnv('ORCHESTRATOR_ENV', 'development')],
    25,
    model,
  );

  const output = extractFinal(messages);
  const diff = getDiff(wt.id);
  return { task, output, worktree: wt, diff };
}

// ─── Code Reviewer ───────────────────────────────────────────────────────────

export async function runReviewerAgent(diff: string, task: WorkTask, model?: string): Promise<{ approved: boolean; review: string }> {
  const prompt = await resolvePrompt('panacea-code-reviewer');
  const userMsg = `Review this code diff for task "${task.title}".\n\nDIFF:\n${diff.slice(0, 12000)}\n\nCheck for: edge-runtime safety (no Node APIs in functions/), Prisma in client code, FSRS binary-only rule, auth/RLS bypasses, missing error handling, N+1 queries, and test coverage. Reply APPROVE or REQUEST_CHANGES with specific findings.`;

  const { messages } = await runAgent(
    prompt,
    [],
    userMsg,
    'panacea:code-reviewer',
    ['panacea', 'autonomous', 'code-reviewer', optionalEnv('ORCHESTRATOR_ENV', 'development')],
    5,
    model,
  );

  const review = extractFinal(messages);
  return { approved: review.toUpperCase().includes('APPROVE'), review };
}

// ─── Test Runner ─────────────────────────────────────────────────────────────

export async function runTestAgent(worktreeId: string, model?: string): Promise<{ passed: boolean; output: string }> {
  const { runInWorktree } = await import('./worktree.js');
  const prompt = await resolvePrompt('panacea-test-runner');
  const userMsg = `Run the project verification suite in the worktree. Use these commands via run_command:\n1. npm ci (if node_modules missing)\n2. npx tsc --noEmit -p tsconfig.ci.json\n3. npm run lint\n4. npm test\nReport which passed and which failed with the error output.`;

  const { messages } = await runAgent(
    prompt + '\n\n' + AUTONOMOUS_SYSTEM_PROMPT,
    [{ name: 'run_command', description: 'placeholder' } as unknown as StructuredToolInterface],
    userMsg,
    'panacea:test-runner',
    ['panacea', 'autonomous', 'test-runner'],
    10,
    model,
  );

  const output = extractFinal(messages);
  return { passed: !output.toLowerCase().includes('failed'), output };
}