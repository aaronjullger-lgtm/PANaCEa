---
name: panacea-dev
description: "PANaCEa project-specific development patterns and constraints. Use for any StudyPANaCEa coding task, especially API endpoints, React views, sessions, drills, FSRS, Prisma, content, dashboard, OSCE, or clinical education workflows."
---

# PANaCEa Dev

PANaCEa is a React/Vite/TypeScript clinical education platform backed by Cloudflare Pages Functions, Clerk, Prisma/Postgres, Gemini, and an implicit FSRS scheduling pipeline.

## Architecture

- Frontend: React 19, Vite, TypeScript, Tailwind, Framer Motion.
- Production API: `functions/api/` Cloudflare Pages Functions.
- Local legacy API: `routes/` + `server.ts`; do not put production behavior here.
- Database: Prisma schema in `prisma/schema.prisma`.
- Auth: Clerk; backend auth/RBAC via shared endpoint middleware.
- State/data: hooks, Zustand/store, TanStack Query, SDK clients under `lib/sdk`.

## Current API Pattern

- Prefer `functions/api/_shared/endpoint.ts` `withEndpoint()` for new simple endpoints.
- Existing routes often use `authenticatedEndpoint`, `adminAuthenticatedEndpoint`, `aiEndpoint`, `publicEndpoint`, `cmsEndpoint`, or `refineryEndpoint` from `functions/api/_shared/middleware.ts`.
- Use shared schemas in `lib/api/schemas/*` when client and server share the contract.
- Use `handleCorsPreflightSecure` for `OPTIONS`; preflight must not require auth.
- Create Prisma with `createEdgePrismaClient(env.DATABASE_URL)` inside the handler and disconnect in `finally`.

## FSRS/Session Truth

- Canonical review writer: `lib/services/drillReviewService.ts`.
- Canonical endpoint: `/api/drills/submit-review`.
- Legacy adapter: `/api/srs/submit` delegates to the same service.
- `/api/questions/attempt` is attempt/seen/stat only; it is not the FSRS writer.
- `main`, `drill`, `targeted`, and missing `sessionType` are FSRS-eligible; `cram` and `rapid_recall` are not.
- Student-facing ratings are implicit/binary. Do not add Hard/Easy controls.

## Frontend Rules

- New app views generally require `config/lazyComponents.tsx` and `config/appViews.ts`.
- Use existing layout/UI primitives before creating new shells.
- Keep page files as orchestration; move reusable UI into `components/<area>/`.
- Do not import Prisma or server-only code into frontend.
- Use the `@/` alias when surrounding code does.

## Approval Boundary

Ask before migrations, destructive scripts, production deploys, production dependencies, env edits, auth/RLS architecture changes, or FSRS parameter/rating changes.

## Verification

- Targeted Vitest first.
- `npm run typecheck` for TS contracts.
- `npm test` for shared service/API work.
- `npm run build` for frontend/routing/import-risk changes.
- Playwright for real user flows, auth, PWA/offline, or responsive/browser behavior.
