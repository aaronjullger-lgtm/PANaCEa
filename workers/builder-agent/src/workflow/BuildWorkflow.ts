/**
 * BuildWorkflow — durable 15-phase build pipeline.
 *
 * NOTE: specification, planning, implementation, and revision phases are
 * orchestration placeholders in v1 — see lib/builder-agent/capabilities.ts.
 */

import { AgentWorkflow } from 'agents/workflows';
import type { AgentWorkflowEvent, AgentWorkflowStep } from 'agents/workflows';
import type { BuilderAgent } from '../agent/BuilderAgent';
import {
  selectExecutionBackend,
  assertWorkerExecutionAvailable,
} from '@/lib/builder-agent/execution/select-backend';
import { InMemoryIdempotencyStore } from '@/lib/builder-agent/idempotency/store';
import { CollectingEventSink, createEvent } from '@/lib/builder-agent/observability/events';
import {
  executeContextPhase,
  executeRiskAndPlanPhase,
  executeValidationPhase,
  transitionRun,
} from '@/lib/builder-agent/workflow/orchestrator';
import { createBuilderToolRegistry } from '@/lib/builder-agent/tools/registry';
import { classifyRisk } from '@/lib/builder-agent/approval/policy';
import { createApprovalRequest } from '@/lib/builder-agent/approval/gates';
import { BUILD_PHASES } from '@/lib/builder-agent/workflow/phases';
import { CAPABILITY_SUMMARY } from '@/lib/builder-agent/capabilities';

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
            run = await executeContextPhase({
              run,
              tools: toolCtx,
              backend: selectExecutionBackend('worker', this.env),
              events,
              idempotency,
            });
            break;
          }

          case 'risk': {
            const { run: r } = executeRiskAndPlanPhase(run);
            run = r;
            break;
          }

          case 'plan':
            break;

          case 'approval': {
            const risk = classifyRisk(run.objective);
            if (risk.requiresPlanApproval) {
              const approval = createApprovalRequest('plan');
              run = {
                ...run,
                status: 'awaiting_plan_approval',
                currentStep: phase.id,
                pendingApprovals: [...run.pendingApprovals, approval],
                updatedAt: new Date().toISOString(),
              };
              events.emit(
                createEvent('approval.requested', run.correlationId, { kind: 'plan' }, { runId })
              );
              await this.agent.updateRun(runId, run);
              await this.waitForApproval(step, { timeout: '7 days', stepName: 'plan-approval' });
              run = (await this.agent.getRun(runId))!;
              if (run.status !== 'approved') {
                throw new Error('Plan approval required but run not approved');
              }
            } else {
              run = transitionRun(run, 'approved', phase.id, events);
            }
            run.completedCheckpoints.push(phase.checkpoint);
            break;
          }

          case 'workspace': {
            const backend = selectExecutionBackend('worker', this.env);
            try {
              assertWorkerExecutionAvailable(backend);
            } catch (err) {
              run = {
                ...run,
                status: 'failed',
                errorSummary: err instanceof Error ? err.message : String(err),
                updatedAt: new Date().toISOString(),
              };
              await this.agent.updateRun(runId, run);
              throw err;
            }
            run = transitionRun(run, 'executing', phase.id, events);
            run.completedCheckpoints.push(phase.checkpoint);
            break;
          }

          case 'implement':
            // Placeholder — no autonomous code generation in v1
            run.artifacts.push('implementation-placeholder.md');
            run.completedCheckpoints.push(phase.checkpoint);
            break;

          case 'validate': {
            run = transitionRun(run, 'testing', phase.id, events);
            const backend = selectExecutionBackend('worker', this.env);
            assertWorkerExecutionAvailable(backend);
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
              { run, tools: toolCtx, backend, events, idempotency },
              run.runId
            );
            if (run.status === 'failed') {
              throw new Error(run.errorSummary ?? 'Validation failed');
            }
            break;
          }

          case 'branch':
          case 'pr':
          case 'ci_monitor':
          case 'revise':
            // External mutations only when not in dry-run; otherwise record placeholder artifacts
            if (run.dryRun) {
              run.artifacts.push(`${phase.id}-dry-run-placeholder`);
              run.completedCheckpoints.push(phase.checkpoint);
              if (phase.id === 'pr') {
                run.prUrl = `https://github.com/${run.repository}/pull/0`;
                run = transitionRun(run, 'awaiting_pr_review', phase.id, events);
              }
              break;
            }
            // Live path unverified in v1 — fail closed rather than call GitHub
            run = {
              ...run,
              status: 'failed',
              errorSummary:
                'Live branch/PR/CI phases require verified integrations and BUILDER_AGENT_DRY_RUN=false',
              updatedAt: new Date().toISOString(),
            };
            await this.agent.updateRun(runId, run);
            throw new Error(run.errorSummary);

          case 'final_approval':
            run = transitionRun(run, 'awaiting_merge_approval', phase.id, events);
            run.pendingApprovals.push(createApprovalRequest('merge'));
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
        await step.mergeAgentState({ lastPhase: phase.id, runId, capabilityNote: CAPABILITY_SUMMARY });
        return { phase: phase.id };
      });
    }

    await step.reportComplete({ runId, status: 'completed' });
    return { runId };
  }
}
