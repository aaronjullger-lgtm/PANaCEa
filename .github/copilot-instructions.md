PANaCEa Copilot Guide (concise, ~20-50 lines)

- Stack: React 19 + TS + Vite + Tailwind/Framer Motion. Primary backend is Cloudflare Pages Functions; Express (`server.ts`) is legacy/local only. DB is Postgres/Supabase via Prisma.
- Architecture flow: UI components → `services/*` → `/functions/api/*` → Prisma Edge or Gemini proxy → response to state. Avoid importing static JSON for content (database-first).
- Serverless pattern: Functions export `onRequestGet/Post(context)`. Use `authenticateRequest` (`functions/api/_shared/auth.ts`) and `createEdgePrismaClient(env.DATABASE_URL)` (`_shared/prisma-edge.ts`); always disconnect in `finally`.
- Dev servers: `npm run dev` (Vite only, uses deployed Functions); `npm run dev:all` (Vite 3000 + legacy Express 3001); `npm run dev:wrangler` (Wrangler Pages dev with local Functions and bindings). Only use Express when testing legacy routes.
- Env vars required: `VITE_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, `CLERK_WEBHOOK_SECRET`, `GEMINI_API_KEY`, `DATABASE_URL`. Do not prefix secrets with `VITE_` except the publishable Clerk key.
- Data/registries: `conditionRegistry.ts` holds condition IDs/metadata; content lives in DB `MedicalContent` (JSONB). Frontend loads via `services/conditionDataLoader.ts`; questions pair `conditionId` with display `condition`.
- Auth: Clerk everywhere; webhook `functions/api/webhooks/clerk.ts` syncs users/roles and uses Turnstile. Admin checks are Prisma role-based; no Express middleware pattern on Functions.
- SRS/analytics: FSRS v5 in `lib/fsrs.ts`; session prefs and performance caches live in localStorage keys `panceai_*`.
- UI patterns: clinical palette (slate text, blue accents), rounded-xl cards, hover translate-x, Framer Motion `easeOut` 0.2-0.3s, Master-Detail layouts for analytics/conditions. Use Lucide icons. Example: `<div className="rounded-xl hover:translate-x-1 transition-transform duration-300 ease-out">`.
- Build/chunking: `vite.config.ts` sets manual chunks (`vendor-clerk`, `vendor-animation`, `data-*`, `drill-*`, `admin`); Prisma packages are externalized; production source maps hidden. PWA with aggressive SW updates, network-first vendor, cache-first data.
- Content pipeline (scripts/): `npm run generate:lab|clinical|basic-science-links`, media `npm run media:integrate|process-existing`, registry sync `npm run sync:all`, orchestrator `npm run orchestrate:full`, scheduled `npm run automation:*`.
- DB workflow: `npm run db:migrate:dev` to create/apply locally; `npm run db:migrate:deploy` or `npm run migrate:production` to apply; `npm run db:studio` to inspect. Supabase should use Transaction pooling.
- Testing: Vitest for unit tests (run `vitest`), Playwright for e2e (`playwright.config.ts` in e2e/). `npm run health-check` for content validation. Run both servers before manual end-to-end checks.
- Import patterns: Absolute imports with '@' (repo root) or '@src' (src/). Prefer named exports. Async functions for API calls.
- CSP: `public/_headers` contains strict allowlists (Clerk, Turnstile, Supabase, Gemini). Update before adding new origins.
- Common pitfalls: missing DB (empty content), forgetting `onRequest*` exports in Functions, skipping Svix verification on Clerk webhooks, bundling Prisma into client, or using static JSON fallbacks.
- Helpful references: `MASTER_DOCUMENTATION.md`, `CLOUDFLARE_FUNCTIONS_GUIDE.md`, `DATABASE_IMPLEMENTATION.md`, `HYBRID_CONTENT_ENGINE.md`, `ADMIN_CMS_IMPLEMENTATION.md`, `PRODUCTION_DEPLOYMENT_CHECKLIST.md`.
