import { buildAgent, type CompiledAgent } from '../orchestrator/factory.js';
import { resolvePrompt } from '../clients/prompts.js';
import { rememberDecisionTool, recallMemoryTool, createLinearIssueTool, searchLinearIssuesTool, triggerN8nWorkflowTool, listSentryIssuesTool } from '../tools/index.js';
import type { StructuredToolInterface } from '@langchain/core/tools';

export type SpecialistRole =
  | 'architecture-planner' | 'security-auditor' | 'accessibility-auditor'
  | 'performance-optimizer' | 'migration-reviewer'
  | 'clinical-validator' | 'question-scorer' | 'content-gap-analyzer' | 'osce-case-builder'
  | 'deploy-readiness' | 'cost-optimizer' | 'postmortem-writer';

interface SpecialistDef {
  role: SpecialistRole;
  promptName: string;
  name: string;
  description: string;
  inputHint: string;
  traceName: string;
  tags: string[];
  recursionLimit: number;
  tools: StructuredToolInterface[];
}

const memoryTools = [rememberDecisionTool, recallMemoryTool];
const linearTools = [createLinearIssueTool, searchLinearIssuesTool];
const sentryTools = [listSentryIssuesTool];

const DEFS: Record<SpecialistRole, SpecialistDef> = {
  'architecture-planner': {
    role: 'architecture-planner', promptName: 'panacea-architecture-planner',
    name: 'Architecture Planner', description: 'Breaks features into ordered implementation steps with file-level specificity.',
    inputHint: 'Feature request description.', traceName: 'panacea:architecture-planner',
    tags: ['panacea', 'planning'], recursionLimit: 15, tools: [...memoryTools],
  },
  'security-auditor': {
    role: 'security-auditor', promptName: 'panacea-security-auditor',
    name: 'Security Auditor', description: 'Audits for auth bypass, RLS gaps, secret leaks, injection, CORS, IDOR.',
    inputHint: 'Diff to audit, or "full scan" for codebase-wide.', traceName: 'panacea:security-auditor',
    tags: ['panacea', 'security'], recursionLimit: 15, tools: [...memoryTools, ...linearTools],
  },
  'accessibility-auditor': {
    role: 'accessibility-auditor', promptName: 'panacea-accessibility-auditor',
    name: 'Accessibility Auditor', description: 'WCAG 2.1 AA compliance checks on React components.',
    inputHint: 'Component path or "scan all" for codebase-wide.', traceName: 'panacea:a11y-auditor',
    tags: ['panacea', 'a11y'], recursionLimit: 12, tools: [...memoryTools, ...linearTools],
  },
  'performance-optimizer': {
    role: 'performance-optimizer', promptName: 'panacea-performance-optimizer',
    name: 'Performance Optimizer', description: 'Identifies bundle bloat, N+1 queries, cold starts, re-render storms.',
    inputHint: 'Module path or "full scan".', traceName: 'panacea:perf-optimizer',
    tags: ['panacea', 'performance'], recursionLimit: 15, tools: [...memoryTools, ...linearTools],
  },
  'migration-reviewer': {
    role: 'migration-reviewer', promptName: 'panacea-migration-reviewer',
    name: 'Migration Reviewer', description: 'Reviews Prisma schema changes for data-loss risk and rollback safety.',
    inputHint: 'Migration file path or diff.', traceName: 'panacea:migration-reviewer',
    tags: ['panacea', 'migration', 'safety'], recursionLimit: 8, tools: [...memoryTools],
  },
  'clinical-validator': {
    role: 'clinical-validator', promptName: 'panacea-clinical-validator',
    name: 'Clinical Validator', description: 'Validates medical content against cited sources. Flags unverified/incorrect claims.',
    inputHint: 'Content text + source citation.', traceName: 'panacea:clinical-validator',
    tags: ['panacea', 'clinical', 'safety'], recursionLimit: 10, tools: [...memoryTools, ...linearTools],
  },
  'question-scorer': {
    role: 'question-scorer', promptName: 'panacea-question-scorer',
    name: 'Question Scorer', description: 'Scores PANCE questions on blueprint alignment, Bloom\'s, distractor quality, bias.',
    inputHint: 'Question JSON (stem, options, answer, explanation).', traceName: 'panacea:question-scorer',
    tags: ['panacea', 'content', 'quality'], recursionLimit: 10, tools: [...memoryTools],
  },
  'content-gap-analyzer': {
    role: 'content-gap-analyzer', promptName: 'panacea-content-gap-analyzer',
    name: 'Content Gap Analyzer', description: 'Compares content DB against NCCPA blueprint for missing conditions/fields.',
    inputHint: 'Blueprint section or "full analysis".', traceName: 'panacea:content-gap',
    tags: ['panacea', 'content', 'blueprint'], recursionLimit: 12, tools: [...memoryTools, ...linearTools],
  },
  'osce-case-builder': {
    role: 'osce-case-builder', promptName: 'panacea-osce-case-builder',
    name: 'OSCE Case Builder', description: 'Generates structured clinical simulation cases with scoring rubrics.',
    inputHint: 'Organ system + difficulty level.', traceName: 'panacea:osce-builder',
    tags: ['panacea', 'content', 'osce'], recursionLimit: 10, tools: [...memoryTools],
  },
  'deploy-readiness': {
    role: 'deploy-readiness', promptName: 'panacea-deploy-readiness',
    name: 'Deploy Readiness', description: 'Runs the full pre-deploy checklist (typecheck, lint, build, tests, secrets).',
    inputHint: '"check" to run the 10-point checklist.', traceName: 'panacea:deploy-readiness',
    tags: ['panacea', 'ops', 'deploy'], recursionLimit: 15, tools: [...memoryTools],
  },
  'cost-optimizer': {
    role: 'cost-optimizer', promptName: 'panacea-cost-optimizer',
    name: 'Cost Optimizer', description: 'Analyzes LLM/API spend patterns and identifies savings opportunities.',
    inputHint: '"analyze" for weekly cost report.', traceName: 'panacea:cost-optimizer',
    tags: ['panacea', 'ops', 'cost'], recursionLimit: 10, tools: [...memoryTools, ...linearTools],
  },
  'postmortem-writer': {
    role: 'postmortem-writer', promptName: 'panacea-postmortem-writer',
    name: 'Postmortem Writer', description: 'Generates structured incident postmortems from Sentry + log data.',
    inputHint: 'Sentry issue ID or time range.', traceName: 'panacea:postmortem',
    tags: ['panacea', 'ops', 'incident'], recursionLimit: 12, tools: [...sentryTools, ...memoryTools, ...linearTools, triggerN8nWorkflowTool],
  },
};

export function buildSpecialist(role: SpecialistRole, opts: { model?: string } = {}): Promise<CompiledAgent> {
  const def = DEFS[role];
  return resolvePrompt(def.promptName).then((systemPrompt) =>
    buildAgent({
      role: 'content-enrichment',
      tools: def.tools,
      systemPrompt,
      traceName: def.traceName,
      tags: def.tags,
      model: opts.model,
      recursionLimit: def.recursionLimit,
    }),
  );
}

export const SPECIALIST_ROLES = Object.keys(DEFS) as SpecialistRole[];

export function describeSpecialists(): Array<{ role: string; name: string; description: string; inputHint: string }> {
  return SPECIALIST_ROLES.map((r) => ({
    role: r, name: DEFS[r].name, description: DEFS[r].description, inputHint: DEFS[r].inputHint,
  }));
}

export { DEFS as SPECIALIST_DEFS };