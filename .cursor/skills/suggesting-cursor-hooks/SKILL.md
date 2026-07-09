---
name: suggesting-cursor-hooks
description: Propose or add safe, non-destructive Cursor hooks in .cursor/hooks.json (formatting, guards, verification reminders). Use when the user wants to automate checks on the agent loop or harden against risky commands.
---

# Suggesting Cursor hooks

Add conservative hooks that improve reliability without surprising side effects.

## When to use

- The user wants automatic checks (format/lint/typecheck) or safety guards on agent actions.
- You keep seeing risky commands that should be gated.

## Instructions

1. Read the current setup: `.cursor/hooks.json`, the scripts in `.cursor/hooks/`, and `docs/cursor-hooks-notes.md`.
2. Use the current schema (version 1):
   ```json
   {
     "version": 1,
     "hooks": {
       "afterFileEdit": [{ "command": "node .cursor/hooks/format-edited-file.mjs" }],
       "beforeShellExecution": [{ "command": "node .cursor/hooks/guard-shell.mjs", "failClosed": false, "timeout": 15 }]
     }
   }
   ```
3. Keep hooks **non-destructive by default**. Prefer check/report over auto-mutation; make any auto-fix opt-in via an env flag and document it.
4. For `beforeShellExecution` guards, read stdin JSON, and print `{"permission":"allow"|"deny"|"ask", "user_message":..., "agent_message":...}`. Deny truly destructive commands; `ask` for risky ones (force push, deploy).
5. Set `failClosed: false` for guards so a script error never blocks all work; use short `timeout`s.
6. Hook script paths are relative to the project root (`.cursor/hooks/...`). Make scripts executable and dependency-light (Node is available).

## Verification

- `node -e 'JSON.parse(require("fs").readFileSync(".cursor/hooks.json","utf8"))'` — valid JSON.
- Self-test a guard: `echo '{"command":"rm -rf /"}' | node .cursor/hooks/guard-shell.mjs` should print `"permission":"deny"`; a benign command should `allow`.
- Confirm it appears in Cursor's Hooks settings/output channel (manual, in-app).

## Failure recovery

- Hook "does nothing" → check the path is project-root-relative and the script is valid.
- Hook blocks legitimate work → loosen the matcher/patterns or set `failClosed: false`.
- Document anything schema-uncertain in `docs/cursor-hooks-notes.md`.
