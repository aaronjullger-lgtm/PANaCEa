# Agent Orchestration Audit

Audit of the agent-automation setup before layering the orchestration system on top, and the decisions that shaped it. Inspected: `.cursor/rules/`, `.cursor/skills/`, `.cursor/hooks.json`, `.cursor/mcp.example.json`, `.cursor/README.md`, `AGENTS.md`, `CLAUDE.md`, `.agents/skills/`, `.claude/skills/`, the `docs/cursor-*.md` set, `package.json`, and `.github/workflows/`.

## What orchestration already exists

- **Rules (22 `.mdc`)** — scoped guidance: core context, architecture boundaries, quality gates (TS/React/a11y/design/PR), safety (security, supabase, deps, MCP, anti-hallucination), and operating procedure (general SOP + cloud mode + planning/handoff + memory).
- **Skills (29)** — workflow/memory, verification/QA, code-safety/review, onboarding/config. Includes `failure-triage`, `repo-memory-update`, `cloud-agent-final-report`, `pr-review`, etc.
- **Hooks** — `beforeShellExecution` guard (deny destructive/secret/prod; ask risky) + `afterFileEdit` Prettier check. Fail-open.
- **MCP** — secret-free templates + curated recommendation table (read-only/dev defaults).
- **Docs** — audit, agent-operating-system (workflow map), cloud-automations (25 prompts), community-research, dedupe, hooks-notes, mcp-cloud-setup, agent-safety-checklist.
- **Pre-existing** — `.agents/skills/` (~40 PANaCEa domain skills), `.claude/skills/`, `AGENTS.md`/`CLAUDE.md` (domain + operating truths), `.cursor/commands/audit-*`.
- **GitHub** — `.github/workflows/` CI (typecheck/lint/build/test/e2e) and automation-lane workflows; `.github/ISSUE_TEMPLATE/` has 3 `automation-*.yml` forms; **no** `pull_request_template.md`.

## What was missing (added by this system)

- **Named agent roles** with explicit powers/limits → `.cursor/agents/`.
- **Reusable multi-phase workflows** (context → plan → implement → self-review → verify → specialist review → docs/memory → report) → `.cursor/workflows/`.
- **Durable, structured repo memory + a learning loop** → `.cursor/memory/` + `repo-learning-loop` skill.
- **Safe self-improvement loop** (bounded to 2 repair attempts) → `docs/agent-self-improvement-loop.md` + workflow.
- **Onboarding playbooks/primers + good/bad examples** → `.cursor/training/`.
- **Evaluation rubrics with automatic-failure conditions** → `.cursor/evals/`.
- **Orchestration skills + index/matrix** → new `.cursor/skills/*` + `docs/agent-workflow-orchestration.md`.
- **PR template + `.md` issue templates**.

## Duplication found & how it's handled

- Verification commands were repeated across rules → centralized in `testing-and-verification.mdc`; agents/workflows **reference** it.
- Design-system truth lives once in `ui-design-system.mdc`; gates/skills reference it.
- `failure-triage` and `repo-memory-update` skills already exist → **reused**, not recreated (the new `self-improvement-loop`, `repo-learning-loop`, and rubric-gate skills reference them).
- Handoff guidance exists in `saving-workspace-context`/`long-running-handoff`/`repo-memory-and-context.mdc` → the new `.cursor/memory/` files are the *storage*; those skills/rules remain the *how*.

## Where rules/skills/hooks overlap (by design)

- **Rules** = advisory, auto-loaded knowledge. **Skills** = on-demand procedures. **Hooks** = deterministic gates. **Agents** = role framing that composes rules+skills. **Workflows** = ordered multi-agent recipes. This layering is intentional; each references the others rather than restating.

## What should stay Cursor-specific (in `.cursor/`)

- Agent roles, workflows, rubrics, training primers, orchestration skills, hooks, and the memory store. These are agent-operating mechanics.

## What belongs in AGENTS.md (all agents/tools)

- Durable truths only: stack, verification ladder, known blockers, cloud caveats, no-secrets / no-production-data policy, final-report requirement. AGENTS.md already carries a concise "agent operating system" quick reference pointing into `.cursor/`. Keep it short.

## What should NOT be automated

- Editing secrets or production credentials; connecting to production DB/services; production migrations/deploys/billing.
- Weakening auth/RLS/security, deleting/skipping tests, or loosening type/lint gates to reach green.
- Claiming success/visual-QA without running checks / capturing browser evidence.
- Modifying shared UI primitives or FSRS rating logic without human approval.
- Force-push/history rewrite; merging or marking PRs ready.
- Uncontrolled loops: repair attempts are capped (2); destructive commands are never retried.

## Known blockers to respect (pre-existing on `main`)

- `dev:all`/`dev:server` and `dev:wrangler` don't run (missing `routes/`, `lib/services/tokenMatchCache.ts`).
- `npm run lint`: 3 pre-existing `no-empty` errors. `npm run typecheck`: 2 pre-existing errors in `lib/study/renderStructuredRationale.ts`.
- See `docs/cursor-automation-audit.md` for full environment detail.
