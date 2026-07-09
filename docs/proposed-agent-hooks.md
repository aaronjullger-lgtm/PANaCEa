# Proposed Agent Hooks

Hook ideas that are **not** implemented as active hooks because the current Cursor hook schema can't support them safely/effectively, or because they'd be too noisy/blocking. Documented here so they can be revisited. Active hooks live in `.cursor/hooks.json` (see `docs/cursor-hooks-notes.md`).

## Implemented (active, safe)
- **`beforeShellExecution` → `guard-shell.mjs`** — deny destructive/prod/secret-file commands; ask on risky ones; allow otherwise. Fail-open.
- **`afterFileEdit` → `format-edited-file.mjs`** — Prettier check (non-mutating) **plus** a non-blocking **sensitive-file advisory** logged when editing secrets/lockfiles/migrations/auth-RLS/prod-config/FSRS files.

## Proposed (not active) and why

### 1. Before-final-response "report gate"
- **Want:** before the agent's final message, require a command summary + unresolved risks.
- **Why not active:** no feed-back-capable pre-response event. `beforeSubmitPrompt` fires on the *user's* prompt and is informational only; `stop` doesn't surface a message to the model and blocking it re-runs the turn (loop-prone, capped).
- **Handled instead by:** rules (`agent-operating-procedure.mdc`, `cloud-agent-operating-mode.mdc`) + skills (`final-reporting`, `cloud-agent-final-report`) + rubric (`agent-final-report-rubric.md`).

### 2. Block edits to sensitive files unless the right workflow is active
- **Want:** `afterFileEdit`/`beforeFileEdit` that blocks editing auth/RLS/migration/secret files unless the correct workflow was selected.
- **Why not active:** `afterFileEdit` can't block or message the agent, and there's no reliable "current workflow" signal to a hook; a blocking file-edit hook risks halting normal work (noisy, error-prone). Enforcing "which workflow" deterministically isn't feasible from a hook.
- **Handled instead by:** the non-blocking sensitive-file **advisory** (logged), plus rules (`supabase-security.mdc`, `security-review.mdc`, `dependency-and-package-safety.mdc`) and `human-approval-gate`.

### 3. Staged-secret pre-commit scan as a Cursor hook
- **Want:** detect secret-like strings in staged changes before commit.
- **Why not active as a Cursor hook:** commit-time scanning belongs to git, and this repo **already has a commit-time secret scanner** that blocks secrets. Duplicating it as a Cursor hook adds noise without added safety.
- **Handled instead by:** the existing commit secret scanner + the `guard-shell.mjs` denial of writing/staging `.env`/`.dev.vars`/`.cursor/mcp.json` + `auditing-security`/`security-quality-gate` secret scans.

### 4. Auto-format-on-edit (mutating)
- **Want:** `prettier --write` on every edited file.
- **Why not default:** surprising large diffs. Left **opt-in** via `CURSOR_HOOK_AUTOFORMAT=1`; default is check-only.

## Constraints honored (all proposals)
- No destructive commands; no auto-applied migrations; no auto-editing of security files; no external data transfer; no noisy hooks that block normal dev work. If a future Cursor schema adds a feed-back-capable pre-response event or edit-gating with context, revisit #1 and #2.
