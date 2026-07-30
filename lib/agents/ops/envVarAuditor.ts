/**
 * Env Var Auditor agent — dev/CI ops tier.
 *
 * Scans `functions/api/` for `env.VAR_NAME` references and compares them
 * against the `CloudflareEnv` interface in `functions/api/_shared/types.ts`.
 * Reports any env vars used in code but missing from the type declaration,
 * and any type-declared env vars that are never referenced.
 *
 * @module lib/agents/ops/envVarAuditor
 */

import { z } from 'zod';
import { readdir, readFile } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';
import { StateGraph, Annotation, START, END } from '@langchain/langgraph';
import type { AgentDefinition, AgentContext, InvokeResult } from '@/lib/agents/shared/types';
import { registerAgent } from '@/lib/agents/shared/runtime';

export const EnvVarAuditorInputSchema = z.object({
  rootDir: z.string().optional(),
  maxFiles: z.number().int().positive().max(10000).optional(),
});
export type EnvVarAuditorInput = z.infer<typeof EnvVarAuditorInputSchema>;

export interface EnvVarFinding {
  envVar: string;
  issue: 'used_but_undeclared' | 'declared_but_unused';
  usageLocations: string[];
  detail: string;
}

export const EnvVarAuditorOutputSchema = z.object({
  rootDir: z.string(),
  filesScanned: z.number().int().nonnegative(),
  declaredEnvVars: z.array(z.string()),
  usedEnvVars: z.array(z.string()),
  findings: z.array(z.object({
    envVar: z.string(),
    issue: z.enum(['used_but_undeclared', 'declared_but_unused']),
    usageLocations: z.array(z.string()),
    detail: z.string(),
  })),
  summary: z.object({
    totalFindings: z.number().int().nonnegative(),
    used_but_undeclared: z.number().int().nonnegative(),
    declared_but_unused: z.number().int().nonnegative(),
  }),
});
export type EnvVarAuditorOutput = z.infer<typeof EnvVarAuditorOutputSchema>;

const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'coverage', 'build', '.cache']);
const ENV_REF_PATTERN = /\benv\.([A-Z][A-Z0-9_]{2,60})\b/g;
const ENV_TYPE_PATTERN = /^\s*([A-Z][A-Z0-9_]{2,60})\??:\s*(?:string|number|boolean)/gm;

const EnvState = Annotation.Root({
  rootDir: Annotation<string>(),
  maxFiles: Annotation<number>(),
  filesScanned: Annotation<number>(),
  declaredEnvVars: Annotation<string[]>(),
  usedEnvVars: Annotation<string[]>(),
  findings: Annotation<EnvVarFinding[]>({ reducer: (_p, n) => n, default: () => [] }),
  summary: Annotation<EnvVarAuditorOutput['summary'] | null>(),
});
type EStateType = typeof EnvState.State;

