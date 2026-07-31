import { createWorktree, destroyWorktree, runInWorktree, commitInWorktree, getDiff, type Worktree } from './worktree.js';
import { runDeveloperAgent, runReviewerAgent } from './agents.js';
import { createPR, pushWorktreeBranch, getPRCheckStatus } from '../clients/github.js';
import { resolvePrompt } from '../clients/prompts.js';
import { buildAgent, type CompiledAgent } from '../orchestrator/factory.js';
import { remember } from '../clients/qdrant.js';
import type { WorkTask } from './workQueue.js';

const MAX_TYPECHECK_RETRIES = 3;
const MAX_REVIEW_RETRIES = 2;
const MAX_CI_RETRIES = 2;
const CI_POLL_INTERVAL_MS = 30_000;
const CI_POLL_TIMEOUT_MS = 300_000;

export interface AutonomousDevResult {
  task: WorkTask;
  worktree?: Worktree;
  diff?: string;
  prUrl?: string;
  prNumber?: number;
  success: boolean;
  stages: string[];
  finalStatus: string;
  error?: string;
}

async function buildPlanner(): Promise<CompiledAgent> {
  const prompt = await resolvePrompt('panacea-architecture-planner');
  return buildAgent({
    role: 'content-enrichment', tools: [], systemPrompt: prompt,
    traceName: 'panacea:autonomous-planner', tags: ['panacea', 'autonomous'], recursionLimit: 10,
  });
}

async function buildFixer(): Promise<CompiledAgent> {
  const prompt = await resolvePrompt('panacea-code-developer');
  return buildAgent({
    role: 'content-enrichment', tools: [], systemPrompt: prompt,
    traceName: 'panacea:autonomous-fixer', tags: ['panacea', 'autonomous'], recursionLimit: 10,
  });
}

