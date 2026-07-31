/**
 * POST /api/cron/agent-health-check
 *
 * Automated agent health check cron job. Runs the infrastructure
 * and content quality agents on a schedule and logs results.
 * Designed to fire daily (or every 6h) via Cloudflare Cron Triggers.
 *
 * Runs three checks sequentially:
 *   1. Database integrity (orphans, FK gaps)
 *   2. FSRS calibration status (overdue, ease hell)
 *   3. Content health audit (below-threshold questions, flags)
 *
 * Auth: CRON_SECRET bearer token (via cronEndpoint).
 */

import { cronEndpoint, ok } from '../_shared/endpoint';
import {
  createEdgePrismaClient,
  safePrismaDisconnect,
} from '../_shared/prisma-edge';
import { ToolRegistry } from '../../../lib/services/agents';
import { runAgent } from '../../../lib/services/agents/agentRunner';
import type { AgentRunResult } from '../../../lib/services/agents/types';
import {
  INFRA_TOOLS,
  QUALITY_TOOLS,
} from '../../../lib/services/agents/tools';
import {
  collectAgentHealthSnapshot,
  buildAgentMetricsPayload,
  getQualityGates,
  getAlertRules,
} from '../../../lib/agents/monitoring';
import { configureBridge, pingOrchestrator } from '../../../lib/agents/bridge';

interface AgentCheckResult {
  check: string;
  status: 'ok' | 'warning' | 'error';
  finalText: string;
  tokensUsed: number;
  durationMs: number;
  error?: string;
}

