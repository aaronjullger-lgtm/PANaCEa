---
name: codebase-onboarding
description: Quickly orient in the PANaCEa codebase — map the stack, entry points, data flow, and conventions before making changes. Use at the start of work in an unfamiliar area.
---

# Codebase onboarding

Build an accurate mental model before editing.

## When to use

- Starting work in an unfamiliar subsystem.
- Before a non-trivial change or investigation.

## Instructions

1. Read the orientation docs (do not re-derive what's written):
   - `docs/cursor-automation-audit.md` (stack + commands), `AGENTS.md`, `CLAUDE.md`, the local dev runbook markdown (repo root), `APP_FUNCTIONALITY_PLAN.md`.
   - The `.cursor/rules/*.mdc` for the area you're touching.
2. Map the layers:
   - UI: `components/` (canonical), `src/` (frontend-only), routing via React Router.
   - Server: `functions/api/` (Edge, production). `lib/` (shared/server services, FSRS). `server.ts` + `routes/` are legacy (routes missing on `main`).
   - Data: `prisma/schema.prisma`, Prisma Edge client in `functions/api/_shared/`.
3. Trace one real flow end to end (e.g. a drill submission: component → `useDrillFSRS` → `functions/api/drills/submit-review` → `lib/services/drillReviewService.ts` → Prisma).
4. Identify the package manager (npm) and the verify commands (typecheck/lint/test/build).
5. Note existing tests near your target to learn conventions and to have a safety net.

## Verification

- You can state: entry point(s), the data flow, the files you'll change, and how you'll verify.
- You confirmed referenced modules exist (some are missing on `main`).

## Failure recovery

- Conflicting docs vs. code → the code wins; note the drift.
- Can't find a symbol → search (`rg`)/Glob before assuming; don't invent files.
