# Cursor Hooks — Notes & Manual Adjustments

What the committed `.cursor/hooks.json` does, and what you may want to tune. Hooks run scripts on the agent loop; see the canonical reference at <https://cursor.com/docs/hooks>.

## What ships in this repo

`.cursor/hooks.json` (schema `version: 1`) registers two **safe, non-destructive** hooks:

| Event | Script | Purpose | failClosed |
|-------|--------|---------|------------|
| `beforeShellExecution` | `node .cursor/hooks/guard-shell.mjs` | Advises **deny** on destructive/secret/prod-destroying commands, **ask** on risky ones (force push, deploy, prod migrate, `git add .`), **allow** otherwise. Never runs the command. | `false` (fail-open) |
| `afterFileEdit` | `node .cursor/hooks/format-edited-file.mjs` | Runs `prettier --check` on the single edited file and logs the result to `.cursor/hooks/logs/format.log`. Does **not** modify files by default. | `false` |

Both use `failClosed: false` so a broken/slow hook never blocks normal work.

### Self-test

```bash
echo '{"command":"rm -rf /"}'            | node .cursor/hooks/guard-shell.mjs   # -> deny
echo '{"command":"git push --force"}'    | node .cursor/hooks/guard-shell.mjs   # -> ask
echo '{"command":"npm run typecheck"}'   | node .cursor/hooks/guard-shell.mjs   # -> allow
echo '{"file_path":"README.md"}'         | node .cursor/hooks/format-edited-file.mjs
```

## Manual adjustments you may want

- **Enable auto-format on edit:** set `CURSOR_HOOK_AUTOFORMAT=1` in your environment. The `afterFileEdit` hook will then run `prettier --write` on the edited file instead of check-only. Left off by default to keep edits non-surprising.
- **Tune the guard:** edit the `DENY` / `ASK` pattern lists in `.cursor/hooks/guard-shell.mjs`. Note `permission: "ask"` is honored for `beforeShellExecution` but is treated as `deny` for `subagentStart` and is not enforced for `preToolUse` in the current product — check the docs if you move logic to those events.
- **Verify in-app:** open Cursor → Settings → Hooks to confirm the hooks are detected, and the **Hooks** output channel to debug. Project hook paths are relative to the repo root (`.cursor/hooks/...`).
- **Windows:** wrap commands as `cmd /c node .cursor/hooks/<script>.mjs` if direct execution is unreliable.

## Optional heavier hooks (not enabled by default)

Running typecheck/lint/test/build on **every** edit or stop is slow and can loop, so they are **not** wired as hooks. Prefer running them via the verification skills/rules, CI, or the automation prompts in `docs/cursor-cloud-automations.md`. If you still want a stop-time reminder, you can add a `stop` hook that prints the commands (keep `loop_limit` small):

```jsonc
// .cursor/hooks.json (example addition — verify against current schema before use)
"stop": [{ "command": "node .cursor/hooks/verify-reminder.mjs", "loop_limit": 1 }]
```

…where the script simply logs/echoes "run: npm run typecheck && npm run lint && npm test && npm run build". Avoid auto-running the full suite from a hook.

## Schema uncertainty

The event names and stdout schema above match the current Cursor docs at the time of writing (`beforeShellExecution`, `afterFileEdit`, `preToolUse`/`postToolUse`, `sessionStart`/`sessionEnd`, `stop`, `beforeSubmitPrompt`, etc.). If a future Cursor version changes the schema, adjust `.cursor/hooks.json` and the scripts, and re-run the self-test above. The scripts are defensive (fail-open) so a schema mismatch degrades to "allow / no-op" rather than breaking the agent.
