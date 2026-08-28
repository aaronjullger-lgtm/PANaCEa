/**
 * Build workflow orchestration — shared between dry-run tests and Cloudflare Workflow steps.
 */

import { createApprovalRequest, resolveApproval } from '../approval/gates';
import { classifyRisk } from '../approval/policy';
import { runValidationSuite } from '../execution/backend';
import type { ExecutionBackend } from '../execution/backend';
import { createEvent } from '../observability/events';
import type { EventSink } from '../observability/events';
import { assertTransition } from '../state/transitions';
import type { BuilderRunState } from '../state/types';
import { createBuilderToolRegistry, integrationStatus } from '../tools/registry';
import type { ToolContext } from '../tools/types';
import type { IdempotencyStore } from '../idempotency/store';

export interface OrchestratorContext {
  run: BuilderRunState;
  tools: ToolContext;
  backend: ExecutionBackend;
  events: EventSink;
  idempotency: IdempotencyStore;
  autoApprovePlan?: boolean;
}

export function transitionRun(
  run: BuilderRunState,
  to: BuilderRunState['status'],
  step: string,
  events: EventSink
): BuilderRunState {
  assertTransition(run.status, to);
  const from = run.status;
  const updated = {
    ...run,
    status: to,
    currentStep: step,
    updatedAt: new Date().toISOString(),
  };
  events.emit(
    createEvent('state.transition', run.correlationId, { from, to, step }, { runId: run.runId })
  );
  return updated;
}

export async function executeContextPhase(ctx: OrchestratorContext): Promise<BuilderRunState> {
  let run = ctx.run;
  const tools = createBuilderToolRegistry(ctx.tools);
  run.integrationStatus = integrationStatus(tools);

  if (run.taskSource === 'sentry' && run.sourceId) {
    const issue = await tools.sentry.getIssue(run.sourceId);
    run = { ...run, objective: `${run.objective}\n\nSentry: ${issue.title}` };
  }
  if (run.taskSource === 'linear' && run.sourceId) {
    const issue = await tools.linear.getIssue(run.sourceId);
    run = { ...run, objective: `${run.objective}\n\nLinear: ${issue.title}` };
  }

  run.completedCheckpoints.push('context_complete');
  return run;
}

export function executeRiskAndPlanPhase(run: BuilderRunState): {
  run: BuilderRunState;
  spec: string;
  plan: string;
  risk: ReturnType<typeof classifyRisk>;
} {
  const risk = classifyRisk(run.objective);
  const spec = `# Specification\n\n**Objective:** ${run.objective}\n\n**Risk:** ${risk.level}\n`;
  const plan = `# Plan\n\n1. Implement change\n2. Validate\n3. Open PR\n`;

  const updated: BuilderRunState = {
    ...run,
    specRef: `spec://${run.runId}`,
    planRef: `plan://${run.runId}`,
    completedCheckpoints: [
      ...run.completedCheckpoints,
      'risk_complete',
      'spec_complete',
      'plan_complete',
    ],
    updatedAt: new Date().toISOString(),
  };

  return { run: updated, spec, plan, risk };
}

export function executeApprovalPhase(
  run: BuilderRunState,
  risk: ReturnType<typeof classifyRisk>,
  autoApprove: boolean,
  resolvedBy: string,
  events: EventSink
): BuilderRunState {
  if (!risk.requiresPlanApproval) {
    return {
      ...run,
      completedCheckpoints: [...run.completedCheckpoints, 'approval_complete'],
      updatedAt: new Date().toISOString(),
    };
  }

  if (!autoApprove) {
    const approval = createApprovalRequest('plan');
    events.emit(
      createEvent('approval.requested', run.correlationId, { kind: 'plan' }, { runId: run.runId })
    );
    return {
      ...run,
      status: 'awaiting_plan_approval',
      currentStep: 'approval',
      pendingApprovals: [...run.pendingApprovals, approval],
      updatedAt: new Date().toISOString(),
    };
  }

  const approval = resolveApproval(
    createApprovalRequest('plan'),
    true,
    resolvedBy,
    'auto-approved'
  );
  events.emit(
    createEvent('approval.resolved', run.correlationId, { kind: 'plan', approved: true }, {
      runId: run.runId,
    })
  );
  return {
    ...run,
    pendingApprovals: [...run.pendingApprovals, approval],
    completedCheckpoints: [...run.completedCheckpoints, 'approval_complete'],
    updatedAt: new Date().toISOString(),
  };
}

export async function executeValidationPhase(
  ctx: OrchestratorContext,
  workspaceId: string
): Promise<BuilderRunState> {
  const handle = await ctx.backend.prepareWorkspace(ctx.run.repository, ctx.run.baseBranch);
  try {
    const validation = await runValidationSuite(ctx.backend, handle, [
      { command: 'npm', args: ['test'] },
      { command: 'npm', args: ['run', 'typecheck'] },
    ]);

    const testResults = validation.results.map((r) => ({
      command: 'npm',
      ok: r.success,
      exitCode: r.exitCode,
      durationMs: r.durationMs,
      outputPreview: r.stdout.slice(0, 200),
    }));

    ctx.events.emit(
      createEvent(
        'test.result',
        ctx.run.correlationId,
        { ok: validation.ok, workspaceId },
        { runId: ctx.run.runId }
      )
    );

    if (!validation.ok) {
      return {
        ...ctx.run,
        testResults,
        status: 'failed',
        errorSummary: 'Validation failed',
        updatedAt: new Date().toISOString(),
      };
    }

    return {
      ...ctx.run,
      testResults,
      completedCheckpoints: [...ctx.run.completedCheckpoints, 'validate_complete'],
      updatedAt: new Date().toISOString(),
    };
  } finally {
    await ctx.backend.dispose(handle);
  }
}
