#!/usr/bin/env npx tsx
/**
 * CI entrypoint: build an instruction from AGENT_JOB and context, then launch the agent.
 * Used by GitHub Actions. Expects:
 *   AGENT_JOB= edge-guard | living-docs | asset-perf | schema-sync | e2e-gap | pr-review | security-sentinel | lint-fix
 *   AGENT_INSTRUCTION_OVERRIDE= optional full instruction (overrides job template)
 *   CHANGED_FILES= optional newline-separated list of changed files (for templates)
 *   GITHUB_REPOSITORY= owner/repo
 *   GITHUB_HEAD_REF or GITHUB_REF_NAME= branch
 *   (security-sentinel) PACKAGE_NAME=, PACKAGE_VERSION=, ADVISORY_URL=
 *
 * Outputs agent ID to stdout (last line) for optional follow-up (e.g. post comment).
 */

import { config } from 'dotenv';
config({ path: '.env.local' });
config({ path: '.env' });

import { launchAgent } from './client.js';

const JOB_TEMPLATES: Record<string, (ctx: CiContext) => string> = {
  'edge-guard': (ctx) =>
    `Review only the changed files under \`functions/\`. (1) Flag any use of \`fs\`, \`path\`, \`os\`, \`process.cwd\`, or other Node-only APIs. (2) Ensure Prisma is imported from the shared singleton (e.g. \`@/lib/prisma\` or the project's canonical path), not \`new PrismaClient()\`. (3) Ensure API handlers validate request body/query with Zod and return structured JSON errors. (4) Output a short checklist: Node APIs yes/no, Prisma singleton yes/no, Zod present yes/no. Changed files: ${ctx.files}`,

  'living-docs': (ctx) =>
    `The following files under \`functions/api/\` or shared API code changed: ${ctx.files}. (1) If there is an existing API doc (e.g. \`docs/api/\` or \`docs/automation/api-surface.md\`), update it to match new or changed routes and request/response shapes. (2) Update any references in \`docs/\` and \`README*.md\` that describe these endpoints. (3) If the project has no single API doc yet, create \`docs/api/API_OVERVIEW.md\` listing the changed routes with method, path, and a one-line description. Follow .cursorrules and existing doc style in \`docs/\`.`,

  'asset-perf': (ctx) =>
    `This PR adds or changes front-end assets or imports. Changed files: ${ctx.files}. (1) List any new or modified images under \`public/\` or under \`src/\`; suggest WebP or responsive images where appropriate. (2) If new CSS was added, suggest minification or Tailwind-purge alignment. (3) Check if new heavy imports (e.g. Recharts, Framer Motion, new libs) could cause the main bundle to exceed 500KB; if so, suggest code-splitting or lazy loading consistent with existing \`config/lazyComponents.tsx\` and project conventions.`,

  'schema-sync': (ctx) =>
    `Schema or content-related code changed: ${ctx.files}. (1) Update \`docs/implementation/\` and any \`docs/\` files that describe the data model or content pipeline so they match the new schema and script behavior. (2) If \`config/conditionRegistry.ts\`, \`config/training-modes.ts\`, or similar configs reference DB concepts, check they're still consistent with the schema. (3) Propose edits only; list files and suggested changes.`,

  'e2e-gap': (ctx) =>
    `These files were added or changed: ${ctx.files}. (1) Identify user-facing flows that touch these areas (e.g. starting a session, submitting an answer, opening a mode). (2) Check \`e2e/\` and \`playwright/\` for existing tests covering those flows. (3) If gaps exist, propose new or extended Playwright tests (or Vitest for pure logic) following the patterns in this repo. Output concrete test file paths and code snippets.`,

  'pr-review': (ctx) =>
    `Review this PR. Focus on Edge runtime rules (no Node APIs in \`functions/\`), Prisma singleton usage, and Zod validation in API routes. Leave comments as if reviewing the code. Changed files: ${ctx.files}. PR branch: ${ctx.branch}.`,

  'security-sentinel': (ctx) =>
    `A dependency vulnerability was reported: ${ctx.packageName ?? 'package'} ${ctx.packageVersion ?? 'version'} ${ctx.advisoryUrl ?? ''}. Create a new branch from main. Upgrade the package to the suggested safe version (or minimal fix). Run \`npm ci\`, \`npx prisma generate\`, \`npm run build\`, and \`npm test\`. If all pass, push the branch and open a Pull Request with title "Security: bump [package] to [version]" and label "Security Fix". If tests fail, describe what broke and do not open the PR.`,

  'lint-fix': (ctx) =>
    `Fix ESLint and Prettier issues in the files reported below. Do not change behavior; only fix lint/format. Use project rules in .cursorrules and .cursor/rules. Files: ${ctx.files}. Failure output or file list: ${ctx.files}.`,
};

interface CiContext {
  files: string;
  branch: string;
  packageName?: string;
  packageVersion?: string;
  advisoryUrl?: string;
}

function getContext(): CiContext {
  const files =
    (process.env.CHANGED_FILES ?? '').trim().replaceAll('\n', ', ') ||
    process.env.GITHUB_REF_NAME ||
    'unknown';
  const branch = process.env.GITHUB_HEAD_REF || process.env.GITHUB_REF_NAME || 'main';
  return {
    files,
    branch,
    packageName: process.env.PACKAGE_NAME,
    packageVersion: process.env.PACKAGE_VERSION,
    advisoryUrl: process.env.ADVISORY_URL,
  };
}

async function main() {
  const job = process.env.AGENT_JOB?.toLowerCase().replaceAll('_', '-');
  const override = process.env.AGENT_INSTRUCTION_OVERRIDE?.trim();

  if (!job && !override) {
    console.error('Set AGENT_JOB (e.g. edge-guard, living-docs) or AGENT_INSTRUCTION_OVERRIDE');
    process.exit(1);
  }

  const instruction = override || (job && JOB_TEMPLATES[job]?.(getContext())) || '';
  if (!instruction) {
    console.error('Unknown AGENT_JOB:', job);
    process.exit(1);
  }

  const repo = process.env.GITHUB_REPOSITORY;
  const repository = repo ? `https://github.com/${repo}` : undefined;
  const ref = process.env.GITHUB_HEAD_REF || process.env.GITHUB_REF_NAME || 'main';

  const result = await launchAgent({
    instruction,
    repository,
    ref,
    autoCreatePr: job === 'security-sentinel' || job === 'lint-fix',
    branchName:
      job === 'security-sentinel'
        ? `security-bump-${process.env.PACKAGE_NAME ?? 'deps'}-${Date.now()}`
        : undefined,
  });

  console.log('Agent launched:', result.id);
  // Last line is ID only for CI parsing (e.g. post comment step)
  console.log(result.id);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
