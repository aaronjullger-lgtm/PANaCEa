---
name: release-readiness-gate
description: Produce a go/no-go readiness verdict before a release. Use before deploy requests or as a pre-merge gate for risky changes. Never deploys.
---

# Release readiness gate

Enforce `workflow-completion-rubric.md` + `predeploy-readiness.workflow.md`. **Report only — never deploy.**

## When to use
- Before a release/deploy request or merging risky changes.

## Gate (all must pass or be documented)
- `npm run typecheck:ci` · `npm run lint` · `npm test` · `npm run build` · `npm run env:check:compat-date` (pre-existing failures noted, no new ones).
- No staged secrets/`.env`/`.cursor/mcp.json`; secret scan clean.
- Edge-safety: `context.env` (no Node built-ins); note known blockers (`dev:wrangler` broken, missing modules).

## Verification evidence
- Full ladder output (pre-existing vs introduced); secret-scan result; Edge scan.

## Stop conditions
- Deliver Go/No-Go and stop — deployment is out of scope.

## Do not claim success unless
- The ladder was actually run and secrets are confirmed absent.

## Recovery / never
- Never run `deploy:local`/`wrangler pages deploy`/`migrate:production`. The deploy + any prod migration → `human-approval-gate`.
