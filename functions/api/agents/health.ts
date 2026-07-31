/**
 * GET /api/agents/health
 *
 * Lists all registered encounter agents and which AI providers are available
 * based on configured env keys. Returns a structured health report that ops
 * dashboards or the frontend can consume to show agent availability.
 */

import { z } from 'zod';
import { authenticatedEndpoint, type AuthenticatedContext } from '../_shared/middleware';
import '@/lib/agents/registry.encounter';
import { listAgents } from '@/lib/agents/registry.encounter';
import { getAvailableProviders } from '@/lib/langchain/models';

export const onRequestGet = authenticatedEndpoint(
  z.object({}),
  async (context: AuthenticatedContext) => {
    const { env, auth } = context;
    const aiEnv = {
      GEMINI_API_KEY: env.GEMINI_API_KEY,
      OPENAI_API_KEY: env.OPENAI_API_KEY,
      ANTHROPIC_API_KEY: env.ANTHROPIC_API_KEY,
      DEEPSEEK_API_KEY: env.DEEPSEEK_API_KEY,
      DEEPINFRA_API_KEY: env.DEEPINFRA_API_KEY,
    };
    const availableProviders = getAvailableProviders(aiEnv);
    const agents = listAgents();
    const agentHealth = agents.map((agent) => {
      const tasksUsingAgent = Object.entries(TASK_MODEL_MAP)
        .filter(([, mapping]) => {
          const allModels = [mapping.primary, ...mapping.fallbacks];
          return allModels.some((m) => MODEL_REGISTRY[m]?.provider);
        })
        .map(([task]) => task);
      const canRun = availableProviders.length > 0;
      return {
        name: agent.name,
        tier: agent.tier,
        description: agent.description,
        available: canRun,
      };
    });
    return {
      data: {
        timestamp: new Date().toISOString(),
        providers: {
          gemini: !!aiEnv.GEMINI_API_KEY,
          openai: !!aiEnv.OPENAI_API_KEY,
          anthropic: !!aiEnv.ANTHROPIC_API_KEY,
          deepseek: !!aiEnv.DEEPSEEK_API_KEY,
          deepinfra: !!aiEnv.DEEPINFRA_API_KEY,
        },
        availableProviders,
        agents: agentHealth,
        totalAgents: agents.length,
        userId: auth.userId,
      },
    };
  },
);