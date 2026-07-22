/**
 * BuilderAgent — Durable Object for PANaCEa engineering runs.
 */

import { Agent } from 'agents';
import type { Env } from '../env';
import {
  createInitialRunState,
  type BuilderRunState,
  type IntakePayload,
} from '@/lib/builder-agent/state/types';
import { IntakePayloadSchema } from '@/lib/builder-agent/state/schema';
import { assertTransition, isTerminal } from '@/lib/builder-agent/state/transitions';
import { resolveApproval } from '@/lib/builder-agent/approval/gates';
import { prohibitedWithoutApproval } from '@/lib/builder-agent/approval/policy';
import { createEvent } from '@/lib/builder-agent/observability/events';
import { redactUnknown } from '@/lib/builder-agent/observability/redaction';
import { buildIdempotencyKey, buildWebhookIdempotencyKey } from '@/lib/builder-agent/idempotency/keys';

export interface BuilderAgentState {
  runs: Record<string, BuilderRunState>;
  webhookDeliveries: Record<string, string>;
  intakeIdempotency: Record<string, string>;
}

export class BuilderAgent extends Agent<Env, BuilderAgentState> {
  initialState: BuilderAgentState = {
    runs: {},
    webhookDeliveries: {},
    intakeIdempotency: {},
  };

  async onConnect() {
    const correlationId = this.name ?? 'panacea';
    console.log(
      JSON.stringify(createEvent('agent.connected', correlationId, { agentId: this.name }))
    );
  }

  async createRun(intake: IntakePayload): Promise<BuilderRunState> {
    const parsed = IntakePayloadSchema.parse(intake);

    if (parsed.idempotencyKey) {
      const existingRunId = this.state.intakeIdempotency[parsed.idempotencyKey];
      if (existingRunId) {
        const existing = this.state.runs[existingRunId];
        if (existing) return existing;
      }
    }

    const run = await this.startRun(parsed);

    const runs = { ...this.state.runs, [run.runId]: run };
    this.setState({
      ...this.state,
      runs,
      ...(parsed.idempotencyKey
        ? {
            intakeIdempotency: {
              ...this.state.intakeIdempotency,
              [parsed.idempotencyKey]: run.runId,
            },
          }
        : {}),
    });

    return run;
  }

  /**
   * Atomic webhook intake: deduplicate delivery and create run in one state update.
   */
  async intakeFromWebhook(
    provider: string,
    deliveryId: string,
    intake: IntakePayload
  ): Promise<{ duplicate: boolean; run?: BuilderRunState }> {
    const key = buildWebhookIdempotencyKey(provider, deliveryId);
    if (this.state.webhookDeliveries[key]) {
      return { duplicate: true };
    }

    const parsed = IntakePayloadSchema.parse(intake);
    const run = await this.startRun(parsed);

    this.setState({
      ...this.state,
      runs: { ...this.state.runs, [run.runId]: run },
      webhookDeliveries: {
        ...this.state.webhookDeliveries,
        [key]: new Date().toISOString(),
      },
    });

    return { duplicate: false, run };
  }

  private async startRun(parsed: IntakePayload): Promise<BuilderRunState> {
    const runId = `run_${crypto.randomUUID()}`;
    const correlationId = `corr_${crypto.randomUUID()}`;

    // v1: dry-run is mandatory unless BUILDER_AGENT_DRY_RUN=false is explicitly set in env
    // AND the client also passes dryRun:false (staging only).
    const dryRun =
      this.env.BUILDER_AGENT_DRY_RUN === 'false' && parsed.dryRun === false ? false : true;

    const run = createInitialRunState(
      { ...parsed, dryRun },
      runId,
      correlationId,
      {
        repository: this.env.BUILDER_AGENT_DEFAULT_REPO ?? 'aaronjullger-lgtm/PANaCEa',
        baseBranch: this.env.BUILDER_AGENT_DEFAULT_BRANCH ?? 'main',
        workspaceId: parsed.workspaceId ?? 'panacea',
      }
    );

    const workflowInstanceId = await this.runWorkflow('BUILD_WORKFLOW', {
      runId,
      workspaceId: run.workspaceId,
    });

    const withWorkflow: BuilderRunState = {
      ...run,
      workflowInstanceId,
    };

    console.log(
      JSON.stringify(
        createEvent(
          'run.created',
          correlationId,
          redactUnknown({ taskSource: parsed.taskSource, dryRun }) as Record<string, unknown>,
          { runId }
        )
      )
    );

    return withWorkflow;
  }

  async getRun(runId: string): Promise<BuilderRunState | null> {
    return this.state.runs[runId] ?? null;
  }

