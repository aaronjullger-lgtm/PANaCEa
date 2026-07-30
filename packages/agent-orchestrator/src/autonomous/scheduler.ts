import { enqueueTask, claimNextTask, completeTask, failTask, getActiveTasks, type WorkTask, type TaskType } from './workQueue.js';
import { runDeveloperAgent, runReviewerAgent, runTestAgent } from './agents.js';
import { destroyWorktree } from './worktree.js';
import { postPRReview, getRepo } from '../clients/github.js';
import { getEnv, getCapabilities } from '../config/env.js';
import { remember } from '../clients/qdrant.js';

const TICK_INTERVAL_MS = 60_000;
const MAX_CONCURRENT = 1;

let _running = false;

export async function tick(): Promise<{ processed: number; results: Array<{ taskId: string; status: string }> }> {
  const caps = getCapabilities();
  if (!caps.github) {
    return { processed: 0, results: [] };
  }

  const task = await claimNextTask('autonomous-scheduler');
  if (!task) return { processed: 0, results: [] };

  console.log(`[scheduler] picked up task ${task.id}: ${task.title}`);

  try {
    if (task.type === 'bugfix' || task.type === 'feature' || task.type === 'refactor' || task.type === 'test') {
      const dev = await runDeveloperAgent(task);

      if (!dev.diff || dev.diff.trim().length === 0) {
        await failTask(task, 'Developer agent produced no code changes');
        await destroyWorktree(dev.worktree!.id);
        return { processed: 1, results: [{ taskId: task.id, status: 'failed — no changes' }] };
      }

      const review = await runReviewerAgent(dev.diff, task);

      let prResult = '';
      if (review.approved) {
        try {
          const repo = getRepo() ?? '';
          const { execSync } = await import('node:child_process');
          execSync(`git push origin ${dev.worktree!.branch}`, { cwd: dev.worktree!.path, stdio: 'pipe', timeout: 30_000 });
          prResult = `Pushed branch ${dev.worktree!.branch}`;
        } catch (err) {
          prResult = `Push failed: ${err instanceof Error ? err.message : String(err)}`;
        }
      }

      const result = `Developer: ${dev.output.slice(0, 500)}\n\nReviewer: ${review.review.slice(0, 500)}\n\n${prResult}`;
      await completeTask(task, result);
      await remember('runs', `sched_${task.id}`, `autonomous ${task.type}: ${task.title} — ${review.approved ? 'APPROVED' : 'CHANGES REQUESTED'}`, {
        taskId: task.id, type: task.type, approved: review.approved, diffSize: dev.diff?.length ?? 0,
      });

      return { processed: 1, results: [{ taskId: task.id, status: review.approved ? 'approved' : 'changes-requested' }] };
    }

    if (task.type === 'content') {
      const { buildContentAuditAgent } = await import('../agents/contentAudit.js');
      const agent = await buildContentAuditAgent({});
      const { messages } = await agent.invoke({ messages: [{ role: 'user', content: task.description }] });
      const output = messages.at(-1)?.content ?? '';
      await completeTask(task, output.slice(0, 2000));
      return { processed: 1, results: [{ taskId: task.id, status: 'done' }] };
    }

    if (task.type === 'monitor') {
      const { buildIncidentResponderAgent } = await import('../agents/incidentResponder.js');
      const agent = await buildIncidentResponderAgent({});
      const { messages } = await agent.invoke({ messages: [{ role: 'user', content: task.description }] });
      const output = messages.at(-1)?.content ?? '';
      await completeTask(task, output.slice(0, 2000));
      return { processed: 1, results: [{ taskId: task.id, status: 'done' }] };
    }

    await completeTask(task, 'No matching agent for task type');
    return { processed: 1, results: [{ taskId: task.id, status: 'skipped' }] };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[scheduler] task ${task.id} failed:`, msg);
    await failTask(task, msg);
    return { processed: 1, results: [{ taskId: task.id, status: `failed: ${msg.slice(0, 100)}` }] };
  }
}

export function startScheduler(intervalMs = TICK_INTERVAL_MS): { stop: () => void } {
  if (_running) return { stop: () => {} };
  _running = true;

  console.log(`[scheduler] autonomous fleet started — tick every ${intervalMs / 1000}s`);

  const timer = setInterval(async () => {
    try {
      const result = await tick();
      if (result.processed > 0) {
        console.log(`[scheduler] processed ${result.processed} task(s):`, result.results);
      }
    } catch (err) {
      console.error('[scheduler] tick error:', err);
    }
  }, intervalMs);

  return {
    stop() {
      clearInterval(timer);
      _running = false;
      console.log('[scheduler] stopped');
    },
  };
}

export { enqueueTask, getActiveTasks };