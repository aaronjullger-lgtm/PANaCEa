/**
 * GET /api/agents/health
 *
 * Enhanced agent health endpoint. Reports:
 * - Agent registry status (which agents are registered, by tier)
 * - MCP server connectivity (which MCP servers are configured)
 * - Model availability (which AI providers are configured)
 * - Capability summary (what agents can do)
 *
 * Used by ops dashboards and the agent orchestrator to show agent availability.
 *
 * @endpoint GET /api/agents/health
 */

import { z } from 'zod';
import { authenticatedEndpoint, type AuthenticatedContext } from '../_shared/middleware';
import '@/lib/agents/registry';
import { listAgents } from '@/lib/agents/shared/runtime';
import { getAvailableProviders } from '@/lib/langchain/models';
import { MODEL_REGISTRY, TASK_MODEL_MAP } from '@/lib/langchain/config';
import {
  registerAllCapabilities,
  listCapabilities,
  getCapabilitySummary,
} from '@/lib/agents/capabilities';
import {
  registerBuiltInMCPServers,
  listMCPServers,
  getMCPToolsByServer,
} from '@/lib/agents/mcp/bridge';

// Ensure capabilities and MCP servers are registered
registerAllCapabilities();
registerBuiltInMCPServers();

export const onRequestGet = authenticatedEndpoint(
  z.object({}),
  async (context: AuthenticatedContext) => {
    const { env } = context;
    const aiEnv = {
      GEMINI_API_KEY: env.GEMINI_API_KEY,
      OPENAI_API_KEY: env.OPENAI_API_KEY,
      ANTHROPIC_API_KEY: env.ANTHROPIC_API_KEY,
      DEEPSEEK_API_KEY: env.DEEPSEEK_API_KEY,
      DEEPINFRA_API_KEY: env.DEEPINFRA_API_KEY,
      OPENROUTER_API_KEY: env.OPENROUTER_API_KEY,
    };

    const availableProviders = getAvailableProviders(aiEnv);
    const agents = listAgents();
    const capabilities = listCapabilities();
    const capabilitySummary = getCapabilitySummary();
    const mcpServers = listMCPServers();
    const mcpToolsByServer = getMCPToolsByServer();

    // Agent health details
    const agentHealth = agents.map((agent) => {
      const capability = capabilities.find((c) => c.name === agent.name);
      const canRun = availableProviders.length > 0;

      return {
        name: agent.name,
        tier: agent.tier,
        description: agent.description,
        available: canRun,
        capabilities: capability?.capabilities ?? [],
        strategy: capability?.strategy ?? 'single-invoke',
        tools: capability?.tools ?? [],
        productionReady: capability?.productionReady ?? false,
      };
    });

    // MCP server health
    const mcpHealth = mcpServers.map((server) => {
      const tools = mcpToolsByServer[server.name] ?? [];
      return {
        name: server.name,
        transport: server.transport,
        status: 'configured' as const,
        toolCount: tools.length,
        toolNames: tools.map((t) => t.name),
        required: server.required,
      };
    });

    // Model availability
    const modelHealth = Object.entries(MODEL_REGISTRY).map(([name, config]) => ({
      name,
      provider: config.provider,
      available: availableProviders.includes(config.provider),
    }));

    // Task-to-model mapping health
    const taskHealth = Object.entries(TASK_MODEL_MAP).map(([task, mapping]) => ({
      task,
      primaryModel: mapping.primary,
      fallbackModels: mapping.fallbacks,
      primaryAvailable: availableProviders.includes(
        MODEL_REGISTRY[mapping.primary]?.provider ?? '',
      ),
    }));

    // Determine overall status
    const hasAvailableProvider = availableProviders.length > 0;
    const hasRegisteredAgents = agents.length > 0;
    const overallStatus: 'healthy' | 'degraded' | 'unhealthy' =
      hasAvailableProvider && hasRegisteredAgents
        ? 'healthy'
        : hasRegisteredAgents
          ? 'degraded'
          : 'unhealthy';

    return {
      data: {
        status: overallStatus,
        timestamp: new Date().toISOString(),
        summary: {
          totalAgents: agents.length,
          productionReady: capabilitySummary.productionReady,
          byTier: capabilitySummary.byTier,
          byCapability: capabilitySummary.byCapability,
          byStrategy: capabilitySummary.byStrategy,
          totalTools: capabilitySummary.totalTools,
        },
        providers: {
          gemini: !!aiEnv.GEMINI_API_KEY,
          openai: !!aiEnv.OPENAI_API_KEY,
          anthropic: !!aiEnv.ANTHROPIC_API_KEY,
          deepseek: !!aiEnv.DEEPSEEK_API_KEY,
          deepinfra: !!aiEnv.DEEPINFRA_API_KEY,
          openrouter: !!aiEnv.OPENROUTER_API_KEY,
        },
        availableProviders,
        agents: agentHealth,
        mcp: {
          servers: mcpHealth,
          totalServers: mcpServers.length,
          totalTools: Object.values(mcpToolsByServer).reduce(
            (sum, tools) => sum + tools.length,
            0,
          ),
        },
        models: modelHealth,
        tasks: taskHealth,
      },
    };
  },
);
