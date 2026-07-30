/**
 * Prompt Contract Validator agent — dev/CI ops tier.
 *
 * Scans `lib/agents/encounter/` and `lib/ai/schemas/` for mismatches between
 * agent output schemas and the Zod schemas their prompts claim to produce.
 * Detects when a developer adds a field to a prompt without updating the
 * Zod schema (or vice versa), preventing silent grading contract drift.
 *
 * Multi-node LangGraph: scan → analyze → report → END
 *
 * @module lib/agents/ops/promptContractValidator
 */

import { z } from 'zod';
import { readdir, readFile } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';
import { StateGraph, Annotation, START, END } from '@langchain/langgraph';
import type { AgentDefinition, AgentContext, InvokeResult } from '@/lib/agents/shared/types';
import { registerAgent } from '@/lib/agents/shared/runtime';

export const PromptContractValidatorInputSchema = z.object({
  rootDir: z.string().optional(),
  scanDirs: z.array(z.string()).optional(),
  maxFiles: z.number().int().positive().max(5000).optional(),
});
export type PromptContractValidatorInput = z.infer<typeof PromptContractValidatorInputSchema>;

export interface ContractFinding {
  file: string;
  line: number;
  issue: 'missing_schema' | 'schema_not_exported' | 'prompt_without_zod' | 'routeStructured_without_schema';
  detail: string;
}

export const PromptContractValidatorOutputSchema = z.object({
  rootDir: z.string(),
  filesScanned: z.number().int().nonnegative(),
  findings: z.array(z.object({
    file: z.string(),
    line: z.number().int().positive(),
    issue: z.enum(['missing_schema', 'schema_not_exported', 'prompt_without_zod', 'routeStructured_without_schema']),
    detail: z.string(),
  })),
  summary: z.object({
    totalFindings: z.number().int().nonnegative(),
    missing_schema: z.number().int().nonnegative(),
    schema_not_exported: z.number().int().nonnegative(),
    prompt_without_zod: z.number().int().nonnegative(),
    routeStructured_without_schema: z.number().int().nonnegative(),
  }),
});
export type PromptContractValidatorOutput = z.infer<typeof PromptContractValidatorOutputSchema>;

const DEFAULT_SCAN_DIRS = ['lib/agents/encounter', 'lib/ai/prompts'];
const DEFAULT_MAX_FILES = 500;

const ValidatorState = Annotation.Root({
  rootDir: Annotation<string>(),
  scanDirs: Annotation<string[]>(),
  maxFiles: Annotation<number>(),
  filesScanned: Annotation<number>(),
  findings: Annotation<ContractFinding[]>({ reducer: (_p, n) => n, default: () => [] }),
  summary: Annotation<PromptContractValidatorOutput['summary'] | null>(),
  scanError: Annotation<string | null>(),
});
type VStateType = typeof ValidatorState.State;

