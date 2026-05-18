---
name: "panacea-navigator"
description: "Use this skill for any PANaCEa repo work: adding features, debugging, tracing data flow, choosing files, reviewing architecture, or deciding whether code belongs in frontend, Cloudflare Functions, services, Prisma, config registries, tests, or scripts. It is the compact current map for StudyPANaCEa."
---

# PANaCEa Navigator

Use this first for repo orientation. This repo has `AGENTS.md`; read and follow it before editing. Use `CLAUDE.md`, `README.md`, `package.json`, and the files you plan to touch as additional context.

## Read Path

- Project rules/context: `AGENTS.md`, `CLAUDE.md`
- Commands and runtime overview: `README.md`, `package.json`
- Current database model: `prisma/schema.prisma`
- App route/view wiring: `config/appViews.ts`, `config/lazyComponents.tsx`, `config/AppRoutes.tsx`
- Production API patterns: `functions/api/_shared/middleware.ts`, `functions/api/_shared/endpoint.ts`
- Verification scripts: `package.json`

## Current Map

- `components/`: React UI by product area; high-risk surfaces include `components/session`, `components/drill`, `components/dashboard`, `components/osce`, `components/admin`
- `hooks/`: client workflow and telemetry hooks such as `useDrillFSRS`, `useTelemetryCollector`, `useStudyPlanLaunch`
- `lib/`: domain logic, FSRS, services, SDK clients, sync, study/session helpers, analytics
- `functions/api/`: production Cloudflare Pages Functions
- `routes/` + `server.ts`: legacy/local Express paths only
- `prisma/`: schema and migrations
- `config/`: app view, lazy component, navigation, and route registries
- `tests/`, `lib/**/*.test.ts`, `functions/api/**/*.test.ts`, `e2e/`: verification
- `scripts/`: maintenance, generation, ingestion, migration, audit, and automation

## Placement Rules

- Production endpoint behavior goes in `functions/api/`, not `routes/`.
- Shared Edge-only helpers belong in `functions/api/_shared/`.
- Shared domain logic belongs in `lib/` or `lib/services/`, but check Edge compatibility before importing it into `functions/api`.
- Frontend state belongs in hooks, stores, or the existing component flow; do not hide server writes in UI helpers.
- New app views normally require `config/lazyComponents.tsx` plus `config/appViews.ts` or the relevant route registry.
- Use the existing `@/` alias when surrounding code does; do not force relative imports across the repo.

## High-Risk Subsystems

- FSRS/review submission: `lib/fsrs.ts`, `lib/implicit-metrics.ts`, `lib/services/drillReviewService.ts`, `functions/api/drills/submit-review.ts`, `functions/api/srs/submit.ts`
- Main session: `components/session/QuizView.tsx`, `components/session/hooks/useQuizSubmit.ts`, `lib/services/sync/syncManager.ts`
- Edge auth/API: `functions/api/_shared/middleware.ts`, `functions/api/_shared/auth.ts`, `functions/api/_shared/prisma-edge.ts`
- Content/refinery: `functions/api/content`, `functions/api/admin/refinery`, `functions/api/admin/staging`, `lib/services/search`
- OSCE: `components/osce`, `components/modes/osce`, `functions/api/osce`, `lib/services/soap*`, `lib/services/osceStructuralScorer.ts`

## Non-Negotiables

- No Prisma imports in frontend/browser code.
- No `process.env` in deployed Edge handlers; use `context.env` or wrapper-provided `env`.
- Do not bypass shared auth/RBAC, response envelopes, request validation, or Prisma cleanup helpers.
- Do not add Hard/Easy student-facing rating controls.
- Do not run migrations, destructive data scripts, production deploys, or env edits without explicit approval.
