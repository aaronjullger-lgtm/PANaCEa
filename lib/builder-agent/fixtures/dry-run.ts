/**
 * Dry-run orchestrator — runs full lifecycle without production mutations.
 * Used by unit/e2e tests and local dev workflows.
 */

import { createApprovalRequest, resolveApproval } from '../approval/gates';
import { classifyRisk } from '../approval/policy';
import { selectExecutionBackend } from '../execution/select-backend';
import { runValidationSuite } from '../execution/backend';
import { InMemoryIdempotencyStore } from '../idempotency/store';
import { CollectingEventSink, createEvent } from '../observability/events';
import { assertTransition } from '../state/transitions';
import {
  createInitialRunState,
  type BuilderRunState,
  type IntakePayload,
} from '../state/types';
import { BUILD_PHASES } from '../workflow/phases';
import { createBuilderToolRegistry, integrationStatus } from '../tools/registry';
import type { ToolContext } from '../tools/types';

export interface DryRunOptions {
  autoApprovePlan?: boolean;
  autoApproveMerge?: boolean;
  simulateCiFailure?: boolean;
  simulateTestFailure?: boolean;
  revisionCycles?: number;
}

export interface DryRunResult {
  run: BuilderRunState;
  events: import('../observability/events').BuilderEvent[];
  spec: string;
  plan: string;
}

