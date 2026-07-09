# PANaCEa Stack Primer

What you must know before editing. Authoritative details: `.cursor/rules/project-context.mdc`, `architecture-boundaries.mdc`, `.cursor/memory/project-facts.md`.

## The stack (do not assume Next.js)
- React 19 + **Vite 6** + React Router 7 SPA. No `next/*`, no server components, no `app/` router.
- Tailwind 3.4 + Radix + Framer Motion/`motion`; Zustand 5 + TanStack Query 5 + Zod 4.
- Prod API: **Cloudflare Pages Functions** (Edge) in `functions/api/`. `server.ts`/`routes/` is legacy/local (and `routes/` is missing on `main`).
- DB: Prisma 7 + Supabase Postgres. Auth: Clerk. AI: Gemini. Package manager: **npm**, Node 22.

## Where code lives
- `components/` (canonical UI, import via `@/components/...`), `src/` (frontend-only), `lib/` (server/shared, FSRS, services), `functions/api/` (Edge), `prisma/schema.prisma` (DB truth). Alias `@/*` → repo root.

## Commands you'll actually run
- Verify: `npm run typecheck` · `npm run lint` · `npm test` (or `npm run test:critical`) · `npm run build`.
- Run UI: `npm run dev` (port 3000). `dev:all`/`dev:wrangler` are **broken on `main`**.

## Golden rules
- Confirm files/exports/routes exist before importing (some are missing on `main`).
- No Prisma/server imports in client code; no `process.env` in Edge (use `context.env`).
- Don't touch shared primitives, auth/RLS, or FSRS rating logic without approval.
- Verify before claiming success; browser evidence for UI.
