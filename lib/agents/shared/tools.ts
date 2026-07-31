import { z } from 'zod';
import type { AIEnvKeys } from '@/lib/langchain/models';

export interface AgentToolContext {
  env: AIEnvKeys;
  userId?: string;
}

export interface AgentTool<I, O> {
  name: string;
  description: string;
  inputSchema: z.ZodType<I>;
  execute(input: I, ctx: AgentToolContext): Promise<O>;
}

export function defineTool<I, O>(
  config: AgentTool<I, O>,
): AgentTool<I, O> {
  return config;
}

export const clinicalLibraryLookup = defineTool({
  name: 'clinical-library-lookup',
  description: 'Search the PANaCEa clinical reference library for a condition or drug',
  inputSchema: z.object({
    query: z.string().min(1).max(200),
    type: z.enum(['condition', 'drug', 'guideline']).default('condition'),
  }),
  async execute(input, _ctx) {
    return { query: input.query, type: input.type, results: [] as unknown[] };
  },
});

export const drugInteractionCheck = defineTool({
  name: 'drug-interaction-check',
  description: 'Check for drug-drug interactions between a list of medications',
  inputSchema: z.object({
    medications: z.array(z.string()).min(1).max(20),
  }),
  async execute(input, _ctx) {
    return { medications: input.medications, interactions: [] as unknown[] };
  },
});

export const blueprintCoverageCheck = defineTool({
  name: 'blueprint-coverage-check',
  description: 'Check NCCPA blueprint coverage for a given organ system and task category',
  inputSchema: z.object({
    system: z.string().min(1),
    taskCategory: z.string().optional(),
  }),
  async execute(input, _ctx) {
    return { system: input.system, coveragePercent: 0, gaps: [] as string[] };
  },
});

export const AGENT_TOOLS: Record<string, AgentTool<unknown, unknown>> = {
  'clinical-library-lookup': clinicalLibraryLookup as AgentTool<unknown, unknown>,
  'drug-interaction-check': drugInteractionCheck as AgentTool<unknown, unknown>,
  'blueprint-coverage-check': blueprintCoverageCheck as AgentTool<unknown, unknown>,
};

export async function invokeTool(
  toolName: string,
  input: unknown,
  ctx: AgentToolContext,
): Promise<{ ok: true; output: unknown } | { ok: false; error: string }> {
  const tool = AGENT_TOOLS[toolName];
  if (!tool) return { ok: false, error: `Unknown tool: ${toolName}` };
  try {
    const parsed = tool.inputSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues.map((i) => i.message).join('; ') };
    }
    const output = await tool.execute(parsed.data, ctx);
    return { ok: true, output };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}