async function walkApi(root: string, maxFiles: number): Promise<string[]> {
  const out: string[] = [];
  async function recurse(dir: string) {
    if (out.length >= maxFiles) return;
    let entries; try { entries = await readdir(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      if (out.length >= maxFiles) return;
      const full = join(dir, e.name);
      if (e.isDirectory()) { if (!SKIP_DIRS.has(e.name)) await recurse(full); }
      else if (e.name.endsWith('.ts')) out.push(full);
    }
  }
  await recurse(join(root, 'functions', 'api'));
  return out;
}

async function scanNode(state: EStateType): Promise<Partial<EStateType>> {
  const files = await walkApi(state.rootDir, state.maxFiles);
  const usedMap = new Map<string, string[]>();
  let declaredVars: string[] = [];

  for (const filePath of files) {
    let contents: string;
    try { contents = await readFile(filePath, 'utf8'); } catch { continue; }
    const relPath = relative(state.rootDir, filePath).split(sep).join('/');

    // Extract env type declarations from types.ts
    if (filePath.endsWith('types.ts')) {
      let m;
      const typePattern = new RegExp(ENV_TYPE_PATTERN);
      while ((m = typePattern.exec(contents)) !== null) {
        declaredVars.push(m[1]);
      }
    }

    // Extract env.VAR references
    let match;
    const refPattern = new RegExp(ENV_REF_PATTERN);
    while ((match = refPattern.exec(contents)) !== null) {
      const varName = match[1];
      if (!usedMap.has(varName)) usedMap.set(varName, []);
      usedMap.get(varName)!.push(relPath);
    }
  }

  declaredVars = [...new Set(declaredVars)];
  const usedVars = [...usedMap.keys()];
  return { filesScanned: files.length, declaredEnvVars: declaredVars, usedEnvVars: usedVars };
}

async function analyzeNode(state: EStateType): Promise<Partial<EStateType>> {
  const findings: EnvVarFinding[] = [];
  const declaredSet = new Set(state.declaredEnvVars);

  for (const usedVar of state.usedEnvVars) {
    if (!declaredSet.has(usedVar)) {
      findings.push({
        envVar: usedVar,
        issue: 'used_but_undeclared',
        usageLocations: [],
        detail: `env.${usedVar} is referenced in code but not declared in CloudflareEnv type. Add it to functions/api/_shared/types.ts to get type safety.`,
      });
    }
  }

  const usedSet = new Set(state.usedEnvVars);
  for (const declaredVar of state.declaredEnvVars) {
    if (!usedSet.has(declaredVar)) {
      findings.push({
        envVar: declaredVar,
        issue: 'declared_but_unused',
        usageLocations: [],
        detail: `${declaredVar} is declared in CloudflareEnv but not referenced anywhere in functions/api/. Consider removing it or documenting why it's retained.`,
      });
    }
  }

  return { findings };
}

async function summarize(state: EStateType): Promise<Partial<EStateType>> {
  return {
    summary: {
      totalFindings: state.findings.length,
      used_but_undeclared: state.findings.filter((f) => f.issue === 'used_but_undeclared').length,
      declared_but_unused: state.findings.filter((f) => f.issue === 'declared_but_unused').length,
    },
  };
}

const compiledEnvAuditor = new StateGraph(EnvState)
  .addNode('scan', scanNode)
  .addNode('analyze', analyzeNode)
  .addNode('summarize', summarize)
  .addEdge(START, 'scan')
  .addEdge('scan', 'analyze')
  .addEdge('analyze', 'summarize')
  .addEdge('summarize', END)
  .compile();

const envVarAuditorAgent: AgentDefinition<EnvVarAuditorInput, EnvVarAuditorOutput> = {
  name: 'env-var-auditor',
  description: 'Scans functions/api/ for env.VAR references and compares against the CloudflareEnv type declaration. Reports used-but-undeclared and declared-but-unused vars.',
  tier: 'ops',
  async invoke(input, _ctx): Promise<InvokeResult<EnvVarAuditorOutput>> {
    const start = Date.now();
    const parsed = EnvVarAuditorInputSchema.safeParse(input);
    if (!parsed.success) return { status: 'schema_invalid', output: null, error: { status: 'schema_invalid', message: parsed.error.issues.map((i) => i.message).join('; '), cause: 'env-var-auditor.input' }, agent: 'env-var-auditor', durationMs: Date.now() - start };
    try {
      const rootDir = parsed.data.rootDir ?? process.cwd();
      const maxFiles = parsed.data.maxFiles ?? 5000;
      const result = await compiledEnvAuditor.invoke({ rootDir, maxFiles, filesScanned: 0, declaredEnvVars: [], usedEnvVars: [], findings: [], summary: null });
      const output: EnvVarAuditorOutput = {
        rootDir,
        filesScanned: result.filesScanned ?? 0,
        declaredEnvVars: result.declaredEnvVars ?? [],
        usedEnvVars: result.usedEnvVars ?? [],
        findings: result.findings ?? [],
        summary: result.summary ?? { totalFindings: 0, used_but_undeclared: 0, declared_but_unused: 0 },
      };
      return { status: 'ok', output, error: null, agent: 'env-var-auditor', durationMs: Date.now() - start, telemetry: { filesScanned: output.filesScanned, findings: output.summary.totalFindings } };
    } catch (err) {
      return { status: 'internal_error', output: null, error: { status: 'internal_error', message: err instanceof Error ? err.message : String(err), cause: 'env-var-auditor.invoke' }, agent: 'env-var-auditor', durationMs: Date.now() - start };
    }
  },
};

registerAgent(envVarAuditorAgent);
export { envVarAuditorAgent };