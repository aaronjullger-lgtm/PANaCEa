# `.cursor/` — AI Agent Automation

Repo-level configuration that makes AI coding agents (Cursor Desktop, IDE, and Cloud Agents) more reliable, safer, and consistent for **PANaCEa**. Everything here is versioned in Git so it's portable and reviewable.

## Layout

```
.cursor/
├── rules/            # .mdc project rules (scoped guidance the agent auto-loads)
├── skills/           # SKILL.md workflows (QA, verification, orchestration, memory)
├── agents/           # agent role definitions (planner, implementer, reviewer, ...)
├── workflows/        # reusable multi-phase, multi-agent workflow recipes
├── memory/           # durable repo memory (facts, failure modes, lessons, history)
├── training/         # onboarding primers + good/bad worked examples
├── evals/            # pass/fail rubrics (final report, UI, security, DB, ...)
├── commands/         # existing slash commands (audit-*)
├── hooks.json        # safe agent-loop hooks (guard + format/advisory check)
├── hooks/            # hook scripts (Node) + logs/ (gitignored)
├── mcp.example.json  # MCP server templates (no secrets) -> copy to mcp.json (gitignored)
└── environment.json  # cloud env install config
```

Related docs live in `docs/`:
`agent-workflow-orchestration.md` (**start here for the orchestration system**), `cursor-agent-operating-system.md`, `agent-orchestration-audit.md`, `agent-self-improvement-loop.md`, `proposed-agent-hooks.md`, `cursor-automation-audit.md`, `cursor-community-research.md`, `cursor-automation-dedupe.md`, `cursor-hooks-notes.md`, `cursor-mcp-cloud-setup.md`, `cursor-cloud-automations.md`, `agent-safety-checklist.md`.

## Orchestration layer (agents / workflows / memory / training / evals)

- **Agents** (`.cursor/agents/`) — role definitions: `orchestrator`, `planner`, `implementation`, `reviewer`, `test-debug`, `ui-ux-qa`, `security`, `database-safety`, `documentation`, `release-readiness`. Each states its powers, limits, verification, stop/escalation conditions, and report format.
- **Workflows** (`.cursor/workflows/`) — 16 multi-phase recipes (feature-build, bug-fix, ui-polish, visual-qa, accessibility-audit, security-review, test-failure-triage, database-change-review, dependency-update-review, predeploy-readiness, pr-review, documentation-refresh, agent-memory-refresh, broken-import-sweep, cloudflare-functions-review, self-improvement-loop). Each: context→plan→implement→self-review→verify→specialist-review→docs/memory→report, with approval gates.
- **Memory** (`.cursor/memory/`) — durable, concise: `project-facts`, `known-failure-modes`, `agent-lessons-learned`, `design-system-decisions`, `validation-history`, `workflow-retrospectives`, `do-not-repeat`. Updated via `repo-learning-loop`/`repo-memory-update`. No secrets/PII/logs.
- **Training** (`.cursor/training/`) — primers + good/bad examples loaded as context (not model training).
- **Evals** (`.cursor/evals/`) — rubrics with automatic-failure conditions used by reviewer/gate skills.

The full map (task→workflow matrix, lead/reviewer agents, approval gates) is `docs/agent-workflow-orchestration.md`.

## Rules (`.cursor/rules/`)

Focused `.mdc` files; the agent loads them by scope/description.