  async listRuns(): Promise<BuilderRunState[]> {
    return Object.values(this.state.runs).sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt)
    );
  }

  async updateRun(runId: string, patch: Partial<BuilderRunState>): Promise<BuilderRunState> {
    const existing = this.state.runs[runId];
    if (!existing) throw new Error(`Run not found: ${runId}`);

    if (patch.status && patch.status !== existing.status) {
      assertTransition(existing.status, patch.status);
    }

    const updated: BuilderRunState = {
      ...existing,
      ...patch,
      runId: existing.runId,
      updatedAt: new Date().toISOString(),
    };

    const runs = { ...this.state.runs, [runId]: updated };
    this.setState({ ...this.state, runs });
    return updated;
  }

  async approveRun(
    runId: string,
    approvalId: string,
    approved: boolean,
    resolvedBy: string,
    reason?: string
  ): Promise<BuilderRunState> {
    const run = this.state.runs[runId];
    if (!run) throw new Error(`Run not found: ${runId}`);

    const idx = run.pendingApprovals.findIndex((a: { id: string }) => a.id === approvalId);
    if (idx < 0) throw new Error(`Approval not found: ${approvalId}`);

    const pending = run.pendingApprovals[idx]!;
    const resolved = resolveApproval(pending, approved, resolvedBy, reason);
    const pendingApprovals = [...run.pendingApprovals];
    pendingApprovals[idx] = resolved;

    let status = run.status;
    if (resolved.kind === 'plan' && approved && status === 'awaiting_plan_approval') {
      assertTransition(status, 'approved');
      status = 'approved';
    }

    if (run.workflowInstanceId) {
      if (approved) {
        await this.approveWorkflow(run.workflowInstanceId, {
          reason,
          metadata: { approvalId, resolvedBy, kind: resolved.kind },
        });
      } else {
        await this.rejectWorkflow(run.workflowInstanceId, { reason: reason ?? 'Rejected' });
      }
    }

    console.log(
      JSON.stringify(
        createEvent(
          'approval.resolved',
          run.correlationId,
          { kind: resolved.kind, approved },
          { runId }
        )
      )
    );

    return this.updateRun(runId, { pendingApprovals, status });
  }

  async cancelRun(runId: string, reason?: string): Promise<BuilderRunState> {
    const run = this.state.runs[runId];
    if (!run) throw new Error(`Run not found: ${runId}`);
    if (isTerminal(run.status)) return run;

    if (run.workflowInstanceId) {
      await this.terminateWorkflow(run.workflowInstanceId);
    }

    assertTransition(run.status, 'canceled');
    console.log(
      JSON.stringify(createEvent('run.canceled', run.correlationId, { reason }, { runId }))
    );
    return this.updateRun(runId, {
      status: 'canceled',
      errorSummary: reason ?? 'Canceled by user',
    });
  }

  async attemptMerge(runId: string): Promise<{ allowed: boolean; reason?: string }> {
    const run = this.state.runs[runId];
    if (!run) throw new Error(`Run not found: ${runId}`);
    const blocked = prohibitedWithoutApproval('merge', run);
    return blocked ? { allowed: false, reason: blocked } : { allowed: true };
  }

  async attemptDeploy(runId: string): Promise<{ allowed: boolean; reason?: string }> {
    const run = this.state.runs[runId];
    if (!run) throw new Error(`Run not found: ${runId}`);
    const blocked = prohibitedWithoutApproval('deploy', run);
    return blocked ? { allowed: false, reason: blocked } : { allowed: true };
  }

  async attemptInfrastructure(runId: string): Promise<{ allowed: boolean; reason?: string }> {
    const run = this.state.runs[runId];
    if (!run) throw new Error(`Run not found: ${runId}`);
    const blocked = prohibitedWithoutApproval('infrastructure', run);
    return blocked ? { allowed: false, reason: blocked } : { allowed: true };
  }

  async attemptCredentials(runId: string): Promise<{ allowed: boolean; reason?: string }> {
    const run = this.state.runs[runId];
    if (!run) throw new Error(`Run not found: ${runId}`);
    const blocked = prohibitedWithoutApproval('credentials', run);
    return blocked ? { allowed: false, reason: blocked } : { allowed: true };
  }

  /** @deprecated Use intakeFromWebhook for atomic deduplication */
  async recordWebhookDelivery(provider: string, deliveryId: string): Promise<boolean> {
    const key = buildWebhookIdempotencyKey(provider, deliveryId);
    if (this.state.webhookDeliveries[key]) return false;
    this.setState({
      ...this.state,
      webhookDeliveries: {
        ...this.state.webhookDeliveries,
        [key]: new Date().toISOString(),
      },
    });
    return true;
  }

  async onWorkflowComplete(
    _workflowName: string,
    _instanceId: string,
    result?: unknown
  ): Promise<void> {
    console.log(
      JSON.stringify({ type: 'workflow.complete', result: redactUnknown(result) })
    );
  }

  async onWorkflowError(
    _workflowName: string,
    _instanceId: string,
    error: unknown
  ): Promise<void> {
    console.log(
      JSON.stringify({ type: 'workflow.error', error: redactUnknown(String(error)) })
    );
  }
}
