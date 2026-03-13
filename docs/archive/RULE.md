# PANaCEa Cursor Rules

Project conventions for AI-assisted editing. Follow these when generating or modifying code.

## Autonomous behavior

Full permission for terminal (`npm`, `npx`, `wrangler`, `prisma`, `git`), server (wrangler/vite), and file ops. **Stop and ask** only before bulk paid-LLM operations (e.g. Gemini) that could incur significant cost. Details in `.cursor/rules/autonomous-behavior.mdc`.

## Project Roles

Start a prompt with **"ACT AS [ROLE]"** to adopt a persona. Roles and guidelines are in `.cursor/rules/project-roles.mdc`. Roles: **optimizer**, **api**, **dba**, **ui/ux**, **qa**, **debug**, **ask**. Agents may commit, push, migrate, and deploy; they must not wipe the DB or undermine the site’s main intentions.

## Stack & architecture
- **Stack:** React 19, TypeScript, Vite, Tailwind, Framer Motion. Backend: Cloudflare Pages Functions; Express (`server.ts`) is legacy/local only. DB: Postgres/Supabase via Prisma.
- **Flow:** UI → `services/*` → `functions/api/*` → Prisma Edge or Gemini → state. Database-first for content; avoid static JSON for medical/content data.
- **Functions:** Export `onRequestGet`/`onRequestPost(context)`. Use `authenticateRequest` and `createEdgePrismaClient(env.DATABASE_URL)`; disconnect in `finally`. For user-scoped DB reads/writes, resolve internal user id via `resolveUserId(prisma, auth.userId)` from `functions/api/_shared/user-resolver.ts` (auth.userId is Clerk ID; DB FKs use internal User.id).

## Lib locations (important)
- **`lib/`** (project root): Server/shared logic — db, auth, services, FSRS, utils, middleware. Used by API and shared code.
- **`src/lib/`**: Frontend-only — search, markdown, unifiedSearch. Do **not** put server code, Prisma, or Node-only APIs in `src/lib/`.

## Imports & patterns
- Use `@/` (repo root) or `@src/` (src/). Prefer named exports. Async for API calls.
- Never bundle Prisma or `lib/db.ts` / `lib/prisma.ts` in client code; use API routes or edge-safe clients.

## UI
- Clinical palette (slate text, blue accents), rounded-xl cards, Lucide icons, Framer Motion easeOut 0.2–0.3s.

## References
- `.github/copilot-instructions.md` — full Copilot/architect guide.
- `ORGANIZATION_SUMMARY.md` — folder structure and lib split.
- `docs/` — architecture, deployment, and implementation docs.
