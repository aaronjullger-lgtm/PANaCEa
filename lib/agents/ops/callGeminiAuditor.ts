/**
 * CallGemini Migration Auditor agent — dev/CI ops tier.
 *
 * Scans the codebase for `callGemini` / `callAIMultiProvider` references,
 * classifies each call site into one of three migration stages, and emits a
 * structured migration report that a downstream step (CI gate, dashboard, or
 * OpCode subagent) can consume. This agent does NOT modify files — it only
 * reports.
 *
 * Multi-node LangGraph:
 *   scan → classify → summarize → END
 *
 * The scan node walks the filesystem via Node's `fs/promises`. Callers MUST
 * pass `rootDir` explicitly (the audit script does this via `process.cwd()`).
 *
 * @module lib/agents/ops/callGeminiAuditor
 */

import { z } from 'zod';
import { readdir, readFile } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';
import {
  StateGraph,
  Annotation,
  START,
  END,
} from '@langchain/langgraph';

import type {
  AgentDefinition,
  AgentContext,
  InvokeResult,
} from '@/lib/agents/shared/types';
import { registerAgent } from '@/lib/agents/shared/runtime';

// ─── Public I/O ───────────────────────────────────────────────────────────

export const CallGeminiAuditorInputSchema = z.object({
  /** Repo root to scan. Defaults to the directory two levels above this file. */
  rootDir: z.string().optional(),
  /** Glob-style include list (file ext only). Default: ['.ts', '.tsx']. */
  extensions: z.array(z.string()).optional(),
  /** Maximum files to scan before bailing. Default: 5000. */
  maxFiles: z.number().int().positive().max(20000).optional(),
  /** Skip these top-level directories. Default: ['node_modules','dist','.git','coverage','build']. */
  skipDirs: z.array(z.string()).optional(),
});
export type CallGeminiAuditorInput = z.infer<typeof CallGeminiAuditorInputSchema>;

export type MigrationStage = 'direct_callGemini' | 'callAIMultiProvider' | 'gateway_migrated' | 'unclear';

export interface CallSiteFinding {
  file: string;
  line: number;
  callee: 'callGemini' | 'callAIMultiProvider' | 'streamGemini';
  stage: MigrationStage;
  snippet: string;
}

export const CallGeminiAuditorOutputSchema = z.object({
  rootDir: z.string(),
  totalFilesScanned: z.number().int().nonnegative(),
  callSites: z.array(
    z.object({
      file: z.string(),
      line: z.number().int().positive(),
      callee: z.enum(['callGemini', 'callAIMultiProvider', 'streamGemini']),
      stage: z.enum(['direct_callGemini', 'callAIMultiProvider', 'gateway_migrated', 'unclear']),
      snippet: z.string(),
    }),
  ),
  summary: z.object({
    totalCallSites: z.number().int().nonnegative(),
    direct_callGemini: z.number().int().nonnegative(),
    callAIMultiProvider: z.number().int().nonnegative(),
    streamGemini: z.number().int().nonnegative(),
    gateway_migrated: z.number().int().nonnegative(),
  }),
});
export type CallGeminiAuditorOutput = z.infer<typeof CallGeminiAuditorOutputSchema>;

// ─── Graph State ──────────────────────────────────────────────────────────

const AuditorState = Annotation.Root({
  rootDir: Annotation<string>,
  extensions: Annotation<string[]>,
  skipDirs: Annotation<string[]>,
  maxFiles: Annotation<number>,
  paths: Annotation<string[]>({
    reducer: (_prev, next) => next,
    default: () => [],
  }),
  filesScanned: Annotation<number>,
  callSites: Annotation<CallSiteFinding[]>({
    reducer: (_prev, next) => next,
    default: () => [],
  }),
  summary: Annotation<CallGeminiAuditorOutput['summary'] | null>,
  scanError: Annotation<string | null>,
});
type AuditorStateType = typeof AuditorState.State;

// ─── helpers ──────────────────────────────────────────────────────────────

