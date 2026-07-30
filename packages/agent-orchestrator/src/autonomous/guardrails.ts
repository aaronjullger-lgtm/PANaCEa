import { z } from 'zod';

export const FORBIDDEN_WRITE_PATHS = [
  /^prisma\/schema\.prisma$/,
  /^\.env/,
  /^wrangler\.toml$/,
  /^functions\/api\/_shared\/auth\.ts$/,
  /^lib\/fsrs\.ts$/,
  /^lib\/implicit-metrics\.ts$/,
  /^lib\/services\/drillReviewService\.ts$/,
  /^\.github\/workflows\//,
];

export const FORBIDDEN_COMMANDS = [
  /prisma\s+migrate/,
  /prisma\s+db\s+push/,
  /wrangler\s+deploy/,
  /npm\s+run\s+deploy/,
  /rm\s+-rf/,
  /git\s+push\s+--force/,
  /git\s+push.*--force/,
  /DROP\s+TABLE/i,
  /TRUNCATE/i,
  /git\s+reset\s+--hard/,
];

export const REQUIRED_APPROVAL = [
  /prisma\/schema\.prisma/,
  /package\.json/,
  /wrangler\.toml/,
  /functions\/api\/_shared\/auth\.ts/,
];

export function canWrite(path: string): { ok: boolean; reason?: string } {
  for (const p of FORBIDDEN_WRITE_PATHS) {
    if (p.test(path)) return { ok: false, reason: `Path "${path}" is protected by guardrails (matches ${p}). Schema/auth/FSRS/env changes require human approval.` };
  }
  return { ok: true };
}

export function canRun(command: string): { ok: boolean; reason?: string } {
  for (const p of FORBIDDEN_COMMANDS) {
    if (p.test(command)) return { ok: false, reason: `Command blocked by guardrails (matches ${p}). Destructive/deploy/migration operations require human approval.` };
  }
  return { ok: true };
}

export function needsApproval(paths: string[]): boolean {
  return paths.some((p) => REQUIRED_APPROVAL.some((r) => r.test(p)));
}

export const AUTONOMOUS_SYSTEM_PROMPT = `
SAFETY RULES (NON-NEGOTIABLE — violation = immediate abort):
- NEVER write to: prisma/schema.prisma, .env*, wrangler.toml, functions/api/_shared/auth.ts, lib/fsrs.ts, lib/implicit-metrics.ts, lib/services/drillReviewService.ts
- NEVER run: prisma migrate, wrangler deploy, npm run deploy, rm -rf, git push --force, git reset --hard
- NEVER commit secrets, log API keys, or bypass auth/RLS to make tests pass
- NEVER change FSRS algorithm parameters (binary Again/Good only — no Hard/Easy)
- NEVER assert medical diagnosis claims in generated content
- ALWAYS run typecheck + lint before committing changes
- ALWAYS work in the assigned worktree — never touch the main checkout
- ALWAYS create a PR for human review — never merge your own PRs
`;