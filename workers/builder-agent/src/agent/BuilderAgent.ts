/**
 * BuilderAgent — Durable Object for PANaCEa engineering runs.
 *
 * One instance per workspace (id = workspace:{workspaceId}).
 * Persists run state in SQLite via Agents SDK.
 */

import { Agent } from 'agents';
import type { Env } from '../env';
import { DEFAULT_WORKSPACE_ID } from '../env';
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
import { buildWebhookIdempotencyKey } from '@/lib/builder-agent/idempotency/keys';

export interface BuilderAgentState {
  runs: Record<string, BuilderRunState>;
  webhookDeliveries: Record<string, string>;
}

export class BuilderAgent extends Agent<Env, BuilderAgentState> {
  initialState: BuilderAgentState = { runs: {}, webhookDeliveries: {} };

  async onConnect() {
    const correlationId = this.name ?? DEFAULT_WORKSPACE_ID;
    console.log(
      JSON.stringify(
        createEvent('agent.connected', correlationId, { agentId: this.name })
      )
    );
  }

  async createRun(intake: IntakePayload): Promise<BuilderRunState> {
    const parsed = IntakePayloadSchema.parse(intake);
    const runId = `run_${crypto.randomUUID()}`;
    const correlationId = `corr_${crypto.randomUUID()}`;

    const dryRun =
      parsed.dryRun ??
      this.env.BUILDER_AGENT_DRY_RUN === 'true';

    const run = createInitialRunState(
      { ...parsed, dryRun },
      runId,
      correlationId,
      {
        repository: this.env.BUILDER_AGENT_DEFAULT_REPO ?? 'aaronjullger-lgtm/PANaCEa',
        baseBranch: this.env.BUILDER_AGENT_DEFAULT_BRANCH ?? 'main',
        workspaceId: parsed.workspaceId ?? DEFAULT_WORKSPACE_ID,
      }
    );

    const runs = { ...this.state.runs, [runId]: run };
    this.setState({ ...this.state, runs });

    console.log(
      JSON.stringify(
        createEvent('run.created', correlationId, redactUnknown({ taskSource: parsed.taskSource }) as Record<string, unknown>, {
          runId,
        })
      )
    );

    // Start durable workflow
    await this.runWorkflow('BUILD_WORKFLOW', {
      runId,
      workspaceId: run.workspaceId,
    });

    return run;
  }

  async getRun(runId: string): Promise<BuilderRunState | null> {
    return this.state.runs[runId] ?? null;
  }

  async listRuns(): Promise<BuilderRunState[]> {
    return Object.values(this.state.runs).sort(
      (a, b) => b.createdAt.localeCompare(a.createdAt)
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

    const resolved = resolveApproval(run.pendingApprovals[idx]!, approved, resolvedBy, reason);
    const pendingApprovals = [...run.pendingApprovals];
    pendingApprovals[idx] = resolved;

    let status = run.status;
    if (resolved.kind === 'plan' && approved && status === 'awaiting_plan_approval') {
      assertTransition(status, 'approved');
      status = 'approved';
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

    assertTransition(run.status, 'canceled');
    console.log(
      JSON.stringify(
        createEvent('run.canceled', run.correlationId, { reason }, { runId })
      )
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

  async recordWebhookDelivery(provider: string, deliveryId: string): Promise<boolean> {
    const key = buildWebhookIdempotencyKey(provider, deliveryId);
    if (this.state.webhookDeliveries[key]) return false;
    this.setState({
      ...this.state,
      webhookDeliveries: { ...this.state.webhookDeliveries, [key]: new Date().toISOString() },
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