const DEFAULT_SKIP_DIRS = ['node_modules', 'dist', '.git', 'coverage', 'build', '.cache'];
const DEFAULT_EXTENSIONS = ['.ts', '.tsx'];
const DEFAULT_MAX_FILES = 5000;

async function walkRepository(
  root: string,
  extensions: string[],
  skipDirs: string[],
  maxFiles: number,
): Promise<string[]> {
  const out: string[] = [];
  const skip = new Set(skipDirs);

  async function recurse(dir: string): Promise<void> {
    if (out.length >= maxFiles) return;
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (out.length >= maxFiles) return;
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (skip.has(entry.name)) continue;
        await recurse(full);
      } else if (extensions.some((ext) => entry.name.endsWith(ext))) {
        out.push(full);
      }
    }
  }

  await recurse(root);
  return out;
}

function classifyCallee(line: string): 'callGemini' | 'callAIMultiProvider' | 'streamGemini' | null {
  // Skip imports, comments, and JSDoc — they reference the symbol name but
  // are not actual call sites. Without this guard the metric double-counts
  // every import line and every doc comment that mentions the function.
  const trimmed = line.trim();
  if (trimmed.startsWith('import ') || trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) {
    return null;
  }
  if (line.includes('callAIMultiProvider')) return 'callAIMultiProvider';
  if (line.includes('streamGemini')) return 'streamGemini';
  if (/\bcallGemini\b/.test(line)) return 'callGemini';
  return null;
}

function classifyStage(
  callee: 'callGemini' | 'callAIMultiProvider' | 'streamGemini',
  importLine: string | null,
): MigrationStage {
  // callGemini is by definition the direct-gemini-call (the @deprecated path).
  if (callee === 'callGemini') return 'direct_callGemini';
  if (callee === 'callAIMultiProvider') {
    // If the file also imports gateway helpers, the file has been wired to the
    // gateway; callAIMultiProvider may still appear as a fallback path.
    if (importLine && (importLine.includes('aiGateway') || importLine.includes('gateway.generate') || importLine.includes('gateway.tutor'))) {
      return 'gateway_migrated';
    }
    return 'callAIMultiProvider';
  }
  if (callee === 'streamGemini') return 'gateway_migrated';
  return 'unclear';
}

async function scanFileForCallSites(
  filePath: string,
  rootDir: string,
): Promise<CallSiteFinding[]> {
  let contents: string;
  try {
    contents = await readFile(filePath, 'utf8');
  } catch {
    return [];
  }
  const lines = contents.split(/\r?\n/);
  const importLine = lines.find((l) => l.includes('import') && (l.includes('aiGateway') || l.includes('gateway'))) ?? null;
  const findings: CallSiteFinding[] = [];
  lines.forEach((line, idx) => {
    const callee = classifyCallee(line);
    if (!callee) return;
    const stage = classifyStage(callee, importLine);
    findings.push({
      file: relative(rootDir, filePath).split(sep).join('/'),
      line: idx + 1,
      callee,
      stage,
      snippet: line.trim().slice(0, 200),
    });
  });
  return findings;
}

// ─── Graph nodes ──────────────────────────────────────────────────────────

async function scanNode(state: AuditorStateType): Promise<Partial<AuditorStateType>> {
  try {
    const paths = await walkRepository(
      state.rootDir,
      state.extensions,
      state.skipDirs,
      state.maxFiles,
    );
    return { paths, scanError: null };
  } catch (err) {
    return {
      paths: [],
      scanError: err instanceof Error ? err.message : String(err),
    };
  }
}

async function classifyNode(state: AuditorStateType): Promise<Partial<AuditorStateType>> {
  let filesScanned = 0;
  const allFindings: CallSiteFinding[] = [];
  for (const path of state.paths) {
    filesScanned += 1;
    const findings = await scanFileForCallSites(path, state.rootDir);
    if (findings.length) allFindings.push(...findings);
  }
  return { filesScanned, callSites: allFindings };
}