export async function runAutonomousDev(task: WorkTask): Promise<AutonomousDevResult> {
  const stages: string[] = [];
  let wt: Worktree | undefined;

  try {
    stages.push('creating worktree');
    wt = await createWorktree('main', task.id);
    stages.push(`worktree: ${wt.branch}`);

    stages.push('planning');
    const planner = await buildPlanner();
    const planResult = await planner.invoke({
      messages: [{ role: 'user', content: `TASK: ${task.title}\n\n${task.description}\n\nProduce a step-by-step implementation plan. Use the task description to infer what files need changing.` }],
    });
    const plan = planResult.messages.at(-1)?.content ?? task.description;

    stages.push('developing');
    const dev = await runDeveloperAgent(task);

    if (!dev.worktree || !dev.diff || dev.diff.trim().length === 0) {
      return { task, success: false, stages, finalStatus: 'no code changes produced', error: 'developer produced no diff' };
    }
    wt = dev.worktree;
    stages.push(`diff: ${dev.diff.length} chars`);

    stages.push('typecheck loop');
    for (let attempt = 1; attempt <= MAX_TYPECHECK_RETRIES; attempt++) {
      const tcResult = await runInWorktree(wt.id, 'npx tsc --noEmit -p tsconfig.ci.json', 120_000);
      if (tcResult.exitCode === 0) {
        stages.push(`typecheck passed (attempt ${attempt})`);
        break;
      }
      if (attempt === MAX_TYPECHECK_RETRIES) {
        stages.push(`typecheck failed after ${attempt} attempts`);
        return { task, worktree: wt, diff: dev.diff, success: false, stages, finalStatus: 'typecheck failed', error: tcResult.stderr.slice(0, 1000) };
      }
      stages.push(`typecheck retry ${attempt + 1}/${MAX_TYPECHECK_RETRIES}`);
      const fixer = await buildFixer();
      await fixer.invoke({
        messages: [{ role: 'user', content: `Typecheck failed with:\n${tcResult.stderr.slice(0, 3000)}\n\nFix the errors. The worktree is at ${wt.path}.` }],
      });
    }

    stages.push('committing');
    commitInWorktree(wt.id, `${task.type}: ${task.title}`, undefined);

    stages.push('reviewing');
    const finalDiff = getDiff(wt.id);
    for (let attempt = 1; attempt <= MAX_REVIEW_RETRIES; attempt++) {
      const review = await runReviewerAgent(finalDiff, task);
      if (review.approved) {
        stages.push(`review approved (attempt ${attempt})`);
        break;
      }
      if (attempt === MAX_REVIEW_RETRIES) {
        stages.push(`review changes-requested after ${attempt} attempts — proceeding anyway`);
        break;
      }
      stages.push(`review fix ${attempt + 1}/${MAX_REVIEW_RETRIES}`);
      const fixer = await buildFixer();
      await fixer.invoke({
        messages: [{ role: 'user', content: `Code review requested changes:\n${review.review.slice(0, 3000)}\n\nAddress the feedback. Worktree: ${wt.path}` }],
      });
      commitInWorktree(wt.id, `fix: address review feedback (${attempt})`, undefined);
    }

    stages.push('pushing');
    const pushed = await pushWorktreeBranch(wt.path, wt.branch);
    if (!pushed) {
      stages.push('push failed — saving diff without PR');
      return { task, worktree: wt, diff: finalDiff, success: false, stages, finalStatus: 'push failed' };
    }

    stages.push('creating PR');
    const pr = await createPR({
      title: `[autonomous] ${task.title}`,
      body: `## Autonomous Agent Task\n\n**Task:** ${task.title}\n**Type:** ${task.type}\n\n### Description\n${task.description}\n\n### Pipeline\n${stages.map((s) => `- ${s}`).join('\n')}\n\n---\n_Generated by the PANaCEa autonomous agent fleet. Human review required before merge._`,
      head: wt.branch,
    });

    if (!pr) {
      stages.push('PR creation failed');
      return { task, worktree: wt, diff: finalDiff, success: false, stages, finalStatus: 'PR creation failed' };
    }
    stages.push(`PR #${pr.number}: ${pr.url}`);

    stages.push('monitoring CI');
    const ciDeadline = Date.now() + CI_POLL_TIMEOUT_MS;
    let ciState: 'pending' | 'success' | 'failure' | 'none' = 'pending';
    while (Date.now() < ciDeadline) {
      await new Promise((r) => setTimeout(r, CI_POLL_INTERVAL_MS));
      const status = await getPRCheckStatus(pr.number);
      ciState = status.state;
      if (ciState === 'success' || ciState === 'failure' || ciState === 'none') break;
      stages.push(`CI polling… (${ciState})`);
    }

    if (ciState === 'failure') {
      for (let attempt = 1; attempt <= MAX_CI_RETRIES; attempt++) {
        stages.push(`CI self-heal ${attempt}/${MAX_CI_RETRIES}`);
        const fixer = await buildFixer();
        await fixer.invoke({
          messages: [{ role: 'user', content: `CI checks failed on PR #${pr.number}. Review the CI output on GitHub and fix any issues. Worktree: ${wt.path}` }],
        });
        commitInWorktree(wt.id, `fix: CI failure (${attempt})`, undefined);
        await pushWorktreeBranch(wt.path, wt.branch);
        const recheck = await getPRCheckStatus(pr.number);
        if (recheck.state === 'success') {
          ciState = 'success';
          stages.push('CI passed after self-heal');
          break;
        }
      }
    }

    stages.push(ciState === 'success' ? 'CI passed — ready for human merge' : `CI state: ${ciState}`);

    await remember('runs', `autodev_${task.id}`, `autonomous dev: ${task.title} → PR #${pr.number}`, {
      taskId: task.id, prNumber: pr.number, prUrl: pr.url, stages, ciState,
    });

    return { task, worktree: wt, diff: finalDiff, prUrl: pr.url, prNumber: pr.number, success: true, stages, finalStatus: `PR #${pr.number} ${ciState}` };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    stages.push(`ERROR: ${msg}`);
    return { task, worktree: wt, success: false, stages, finalStatus: 'error', error: msg };
  }
}