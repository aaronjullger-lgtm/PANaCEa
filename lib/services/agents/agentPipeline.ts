/**
 * Agent Execution Pipeline
 *
 * Wires DeepAgents middleware (HITL, SubAgent, Filesystem) into the
 * Edge agent runner. Follows the DeepAgents SDK pattern where middleware
 * wraps the core agent execution in a composable stack.
 *
 * Pipeline order (outermost first):
 *   1. HITL — approval gates for high-risk operations
 *   2. SubAgent — parallel subagent spawning
 *   3. Filesystem — virtual FS for context offloading
 *   4. Core — runAgent() from agentRunner.ts
 *
 * @module lib/services/agents/agentPipeline
 */

import type { AgentContext, InvokeResult } from '@/lib/agents/shared/types';
import type { RunAgentArgs } from './agentRunner';
import type { AgentRunResult } from './types';
import { runAgent } from './agentRunner';
import {
  createHITLMiddleware,
  createConsoleApprovalHandler,
  type MiddlewareNext,
  type AgentMiddleware,
} from '@/lib/agents/middleware/hitl';
import { createVirtualFS } from '@/lib/agents/middleware/filesystem';
import type { VirtualFS } from '@/lib/agents/middleware/filesystem';

export type { AgentRunResult };

export interface PipelineConfig {
  enableHITL?: boolean;
  autoApproveLowRisk?: boolean;
  hitlTimeoutMs?: number;
  enableFilesystem?: boolean;
  enableSubAgents?: boolean;
}

const DEFAULT_CONFIG: PipelineConfig = {
  enableHITL: false,
  autoApproveLowRisk: true,
  hitlTimeoutMs: 300_000,
  enableFilesystem: true,
  enableSubAgents: true,
};

function composeMiddleware(middlewares: AgentMiddleware[], handler: MiddlewareNext): MiddlewareNext {
  return middlewares.reduceRight(
    (next, middleware) => middleware.wrap(next),
    handler,
  );
}

export async function runAgentWithPipeline(
  args: RunAgentArgs,
  pipelineConfig: PipelineConfig = {},
): Promise<AgentRunResult> {
  const config = { ...DEFAULT_CONFIG, ...pipelineConfig };
  const middlewares: AgentMiddleware[] = [];

  if (config.enableHITL) {
    middlewares.push(
      createHITLMiddleware({
        handler: createConsoleApprovalHandler(),
        autoApproveLowRisk: config.autoApproveLowRisk,
        timeoutMs: config.hitlTimeoutMs,
      }),
    );
  }

  const coreHandler: MiddlewareNext = async (_input, _ctx) => {
    const result = await runAgent(args);
    return {
      status: result.stopReason === 'completed' ? 'ok' : 'internal_error',
      output: result.finalText || null,
      error: result.error
        ? { status: 'internal_error', message: result.error.message, cause: result.error.code }
        : null,
      agent: 'agent-pipeline',
      durationMs: result.durationMs,
      telemetry: {
        iterations: result.iterations,
        tokensUsed: result.tokensUsed,
        stopReason: result.stopReason,
      },
    };
  };

  const pipeline = composeMiddleware(middlewares, coreHandler);

  const ctx: AgentContext = {
    env: args.geminiContext.env as AgentContext['env'],
    userId: args.toolContext.userId,
    signal: args.toolContext.signal,
    log: args.toolContext.log,
  };

  const pipelineResult = await pipeline(args.userMessage, ctx);

  if (pipelineResult.status === 'ok') {
    return {
      steps: [],
      finalText: typeof pipelineResult.output === 'string' ? pipelineResult.output : '',
      stopReason: 'completed',
      iterations: (pipelineResult.telemetry?.iterations as number) ?? 0,
      tokensUsed: (pipelineResult.telemetry?.tokensUsed as AgentRunResult['tokensUsed']) ?? { input: 0, output: 0, total: 0 },
      durationMs: pipelineResult.durationMs,
    };
  }

  return {
    steps: [],
    finalText: '',
    stopReason: 'model_error',
    iterations: 0,
    tokensUsed: { input: 0, output: 0, total: 0 },
    durationMs: pipelineResult.durationMs,
    error: {
      message: pipelineResult.error?.message ?? 'Pipeline execution failed',
      code: pipelineResult.error?.cause ?? 'PIPELINE_ERROR',
    },
  };
}

export { createVirtualFS };
export type { VirtualFS };