| Rule | When it applies |
|------|-----------------|
| `project-context.mdc` | Always — stack, commands, layout, anti-hallucination checks. |
| `architecture-boundaries.mdc` | Always — Edge runtime, Prisma singleton, client/server split, FSRS ownership. |
| `agent-operating-procedure.mdc` | Always — plan → verify → report SOP. |
| `typescript-quality.mdc` | `*.ts/*.tsx` edits. |
| `react-quality.mdc` | `*.tsx/*.jsx` edits (React+Vite, not Next.js). |
| `supabase-security.mdc` | `prisma/`, `functions/api/`, `lib/` DB work. |
| `accessibility.mdc` | `components/`, `src/` UI. |
| `testing-and-verification.mdc` | Writing/running tests; before completion. |
| `security-review.mdc` | Auth/RLS/endpoint/secret work. |
| `agent-planning-and-handoff.mdc` | Multi-step tasks; planning + handoff. |
| `repo-memory-and-context.mdc` | Persisting durable context/memory. |
| `browser-verification.mdc` | UI/route/behavior changes (browser evidence gate). |
| `visual-design-quality-gate.mdc` | UI pass/fail gate + no-AI-slop. |
| `pr-review-quality-gate.mdc` | Reviewing/preparing a PR. |
| `dependency-and-package-safety.mdc` | `package.json`/dependency changes. |
| `mcp-and-tool-safety.mdc` | Using/enabling MCP or external tools. |
| `anti-hallucination-imports.mdc` | Adding imports/routes/packages. |
| `cloud-agent-operating-mode.mdc` | Running as a Cursor Cloud/background agent. |
| `ui-design-system.mdc` | **Pre-existing, preserved** — Stormy Slate design system. |

Also preserved: `autonomous-behavior.mdc`, `project-conventions.mdc`, `project-roles.mdc`, `panacea-rules.md`.

## Skills (`.cursor/skills/`)

Loaded automatically when their `description` matches the task, or invoked with `/skill-name`.

- **Workflow/memory:** `agent-task-planning`, `long-running-handoff`, `repo-memory-update`, `saving-workspace-context`, `community-pattern-research`, `cloud-agent-final-report`.
- **Verification/QA:** `verifying-in-browser`, `visual-qa-testing`, `ui-polish-pass`, `design-system-enforcement`, `no-ai-slop-visual-audit`, `responsive-testing`, `dark-mode-testing`, `accessibility-auditing`, `form-testing`, `recording-browser-flow-as-test`.
- **Code safety/review:** `pr-review`, `dependency-review`, `code-mod-safety`, `route-and-import-verification`, `auto-type-checking`, `failure-triage`, `parallel-test-fixing`, `auditing-security`, `mcp-safety-review`.
- **Onboarding/config:** `codebase-onboarding`, `using-ui-stack`, `suggesting-cursor-rules`, `suggesting-cursor-hooks`.
- **Orchestration & gates:** `agent-orchestration`, `workflow-selection`, `task-decomposition`, `subagent-review`, `final-reporting`, `human-approval-gate`, `self-improvement-loop`, `repo-learning-loop`, `workflow-retrospective`, `agent-training-refresh`, `design-quality-gate`, `security-quality-gate`, `database-safety-gate`, `release-readiness-gate`.

> These complement (don't duplicate) the domain skills already in `.agents/skills/` and `.claude/skills/`. See `docs/cursor-automation-dedupe.md`.

## Hooks (`.cursor/hooks.json`)

Two safe, fail-open hooks (details + tuning in `docs/cursor-hooks-notes.md`):

- `beforeShellExecution` → `guard-shell.mjs`: deny destructive/prod-destroying commands and writing/staging secret files (`.env`/`.dev.vars`/`.cursor/mcp.json`), ask on risky ones (force push, deploy, reading secret files, `printenv`), allow otherwise. Never runs the command.
- `afterFileEdit` → `format-edited-file.mjs`: Prettier **check** on the edited file (logs to `hooks/logs/`); set `CURSOR_HOOK_AUTOFORMAT=1` to auto-format.

Self-test: `echo '{"command":"rm -rf /"}' | node .cursor/hooks/guard-shell.mjs` → `deny`.

## MCP (`.cursor/mcp.example.json`)

Template only — **no secrets**. Copy servers you want into `.cursor/mcp.json` (gitignored) or configure them in the Cursor dashboard for Cloud Agents. See the curated table in `docs/cursor-mcp-cloud-setup.md`. Recommended now: GitHub (read-only), Supabase (dev/read-only), Playwright (local), Context7, Sequential Thinking; later/optional: Figma, Mermaid/Excalidraw (vet with `mcp-safety-review` first).

## `.cursorrules` note

The legacy root `.cursorrules` is kept only for backward compatibility. New, structured guidance lives here in `.cursor/rules/*.mdc`. Prefer editing the `.mdc` rules.

## Safety

All automation follows `docs/agent-safety-checklist.md`: no secrets, no production DB/services, no weakening auth/RLS, no deleting tests, no unverified success claims.
