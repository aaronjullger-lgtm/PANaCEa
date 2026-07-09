# Project Facts (durable)

Stable, verified facts about PANaCEa for fast agent onboarding. Keep concise; update only when a fact genuinely changes. No secrets, no PII, no logs. Format: `- <fact> (verified: YYYY-MM-DD)`.

## Stack
- Frontend: React 19 + Vite 6 + React Router 7 SPA — **not** Next.js (no `next/*`, no server components, no `app/` router). (2026-07-09)
- Styling/UI: TailwindCSS 3.4, Radix UI, Framer Motion / `motion`, Lucide, Recharts/Nivo, `three`. (2026-07-09)
- State/data: Zustand 5, TanStack Query 5, Zod 4. (2026-07-09)
- Backend (prod): Cloudflare Pages Functions (Edge) in `functions/api/`; Express `server.ts` is legacy/local only. (2026-07-09)
- DB: PostgreSQL (Supabase) via Prisma 7. Edge uses `DATABASE_URL` (`prisma://` Accelerate); CLI/scripts use `DIRECT_DATABASE_URL` (`postgres://`). (2026-07-09)
- Auth: Clerk. AI: Google Gemini. (2026-07-09)
- Package manager: npm (`package-lock.json`), Node 22. (2026-07-09)

## Commands (canonical)
- Verify ladder: `npm run typecheck` · `npm run lint` · `npm test` (or `npm run test:critical`) · `npm run build`. (2026-07-09)
- Frontend dev: `npm run dev` (port 3000). E2E: `npm run test:e2e` (needs `npx playwright install`). a11y: `npm run test:e2e:a11y`. (2026-07-09)
- DB (dev only): `npm run db:generate`, `npm run db:validate`, `npm run db:studio`. (2026-07-09)

## Layout
- `components/` (canonical UI, `@/components/...`), `src/` (frontend-only), `lib/` (server/shared, FSRS, services), `functions/api/` (Edge), `prisma/schema.prisma` (DB source of truth). Alias `@/*` → repo root. (2026-07-09)

## Source-of-truth docs
- `AGENTS.md`, `CLAUDE.md`, `APP_FUNCTIONALITY_PLAN.md`, `docs/cursor-automation-audit.md`, `docs/agent-workflow-orchestration.md`, `.cursor/rules/*.mdc`. (2026-07-09)
