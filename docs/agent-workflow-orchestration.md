# PANaCEa Agent Workflow Orchestration

The orchestration layer that turns the `.cursor/` setup into a coordinated engineering team. It composes **agent roles** (`.cursor/agents/`), **workflows** (`.cursor/workflows/`), **rules** (`.cursor/rules/`), **skills** (`.cursor/skills/`), **hooks** (`.cursor/hooks.json`), **memory** (`.cursor/memory/`), **training** (`.cursor/training/`), and **rubrics** (`.cursor/evals/`). Start here, then open the specific workflow file.

## How to choose a workflow

1. Identify the task type (feature, bug, UI, security, DB, deps, tests, release, docs, imports, Edge).
2. Match it in the **matrix** below → open the workflow file → the **Orchestrator** leads, delegating to the listed agents.
3. If unsure, use the `workflow-selection` skill; if it spans types, the Orchestrator runs the closest workflow and pulls in extra specialists.

## The universal phase pattern

Every workflow follows: **1) Context scan → 2) Plan → 3) Implementation → 4) Self-review → 5) Verification → 6) Specialist review → 7) Docs/update memory → 8) Final report.** Context-gathering (phase 1) is mandatory; you may not skip to editing.

## Task → workflow matrix

| Task type | Lead agent | Supporting agents | Workflow file | Required checks | Human approval? |
|-----------|-----------|-------------------|---------------|-----------------|-----------------|
| Feature work | Orchestrator/Implementation | Planner, Reviewer, UI/UX QA*, Security* | `feature-build.workflow.md` | typecheck, lint, test, build (+browser* ) | If deps/auth/DB/prod |
| Bug fix | Test/Debug | Implementation, Reviewer | `bug-fix.workflow.md` | repro, test, typecheck, build | If auth/DB/prod |
| UI polish | UI/UX QA | Implementation, Reviewer | `ui-polish.workflow.md` | dev+screenshots, hex scan, lint, typecheck | Shared primitives / new dep |
| Landing page work | UI/UX QA | Implementation, Reviewer | `ui-polish.workflow.md` + `visual-qa.workflow.md` | screenshots (light+dark, breakpoints), a11y | Shared primitives / new dep |
| Visual QA | UI/UX QA | Reviewer | `visual-qa.workflow.md` | dev+screenshots, a11y | No (report-first) |
| Accessibility | UI/UX QA | Reviewer | `accessibility-audit.workflow.md` | `test:e2e:a11y`, manual keyboard/contrast | Shared primitives |
| Auth/RLS changes | Security | Database Safety, Reviewer | `security-review.workflow.md` (+`cloudflare-functions-review`) | secret scan, typecheck, authz map | **Yes (required)** |
| Database schema | Database Safety | Security, Reviewer | `database-change-review.workflow.md` | db:generate, typecheck, db:validate | **Yes (to apply)** |
| Cloudflare Functions | Security | Reviewer, Test/Debug | `cloudflare-functions-review.workflow.md` | typecheck, build, `rg process.env` | If auth/deploy |
| Dependency updates | Reviewer | Security | `dependency-update-review.workflow.md` | install, typecheck, build, test, size | **Yes for prod deps** |
| Security fixes | Security | Reviewer, Implementation | `security-review.workflow.md` | secret scan, typecheck, lint | **Yes for auth/RLS/secrets** |
| Test failures | Test/Debug | Implementation, Reviewer | `test-failure-triage.workflow.md` | failing cmd, test, typecheck, build | If root cause restricted |
| Release readiness | Release Readiness | Security, Reviewer | `predeploy-readiness.workflow.md` | typecheck:ci, lint, test, build, compat-date | **Yes to deploy** |
| Documentation refresh | Documentation | Reviewer | `documentation-refresh.workflow.md` | spot-run documented cmds | No |
| Agent memory refresh | Documentation | Reviewer | `agent-memory-refresh.workflow.md` | secret scan | No |
| Broken imports/dead code | Test/Debug | Implementation, Reviewer | `broken-import-sweep.workflow.md` | typecheck, build | Deleting files |
| Recover from failure | Test/Debug | Implementation, Documentation | `self-improvement-loop.workflow.md` | the failing cmd (≤2 attempts) | Risky rule/hook or restricted root cause |

\* only when the change includes UI / data-auth.

## Which agent leads vs reviews

- **Leads** own execution of their workflow phase; **Reviewers** grade work they didn't produce (fresh-eyes / adversarial review — a core safety principle). The Orchestrator never merges/deploys and never skips the specialist review phase for risky changes.

## How hooks support workflows

- `beforeShellExecution` guard denies destructive/secret/prod-destroying commands and asks on risky ones — a deterministic backstop under every workflow's Implementation/Verification phases.
- `afterFileEdit` runs a Prettier check and logs a **sensitive-file advisory** when auth/RLS/migration/config/lockfile/secret files are touched (prompt to use the right workflow).
- Hooks are gates, not knowledge; see `docs/cursor-hooks-notes.md` and proposed hooks in `docs/proposed-agent-hooks.md`.

## How skills support workflows

- Orchestration: `workflow-selection`, `agent-orchestration`, `task-decomposition`, `subagent-review`, `human-approval-gate`, `final-reporting`.
- Gates: `design-quality-gate`, `security-quality-gate`, `database-safety-gate`, `release-readiness-gate`.
- Learning: `repo-learning-loop`, `repo-memory-update`, `workflow-retrospective`, `self-improvement-loop`, `agent-training-refresh`.
- Each workflow names the skills its phases use; skills reference rules/rubrics rather than restating them.

## How final reports should be written

- Use the workflow's final-report template and pass the `agent-final-report-rubric.md`: files changed, commands run + pass/fail (pre-existing vs introduced), evidence (screenshots for UI), residual risks, human-approval items, and where durable memory was updated. **Never** claim success/visual-QA without evidence.

## How context is preserved

- Durable facts/lessons → `.cursor/memory/` (via `repo-learning-loop`/`repo-memory-update`); status/next-step → `APP_FUNCTIONALITY_PLAN.md`; cross-tool truths → `AGENTS.md`. Keep entries short, dated, evidence-backed.

## How failures are handled

- Enter `self-improvement-loop.workflow.md`: **max 2 automatic repair attempts**, diagnose before retry, never loop on destructive commands, never hide failures, then escalate with an unresolved-failure report. Full spec: `docs/agent-self-improvement-loop.md`.

## When to stop and ask for human approval

- DB writes/migrations, auth/RLS/middleware changes, production deploys, billing, secrets, new production dependencies, shared-primitive or FSRS rating changes, deleting files, or any irreversible/ambiguous-scope action. Use the `human-approval-gate` skill.

## What should never be automated

See `docs/agent-safety-checklist.md` and `docs/agent-orchestration-audit.md` → "What should NOT be automated." In short: no secrets, no production data/deploys, no weakening of auth/RLS/tests/type-lint gates, no unverified success claims, no uncontrolled loops.
