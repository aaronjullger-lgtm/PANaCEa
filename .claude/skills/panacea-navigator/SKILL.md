---
name: panacea-navigator
description: "Current PANaCEa codebase map. Use whenever working in StudyPANaCEa, choosing files, tracing data flow, adding features, debugging, or deciding whether code belongs in frontend, Cloudflare Functions, lib services, Prisma, config registries, tests, or scripts."
---

# PANaCEa Navigator

The repo currently has no `AGENTS.md`. Start with `CLAUDE.md`, `README.md`, `package.json`, and the files you will touch.

## Map

- `components/`: React UI by product area (`session`, `drill`, `dashboard`, `osce`, `admin`, `library`, `ui`)
- `hooks/`: client workflows and telemetry (`useDrillFSRS`, `useTelemetryCollector`, `useStudyPlanLaunch`)
- `lib/`: core domain logic, FSRS, services, SDK clients, sync, analytics, study/session helpers
- `functions/api/`: production Cloudflare Pages Functions
- `routes/` and `server.ts`: legacy/local Express only
- `config/`: app view, lazy component, route, and navigation registries
- `prisma/`: schema and migrations
- `tests/`, `lib/**/*.test.ts`, `functions/api/**/*.test.ts`, `e2e/`: verification
- `scripts/`: generation, ingestion, DB maintenance, audits, automation

## Canonical Paths

- Review/FSRS writer: `lib/services/drillReviewService.ts`
- Canonical review endpoint: `functions/api/drills/submit-review.ts`
- Legacy SRS adapter: `functions/api/srs/submit.ts`
- Attempt-only endpoint: `functions/api/questions/attempt.ts`
- FSRS math: `lib/fsrs.ts`
- Telemetry/MVRT: `types/telemetry.ts`, `lib/implicit-metrics.ts`
- Edge middleware: `functions/api/_shared/middleware.ts`, `functions/api/_shared/endpoint.ts`
- Prisma Edge client: `functions/api/_shared/prisma-edge.ts`
- View wiring: `config/lazyComponents.tsx`, `config/appViews.ts`, `config/AppRoutes.tsx`

## Rules

- Production endpoint behavior goes in `functions/api/`, not `routes/`.
- Use `@/` imports where surrounding frontend code does; do not force relative imports.
- Do not import Prisma into browser/frontend code.
- Edge handlers use `context.env`/wrapper `env`, not `process.env`.
- Do not bypass shared auth/RBAC, validation, response envelopes, idempotency, or Prisma cleanup.
- New views usually need lazy-component and app-view registration.
- FSRS, auth, Prisma schema, migrations, and live review submission are high-risk; read surrounding code first.