async function summarizeNode(state: AuditorStateType): Promise<Partial<AuditorStateType>> {
  const summary = {
    totalCallSites: state.callSites.length,
    direct_callGemini: state.callSites.filter((c) => c.stage === 'direct_callGemini').length,
    callAIMultiProvider: state.callSites.filter((c) => c.stage === 'callAIMultiProvider').length,
    streamGemini: state.callSites.filter((c) => c.callee === 'streamGemini').length,
    gateway_migrated: state.callSites.filter((c) => c.stage === 'gateway_migrated').length,
  };
  return { summary };
}

// ─── Graph ────────────────────────────────────────────────────────────────

const auditorGraph = new StateGraph(AuditorState)
  .addNode('scan', scanNode)
  .addNode('classify', classifyNode)
  .addNode('summarize', summarizeNode)
  .addEdge(START, 'scan')
  .addEdge('scan', 'classify')
  .addEdge('classify', 'summarize')
  .addEdge('summarize', END);

const compiledAuditor = auditorGraph.compile();

// ─── Agent Definition ────────────────────────────────────────────────────

const callGeminiAuditorAgent: AgentDefinition<CallGeminiAuditorInput, CallGeminiAuditorOutput> = {
  name: 'callgemini-auditor',
  description:
    'Scans the PANaCEa codebase for callGemini / callAIMultiProvider / streamGemini references and emits a structured migration-stage report.',
  tier: 'ops',
  inputSchema: CallGeminiAuditorInputSchema,
  outputSchema: CallGeminiAuditorOutputSchema,
  async invoke(input, ctx: AgentContext): Promise<InvokeResult<CallGeminiAuditorOutput>> {
    const start = Date.now();
    const parsed = CallGeminiAuditorInputSchema.safeParse(input);
    if (!parsed.success) {
      return {
        status: 'schema_invalid',
        output: null,
        error: {
          status: 'schema_invalid',
          message: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
          cause: 'callgemini-auditor.input',
        },
        agent: 'callgemini-auditor',
        durationMs: Date.now() - start,
      };
    }

    try {
      const rootDir = parsed.data.rootDir ?? process.cwd();
      const extensions = parsed.data.extensions ?? DEFAULT_EXTENSIONS;
      const skipDirs = parsed.data.skipDirs ?? DEFAULT_SKIP_DIRS;
      const maxFiles = parsed.data.maxFiles ?? DEFAULT_MAX_FILES;

      const result = await compiledAuditor.invoke({
        rootDir,
        extensions,
        skipDirs,
        maxFiles,
        filesScanned: 0,
        callSites: [],
        summary: null,
        scanError: null,
      });

      if (result.scanError) {
        return {
          status: 'internal_error',
          output: null,
          error: { status: 'internal_error', message: result.scanError, cause: 'callgemini-auditor.scan' },
          agent: 'callgemini-auditor',
          durationMs: Date.now() - start,
        };
      }

      const output: CallGeminiAuditorOutput = {
        rootDir,
        totalFilesScanned: result.filesScanned ?? 0,
        callSites: result.callSites ?? [],
        summary: result.summary ?? {
          totalCallSites: 0,
          direct_callGemini: 0,
          callAIMultiProvider: 0,
          streamGemini: 0,
          gateway_migrated: 0,
        },
      };

      const validated = CallGeminiAuditorOutputSchema.safeParse(output);
      if (!validated.success) {
        return {
          status: 'schema_invalid',
          output: null,
          error: {
            status: 'schema_invalid',
            message: validated.error.issues.map((i) => i.message).join('; '),
            cause: 'callgemini-auditor.output',
          },
          agent: 'callgemini-auditor',
          durationMs: Date.now() - start,
        };
      }

      return {
        status: 'ok',
        output: validated.data,
        error: null,
        agent: 'callgemini-auditor',
        durationMs: Date.now() - start,
        telemetry: {
          filesScanned: validated.data.totalFilesScanned,
          callSitesFound: validated.data.summary.totalCallSites,
        },
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        status: 'internal_error',
        output: null,
        error: { status: 'internal_error', message, cause: 'callgemini-auditor.invoke' },
        agent: 'callgemini-auditor',
        durationMs: Date.now() - start,
      };
    }
  },
};

registerAgent(callGeminiAuditorAgent);

export { callGeminiAuditorAgent };