export const onRequestPost = cronEndpoint({
  handler: async (context) => {
    const { env, waitUntil } = context;
    const prisma = createEdgePrismaClient(env.DATABASE_URL);
    const startedAt = Date.now();
    const results: AgentCheckResult[] = [];

    try {
      console.log('[agentHealthCheck] Starting automated agent health checks');

      // ─── Check 1: Database Integrity ────────────────────────────────────
      console.log('[agentHealthCheck] Check 1/3: Database integrity');
      try {
        const infraRegistry = new ToolRegistry(INFRA_TOOLS);
        const dbResult = await runAgent({
          userMessage: `Run a database integrity check on PANaCEa. Check for orphan records across all key relationships and report the overall database health status.`,
          registry: infraRegistry,
          config: {
            allowedTools: ['database_integrity_check'],
            allowedCategories: ['read'],
            maxIterations: 2,
            telemetryEndpoint: '/api/cron/agent-health-check',
          },
          toolContext: {
            prisma,
            userId: 'cron-agent-health',
            env: env as Record<string, unknown>,
            log: (level, msg) => console.log(`[agentHealthCheck:db] ${level}: ${msg}`),
          },
          geminiContext: {
            env: { GEMINI_API_KEY: env.GEMINI_API_KEY as string },
            auth: { userId: 'cron-agent-health' },
            waitUntil,
          },
        });
        results.push({
          check: 'database_integrity',
          status: dbResult.stopReason === 'completed' ? 'ok' : 'error',
          finalText: dbResult.finalText,
          tokensUsed: dbResult.tokensUsed.total,
          durationMs: dbResult.durationMs,
          error: dbResult.error?.message,
        });
      } catch (err) {
        results.push({
          check: 'database_integrity',
          status: 'error',
          finalText: '',
          tokensUsed: 0,
          durationMs: 0,
          error: err instanceof Error ? err.message : String(err),
        });
      }

      // ─── Check 2: FSRS Calibration ──────────────────────────────────────
      console.log('[agentHealthCheck] Check 2/3: FSRS calibration');
      try {
        const infraRegistry2 = new ToolRegistry(INFRA_TOOLS);
        const fsrsResult = await runAgent({
          userMessage: `Check FSRS scheduling health. Count active cards, overdue items, ease hell cases, difficulty distribution, and 7-day review backlog. Report status and issues.`,
          registry: infraRegistry2,
          config: {
            allowedTools: ['fsrs_calibration_status'],
            allowedCategories: ['read'],
            maxIterations: 2,
            telemetryEndpoint: '/api/cron/agent-health-check',
          },
          toolContext: {
            prisma,
            userId: 'cron-agent-health',
            env: env as Record<string, unknown>,
            log: (level, msg) => console.log(`[agentHealthCheck:fsrs] ${level}: ${msg}`),
          },
          geminiContext: {
            env: { GEMINI_API_KEY: env.GEMINI_API_KEY as string },
            auth: { userId: 'cron-agent-health' },
            waitUntil,
          },
        });
        results.push({
          check: 'fsrs_calibration',
          status: fsrsResult.stopReason === 'completed' ? 'ok' : 'error',
          finalText: fsrsResult.finalText,
          tokensUsed: fsrsResult.tokensUsed.total,
          durationMs: fsrsResult.durationMs,
          error: fsrsResult.error?.message,
        });
      } catch (err) {
        results.push({
          check: 'fsrs_calibration',
          status: 'error',
          finalText: '',
          tokensUsed: 0,
          durationMs: 0,
          error: err instanceof Error ? err.message : String(err),
        });
      }

      // ─── Check 3: Content Health ────────────────────────────────────────
      console.log('[agentHealthCheck] Check 3/3: Content health');
      try {
        const qualityRegistry = new ToolRegistry(QUALITY_TOOLS);
        const contentResult = await runAgent({
          userMessage: `Audit PANaCEa content health. Check for questions below health threshold (0.5), flagged items, and conditions needing medical review. Report the worst offenders by health score.`,
          registry: qualityRegistry,
          config: {
            allowedTools: ['content_health_audit'],
            allowedCategories: ['read'],
            maxIterations: 2,
            telemetryEndpoint: '/api/cron/agent-health-check',
          },
          toolContext: {
            prisma,
            userId: 'cron-agent-health',
            env: env as Record<string, unknown>,
            log: (level, msg) => console.log(`[agentHealthCheck:content] ${level}: ${msg}`),
          },
          geminiContext: {
            env: { GEMINI_API_KEY: env.GEMINI_API_KEY as string },
            auth: { userId: 'cron-agent-health' },
            waitUntil,
          },
        });
        results.push({
          check: 'content_health',
          status: contentResult.stopReason === 'completed' ? 'ok' : 'error',
          finalText: contentResult.finalText,
          tokensUsed: contentResult.tokensUsed.total,
          durationMs: contentResult.durationMs,
          error: contentResult.error?.message,
        });
      } catch (err) {
        results.push({
          check: 'content_health',
          status: 'error',
          finalText: '',
          tokensUsed: 0,
          durationMs: 0,
          error: err instanceof Error ? err.message : String(err),
        });
      }

      // ─── Check 4: Agent Bridge & LangSmith Health ──────────────────────
      console.log('[agentHealthCheck] Check 4/4: Agent bridge + LangSmith health');
      let bridgeSnapshot = null;
      let langsmithMetrics = null;
      try {
        // Configure bridge from env if orchestrator URL is set
        const orchestratorUrl = (env as Record<string, string>).AGENT_ORCHESTRATOR_URL;
        if (orchestratorUrl) {
          configureBridge({
            orchestratorBaseUrl: orchestratorUrl,
            enabled: true,
            timeoutMs: 5000,
          });
        }

        bridgeSnapshot = await collectAgentHealthSnapshot({
          env: env as Record<string, string> as any,
          userId: 'cron-agent-health',
          log: (level, msg) => console.log(`[agentHealthCheck:bridge] ${level}: ${msg}`),
        });

        langsmithMetrics = buildAgentMetricsPayload(bridgeSnapshot);

        console.log(
          `[agentHealthCheck:bridge] Edge: ${bridgeSnapshot.edge.agentCount} agents, ` +
          `Node: ${bridgeSnapshot.node.reachable ? `${bridgeSnapshot.node.agentCount} agents` : 'unreachable'}, ` +
          `Bridge: ${bridgeSnapshot.bridge.status}`
        );
      } catch (err) {
        console.warn('[agentHealthCheck:bridge] Bridge health check failed:', err instanceof Error ? err.message : String(err));
      }

      // ─── Summary ─────────────────────────────────────────────────────────
      const totalMs = Date.now() - startedAt;
      const okCount = results.filter((r) => r.status === 'ok').length;
      const warnCount = results.filter((r) => r.status === 'warning').length;
      const errCount = results.filter((r) => r.status === 'error').length;

      console.log(
        `[agentHealthCheck] Complete in ${totalMs}ms. ` +
        `${okCount} ok, ${warnCount} warnings, ${errCount} errors.`
      );

      // Log individual findings
      for (const r of results) {
        if (r.status !== 'ok') {
          console.warn(`[agentHealthCheck:${r.check}] ${r.status}: ${r.error ?? r.finalText.slice(0, 200)}`);
        }
      }

      return ok({
        checkedAt: new Date().toISOString(),
        totalDurationMs: totalMs,
        checksRun: results.length,
        ok: okCount,
        warnings: warnCount,
        errors: errCount,
        details: results,
        bridge: bridgeSnapshot ? {
          edgeAgentCount: bridgeSnapshot.edge.agentCount,
          nodeReachable: bridgeSnapshot.node.reachable,
          nodeAgentCount: bridgeSnapshot.node.agentCount,
          bridgeStatus: bridgeSnapshot.bridge.status,
        } : null,
        langsmithMetrics: langsmithMetrics ? {
          metricCount: langsmithMetrics.metrics.length,
          timestamp: langsmithMetrics.timestamp,
        } : null,
        qualityGates: getQualityGates().map((g) => ({
          metric: g.metric,
          threshold: g.threshold,
          severity: g.severity,
        })),
        alertRules: getAlertRules().filter((r) => r.enabled).map((r) => ({
          name: r.name,
          metric: r.metric,
          threshold: r.threshold,
        })),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('[agentHealthCheck] Fatal error:', message);
      return {
        status: 500,
        error: 'Agent health check failed',
        detail: message,
      };
    } finally {
      await safePrismaDisconnect(prisma);
    }
  },
});