export async function runDryRunLifecycle(
  intake: IntakePayload,
  options: DryRunOptions = {}
): Promise<DryRunResult> {
  const runId = `run_${crypto.randomUUID()}`;
  const correlationId = `corr_${crypto.randomUUID()}`;
  const events = new CollectingEventSink();
  const idempotency = new InMemoryIdempotencyStore();

  let run = createInitialRunState(intake, runId, correlationId, {
    repository: intake.repository ?? 'aaronjullger-lgtm/PANaCEa',
    baseBranch: intake.baseBranch ?? 'main',
    workspaceId: intake.workspaceId ?? 'panacea',
  });
  run.dryRun = true;

  const toolCtx: ToolContext = {
    env: {},
    correlationId,
    runId,
    dryRun: true,
    idempotency,
    events,
  };
  const tools = createBuilderToolRegistry(toolCtx);
  run.integrationStatus = integrationStatus(tools);

  events.emit(createEvent('run.created', correlationId, { taskSource: intake.taskSource }, { runId }));

  const transition = (to: BuilderRunState['status'], step?: string) => {
    assertTransition(run.status, to);
    const from = run.status;
    run = { ...run, status: to, currentStep: step, updatedAt: new Date().toISOString() };
    events.emit(
      createEvent('state.transition', correlationId, { from, to, step }, { runId })
    );
  };

  // Phase 1-2: intake + context
  transition('analyzing', 'intake');
  run.completedCheckpoints.push('intake_complete');

  if (intake.taskSource === 'sentry' && intake.sourceId) {
    const issue = await tools.sentry.getIssue(intake.sourceId);
    run.objective = `${run.objective}\n\nSentry: ${issue.title}`;
  }
  if (intake.taskSource === 'linear' && intake.sourceId) {
    const issue = await tools.linear.getIssue(intake.sourceId);
    run.objective = `${run.objective}\n\nLinear: ${issue.title}`;
  }
  run.completedCheckpoints.push('context_complete');

  // Phase 3-5: risk, spec, plan
  const risk = classifyRisk(run.objective, intake.metadata);
  const spec = `# Specification\n\n**Objective:** ${run.objective}\n\n**Risk:** ${risk.level}\n`;
  const plan = `# Plan\n\n1. Implement minimal change\n2. Run tests\n3. Open PR\n`;
  run.specRef = `spec://${runId}`;
  run.planRef = `plan://${runId}`;
  run.completedCheckpoints.push('risk_complete', 'spec_complete', 'plan_complete');

  // Phase 6: approval
  if (risk.requiresPlanApproval && !options.autoApprovePlan) {
    transition('awaiting_plan_approval', 'approval');
    const approval = createApprovalRequest('plan');
    run.pendingApprovals.push(approval);
    events.emit(createEvent('approval.requested', correlationId, { kind: 'plan' }, { runId }));
    throw new Error('Dry-run paused at plan approval (call with autoApprovePlan: true)');
  }

  if (risk.requiresPlanApproval && options.autoApprovePlan) {
    const approval = createApprovalRequest('plan');
    run.pendingApprovals.push(
      resolveApproval(approval, true, intake.requestingUser, 'auto-approved in dry-run')
    );
    events.emit(createEvent('approval.resolved', correlationId, { kind: 'plan', approved: true }, { runId }));
  }

  transition('approved', 'approval');
  run.completedCheckpoints.push('approval_complete');

  // Phase 7-9: workspace, implement, validate
  transition('executing', 'workspace');
  const backend = selectExecutionBackend('test', {}, {
    failCommands: options.simulateTestFailure ? ['npm test -- tests/builder-agent'] : undefined,
  });
  const workspace = await backend.prepareWorkspace(run.repository, run.baseBranch);
  run.completedCheckpoints.push('workspace_complete', 'implement_complete');

  transition('testing', 'validate');
  const validation = await runValidationSuite(backend, workspace, [
    { command: 'npm', args: ['test', '--', 'tests/builder-agent'] },
    { command: 'npm', args: ['run', 'typecheck'] },
    { command: 'npm', args: ['run', 'lint'] },
  ]);

  run.testResults = validation.results.map((r) => ({
    command: r.stdout.split(' ')[1] ?? 'npm',
    ok: r.success,
    exitCode: r.exitCode,
    durationMs: r.durationMs,
    outputPreview: r.stdout.slice(0, 200),
  }));

  if (!validation.ok) {
    transition('failed', 'validate');
    run.errorSummary = 'Validation suite failed';
    events.emit(createEvent('run.failed', correlationId, { phase: 'validate' }, { runId }));
    await backend.dispose(workspace);
    return { run, events: events.events, spec, plan };
  }
  run.completedCheckpoints.push('validate_complete');

  // Phase 10-11: branch + PR
  const branch = `cursor/builder-${runId.slice(4, 12)}`;
  await tools.github.createBranch(run.repository, run.baseBranch, branch);
  run.branchName = branch;
  run.completedCheckpoints.push('branch_complete');

  const pr = await tools.github.createPullRequest(
    run.repository,
    branch,
    run.baseBranch,
    `builder: ${run.objective.slice(0, 72)}`,
    `## Builder Agent\n\n${spec}\n\n${plan}\n\nCorrelation: ${correlationId}`
  );
  run.prUrl = pr.url;
  run.completedCheckpoints.push('pr_complete');

  transition('awaiting_pr_review', 'ci_monitor');

  // Phase 12-13: CI + revision
  let cycles = options.revisionCycles ?? 0;
  if (options.simulateCiFailure && cycles === 0) {
    cycles = 1;
  }

  for (let i = 0; i <= cycles; i++) {
    const checks = await tools.github.getCheckStatus(run.repository, branch);
    const ciOk = !options.simulateCiFailure || i > 0;
    run.ciResults = checks.map((c) => ({
      checkName: c.name,
      status: 'completed',
      conclusion: ciOk ? 'success' : 'failure',
    }));
    events.emit(
      createEvent('ci.result', correlationId, { ok: ciOk, iteration: i }, { runId })
    );

    if (!ciOk) {
      transition('revising', 'revise');
      const feedback = await tools.coderabbit.getReviewFeedback(pr.url);
      run.artifacts.push(`revision-notes-${i}.md`);
      run.retryCount += 1;
      events.emit(createEvent('retry', correlationId, { phase: 'revise', count: run.retryCount }, { runId }));
      transition('testing', 'validate');
      continue;
    }
    transition('awaiting_pr_review', 'ci_monitor');
    break;
  }

  run.completedCheckpoints.push('ci_complete', 'revise_complete');

  // Phase 14: final approval (merge blocked without approval)
  transition('awaiting_merge_approval', 'final_approval');
  if (!options.autoApproveMerge) {
    run.pendingApprovals.push(createApprovalRequest('merge'));
    events.emit(createEvent('approval.requested', correlationId, { kind: 'merge' }, { runId }));
    // Complete without merge — merge always requires explicit approval
    transition('completed', 'complete');
    run.completedCheckpoints.push('final_approval_complete', 'run_complete');
    await backend.dispose(workspace);
    return { run, events: events.events, spec, plan };
  }

  run.pendingApprovals.push(
    resolveApproval(createApprovalRequest('merge'), true, intake.requestingUser)
  );
  transition('completed', 'complete');
  run.completedCheckpoints.push('final_approval_complete', 'run_complete');

  for (const phase of BUILD_PHASES) {
    if (!run.completedCheckpoints.includes(phase.checkpoint)) {
      // ensure all phase checkpoints represented in happy path
    }
  }

  await backend.dispose(workspace);
  return { run, events: events.events, spec, plan };
}
