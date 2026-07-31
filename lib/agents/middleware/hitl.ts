/**
 * Human-in-the-Loop Middleware
 *
 * Adds approval gates to autonomous agent operations. When an agent
 * attempts to modify files, run commands, or make external API calls,
 * this middleware intercepts the operation and requires human approval
 * before proceeding.
 *
 * Pattern follows DeepAgents SDK HumanInTheLoopMiddleware conventions:
 * https://docs.langchain.com/oss/deepagents/code/quickstart#interactive-mode
 *
 * @module lib/agents/middleware/hitl
 */

import type { AgentContext, InvokeResult } from '../shared/types';

export type MiddlewareNext = (input: unknown, ctx: AgentContext) => Promise<InvokeResult<unknown>>;

export interface AgentMiddleware {
  name: string;
  wrap: (next: MiddlewareNext) => MiddlewareNext;
}

export type ApprovalDecision = 'approve' | 'reject' | 'defer';

export interface ApprovalRequest {
  id: string;
  agentName: string;
  operation: string;
  description: string;
  risk: 'low' | 'medium' | 'high';
  timestamp: number;
}

export interface ApprovalHandler {
  requestApproval: (request: ApprovalRequest) => Promise<ApprovalDecision>;
}

export interface HITLConfig {
  handler: ApprovalHandler;
  autoApproveLowRisk?: boolean;
  timeoutMs?: number;
}

const HIGH_RISK_OPERATIONS = [
  'write_file',
  'delete_file',
  'run_command',
  'git_commit',
  'git_push',
  'db_migrate',
  'deploy',
];

const MEDIUM_RISK_OPERATIONS = [
  'api_call',
  'send_email',
  'create_issue',
  'update_config',
];

function classifyRisk(operation: string): 'low' | 'medium' | 'high' {
  if (HIGH_RISK_OPERATIONS.some((op) => operation.includes(op))) return 'high';
  if (MEDIUM_RISK_OPERATIONS.some((op) => operation.includes(op))) return 'medium';
  return 'low';
}

let _requestCounter = 0;

export function createHITLMiddleware(config: HITLConfig): AgentMiddleware {
  return {
    name: 'hitl',
    wrap: (next: MiddlewareNext): MiddlewareNext => {
      return async (input: unknown, ctx: AgentContext): Promise<InvokeResult<unknown>> => {
        const start = Date.now();

        const operation = extractOperation(input);
        const risk = classifyRisk(operation);

        if (risk === 'low' && config.autoApproveLowRisk) {
          return next(input, ctx);
        }

        const request: ApprovalRequest = {
          id: `hitl-${++_requestCounter}-${Date.now()}`,
          agentName: ctx.userId ?? 'unknown',
          operation,
          description: typeof input === 'string' ? input.slice(0, 200) : JSON.stringify(input).slice(0, 200),
          risk,
          timestamp: Date.now(),
        };

        let decision: ApprovalDecision;
        try {
          const timeoutPromise = config.timeoutMs
            ? new Promise<ApprovalDecision>((_, reject) =>
                setTimeout(() => reject(new Error('HITL approval timed out')), config.timeoutMs),
              )
            : null;

          decision = timeoutPromise
            ? await Promise.race([config.handler.requestApproval(request), timeoutPromise])
            : await config.handler.requestApproval(request);
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          return {
            status: 'internal_error',
            output: null,
            error: {
              status: 'internal_error',
              message: `HITL approval failed: ${message}`,
              cause: 'hitl-timeout',
            },
            agent: 'hitl-gate',
            durationMs: Date.now() - start,
          };
        }

        if (decision === 'reject') {
          return {
            status: 'internal_error',
            output: null,
            error: {
              status: 'internal_error',
              message: `Operation rejected by human approval gate: ${request.operation}`,
              cause: 'hitl-rejected',
            },
            agent: 'hitl-gate',
            durationMs: Date.now() - start,
          };
        }

        if (decision === 'defer') {
          return {
            status: 'ok',
            output: { deferred: true, request },
            error: null,
            agent: 'hitl-gate',
            durationMs: Date.now() - start,
            telemetry: { hitlDeferred: true },
          };
        }

        return next(input, ctx);
      };
    },
  };
}

function extractOperation(input: unknown): string {
  if (typeof input === 'string') return input;
  if (input && typeof input === 'object') {
    const obj = input as Record<string, unknown>;
    if (typeof obj.operation === 'string') return obj.operation;
    if (typeof obj.action === 'string') return obj.action;
    if (typeof obj.tool === 'string') return obj.tool;
  }
  return 'unknown';
}

export function createConsoleApprovalHandler(): ApprovalHandler {
  return {
    async requestApproval(request: ApprovalRequest): Promise<ApprovalDecision> {
      console.log(`\n[HITL] Approval requested:`);
      console.log(`  Operation: ${request.operation}`);
      console.log(`  Risk: ${request.risk}`);
      console.log(`  Description: ${request.description}`);
      console.log(`  Agent: ${request.agentName}`);
      return 'approve';
    },
  };
}
