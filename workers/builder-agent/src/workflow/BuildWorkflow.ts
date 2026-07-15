/**
 * BuildWorkflow — durable 15-phase build pipeline.
 */

import { AgentWorkflow } from 'agents/workflows';
import type { AgentWorkflowEvent, AgentWorkflowStep } from 'agents/workflows';
import type { BuilderAgent } from '../agent/BuilderAgent';
import { LocalDevExecutionBackend } from '@/lib/builder-agent/execution/local-dev-backend';
import { SandboxExecutionBackend } from '@/lib/builder-agent/execution/sandbox-backend';
import type { ExecutionBackend } from '@/lib/builder-agent/execution/backend';
import { InMemoryIdempotencyStore } from '@/lib/builder-agent/idempotency/store';
import { CollectingEventSink, createEvent } from '@/lib/builder-agent/observability/events';
import {
  executeApprovalPhase,
  executeContextPhase,
  executeRiskAndPlanPhase,
  executeValidationPhase,
  transitionRun,
} from '@/lib/builder-agent/workflow/orchestrator';
import { createBuilderToolRegistry } from '@/lib/builder-agent/tools/registry';
import { classifyRisk } from '@/lib/builder-agent/approval/policy';
import { BUILD_PHASES } from '@/lib/builder-agent/workflow/phases';

type BuildWorkflowParams = { runId: string; workspaceId: string };

export class BuildWorkflow extends AgentWorkflow<BuilderAgent, BuildWorkflowParams> {
  async run(event: AgentWorkflowEvent<BuildWorkflowParams>, step: AgentWorkflowStep) {
    const { runId } = event.payload;

    await step.do('load-run', async () => {
      const run = await this.agent.getRun(runId);
      if (!run) throw new Error(`Run ${runId} not found`);
      return run;
    });

    let run = (await this.agent.getRun(runId))!;

    for (const phase of BUILD_PHASES) {
      await step.do(`phase-${phase.id}`, async () => {
        const events = new CollectingEventSink();
        events.emit(
          createEvent('workflow.phase', run.correlationId, { phase: phase.id }, { runId })
        );

        switch (phase.id) {
          case 'intake':
            run = transitionRun(run, 'analyzing', phase.id, events);
            run.completedCheckpoints.push(phase.checkpoint);
            break;

          case 'context': {
            const idempotency = new InMemoryIdempotencyStore();
            const toolCtx = {
              env: this.env as unknown as Record<string, string>,
              correlationId: run.correlationId,
              runId: run.runId,
              dryRun: run.dryRun,
              idempotency,
              events,
            };
            run = await executeContextPhase({ run, tools: toolCtx, backend: pickBackend(this.env), events, idempotency });
            break;
          }

          case 'risk': {
            const { run: r } = executeRiskAndPlanPhase(run);
            run = r;
            break;
          }

          case 'plan':
            // spec/plan created in risk phase
            break;

          case 'approval': {
            const risk = classifyRisk(run.objective);
            run = executeApprovalPhase(run, risk, false, run.requestingUser, events);
            if (run.status === 'awaiting_plan_approval') {
              await step.waitForEvent('approval', { type: 'approval', timeout: '604800 seconds' });
              run = (await this.agent.getRun(runId))!;
            } else {
              run = transitionRun(run, 'approved', phase.id, events);
            }
            run.completedCheckpoints.push(phase.checkpoint);
            break;
          }

          case 'workspace':
            run = transitionRun(run, 'executing', phase.id, events);
            run.completedCheckpoints.push(phase.checkpoint);
            break;

          case 'implement':
            run.completedCheckpoints.push(phase.checkpoint);
            break;

          case 'validate': {
            run = transitionRun(run, 'testing', phase.id, events);
            const idempotency = new InMemoryIdempotencyStore();
            const toolCtx = {
              env: this.env as unknown as Record<string, string>,
              correlationId: run.correlationId,
              runId: run.runId,
              dryRun: run.dryRun,
              idempotency,
              events,
            };
            run = await executeValidationPhase(
              { run, tools: toolCtx, backend: pickBackend(this.env), events, idempotency },
              run.runId
            );
            if (run.status === 'failed') throw new Error(run.errorSummary ?? 'Validation failed');
            break;
          }

          case 'branch': {
            const tools = createBuilderToolRegistry({
              env: this.env as Record<string, string>,
              correlationId: run.correlationId,
              runId: run.runId,
              dryRun: run.dryRun,
              idempotency: new InMemoryIdempotencyStore(),
              events,
            });
            const branch = `cursor/builder-${run.runId.slice(4, 12)}`;
            await tools.github.createBranch(run.repository, run.baseBranch, branch);
            run = { ...run, branchName: branch };
            run.completedCheckpoints.push(phase.checkpoint);
            await this.agent.updateRun(runId, run);
            break;
          }

          case 'pr': {
            const tools = createBuilderToolRegistry({
              env: this.env as Record<string, string>,
              correlationId: run.correlationId,
              runId: run.runId,
              dryRun: run.dryRun,
              idempotency: new InMemoryIdempotencyStore(),
              events,
            });
            const pr = await tools.github.createPullRequest(
              run.repository,
              run.branchName!,
              run.baseBranch,
              `builder: ${run.objective.slice(0, 72)}`,
              `Correlation: ${run.correlationId}`
            );
            run = { ...run, prUrl: pr.url };
            run.completedCheckpoints.push(phase.checkpoint);
            run = transitionRun(run, 'awaiting_pr_review', phase.id, events);
            await this.agent.updateRun(runId, run);
            break;
          }

          case 'ci_monitor': {
            const tools = createBuilderToolRegistry({
              env: this.env as Record<string, string>,
              correlationId: run.correlationId,
              runId: run.runId,
              dryRun: run.dryRun,
              idempotency: new InMemoryIdempotencyStore(),
              events,
            });
            const checks = await tools.github.getCheckStatus(run.repository, run.branchName!);
            run.ciResults = checks.map((c: { name: string; conclusion?: string }) => ({
              checkName: c.name,
              status: 'completed' as const,
              conclusion: (c.conclusion as 'success' | 'failure') ?? 'success',
            }));
            run.completedCheckpoints.push(phase.checkpoint);
            await this.agent.updateRun(runId, run);
            break;
          }

          case 'revise':
            run.completedCheckpoints.push(phase.checkpoint);
            break;

          case 'final_approval':
            run = transitionRun(run, 'awaiting_merge_approval', phase.id, events);
            run.completedCheckpoints.push(phase.checkpoint);
            break;

          case 'complete':
            run = transitionRun(run, 'completed', phase.id, events);
            run.completedCheckpoints.push(phase.checkpoint);
            break;

          default:
            break;
        }

        await this.agent.updateRun(runId, run);
        await step.mergeAgentState({ lastPhase: phase.id, runId });
        return { phase: phase.id };
      });
    }

    await step.reportComplete({ runId, status: 'completed' });
    return { runId };
  }
}

function pickBackend(env: { BUILDER_AGENT_SANDBOX_ENABLED?: string; Sandbox?: unknown }): ExecutionBackend {
  const sandbox = new SandboxExecutionBackend({
    enabled: env.BUILDER_AGENT_SANDBOX_ENABLED === 'true',
    bindingPresent: Boolean(env.Sandbox),
  });
  if (sandbox.available) return sandbox;
  return new LocalDevExecutionBackend();
}