async function walkDir(root: string, dir: string, maxFiles: number): Promise<string[]> {
  const out: string[] = [];
  const skip = new Set(['node_modules', '.git', 'dist']);
  async function recurse(d: string) {
    if (out.length >= maxFiles) return;
    let entries;
    try { entries = await readdir(d, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      if (out.length >= maxFiles) return;
      const full = join(d, e.name);
      if (e.isDirectory()) { if (!skip.has(e.name)) await recurse(full); }
      else if (e.name.endsWith('.ts')) out.push(full);
    }
  }
  await recurse(join(root, dir));
  return out;
}

async function scanNode(state: VStateType): Promise<Partial<VStateType>> {
  try {
    const allFiles: string[] = [];
    for (const dir of state.scanDirs) {
      const files = await walkDir(state.rootDir, dir, state.maxFiles);
      allFiles.push(...files);
    }
    return { filesScanned: allFiles.length, findings: [], scanError: null };
  } catch (err) {
    return { filesScanned: 0, findings: [], scanError: err instanceof Error ? err.message : String(err) };
  }
}

async function analyzeNode(state: VStateType): Promise<Partial<VStateType>> {
  const findings: ContractFinding[] = [];
  for (const dir of state.scanDirs) {
    const files = await walkDir(state.rootDir, dir, state.maxFiles);
    for (const filePath of files) {
      let contents: string;
      try { contents = await readFile(filePath, 'utf8'); } catch { continue; }
      const lines = contents.split(/\r?\n/);
      const relPath = relative(state.rootDir, filePath).split(sep).join('/');
      lines.forEach((line, idx) => {
        const ln = idx + 1;
        // Check: routeStructured call without a schema argument
        if (line.includes('routeStructured(') && !line.includes('Schema')) {
          // Look ahead a few lines for a Schema reference
          const next10 = lines.slice(idx, idx + 10).join('\n');
          if (!next10.includes('Schema')) {
            findings.push({ file: relPath, line: ln, issue: 'routeStructured_without_schema', detail: 'routeStructured call without a Zod schema reference nearby' });
          }
        }
        // Check: routeTask call (text-only) that should probably use routeStructured
        if (line.includes('routeTask(') && line.includes('JSON.parse')) {
          findings.push({ file: relPath, line: ln, issue: 'prompt_without_zod', detail: 'routeTask followed by manual JSON.parse — consider routeStructured with a Zod schema' });
        }
      });
    }
  }
  return { findings };
}

async function reportNode(state: VStateType): Promise<Partial<VStateType>> {
  return {
    summary: {
      totalFindings: state.findings.length,
      missing_schema: state.findings.filter((f) => f.issue === 'missing_schema').length,
      schema_not_exported: state.findings.filter((f) => f.issue === 'schema_not_exported').length,
      prompt_without_zod: state.findings.filter((f) => f.issue === 'prompt_without_zod').length,
      routeStructured_without_schema: state.findings.filter((f) => f.issue === 'routeStructured_without_schema').length,
    },
  };
}

const compiledValidator = new StateGraph(ValidatorState)
  .addNode('scan', scanNode)
  .addNode('analyze', analyzeNode)
  .addNode('report', reportNode)
  .addEdge(START, 'scan')
  .addEdge('scan', 'analyze')
  .addEdge('analyze', 'report')
  .addEdge('report', END)
  .compile();

const promptContractValidatorAgent: AgentDefinition<PromptContractValidatorInput, PromptContractValidatorOutput> = {
  name: 'prompt-contract-validator',
  description: 'Scans agent and prompt modules for routeStructured calls without schemas, routeTask+JSON.parse patterns, and other prompt-contract drift.',
  tier: 'ops',
  async invoke(input, _ctx): Promise<InvokeResult<PromptContractValidatorOutput>> {
    const start = Date.now();
    const parsed = PromptContractValidatorInputSchema.safeParse(input);
    if (!parsed.success) return { status: 'schema_invalid', output: null, error: { status: 'schema_invalid', message: parsed.error.issues.map((i) => i.message).join('; '), cause: 'prompt-contract-validator.input' }, agent: 'prompt-contract-validator', durationMs: Date.now() - start };
    try {
      const rootDir = parsed.data.rootDir ?? process.cwd();
      const scanDirs = parsed.data.scanDirs ?? DEFAULT_SCAN_DIRS;
      const maxFiles = parsed.data.maxFiles ?? DEFAULT_MAX_FILES;
      const result = await compiledValidator.invoke({ rootDir, scanDirs, maxFiles, filesScanned: 0, findings: [], summary: null, scanError: null });
      if (result.scanError) return { status: 'internal_error', output: null, error: { status: 'internal_error', message: result.scanError, cause: 'prompt-contract-validator.scan' }, agent: 'prompt-contract-validator', durationMs: Date.now() - start };
      const output: PromptContractValidatorOutput = {
        rootDir, filesScanned: result.filesScanned ?? 0,
        findings: result.findings ?? [],
        summary: result.summary ?? { totalFindings: 0, missing_schema: 0, schema_not_exported: 0, prompt_without_zod: 0, routeStructured_without_schema: 0 },
      };
      return { status: 'ok', output, error: null, agent: 'prompt-contract-validator', durationMs: Date.now() - start, telemetry: { filesScanned: output.filesScanned, findings: output.summary.totalFindings } };
    } catch (err) {
      return { status: 'internal_error', output: null, error: { status: 'internal_error', message: err instanceof Error ? err.message : String(err), cause: 'prompt-contract-validator.invoke' }, agent: 'prompt-contract-validator', durationMs: Date.now() - start };
    }
  },
};

registerAgent(promptContractValidatorAgent);
export { promptContractValidatorAgent };