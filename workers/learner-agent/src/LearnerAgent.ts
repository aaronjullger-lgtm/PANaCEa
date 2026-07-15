/**
 * Learner Agent Durable Object — one instance per authenticated learner.
 *
 * Manages WebSocket continuity, pending recommendations, and workflow triggers.
 * Canonical learning data remains in Postgres via Pages API tool calls.
 */

import { Agent } from 'agents';
import { AgentWorkflow } from 'agents/workflows';
import type { AgentWorkflowEvent, AgentWorkflowStep } from 'agents/workflows';

export interface LearnerAgentState {
  userId: string | null;
  correlationId: string | null;
  activeSessionId: string | null;
  currentObjective: string | null;
  pendingRecommendation: Record<string, unknown> | null;
  pendingConfirmation: 'accept' | 'defer' | 'adjust' | null;
  lastConnectedAt: string | null;
  disabledMemoryCategories: string[];
}

const DEFAULT_STATE: LearnerAgentState = {
  userId: null,
  correlationId: null,
  activeSessionId: null,
  currentObjective: null,
  pendingRecommendation: null,
  pendingConfirmation: null,
  lastConnectedAt: null,
  disabledMemoryCategories: [],
};

export class LearnerAgent extends Agent<Env, LearnerAgentState> {
  initialState: LearnerAgentState = { ...DEFAULT_STATE };

  async onConnect(connection: Connection) {
    const token = new URL(connection.url).searchParams.get('token');
    if (!token) {
      connection.close(4401, 'Missing connection token');
      return;
    }

    const userId = await this.env.RATE_LIMIT_KV?.get(`learner-connect:${token}`);
    if (!userId) {
      connection.close(4401, 'Invalid or expired connection token');
      return;
    }

    this.setState({
      ...this.state,
      userId,
      lastConnectedAt: new Date().toISOString(),
      correlationId: this.state.correlationId ?? `corr_${Date.now()}`,
    });

    connection.send(
      JSON.stringify({
        type: 'connected',
        userId,
        correlationId: this.state.correlationId,
        activeSessionId: this.state.activeSessionId,
        pendingRecommendation: this.state.pendingRecommendation,
      })
    );
  }

  async onMessage(connection: Connection, message: string) {
    let payload: { type?: string; [key: string]: unknown };
    try {
      payload = JSON.parse(message);
    } catch {
      connection.send(JSON.stringify({ type: 'error', error: 'Invalid JSON' }));
      return;
    }

    const type = payload.type ?? 'unknown';

    switch (type) {
      case 'ping':
        connection.send(JSON.stringify({ type: 'pong', at: new Date().toISOString() }));
        break;

      case 'set_objective':
        this.setState({
          ...this.state,
          currentObjective: String(payload.objective ?? ''),
        });
        connection.send(JSON.stringify({ type: 'objective_set', objective: this.state.currentObjective }));
        break;

      case 'set_recommendation':
        this.setState({
          ...this.state,
          pendingRecommendation: (payload.recommendation as Record<string, unknown>) ?? null,
        });
        connection.send(JSON.stringify({ type: 'recommendation_stored' }));
        break;

      case 'recommendation_response': {
        const response = payload.response as 'accept' | 'defer' | 'adjust';
        this.setState({
          ...this.state,
          pendingConfirmation: response,
        });
        connection.send(
          JSON.stringify({
            type: 'recommendation_recorded',
            response,
            correlationId: this.state.correlationId,
          })
        );
        if (response === 'adjust') {
          await this.runWorkflow('STUDY_PLAN_REVISION_WORKFLOW', {
            userId: this.state.userId,
            requestId: `rev_${Date.now()}`,
            changeDescription: String(payload.adjustment ?? 'learner requested plan adjustment'),
          });
        }
        break;
      }

      case 'session_started':
        this.setState({
          ...this.state,
          activeSessionId: String(payload.sessionId ?? ''),
        });
        connection.send(JSON.stringify({ type: 'session_bound', sessionId: this.state.activeSessionId }));
        break;

      case 'session_completed':
        this.setState({
          ...this.state,
          activeSessionId: null,
          pendingConfirmation: null,
        });
        connection.send(JSON.stringify({ type: 'session_cleared' }));
        break;

      default:
        connection.send(JSON.stringify({ type: 'error', error: `Unknown message type: ${type}` }));
    }
  }

  async onWorkflowComplete(workflowName: string, instanceId: string, result?: unknown) {
    this.broadcast(
      JSON.stringify({
        type: 'workflow_complete',
        workflowName,
        instanceId,
        result,
      })
    );
  }

  async onWorkflowProgress(workflowName: string, instanceId: string, progress: unknown) {
    this.broadcast(
      JSON.stringify({
        type: 'workflow_progress',
        workflowName,
        instanceId,
        progress,
      })
    );
  }
}

type RevisionParams = {
  userId: string | null;
  requestId: string;
  changeDescription: string;
};

export class StudyPlanRevisionWorkflow extends AgentWorkflow<LearnerAgent, RevisionParams> {
  async run(event: AgentWorkflowEvent<RevisionParams>, step: AgentWorkflowStep) {
    const params = event.payload;

    await step.do('validate-request', async () => {
      if (!params.userId) throw new Error('userId required');
      if (!params.requestId) throw new Error('requestId required');
      return { ok: true };
    });

    await this.reportProgress({
      step: 'revision',
      status: 'queued',
      requestId: params.requestId,
    });

    const result = await step.do('record-revision-intent', async () => {
      return {
        userId: params.userId,
        requestId: params.requestId,
        changeDescription: params.changeDescription,
        recordedAt: new Date().toISOString(),
        note: 'Full plan revision executes via Pages API study-plan services',
      };
    });

    await step.mergeAgentState({
      pendingConfirmation: null,
    });

    await step.reportComplete(result);
    return result;
  }
}

interface Env {
  LEARNER_AGENT: DurableObjectNamespace;
  STUDY_PLAN_REVISION_WORKFLOW: Workflow;
  RATE_LIMIT_KV?: KVNamespace;
  PAGES_API_URL?: string;
}
