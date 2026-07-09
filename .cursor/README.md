# `.cursor/` — AI Agent Automation

Repo-level configuration that makes AI coding agents (Cursor Desktop, IDE, and Cloud Agents) more reliable, safer, and consistent for **PANaCEa**. Everything here is versioned in Git so it's portable and reviewable.

## Layout

```
.cursor/
├── rules/            # .mdc project rules (scoped guidance the agent auto-loads)
├── skills/           # SKILL.md workflows (QA, verification, onboarding, security)
├── commands/         # existing slash commands (audit-*)
├── hooks.json        # safe agent-loop hooks (guard + format check)
├── hooks/            # hook scripts (Node) + logs/ (gitignored)
├── mcp.example.json  # MCP server templates (no secrets) -> copy to mcp.json (gitignored)
└── environment.json  # cloud env install config
```

Related docs live in `docs/`:
`cursor-automation-audit.md`, `cursor-hooks-notes.md`, `cursor-mcp-cloud-setup.md`, `cursor-cloud-automations.md`, `agent-safety-checklist.md`.

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
| `ui-design-system.mdc` | **Pre-existing, preserved** — Stormy Slate design system. |

Also preserved: `autonomous-behavior.mdc`, `project-conventions.mdc`, `project-roles.mdc`, `panacea-rules.md`.

## Skills (`.cursor/skills/`)

Loaded automatically when their `description` matches the task, or invoked with `/skill-name`.

`saving-workspace-context`, `suggesting-cursor-rules`, `suggesting-cursor-hooks`, `verifying-in-browser`, `visual-qa-testing`, `responsive-testing`, `dark-mode-testing`, `accessibility-auditing`, `form-testing`, `parallel-test-fixing`, `codebase-onboarding`, `auto-type-checking`, `recording-browser-flow-as-test`, `using-ui-stack`, `auditing-security`.

> These complement (don't duplicate) the domain skills already in `.agents/skills/` and `.claude/skills/`.

## Hooks (`.cursor/hooks.json`)

Two safe, fail-open hooks (details + tuning in `docs/cursor-hooks-notes.md`):

- `beforeShellExecution` → `guard-shell.mjs`: deny destructive/secret/prod-destroying commands, ask on risky ones, allow otherwise. Never runs the command.
- `afterFileEdit` → `format-edited-file.mjs`: Prettier **check** on the edited file (logs to `hooks/logs/`); set `CURSOR_HOOK_AUTOFORMAT=1` to auto-format.

Self-test: `echo '{"command":"rm -rf /"}' | node .cursor/hooks/guard-shell.mjs` → `deny`.

## MCP (`.cursor/mcp.example.json`)

Template only — **no secrets**. Copy servers you want into `.cursor/mcp.json` (gitignored) or configure them in the Cursor dashboard for Cloud Agents. See `docs/cursor-mcp-cloud-setup.md`. Recommended: GitHub (read-only), Supabase (dev/read-only), Playwright (local), optional Figma/Context7.

## `.cursorrules` note

The legacy root `.cursorrules` is kept only for backward compatibility. New, structured guidance lives here in `.cursor/rules/*.mdc`. Prefer editing the `.mdc` rules.

## Safety

All automation follows `docs/agent-safety-checklist.md`: no secrets, no production DB/services, no weakening auth/RLS, no deleting tests, no unverified success claims.
